import type {
  AttributeKey,
  DayScheduleAnalysis,
  FreeWindow,
  PlayerState,
  QuestRank,
  QuestType,
  SkillNode,
  StatMap,
  TimetableBlock,
  TimetableBlockType,
} from './types.ts';

export type FlowPacingState =
  | 'FLOW_CHANNEL'
  | 'OVERLOAD_ANXIETY'
  | 'RECOVERY_NEEDED'
  | 'MOMENTUM_BUILDING';

export interface FlowPacingAnalysis {
  state: FlowPacingState;
  label: string;
  challengeSkillBalance: string;
  pacingDirective: string;
  recommendedMaxQuests: number;
  recommendedQuestMinutes: number;
}

const DAY_LABELS = [
  'Chủ Nhật (SUN)',
  'Thứ Hai (MON)',
  'Thứ Ba (TUE)',
  'Thứ Tư (WED)',
  'Thứ Năm (THU)',
  'Thứ Sáu (FRI)',
  'Thứ Bảy (SAT)',
];

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, Math.min(1440, h * 60 + m));
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(mins)));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Computes exact non-overlapping free cognitive windows for a given day of week.
 * Guarantees that sleep, meals, classes, work, fixed habits, rest buffers, and ad-hoc events
 * are strictly respected, and reserves >=20% of free time as breathing room.
 */
export function analyzeDaySchedule(
  allBlocks: TimetableBlock[],
  dayOfWeek: number,
  energyLevel = 80
): DayScheduleAnalysis {
  const dayBlocks = allBlocks
    .filter((b) => b.dayOfWeek === dayOfWeek)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  let totalSleepMinutes = 0;
  let totalBusyMinutes = 0;
  let totalRestBufferMinutes = 0;

  const occupiedIntervals: { start: number; end: number }[] = [];

  for (const block of dayBlocks) {
    const start = timeToMinutes(block.startTime);
    const end = Math.max(start, timeToMinutes(block.endTime));
    const dur = end - start;
    if (dur <= 0) continue;

    occupiedIntervals.push({ start, end });

    if (block.type === 'sleep') {
      totalSleepMinutes += dur;
    } else if (block.type === 'rest_buffer') {
      totalRestBufferMinutes += dur;
    } else {
      totalBusyMinutes += dur;
    }
  }

  // Merge overlapping occupied intervals
  occupiedIntervals.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const interval of occupiedIntervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  // Extract gaps >= 15 minutes
  const freeWindows: FreeWindow[] = [];
  let cursor = 0;

  const pushGap = (gapStart: number, gapEnd: number) => {
    const dur = gapEnd - gapStart;
    if (dur < 15) return;

    let windowQuality: FreeWindow['windowQuality'] = 'MICRO_SPRINT';
    if (dur >= 60) {
      windowQuality = 'DEEP_WORK_PRIME';
    } else if (dur >= 30) {
      windowQuality = 'STANDARD_FOCUS';
    }

    freeWindows.push({
      startTime: minutesToTime(gapStart),
      endTime: minutesToTime(gapEnd),
      durationMinutes: dur,
      windowQuality,
    });
  };

  for (const occ of merged) {
    if (occ.start > cursor) {
      pushGap(cursor, occ.start);
    }
    cursor = Math.max(cursor, occ.end);
  }
  if (cursor < 1440) {
    pushGap(cursor, 1440);
  }

  const totalFreeMinutes = freeWindows.reduce((acc, w) => acc + w.durationMinutes, 0);

  // Reserve at least 20% breathing room (more when energy is low)
  const bufferRatio = energyLevel <= 45 ? 0.45 : energyLevel <= 65 ? 0.3 : 0.22;
  const reservedBreathingMinutes = Math.round(totalFreeMinutes * bufferRatio);
  const rawQuestCapacity = Math.max(0, totalFreeMinutes - reservedBreathingMinutes);

  // Cap daily AI quest allocation so it never feels oppressive
  const maxDailyCap = energyLevel <= 45 ? 90 : energyLevel <= 70 ? 180 : 260;
  const recommendedQuestMinutes = Math.min(rawQuestCapacity, maxDailyCap);

  let overloadRisk: DayScheduleAnalysis['overloadRisk'] = 'LOW';
  if (totalSleepMinutes < 390 || totalFreeMinutes < 60) {
    overloadRisk = 'CRITICAL';
  } else if (totalBusyMinutes > 600 || totalFreeMinutes < 120) {
    overloadRisk = 'HIGH';
  } else if (totalBusyMinutes > 450) {
    overloadRisk = 'MODERATE';
  }

  const isFreeDayExpansion = totalFreeMinutes >= 240 && energyLevel >= 60;

  return {
    dayOfWeek,
    dayLabel: DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`,
    totalSleepMinutes,
    totalBusyMinutes,
    totalRestBufferMinutes,
    totalFreeMinutes,
    recommendedQuestMinutes,
    reservedBreathingMinutes,
    overloadRisk,
    isFreeDayExpansion,
    freeWindows,
    blocks: dayBlocks,
  };
}

export function analyzeFullWeek(
  allBlocks: TimetableBlock[],
  energyLevel = 80
): DayScheduleAnalysis[] {
  // Return Monday (1) through Sunday (0) order
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((day) => analyzeDaySchedule(allBlocks, day, energyLevel));
}

/**
 * Evaluates Csíkszentmihályi Flow State & Persona 5 Pacing from player vitality,
 * planned rest mode, schedule load, and recent execution momentum.
 */
export function analyzeFlowAndPacing(params: {
  player: Pick<PlayerState, 'energyLevel' | 'fatigue' | 'plannedRestMode' | 'streakDays'>;
  dayAnalysis: DayScheduleAnalysis;
  goalsCount: number;
  completionRate?: number;
  recentRejectionsCount?: number;
}): FlowPacingAnalysis {
  const {
    player,
    dayAnalysis,
    goalsCount,
    completionRate = 100,
    recentRejectionsCount = 0,
  } = params;

  if (
    player.plannedRestMode ||
    player.energyLevel <= 45 ||
    player.fatigue >= 70 ||
    dayAnalysis.overloadRisk === 'CRITICAL'
  ) {
    return {
      state: 'RECOVERY_NEEDED',
      label: player.plannedRestMode ? 'Grace Day / Planned Rest' : 'Burnout Shield Active',
      challengeSkillBalance: 'Năng lượng thấp hơn tải trọng — cần hạ tải để phục hồi kênh Flow.',
      pacingDirective: player.plannedRestMode
        ? 'Persona 5 "Take Your Time": Chế độ Nghỉ Chủ Động đang bật. Chỉ giữ tối đa 1–2 nhiệm vụ nhẹ nhàng để bảo vệ streak.'
        : 'Ưu tiên hồi phục sinh lực (NSDR, vận động nhẹ, ngủ sớm) trước khi quay lại Deep Work.',
      recommendedMaxQuests: 2,
      recommendedQuestMinutes: Math.min(dayAnalysis.recommendedQuestMinutes, player.plannedRestMode ? 45 : 60),
    };
  }

  if (
    dayAnalysis.overloadRisk === 'HIGH' ||
    recentRejectionsCount >= 2 ||
    (player.fatigue >= 55 && dayAnalysis.totalBusyMinutes >= 540) ||
    (goalsCount >= 4 && dayAnalysis.totalFreeMinutes < 150)
  ) {
    return {
      state: 'OVERLOAD_ANXIETY',
      label: 'Schedule Crunch / High Friction',
      challengeSkillBalance: 'Độ khó hoặc mật độ lịch vượt quá quỹ thời gian rảnh -> dễ sinh lo âu.',
      pacingDirective:
        'Chia nhỏ thử thách thành các phiên 25–30 phút và kích hoạt Atomic 2-Minute Start để giảm ma sát.',
      recommendedMaxQuests: 3,
      recommendedQuestMinutes: Math.min(dayAnalysis.recommendedQuestMinutes, 110),
    };
  }

  if (
    player.energyLevel >= 68 &&
    player.fatigue < 45 &&
    dayAnalysis.totalFreeMinutes >= 90 &&
    (completionRate >= 70 || player.streakDays >= 2)
  ) {
    return {
      state: 'FLOW_CHANNEL',
      label: 'Optimal Flow Channel',
      challengeSkillBalance: 'Kỹ năng & thử thách cân bằng trong các cửa sổ Deep Work rộng rãi.',
      pacingDirective:
        'Độ tập trung và sinh lực ở trạng thái tối ưu — cho phép triển khai Deep Work 45–60p và tổng hợp đầu ra sâu.',
      recommendedMaxQuests: dayAnalysis.isFreeDayExpansion ? 5 : 4,
      recommendedQuestMinutes: dayAnalysis.recommendedQuestMinutes,
    };
  }

  return {
    state: 'MOMENTUM_BUILDING',
    label: 'Momentum Building',
    challengeSkillBalance: 'Đang tích lũy đà tiến ổn định — ưu tiên chuỗi thắng nhỏ chắc chắn.',
    pacingDirective:
      'Persona 5 Daily Cadence: Chốt 1–2 thắng lợi rõ ràng hôm nay để mở rộng vùng Flow cho ngày mai.',
    recommendedMaxQuests: 3,
    recommendedQuestMinutes: Math.min(dayAnalysis.recommendedQuestMinutes, 150),
  };
}

/**
 * Deterministic slot allocator: fits a desired duration into an unused slice of freeWindows.
 */
export class SlotAllocator {
  private availableSlices: { start: number; end: number; quality: FreeWindow['windowQuality'] }[];

  constructor(freeWindows: FreeWindow[]) {
    this.availableSlices = freeWindows.map((w) => ({
      start: timeToMinutes(w.startTime),
      end: timeToMinutes(w.endTime),
      quality: w.windowQuality,
    }));
  }

  allocate(durationMinutes: number, preferDeepWork = false): string {
    const sortedIndices = this.availableSlices
      .map((s, idx) => ({ s, idx, len: s.end - s.start }))
      .filter((x) => x.len >= durationMinutes)
      .sort((a, b) => {
        if (preferDeepWork) {
          return b.len - a.len;
        }
        return a.s.start - b.s.start;
      });

    if (sortedIndices.length === 0) {
      // Fallback: pick largest slice even if slightly shorter, or Flexible
      const largest = this.availableSlices
        .map((s, idx) => ({ s, idx, len: s.end - s.start }))
        .sort((a, b) => b.len - a.len)[0];
      if (largest && largest.len >= 15) {
        const usedEnd = largest.s.start + Math.min(durationMinutes, largest.len);
        const slot = `${minutesToTime(largest.s.start)} - ${minutesToTime(usedEnd)}`;
        this.availableSlices[largest.idx].start = usedEnd + 10; // 10m transition buffer
        return slot;
      }
      return 'Flexible Window';
    }

    const chosen = sortedIndices[0];
    const start = chosen.s.start;
    const end = start + durationMinutes;
    const slot = `${minutesToTime(start)} - ${minutesToTime(end)}`;
    // Leave 10 minutes transition buffer after each quest
    this.availableSlices[chosen.idx].start = end + 10;
    return slot;
  }
}

function normalizeTimeToken(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/h/g, ':');
  const m = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  if (hh < 0 || hh > 24 || mm < 0 || mm > 59) return null;
  if (hh === 24 && mm === 0) return '23:59';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function extractDaysFromClause(clause: string): number[] {
  const lower = clause.toLowerCase();
  if (lower.includes('mỗi ngày') || lower.includes('hằng ngày') || lower.includes('cả tuần') || lower.includes('every day')) {
    return [1, 2, 3, 4, 5, 6, 0];
  }
  if (lower.includes('cuối tuần') || lower.includes('weekend')) {
    return [6, 0];
  }

  const days = new Set<number>();

  // Range like "thứ 2 - 6", "t2-t6", "thứ 2 đến thứ 6"
  const rangeMatch = lower.match(/(?:thứ\s*|t)\s*([2-7])\s*(?:-|đến|to)\s*(?:thứ\s*|t)?\s*([2-7])/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    for (let d = Math.min(a, b); d <= Math.max(a, b); d++) {
      days.add(d - 1); // Thứ 2 -> 1 ... Thứ 7 -> 6
    }
  }

  // Individual day mentions: "thứ 2, 4, 6" or "t3, t5, t7"
  const listMatch = lower.match(/(?:thứ|t)\s*([2-7](?:\s*[,/&]\s*(?:thứ\s*|t)?[2-7])*)/g);
  if (listMatch) {
    for (const seg of listMatch) {
      const nums = seg.match(/[2-7]/g);
      if (nums) {
        for (const n of nums) {
          days.add(Number(n) - 1);
        }
      }
    }
  }

  if (/\b(?:cn|chủ nhật|chu nhat|sunday|sun)\b/i.test(lower)) {
    days.add(0);
  }
  if (/\b(mon|monday)\b/i.test(lower)) days.add(1);
  if (/\b(tue|tuesday)\b/i.test(lower)) days.add(2);
  if (/\b(wed|wednesday)\b/i.test(lower)) days.add(3);
  if (/\b(thu|thursday)\b/i.test(lower)) days.add(4);
  if (/\b(fri|friday)\b/i.test(lower)) days.add(5);
  if (/\b(sat|saturday)\b/i.test(lower)) days.add(6);

  return days.size > 0 ? Array.from(days) : [1, 2, 3, 4, 5];
}

function inferBlockMeta(clause: string): {
  type: TimetableBlockType;
  energyCost: TimetableBlock['energyCost'];
  fallbackTitle: string;
} {
  const lower = clause.toLowerCase();
  if (lower.includes('ngủ') || lower.includes('sleep')) {
    return { type: 'sleep', energyCost: 'NONE', fallbackTitle: 'Giờ ngủ cố định' };
  }
  if (
    lower.includes('ngoại ngữ') ||
    lower.includes('english') ||
    lower.includes('language') ||
    lower.includes('workshop') ||
    lower.includes('seminar') ||
    lower.includes('kỹ năng')
  ) {
    return { type: 'class_work', energyCost: 'MEDIUM', fallbackTitle: 'Khối Rèn luyện Kỹ năng' };
  }
  if (
    lower.includes('lớp') ||
    lower.includes('học') ||
    lower.includes('làm việc') ||
    lower.includes('công ty') ||
    lower.includes('ca làm') ||
    lower.includes('studio') ||
    lower.includes('lab') ||
    lower.includes('class') ||
    lower.includes('work')
  ) {
    return { type: 'class_work', energyCost: 'HIGH', fallbackTitle: 'Khối Công việc / Học tập cố định' };
  }
  if (lower.includes('ăn') || lower.includes('cơm') || lower.includes('di chuyển') || lower.includes('xe')) {
    return { type: 'commute_meal', energyCost: 'NONE', fallbackTitle: 'Ăn uống / Di chuyển' };
  }
  if (lower.includes('gym') || lower.includes('tập') || lower.includes('chạy') || lower.includes('workout')) {
    return { type: 'fixed_habit', energyCost: 'MEDIUM', fallbackTitle: 'Tập luyện thể chất' };
  }
  if (lower.includes('nghỉ') || lower.includes('thư giãn') || lower.includes('rest')) {
    return { type: 'rest_buffer', energyCost: 'NONE', fallbackTitle: 'Thời gian nghỉ ngơi' };
  }
  return { type: 'fixed_habit', energyCost: 'MEDIUM', fallbackTitle: 'Hoạt động cố định' };
}

/**
 * Deterministic Vietnamese/English natural language timetable parser.
 * Supports lines or semicolon-separated clauses, e.g.:
 * "Thứ 2-6 làm việc/học tập 08:00-12:00; Tối thứ 3, 5, 7 lớp kỹ năng 19:00-21:00; Ngủ 23:00-06:30"
 */
export function parseNaturalLanguageTimetable(rawText: string): Omit<TimetableBlock, 'id'>[] {
  const clauses = rawText
    .split(/[\n;]+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const results: Omit<TimetableBlock, 'id'>[] = [];

  for (const clause of clauses) {
    // Match time range like 07:30-11:30 or 7h30 - 11h30 or 18:30 đến 21:00
    const timeMatch = clause.match(
      /(\d{1,2}(?:[:h]\d{1,2})?)\s*(?:-|–|to|đến)\s*(\d{1,2}(?:[:h]\d{1,2})?)/i
    );
    if (!timeMatch) continue;

    const startTime = normalizeTimeToken(timeMatch[1]);
    const endTime = normalizeTimeToken(timeMatch[2]);
    if (!startTime || !endTime) continue;

    const days = extractDaysFromClause(clause);
    const meta = inferBlockMeta(clause);

    // Build clean title from clause by stripping raw time & day prefixes if possible
    const cleanClause = clause
      .replace(timeMatch[0], '')
      .replace(/\b(mỗi ngày|hằng ngày|cả tuần|từ)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const title =
      cleanClause.length >= 4 && cleanClause.length <= 64
        ? cleanClause.charAt(0).toUpperCase() + cleanClause.slice(1)
        : meta.fallbackTitle;

    // Handle overnight sleep split (e.g. 23:30 - 06:30 -> 23:30-23:59 + 00:00-06:30)
    if (startTime > endTime) {
      for (const day of days) {
        results.push({
          dayOfWeek: day,
          startTime,
          endTime: '23:59',
          title,
          type: meta.type,
          energyCost: meta.energyCost,
          isRecurring: true,
        });
        results.push({
          dayOfWeek: (day + 1) % 7,
          startTime: '00:00',
          endTime,
          title,
          type: meta.type,
          energyCost: meta.energyCost,
          isRecurring: true,
        });
      }
    } else {
      for (const day of days) {
        results.push({
          dayOfWeek: day,
          startTime,
          endTime,
          title,
          type: meta.type,
          energyCost: meta.energyCost,
          isRecurring: true,
        });
      }
    }
  }

  return results;
}

const RANK_REWARD_MULT: Record<QuestRank, number> = {
  E: 0.85,
  D: 1.0,
  C: 1.15,
  B: 1.35,
  A: 1.6,
  S: 1.9,
};

const TYPE_REWARD_MULT: Record<QuestType, number> = {
  recovery: 0.8,
  side: 0.95,
  daily: 1.0,
  main: 1.25,
  hidden: 1.35,
  emergency: 1.25,
};

export function computeBalancedQuestRewards(params: {
  durationMinutes: number;
  rank: QuestRank;
  type: QuestType;
  requiresProof: boolean;
  primaryStat: AttributeKey;
  secondaryStat?: AttributeKey;
}): {
  xpReward: number;
  goldReward: number;
  masteryReward: number;
  spReward: number;
  statRewards: Partial<StatMap>;
} {
  const dur = Math.max(5, Math.min(360, Math.round(params.durationMinutes || 25)));
  const eff = dur <= 90 ? dur : 90 + (dur - 90) * 0.5;
  const rankMult = RANK_REWARD_MULT[params.rank] ?? 1.0;
  const typeMult = TYPE_REWARD_MULT[params.type] ?? 1.0;

  const xpReward = Math.max(15, Math.round(eff * 1.9 * rankMult * typeMult));
  const goldReward = Math.max(10, Math.round(eff * 1.15 * rankMult * typeMult));
  const masteryReward = Math.max(
    4,
    Math.round((params.requiresProof ? 18 : 6) * rankMult * (eff >= 45 ? 1.2 : 1.0))
  );
  const spReward =
    params.type === 'main' || params.type === 'hidden' || params.rank === 'A' || params.rank === 'S'
      ? 2
      : 1;

  const statRewards: Partial<StatMap> = {
    [params.primaryStat]: dur >= 45 ? 2 : 1,
  };
  if (params.secondaryStat && params.secondaryStat !== params.primaryStat) {
    statRewards[params.secondaryStat] = 1;
  }

  return { xpReward, goldReward, masteryReward, spReward, statRewards };
}

export function inferSkillIdForTask(
  title: string,
  description: string | undefined,
  primaryStat: AttributeKey,
  skills: SkillNode[]
): string | undefined {
  if (!skills || skills.length === 0) return undefined;
  const text = `${title} ${description || ''}`.toLowerCase();

  let candidateId: string | undefined;
  if (/(gym|chạy|tập thể dục|workout|cardio|hít đất|chống đẩy|thể lực|bơi|đá bóng|cầu lông|yoga|stretch)/.test(text)) {
    candidateId = 'sk-vit-2l';
  } else if (/(ngủ|sleep|giấc ngủ|ngủ sớm|wake up|thức dậy)/.test(text)) {
    candidateId = 'sk-vit-1';
  } else if (/(thiền|nsdr|meditat|thở|hồi phục|nghỉ|nhắm mắt|đi bộ|walk)/.test(text)) {
    candidateId = 'sk-vit-2r';
  } else if (/(ielts|ngoại ngữ|tiếng anh|từ vựng|vocab|anki|flashcard|ôn tập|spaced|retrieval|listening|speaking)/.test(text)) {
    candidateId = 'sk-knw-2l';
  } else if (/(đọc|sách|read|book|study|học bài|ghi chú|note|feynman|tóm tắt|research|nghiên cứu)/.test(text)) {
    candidateId = 'sk-knw-1';
  } else if (/(timebox|lịch|plan|kế hoạch|sắp xếp|schedule)/.test(text)) {
    candidateId = 'sk-exe-2l';
  } else if (/(deep work|ultradian|focus|tập trung|pomodoro|viết báo cáo|dự án|project)/.test(text)) {
    candidateId = 'sk-exe-3';
  } else if (/(2 phút|khởi động|dọn|email|trả lời|thói quen|habit)/.test(text)) {
    candidateId = 'sk-exe-1';
  } else if (/(thuyết trình|present|pitch|demo|slide|họp nhóm|meeting|lãnh đạo|lead)/.test(text)) {
    candidateId = 'sk-inf-2r';
  } else if (/(giao tiếp|nhóm|bạn|gia đình|gọi điện|network|team|mentor|chia sẻ)/.test(text)) {
    candidateId = 'sk-inf-1';
  } else if (/(debug|fix bug|lỗi|dsa|leetcode|thuật toán|giải đề|giải bài|problem|bài tập)/.test(text)) {
    candidateId = 'sk-int-2r';
  } else if (/(phân tích|data|sql|báo cáo|excel|tính toán|toán)/.test(text)) {
    candidateId = 'sk-int-2l';
  } else if (/(code|lập trình|dev|ai|llm|api|system|kiến trúc|design|tư duy)/.test(text)) {
    candidateId = 'sk-int-1';
  }

  if (candidateId) {
    const matched = skills.find((s) => s.id === candidateId);
    if (matched) return matched.id;
  }

  return skills.find((s) => s.primaryStat === primaryStat)?.id || skills[0]?.id;
}

