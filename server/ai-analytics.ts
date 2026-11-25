import crypto from 'node:crypto';
import { db } from './db.ts';
import {
  analyzeDaySchedule,
  computeBalancedQuestRewards,
  inferSkillIdForTask,
  minutesToTime,
  timeToMinutes,
} from './scheduler.ts';
import { VN_TIMEZONE, getVnDayOfWeek, getVnTodayKey } from './time-vn.ts';
import type {
  AISettings,
  ActivityCategory,
  ActivityLogEntry,
  AppUsageRankItem,
  AttributeKey,
  DailyFocusTrendPoint,
  DailyProgressSnapshot,
  Goal,
  HeatmapDayCell,
  LongTermAnalyticsPayload,
  PlayerState,
  Quest,
  QuestRank,
  QuestType,
  SkillNode,
  StatGrowthBalanceItem,
  TimetableBlock,
  TimetableBlockType,
  WeeklyBlueprintBlockDraft,
  WeeklyBlueprintDraft,
  WeeklyGrade,
  WeeklyReviewDiagnosis,
  WeeklyReviewRecord,
} from './types.ts';

interface LlmChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const STAT_KEYS: AttributeKey[] = ['INT', 'PER', 'STR', 'VIT', 'AGI', 'CHA'];

const VALID_BLOCK_TYPES: TimetableBlockType[] = [
  'sleep',
  'class_work',
  'commute_meal',
  'fixed_habit',
  'rest_buffer',
  'adhoc_event',
];

const VALID_ENERGY_COSTS: Array<TimetableBlock['energyCost']> = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

const SECONDARY_STAT_PAIR: Record<AttributeKey, AttributeKey> = {
  INT: 'AGI',
  PER: 'INT',
  AGI: 'PER',
  STR: 'VIT',
  VIT: 'AGI',
  CHA: 'PER',
};

const STAT_VI_LABELS: Record<AttributeKey, string> = {
  INT: 'Trí tuệ & Phân tích (INT)',
  PER: 'Nhận thức & Học sâu (PER)',
  STR: 'Thể lực & Sức bền (STR)',
  VIT: 'Sinh lực & Phục hồi (VIT)',
  AGI: 'Kỷ luật & Tốc độ thực thi (AGI)',
  CHA: 'Giao tiếp & Ảnh hưởng (CHA)',
};

const DAY_LABELS: Record<number, string> = {
  0: 'Chủ Nhật (SUN)',
  1: 'Thứ Hai (MON)',
  2: 'Thứ Ba (TUE)',
  3: 'Thứ Tư (WED)',
  4: 'Thứ Năm (THU)',
  5: 'Thứ Sáu (FRI)',
  6: 'Thứ Bảy (SAT)',
};

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const AWAKE_START_MIN = 7 * 60; // 07:00
const AWAKE_END_MIN = 23 * 60 + 30; // 23:30

const vnHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: VN_TIMEZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function getVnHourFromTimestamp(ms: number): number {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 12;
  const h = Number(vnHourFormatter.format(d));
  return h === 24 ? 0 : Math.max(0, Math.min(23, h));
}

function buildVnDateKeys(days: number, endDateKey: string = getVnTodayKey()): string[] {
  const anchor = new Date(`${endDateKey}T12:00:00+07:00`);
  const baseMs = Number.isNaN(anchor.getTime()) ? Date.now() : anchor.getTime();
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(getVnTodayKey(new Date(baseMs - offset * 86_400_000)));
  }
  return keys;
}

function formatDateLabel(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}`;
}

function formatHourWindow(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const next = (h + 1) % 24;
  return `${String(h).padStart(2, '0')}:00–${String(next).padStart(2, '0')}:00`;
}

function parseStartHourFromWindow(windowStr: string | null | undefined): number | null {
  if (!windowStr) return null;
  const match = windowStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  if (Number.isNaN(h) || h < 0 || h > 23) return null;
  return h;
}

function isValidHHmm(raw: string | undefined): raw is string {
  if (!raw || typeof raw !== 'string') return false;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

function hasTimeOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function inferStatFromText(text: string): AttributeKey {
  const lower = text.toLowerCase();
  if (/(giao tiếp|thuyết trình|lãnh đạo|đàm phán|networking|team|mentor|chia sẻ|charisma|họp|kết nối)/.test(lower)) {
    return 'CHA';
  }
  if (/(gym|chạy|thể lực|sức mạnh|workout|thể thao|chống đẩy|cardio|strength|fitness|bơi|cầu lông)/.test(lower)) {
    return 'STR';
  }
  if (/(ngủ|hồi phục|nghỉ|sức khỏe|thiền|nsdr|stress|sleep|vitality|recovery|đi bộ|yoga|stretch)/.test(lower)) {
    return 'VIT';
  }
  if (/(tốc độ|thói quen|kỷ luật|timebox|năng suất|sprint|backlog|execution|agility|dọn)/.test(lower)) {
    return 'AGI';
  }
  if (/(ngôn ngữ|ngoại ngữ|ielts|toeic|tiếng anh|đọc|sách|nghiên cứu|tổng hợp|recall|feynman|writing|speaking|research)/.test(lower)) {
    return 'PER';
  }
  return 'INT';
}

function resolveGoalStat(goal: Goal): AttributeKey {
  if (goal.category === 'Health & Vitality') {
    return inferStatFromText(`${goal.title} ${goal.rawInput}`) === 'VIT' ? 'VIT' : 'STR';
  }
  if (goal.category === 'Language & IELTS' || goal.category === 'Research & Academic') {
    return 'PER';
  }
  return inferStatFromText(`${goal.title} ${goal.rawInput}`);
}

function isLlmConfigured(settings: AISettings): boolean {
  if (!settings.useLiveLlm || !settings.baseUrl?.trim()) return false;
  if (settings.apiKey?.trim()) return true;
  return /localhost|127\.0\.0\.1/i.test(settings.baseUrl);
}

async function callOpenAICompatible(
  settings: AISettings,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  if (!isLlmConfigured(settings)) return null;

  const cleanBase = settings.baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        temperature: settings.temperature ?? 0.35,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as LlmChatResponse;
    return data.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonBlock<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as T;
      } catch {
        // continue to brace extraction
      }
    }
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function distributeLogSecondsByVnHour(log: ActivityLogEntry, hourlyMap: Map<number, number>): void {
  const totalSec = Math.max(0, Math.round(log.durationSeconds || 0));
  if (totalSec <= 0) return;

  const startMs = Date.parse(log.startedAt);
  if (Number.isNaN(startMs)) {
    const fallbackHour = 12;
    hourlyMap.set(fallbackHour, (hourlyMap.get(fallbackHour) || 0) + totalSec);
    return;
  }

  // Split across hour boundaries for long coalesced blocks (bounded to 24 chunks)
  let remainingSec = totalSec;
  let cursorMs = startMs;
  for (let step = 0; step < 24 && remainingSec > 0; step += 1) {
    const hour = getVnHourFromTimestamp(cursorMs);
    const msIntoHour = ((cursorMs + 7 * 3600_000) % 3600_000 + 3600_000) % 3600_000;
    const secLeftInHour = Math.max(1, Math.ceil((3600_000 - msIntoHour) / 1000));
    const sliceSec = Math.min(remainingSec, secLeftInHour);
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + sliceSec);
    remainingSec -= sliceSec;
    cursorMs += sliceSec * 1000;
  }
}

function computeHeatmapIntensity(focusMinutes: number, questsCompleted: number): 0 | 1 | 2 | 3 | 4 {
  if (focusMinutes <= 0 && questsCompleted <= 0) return 0;
  if (focusMinutes >= 240) return 4;
  if (focusMinutes >= 120) return 3;
  if (focusMinutes >= 45 || questsCompleted >= 3) return 2;
  return 1;
}

function computeWeeklyGrade(params: {
  rangeDays: number;
  avgFocusScore: number;
  completionRatePct: number;
  questsTotal: number;
  totalFocusMinutes: number;
  totalDistractionMinutes: number;
}): WeeklyGrade {
  const {
    rangeDays,
    avgFocusScore,
    completionRatePct,
    questsTotal,
    totalFocusMinutes,
    totalDistractionMinutes,
  } = params;

  if (totalFocusMinutes <= 0 && questsTotal === 0) {
    return 'D';
  }

  const focusHoursPerWeek = (totalFocusMinutes / 60) * (7 / Math.max(1, rangeDays));
  const focusScorePart = (Math.max(0, Math.min(100, avgFocusScore)) / 100) * 40;
  const completionPart =
    questsTotal > 0
      ? (Math.max(0, Math.min(100, completionRatePct)) / 100) * 30
      : (Math.max(0, Math.min(100, avgFocusScore)) / 100) * 22;
  const volumePart = Math.min(1, focusHoursPerWeek / 18) * 30;

  let distractionPenalty = 0;
  if (totalDistractionMinutes >= 120 && totalDistractionMinutes > totalFocusMinutes) {
    const excessRatio = Math.min(1, (totalDistractionMinutes - totalFocusMinutes) / Math.max(120, totalFocusMinutes || 120));
    distractionPenalty = excessRatio * 8;
  }

  const composite = focusScorePart + completionPart + volumePart - distractionPenalty;
  if (composite >= 86) return 'S';
  if (composite >= 74) return 'A';
  if (composite >= 58) return 'B';
  if (composite >= 40) return 'C';
  return 'D';
}

function computeStatBalance(player: PlayerState): {
  statBalance: StatGrowthBalanceItem[];
  weakestStats: AttributeKey[];
} {
  const values = STAT_KEYS.map((stat) => ({
    stat,
    currentValue: Math.max(0, Number(player.stats?.[stat]) || 0),
  }));
  const total = values.reduce((acc, item) => acc + item.currentValue, 0);
  const mean = total / STAT_KEYS.length;

  const statBalance: StatGrowthBalanceItem[] = values.map(({ stat, currentValue }) => {
    const sharePct = total > 0 ? Math.round((currentValue / total) * 100) : Math.round(100 / STAT_KEYS.length);
    let status: StatGrowthBalanceItem['status'] = 'balanced';
    if (mean > 0) {
      const ratio = currentValue / mean;
      if (ratio >= 1.1) {
        status = 'strong';
      } else if (ratio <= 0.9) {
        status = 'lagging';
      }
    }
    return { stat, currentValue, sharePct, status };
  });

  const weakestStats = [...values]
    .sort((a, b) => a.currentValue - b.currentValue)
    .slice(0, 2)
    .map((item) => item.stat);

  return { statBalance, weakestStats };
}

/**
 * 1. Computes comprehensive 7-day or 30-day long-term telemetry, 30d heatmap,
 * empirical peak focus hour (0..23), top helpful/draining apps, stat balance, and WeeklyGrade.
 */
export function computeLongTermReview(range: '7d' | '30d' = '7d'): LongTermAnalyticsPayload {
  const normalizedRange: '7d' | '30d' = range === '30d' ? '30d' : '7d';
  const rangeDays = normalizedRange === '30d' ? 30 : 7;
  const todayKey = getVnTodayKey();
  const keys30 = buildVnDateKeys(30, todayKey);
  const startDate30 = keys30[0];
  const endDate = keys30[keys30.length - 1];
  const rangeKeys = keys30.slice(keys30.length - rangeDays);
  const startDate = rangeKeys[0];
  const rangeKeySet = new Set(rangeKeys);

  const logs30 = db.getActivityLogsRange(startDate30, endDate);
  const snapshots30 = db.getDailyProgressRange(30);
  const questsAll = db.getQuests();
  const player = db.getPlayer();

  const snapshotByDate = new Map<string, DailyProgressSnapshot>();
  for (const snap of snapshots30) {
    snapshotByDate.set(snap.dateKey, snap);
  }

  const questCountsByDate = new Map<string, { completed: number; total: number }>();
  for (const q of questsAll) {
    const entry = questCountsByDate.get(q.dateKey) || { completed: 0, total: 0 };
    entry.total += 1;
    if (q.status === 'completed') {
      entry.completed += 1;
    }
    questCountsByDate.set(q.dateKey, entry);
  }

  interface DayAccumulator {
    deepSec: number;
    studySec: number;
    commSec: number;
    distractionSec: number;
    otherSec: number;
    idleSec: number;
  }

  const activityByDate = new Map<string, DayAccumulator>();
  for (const key of keys30) {
    activityByDate.set(key, {
      deepSec: 0,
      studySec: 0,
      commSec: 0,
      distractionSec: 0,
      otherSec: 0,
      idleSec: 0,
    });
  }

  // Range-scoped aggregates for empirical peak hour & top helpful/draining apps
  const focusSecByHour = new Map<number, number>();
  const helpfulAppsMap = new Map<
    string,
    { processName: string; deepSec: number; studySec: number }
  >();
  const drainingAppsMap = new Map<string, { processName: string; seconds: number }>();

  for (const log of logs30) {
    const sec = Math.max(0, Math.round(log.durationSeconds || 0));
    if (sec <= 0) continue;

    const dayAcc = activityByDate.get(log.dateKey);
    if (dayAcc) {
      switch (log.category) {
        case 'deep_work':
          dayAcc.deepSec += sec;
          break;
        case 'study_research':
          dayAcc.studySec += sec;
          break;
        case 'communication':
          dayAcc.commSec += sec;
          break;
        case 'distraction':
          dayAcc.distractionSec += sec;
          break;
        case 'idle':
          dayAcc.idleSec += sec;
          break;
        default:
          dayAcc.otherSec += sec;
          break;
      }
    }

    if (rangeKeySet.has(log.dateKey)) {
      const procDisplay = (log.processName || 'Unknown').trim() || 'Unknown';
      const procKey = procDisplay.toLowerCase();

      if (log.category === 'deep_work' || log.category === 'study_research') {
        distributeLogSecondsByVnHour(log, focusSecByHour);
        const existing = helpfulAppsMap.get(procKey) || {
          processName: procDisplay,
          deepSec: 0,
          studySec: 0,
        };
        if (log.category === 'deep_work') {
          existing.deepSec += sec;
        } else {
          existing.studySec += sec;
        }
        helpfulAppsMap.set(procKey, existing);
      } else if (log.category === 'distraction') {
        const existing = drainingAppsMap.get(procKey) || {
          processName: procDisplay,
          seconds: 0,
        };
        existing.seconds += sec;
        drainingAppsMap.set(procKey, existing);
      }
    }
  }

  const heatmap30d: HeatmapDayCell[] = [];
  const dailyTrend: DailyFocusTrendPoint[] = [];

  let totalDeepWorkMinutes = 0;
  let totalStudyMinutes = 0;
  let totalFocusMinutes = 0;
  let totalDistractionMinutes = 0;
  let questsCompleted = 0;
  let questsTotal = 0;
  const activeDayFocusScores: number[] = [];

  for (const dateKey of keys30) {
    const acc = activityByDate.get(dateKey)!;
    const snap = snapshotByDate.get(dateKey);
    const qCount = questCountsByDate.get(dateKey) || { completed: 0, total: 0 };

    const activeSec = acc.deepSec + acc.studySec + acc.commSec + acc.distractionSec + acc.otherSec;
    const logDeepMins = Math.round(acc.deepSec / 60);
    const logStudyMins = Math.round(acc.studySec / 60);
    const distractionMins = Math.round(acc.distractionSec / 60);
    const snapFocusMins = Math.max(0, Math.round(snap?.focusMinutes ?? 0));

    // When no PC logs exist for a day, honor quest focus minutes from daily_snapshots
    const deepWorkMins = logDeepMins === 0 && logStudyMins === 0 && snapFocusMins > 0 ? snapFocusMins : logDeepMins;
    const studyMins = logStudyMins;
    const dayFocusMins = Math.max(deepWorkMins + studyMins, snapFocusMins);

    const dayQuestsCompleted = Math.max(qCount.completed, Math.max(0, Math.round(snap?.questsCompleted ?? 0)));
    const dayQuestsTotal = Math.max(dayQuestsCompleted, qCount.total);

    let dayFocusScore = 0;
    if (activeSec > 0) {
      dayFocusScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((acc.deepSec * 1.0 + acc.studySec * 0.95 + acc.commSec * 0.55 + acc.otherSec * 0.4) /
              activeSec) *
              100
          )
        )
      );
    } else if (dayFocusMins > 0 || dayQuestsCompleted > 0) {
      dayFocusScore = 85;
    }

    heatmap30d.push({
      dateKey,
      focusMinutes: dayFocusMins,
      distractionMinutes: distractionMins,
      questsCompleted: dayQuestsCompleted,
      focusScore: dayFocusScore,
      intensity: computeHeatmapIntensity(dayFocusMins, dayQuestsCompleted),
    });

    if (rangeKeySet.has(dateKey)) {
      dailyTrend.push({
        dateKey,
        label: formatDateLabel(dateKey),
        deepWorkMinutes: deepWorkMins,
        studyMinutes: studyMins,
        distractionMinutes: distractionMins,
        questsCompleted: dayQuestsCompleted,
        focusScore: dayFocusScore,
      });

      totalDeepWorkMinutes += deepWorkMins;
      totalStudyMinutes += studyMins;
      totalFocusMinutes += dayFocusMins;
      totalDistractionMinutes += distractionMins;
      questsCompleted += dayQuestsCompleted;
      questsTotal += dayQuestsTotal;

      if (activeSec > 0 || dayFocusMins > 0 || dayQuestsCompleted > 0) {
        activeDayFocusScores.push(dayFocusScore);
      }
    }
  }

  const avgFocusScore =
    activeDayFocusScores.length > 0
      ? Math.round(activeDayFocusScores.reduce((sum, v) => sum + v, 0) / activeDayFocusScores.length)
      : 0;

  const completionRatePct =
    questsTotal > 0 ? Math.min(100, Math.round((questsCompleted / questsTotal) * 100)) : 0;

  // Empirical peak focus hour across all 0..23 VN hours
  let bestHour: number | null = null;
  let bestHourSec = 0;
  for (let h = 0; h <= 23; h += 1) {
    const sec = focusSecByHour.get(h) || 0;
    if (sec > bestHourSec) {
      bestHourSec = sec;
      bestHour = h;
    }
  }
  const empiricalPeakHour = bestHour !== null && bestHourSec >= 300 ? formatHourWindow(bestHour) : null;

  const topHelpfulApps: AppUsageRankItem[] = Array.from(helpfulAppsMap.values())
    .map((item) => {
      const totalSec = item.deepSec + item.studySec;
      const category: ActivityCategory = item.studySec > item.deepSec ? 'study_research' : 'deep_work';
      return {
        processName: item.processName,
        category,
        seconds: totalSec,
      };
    })
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)
    .map((item) => ({
      processName: item.processName,
      category: item.category,
      minutes: Math.max(1, Math.round(item.seconds / 60)),
    }));

  const topDrainingApps: AppUsageRankItem[] = Array.from(drainingAppsMap.values())
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)
    .map((item) => ({
      processName: item.processName,
      category: 'distraction' as const,
      minutes: Math.max(1, Math.round(item.seconds / 60)),
    }));

  const { statBalance, weakestStats } = computeStatBalance(player);

  const grade = computeWeeklyGrade({
    rangeDays,
    avgFocusScore,
    completionRatePct,
    questsTotal,
    totalFocusMinutes,
    totalDistractionMinutes,
  });

  return {
    range: normalizedRange,
    startDate,
    endDate,
    totalFocusMinutes,
    totalDeepWorkMinutes,
    totalStudyMinutes,
    totalDistractionMinutes,
    avgFocusScore,
    questsCompleted,
    questsTotal,
    completionRatePct,
    empiricalPeakHour,
    grade,
    heatmap30d,
    dailyTrend,
    topHelpfulApps,
    topDrainingApps,
    statBalance,
    weakestStats,
  };
}

function buildRecommendedFocusWindow(
  empiricalPeakHour: string | null,
  profilePeakHours?: string
): string {
  const startH = parseStartHourFromWindow(empiricalPeakHour);
  if (startH !== null) {
    const endMin = Math.min(AWAKE_END_MIN, startH * 60 + 90);
    return `${minutesToTime(startH * 60)}–${minutesToTime(endMin)} (khung 90p Ultradian quanh giờ vàng ${empiricalPeakHour})`;
  }
  if (profilePeakHours?.trim()) {
    return `${profilePeakHours.trim()} (theo hồ sơ cá nhân — tiếp tục thu thập telemetry để chuẩn hóa)`;
  }
  return '09:00–10:30 (khung Deep Work sáng chuẩn 90 phút)';
}

function buildHeuristicDiagnosis(
  analytics: LongTermAnalyticsPayload,
  player: PlayerState,
  goals: Goal[]
): WeeklyReviewDiagnosis {
  const rangeLabel = analytics.range === '30d' ? '30 ngày qua' : '7 ngày qua';
  const focusHours = (analytics.totalFocusMinutes / 60).toFixed(1);
  const distractionHours = (analytics.totalDistractionMinutes / 60).toFixed(1);
  const activeDays = analytics.dailyTrend.filter(
    (d) => d.deepWorkMinutes + d.studyMinutes > 0 || d.questsCompleted > 0
  ).length;

  const bestDay = [...analytics.dailyTrend].sort(
    (a, b) => b.deepWorkMinutes + b.studyMinutes - (a.deepWorkMinutes + a.studyMinutes)
  )[0];
  const strongestStat = [...analytics.statBalance].sort((a, b) => b.currentValue - a.currentValue)[0];
  const primaryGoal = [...goals].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2) || a.progress - b.progress;
  })[0];

  const topHelpful = analytics.topHelpfulApps[0];
  const secondHelpful = analytics.topHelpfulApps[1];
  const topDrain = analytics.topDrainingApps[0];
  const secondDrain = analytics.topDrainingApps[1];

  const headline =
    analytics.totalFocusMinutes > 0 || analytics.questsCompleted > 0
      ? `Hạng ${analytics.grade} trong ${rangeLabel}: đạt ${focusHours}h tập trung (${analytics.avgFocusScore}% Focus Score) và hoàn thành ${analytics.questsCompleted}/${analytics.questsTotal} nhiệm vụ (${analytics.completionRatePct}%).`
      : `Hạng ${analytics.grade} trong ${rangeLabel}: chưa có đủ dữ liệu tập trung thực tế — cần kích hoạt nhịp Deep Work đầu tiên để tạo đường cơ sở.`;

  const strengths: string[] = [
    topHelpful
      ? `Động cơ đầu ra rõ ràng qua ${topHelpful.processName} (${topHelpful.minutes}p)${secondHelpful ? ` và ${secondHelpful.processName} (${secondHelpful.minutes}p)` : ''}, tạo tổng ${analytics.totalDeepWorkMinutes}p Deep Work + ${analytics.totalStudyMinutes}p Học sâu.`
      : `Duy trì ${activeDays}/${analytics.dailyTrend.length} ngày có hoạt động rèn luyện${analytics.questsCompleted > 0 ? ` với ${analytics.questsCompleted} nhiệm vụ hoàn thành` : ''}.`,
    analytics.empiricalPeakHour
      ? `Xác định được giờ vàng sinh học thực tế tại ${analytics.empiricalPeakHour}${bestDay && bestDay.deepWorkMinutes + bestDay.studyMinutes > 0 ? ` (đỉnh điểm ngày ${bestDay.label}: ${bestDay.deepWorkMinutes + bestDay.studyMinutes}p tập trung)` : ''}.`
      : bestDay && bestDay.deepWorkMinutes + bestDay.studyMinutes > 0
        ? `Ngày tập trung tốt nhất là ${bestDay.label} với ${bestDay.deepWorkMinutes + bestDay.studyMinutes}p đầu ra và Focus Score ${bestDay.focusScore}%.`
        : `Nền tảng kỷ luật đang sẵn sàng — chỉ số cao nhất hiện tại là ${strongestStat.stat} (${strongestStat.currentValue} điểm).`,
    analytics.completionRatePct >= 70
      ? `Tỷ lệ chốt nhiệm vụ đạt ${analytics.completionRatePct}% (${analytics.questsCompleted}/${analytics.questsTotal}), củng cố thế mạnh ở chỉ số ${strongestStat.stat} (${strongestStat.currentValue} điểm, chiếm ${strongestStat.sharePct}%).`
      : `Chỉ số mũi nhọn ${strongestStat.stat} (${strongestStat.currentValue} điểm) đang dẫn dắt đà tăng trưởng${player.streakDays > 0 ? ` cùng chuỗi ${player.streakDays} ngày liên tiếp` : ''}.`,
  ];

  const missedQuests = Math.max(0, analytics.questsTotal - analytics.questsCompleted);
  const weakPairText = analytics.weakestStats.join(' & ');
  const quietDays = analytics.dailyTrend.length - activeDays;

  const bottlenecks: string[] = [
    topDrain
      ? `Rò rỉ tập trung ${analytics.totalDistractionMinutes}p (${distractionHours}h), chủ yếu do ${topDrain.processName} (${topDrain.minutes}p)${secondDrain ? ` và ${secondDrain.processName} (${secondDrain.minutes}p)` : ''}.`
      : analytics.totalFocusMinutes < 180
        ? `Tổng thời lượng Deep Work còn mỏng (${analytics.totalFocusMinutes}p trong ${rangeLabel}), chưa đủ để kích hoạt hiệu ứng tích lũy kỹ năng.`
        : `Chưa ghi nhận ứng dụng gây xao nhãng lớn, nhưng vẫn có ${quietDays} ngày trống dữ liệu cần giữ nhịp ổn định hơn.`,
    missedQuests > 0
      ? `Còn ${missedQuests}/${analytics.questsTotal} nhiệm vụ chưa hoàn tất (${100 - analytics.completionRatePct}% rơi rụng) — cần thu gọn khối lượng mỗi ngày vào đúng cửa sổ rảnh.`
      : quietDays >= 2
        ? `Có ${quietDays}/${analytics.dailyTrend.length} ngày chưa ghi nhận phiên tập trung nào — nhịp thực thi dễ bị đứt gãy giữa tuần.`
        : `Chưa tận dụng hết công suất Deep Work mỗi ngày (trung bình ${Math.round(analytics.totalFocusMinutes / Math.max(1, analytics.dailyTrend.length))}p/ngày).`,
    `Mất cân bằng chỉ số: ${weakPairText} đang ở nhóm thấp nhất (${analytics.statBalance
      .filter((s) => analytics.weakestStats.includes(s.stat))
      .map((s) => `${s.stat}:${s.currentValue}`)
      .join(', ')}) so với ${strongestStat.stat}:${strongestStat.currentValue}.`,
  ];

  const peakLabel = analytics.empiricalPeakHour || '09:00–10:30';
  const nextWeekTopPriority = topDrain && analytics.totalDistractionMinutes >= 45
    ? `Khóa cứng 1 phiên Deep Work 60–90p vào khung ${peakLabel} mỗi ngày (tắt ${topDrain.processName}) và chèn 3 khối ngắn bù chỉ số ${analytics.weakestStats[0]}${primaryGoal ? ` phục vụ mục tiêu "${primaryGoal.title.slice(0, 38)}"` : ''}.`
    : `Bảo vệ tuyệt đối 1 khối Deep Work 60–90p vào khung ${peakLabel}${primaryGoal ? ` cho mục tiêu "${primaryGoal.title.slice(0, 40)}"` : ''} và phân bổ ít nhất 3 khối rèn ${weakPairText} trong lịch tuần.`;

  return {
    headline,
    strengths,
    bottlenecks,
    nextWeekTopPriority,
    recommendedFocusWindow: buildRecommendedFocusWindow(
      analytics.empiricalPeakHour,
      player.profile.peakHours
    ),
    mode: 'heuristic',
  };
}

/**
 * 2. Generates an evidence-backed AI (or sharp heuristic fallback) Weekly/30-Day Review,
 * persists it to SQLite, and returns the record, recent review history, and full analytics payload.
 */
export async function generateWeeklyAiReview(
  range: '7d' | '30d' = '7d'
): Promise<{
  review: WeeklyReviewRecord;
  reviews: WeeklyReviewRecord[];
  analytics: LongTermAnalyticsPayload;
}> {
  const analytics = computeLongTermReview(range);
  const player = db.getPlayer();
  const goals = db.getGoals();
  const aiSettings = db.getAISettings();

  const fallbackDiagnosis = buildHeuristicDiagnosis(analytics, player, goals);
  let diagnosis: WeeklyReviewDiagnosis = fallbackDiagnosis;

  if (isLlmConfigured(aiSettings)) {
    try {
      const systemPrompt = `Bạn là THE SYSTEM — Chuyên gia phân tích hiệu suất cá nhân (Solo Leveling Personal Growth OS).
Nhiệm vụ: Đọc dữ liệu telemetry thực tế ${analytics.range === '30d' ? '30 ngày' : '7 ngày'} của người dùng và xuất báo cáo chẩn đoán sắc bén bằng tiếng Việt, ngắn gọn, có dẫn chứng số liệu thật (tên app, số phút, khung giờ vàng, chỉ số yếu).
Tuyệt đối không bịa app hoặc số liệu không có trong telemetry.
CHỈ trả về JSON hợp lệ theo schema chính xác sau:
{
  "headline": "1 câu tổng kết sắc bén kèm hạng và số liệu thực",
  "strengths": ["điểm mạnh 1", "điểm mạnh 2", "điểm mạnh 3"],
  "bottlenecks": ["điểm nghẽn 1 kèm tên app/giờ thực", "điểm nghẽn 2", "điểm nghẽn 3"],
  "nextWeekTopPriority": "1 hành động ưu tiên số 1 cụ thể nhất cho tuần tới",
  "recommendedFocusWindow": "khung giờ Deep Work khuyến nghị dựa trên giờ vàng thực tế"
}`;

      const telemetryContext = {
        playerName: player.profile.name,
        persona: player.profile.aiPersona || 'strategic_mentor',
        range: analytics.range,
        period: `${analytics.startDate} -> ${analytics.endDate}`,
        grade: analytics.grade,
        totalFocusMinutes: analytics.totalFocusMinutes,
        totalDeepWorkMinutes: analytics.totalDeepWorkMinutes,
        totalStudyMinutes: analytics.totalStudyMinutes,
        totalDistractionMinutes: analytics.totalDistractionMinutes,
        avgFocusScore: analytics.avgFocusScore,
        questsCompleted: analytics.questsCompleted,
        questsTotal: analytics.questsTotal,
        completionRatePct: analytics.completionRatePct,
        empiricalPeakHour: analytics.empiricalPeakHour,
        topHelpfulApps: analytics.topHelpfulApps,
        topDrainingApps: analytics.topDrainingApps,
        statBalance: analytics.statBalance,
        weakestStats: analytics.weakestStats,
        activeGoals: goals.slice(0, 4).map((g) => ({
          title: g.title,
          priority: g.priority,
          progress: g.progress,
        })),
      };

      const raw = await callOpenAICompatible(
        aiSettings,
        systemPrompt,
        `Dữ liệu telemetry thực tế:\n${JSON.stringify(telemetryContext, null, 2)}`
      );
      const parsed = raw ? extractJsonBlock<Record<string, unknown>>(raw) : null;

      if (parsed && typeof parsed.headline === 'string' && parsed.headline.trim()) {
        const cleanList = (val: unknown, fallback: string[]): string[] => {
          const items = Array.isArray(val)
            ? val
                .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
                .map((x) => x.trim())
            : [];
          const merged = [...items];
          for (const fb of fallback) {
            if (merged.length >= 3) break;
            merged.push(fb);
          }
          return merged.slice(0, 3);
        };

        diagnosis = {
          headline: parsed.headline.trim(),
          strengths: cleanList(parsed.strengths, fallbackDiagnosis.strengths),
          bottlenecks: cleanList(parsed.bottlenecks, fallbackDiagnosis.bottlenecks),
          nextWeekTopPriority:
            typeof parsed.nextWeekTopPriority === 'string' && parsed.nextWeekTopPriority.trim()
              ? parsed.nextWeekTopPriority.trim()
              : fallbackDiagnosis.nextWeekTopPriority,
          recommendedFocusWindow:
            typeof parsed.recommendedFocusWindow === 'string' && parsed.recommendedFocusWindow.trim()
              ? parsed.recommendedFocusWindow.trim()
              : fallbackDiagnosis.recommendedFocusWindow,
          mode: 'llm',
        };
      }
    } catch (err) {
      console.warn('[AI Analytics] Live LLM weekly review failed, using heuristic fallback:', err);
    }
  }

  const review: WeeklyReviewRecord = {
    id: uid('rev'),
    weekStart: analytics.startDate,
    weekEnd: analytics.endDate,
    grade: analytics.grade,
    metrics: {
      totalFocusMinutes: analytics.totalFocusMinutes,
      totalDistractionMinutes: analytics.totalDistractionMinutes,
      avgFocusScore: analytics.avgFocusScore,
      questsCompleted: analytics.questsCompleted,
      completionRatePct: analytics.completionRatePct,
      empiricalPeakHour: analytics.empiricalPeakHour,
    },
    diagnosis,
    createdAt: new Date().toISOString(),
  };

  db.saveWeeklyReview(review);
  db.checkpointWal();

  return {
    review,
    reviews: db.getWeeklyReviews(12),
    analytics,
  };
}

interface TimeSlice {
  start: number;
  end: number;
}

function buildAwakeFreeSlicesForDay(
  existingBlocks: TimetableBlock[],
  dayOfWeek: number,
  energyLevel: number
): { dayLabel: string; slices: TimeSlice[]; overloadRisk: string } {
  const analysis = analyzeDaySchedule(existingBlocks, dayOfWeek, energyLevel);

  // Also explicitly verify against every existing block on this day and sleep 23:30-07:00
  const occupied: TimeSlice[] = [
    { start: 0, end: AWAKE_START_MIN },
    { start: AWAKE_END_MIN, end: 1440 },
  ];
  for (const b of analysis.blocks) {
    const s = timeToMinutes(b.startTime);
    const e = timeToMinutes(b.endTime);
    if (e > s) occupied.push({ start: s, end: e });
  }
  occupied.sort((a, b) => a.start - b.start);

  const merged: TimeSlice[] = [];
  for (const iv of occupied) {
    const last = merged[merged.length - 1];
    if (!last || iv.start > last.end) {
      merged.push({ ...iv });
    } else {
      last.end = Math.max(last.end, iv.end);
    }
  }

  const slices: TimeSlice[] = [];
  let cursor = AWAKE_START_MIN;
  for (const occ of merged) {
    if (occ.end <= AWAKE_START_MIN) continue;
    if (occ.start >= AWAKE_END_MIN) break;
    if (occ.start > cursor) {
      const gapStart = cursor;
      const gapEnd = Math.min(AWAKE_END_MIN, occ.start);
      if (gapEnd - gapStart >= 25) {
        slices.push({ start: gapStart, end: gapEnd });
      }
    }
    cursor = Math.max(cursor, occ.end);
  }
  if (cursor < AWAKE_END_MIN && AWAKE_END_MIN - cursor >= 25) {
    slices.push({ start: cursor, end: AWAKE_END_MIN });
  }

  return {
    dayLabel: analysis.dayLabel || DAY_LABELS[dayOfWeek] || `Day ${dayOfWeek}`,
    slices,
    overloadRisk: analysis.overloadRisk,
  };
}

function snapToFiveMinutes(min: number): number {
  return Math.round(min / 5) * 5;
}

function allocateNearPreferredStart(
  slices: TimeSlice[],
  desiredDuration: number,
  preferredStartMin: number,
  minDuration = 25
): { start: number; end: number } | null {
  const dur = Math.max(minDuration, Math.min(180, Math.round(desiredDuration)));

  const findBest = (targetDur: number): { idx: number; start: number; end: number } | null => {
    let best: { idx: number; start: number; end: number; dist: number } | null = null;
    for (let i = 0; i < slices.length; i += 1) {
      const s = slices[i];
      if (s.end - s.start < targetDur) continue;
      let candidateStart = Math.max(s.start, Math.min(s.end - targetDur, preferredStartMin));
      const snapped = snapToFiveMinutes(candidateStart);
      if (snapped >= s.start && snapped + targetDur <= s.end) {
        candidateStart = snapped;
      }
      const dist = Math.abs(candidateStart - preferredStartMin);
      if (!best || dist < best.dist) {
        best = { idx: i, start: candidateStart, end: candidateStart + targetDur, dist };
      }
    }
    return best ? { idx: best.idx, start: best.start, end: best.end } : null;
  };

  let chosen = findBest(dur);
  if (!chosen && dur > minDuration) {
    // Fallback to largest slice fitting at least minDuration
    let largestIdx = -1;
    let largestLen = 0;
    for (let i = 0; i < slices.length; i += 1) {
      const len = slices[i].end - slices[i].start;
      if (len >= minDuration && len > largestLen) {
        largestLen = len;
        largestIdx = i;
      }
    }
    if (largestIdx >= 0) {
      const s = slices[largestIdx];
      const fittedDur = Math.min(dur, largestLen);
      const start = s.start;
      chosen = { idx: largestIdx, start, end: start + fittedDur };
    }
  }

  if (!chosen) return null;

  const targetSlice = slices[chosen.idx];
  const nextSlices: TimeSlice[] = [];
  // Keep 10-minute transition buffers around newly scheduled blocks
  if (chosen.start - 10 - targetSlice.start >= 25) {
    nextSlices.push({ start: targetSlice.start, end: chosen.start - 10 });
  }
  if (targetSlice.end - (chosen.end + 10) >= 25) {
    nextSlices.push({ start: chosen.end + 10, end: targetSlice.end });
  }
  slices.splice(chosen.idx, 1, ...nextSlices);

  return { start: chosen.start, end: chosen.end };
}

function getStatBalancingTemplate(stat: AttributeKey, dayIndex: number): {
  title: string;
  durationMinutes: number;
  preferredStartMin: number;
  type: TimetableBlockType;
  energyCost: TimetableBlock['energyCost'];
  reason: string;
} {
  switch (stat) {
    case 'STR':
      return {
        title: dayIndex % 2 === 0 ? 'Tập thể lực / Gym & Sức bền' : 'Chạy bộ Cardio Zone-2',
        durationMinutes: 45,
        preferredStartMin: 17 * 60,
        type: 'fixed_habit',
        energyCost: 'MEDIUM',
        reason: `Bù chỉ số yếu ${STAT_VI_LABELS.STR} để giữ nền tảng năng lượng cả tuần.`,
      };
    case 'VIT':
      return {
        title: dayIndex % 2 === 0 ? 'NSDR Phục hồi sâu & Thư giãn mắt' : 'Đi bộ thả lỏng & Nạp sinh lực',
        durationMinutes: 30,
        preferredStartMin: 16 * 60 + 30,
        type: 'rest_buffer',
        energyCost: 'NONE',
        reason: `Bù chỉ số yếu ${STAT_VI_LABELS.VIT}, hạ Fatigue và ngăn burnout.`,
      };
    case 'CHA':
      return {
        title: dayIndex % 2 === 0 ? 'Luyện thuyết trình / Diễn đạt ý tưởng' : 'Kết nối & Trao đổi chuyên môn',
        durationMinutes: 35,
        preferredStartMin: 18 * 60 + 30,
        type: 'fixed_habit',
        energyCost: 'MEDIUM',
        reason: `Bù chỉ số yếu ${STAT_VI_LABELS.CHA} bằng thực hành giao tiếp chủ động.`,
      };
    case 'PER':
      return {
        title: dayIndex % 2 === 0 ? 'Active Recall & Ghi chú Feynman' : 'Đọc sâu tài liệu & Ngoại ngữ',
        durationMinutes: 45,
        preferredStartMin: 20 * 60,
        type: 'fixed_habit',
        energyCost: 'MEDIUM',
        reason: `Bù chỉ số yếu ${STAT_VI_LABELS.PER} theo cơ chế truy xuất chủ động.`,
      };
    case 'AGI':
      return {
        title: 'Sprint Thực thi nhanh & Dọn backlog',
        durationMinutes: 40,
        preferredStartMin: 15 * 60,
        type: 'fixed_habit',
        energyCost: 'MEDIUM',
        reason: `Bù chỉ số yếu ${STAT_VI_LABELS.AGI} giúp tăng tốc hoàn thành nhiệm vụ tồn đọng.`,
      };
    case 'INT':
    default:
      return {
        title: 'Luyện giải quyết vấn đề & Tư duy hệ thống',
        durationMinutes: 60,
        preferredStartMin: 14 * 60 + 30,
        type: 'fixed_habit',
        energyCost: 'HIGH',
        reason: `Bù chỉ số yếu ${STAT_VI_LABELS.INT} bằng bài tập phân tích có độ khó vừa tầm.`,
      };
  }
}

function buildDeterministicWeeklyBlueprint(params: {
  existingBlocks: TimetableBlock[];
  player: PlayerState;
  analytics7d: LongTermAnalyticsPayload;
  goals: Goal[];
  skills: SkillNode[];
  focusNote: string;
  maxBlocksPerDay: number;
}): WeeklyBlueprintDraft {
  const { existingBlocks, player, analytics7d, goals, skills, focusNote, maxBlocksPerDay } = params;

  const peakHour =
    parseStartHourFromWindow(analytics7d.empiricalPeakHour) ??
    parseStartHourFromWindow(player.profile.peakHours) ??
    9;
  const peakStartMin = Math.max(AWAKE_START_MIN, Math.min(21 * 60, peakHour * 60));

  const prioritizedGoals = [...goals].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2) || a.progress - b.progress;
  });

  const weakestStats: AttributeKey[] =
    analytics7d.weakestStats.length > 0 ? analytics7d.weakestStats : ['VIT', 'STR'];

  const blocks: WeeklyBlueprintBlockDraft[] = [];

  for (let i = 0; i < WEEK_ORDER.length; i += 1) {
    const dow = WEEK_ORDER[i];
    const { dayLabel, slices, overloadRisk } = buildAwakeFreeSlicesForDay(
      existingBlocks,
      dow,
      player.energyLevel
    );
    if (slices.length === 0) continue;

    const dayLimit =
      overloadRisk === 'CRITICAL' ? 1 : overloadRisk === 'HIGH' ? Math.min(maxBlocksPerDay, 2) : maxBlocksPerDay;
    let addedToday = 0;

    // Slot 1: High-leverage Deep Work / Study near empiricalPeakHour
    const goal = prioritizedGoals.length > 0 ? prioritizedGoals[i % prioritizedGoals.length] : undefined;
    const isSunday = dow === 0;
    const deepDur = isSunday ? 60 : overloadRisk === 'HIGH' ? 45 : 75;
    const deepSlot = allocateNearPreferredStart(slices, deepDur, peakStartMin, 30);

    if (deepSlot) {
      let title: string;
      let primaryStat: AttributeKey;
      let reason: string;
      let blockType: TimetableBlockType = 'fixed_habit';

      if (isSunday) {
        title = focusNote
          ? `Tổng kết tuần & Lập chiến lược: ${focusNote.slice(0, 34)}`
          : 'Tổng kết tuần & Chuẩn bị chiến lược Deep Work';
        primaryStat = 'PER';
        reason = analytics7d.empiricalPeakHour
          ? `Đặt gần giờ vàng thực tế ${analytics7d.empiricalPeakHour} để rà soát tiến độ & khóa mục tiêu tuần mới.`
          : 'Tổng kết tuần giúp duy trì đà tiến và tránh mất phương hướng đầu tuần mới.';
      } else if (goal) {
        const milestoneHint = goal.subMilestones[i % Math.max(1, goal.subMilestones.length)];
        const baseName =
          focusNote && i % 2 === 0 ? `${focusNote.slice(0, 32)} (${goal.title.slice(0, 22)})` : `Deep Work: ${goal.title.slice(0, 42)}`;
        title = baseName;
        primaryStat = resolveGoalStat(goal);
        reason = analytics7d.empiricalPeakHour
          ? `Khớp giờ vàng ${analytics7d.empiricalPeakHour} để đẩy mục tiêu "${goal.title.slice(0, 32)}"${milestoneHint ? ` — ${milestoneHint.slice(0, 42)}` : ''}.`
          : `Phiên tập trung mũi nhọn đẩy tiến độ mục tiêu "${goal.title.slice(0, 36)}".`;
      } else if (focusNote) {
        title = `Deep Work: ${focusNote.slice(0, 46)}`;
        primaryStat = inferStatFromText(focusNote);
        reason = analytics7d.empiricalPeakHour
          ? `Bám sát trọng tâm tuần vào khung giờ vàng thực tế ${analytics7d.empiricalPeakHour}.`
          : 'Phiên Deep Work ưu tiên cho trọng tâm tuần bạn đã chọn.';
      } else {
        const targetSkill = player.profile.targetSkills[i % Math.max(1, player.profile.targetSkills.length)];
        title = targetSkill ? `Deep Work: Rèn ${targetSkill.slice(0, 38)}` : 'Deep Work Tập trung Cốt lõi';
        primaryStat = targetSkill ? inferStatFromText(targetSkill) : 'INT';
        reason = analytics7d.empiricalPeakHour
          ? `Tận dụng giờ vàng sinh học thực tế ${analytics7d.empiricalPeakHour} cho phiên đầu ra sâu nhất trong ngày.`
          : 'Khối tập trung sâu giúp tích lũy Mastery ổn định mỗi ngày.';
      }

      blocks.push({
        id: uid('bp'),
        dayOfWeek: dow,
        dayLabel,
        startTime: minutesToTime(deepSlot.start),
        endTime: minutesToTime(deepSlot.end),
        title,
        type: blockType,
        energyCost: isSunday ? 'LOW' : 'HIGH',
        primaryStat,
        goalId: goal?.id,
        skillId: inferSkillIdForTask(title, reason, primaryStat, skills),
        reason,
        selected: true,
      });
      addedToday += 1;
    }

    // Slot 2..dayLimit: Weakest stats balancing + secondary focus
    while (addedToday < dayLimit && slices.length > 0) {
      const targetStat =
        isSunday && addedToday === 1
          ? 'VIT'
          : weakestStats[(i + addedToday - 1) % weakestStats.length];
      const tpl = getStatBalancingTemplate(targetStat, i + addedToday);
      const slot = allocateNearPreferredStart(slices, tpl.durationMinutes, tpl.preferredStartMin, 25);
      if (!slot) break;

      blocks.push({
        id: uid('bp'),
        dayOfWeek: dow,
        dayLabel,
        startTime: minutesToTime(slot.start),
        endTime: minutesToTime(slot.end),
        title: tpl.title,
        type: tpl.type,
        energyCost: tpl.energyCost,
        primaryStat: targetStat,
        skillId: inferSkillIdForTask(tpl.title, tpl.reason, targetStat, skills),
        reason: tpl.reason,
        selected: true,
      });
      addedToday += 1;
    }
  }

  const peakText = analytics7d.empiricalPeakHour
    ? `giờ vàng thực tế ${analytics7d.empiricalPeakHour}`
    : `khung ${minutesToTime(peakStartMin)}`;

  return {
    generatedAt: new Date().toISOString(),
    mode: 'heuristic',
    empiricalPeakHour: analytics7d.empiricalPeakHour,
    weakestStats: analytics7d.weakestStats,
    summary: `Đã dựng ${blocks.length} khối lịch không trùng lặp (T2–CN, tôn trọng ngủ 23:30–07:00), neo Deep Work quanh ${peakText} và bù chỉ số yếu ${weakestStats.join(' & ')}${focusNote ? ` theo trọng tâm "${focusNote.slice(0, 48)}"` : ''}.`,
    blocks,
  };
}

function validateAndPlaceBlocksZeroCollision(
  candidates: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    title: string;
    type: TimetableBlockType;
    energyCost: TimetableBlock['energyCost'];
    primaryStat: AttributeKey;
    goalId?: string;
    reason: string;
  }>,
  existingBlocks: TimetableBlock[],
  energyLevel: number,
  maxBlocksPerDay: number,
  goals: Goal[],
  skills: SkillNode[]
): WeeklyBlueprintBlockDraft[] {
  const goalIds = new Set(goals.map((g) => g.id));
  const slicesByDay = new Map<number, { dayLabel: string; slices: TimeSlice[] }>();
  const placedCountByDay = new Map<number, number>();
  const placedIntervalsByDay = new Map<number, TimeSlice[]>();

  for (const dow of WEEK_ORDER) {
    const info = buildAwakeFreeSlicesForDay(existingBlocks, dow, energyLevel);
    slicesByDay.set(dow, { dayLabel: info.dayLabel, slices: info.slices });
    placedCountByDay.set(dow, 0);
    placedIntervalsByDay.set(dow, []);
  }

  // Build existing occupied intervals per day for double-check assertion
  const existingOccupiedByDay = new Map<number, TimeSlice[]>();
  for (const dow of WEEK_ORDER) {
    const occ: TimeSlice[] = [
      { start: 0, end: AWAKE_START_MIN },
      { start: AWAKE_END_MIN, end: 1440 },
    ];
    for (const b of existingBlocks) {
      if (b.dayOfWeek !== dow) continue;
      const s = timeToMinutes(b.startTime);
      const e = timeToMinutes(b.endTime);
      if (e > s) occ.push({ start: s, end: e });
    }
    existingOccupiedByDay.set(dow, occ);
  }

  const verified: WeeklyBlueprintBlockDraft[] = [];

  for (const cand of candidates) {
    const dow = Math.round(Number(cand.dayOfWeek));
    if (dow < 0 || dow > 6) continue;
    const count = placedCountByDay.get(dow) || 0;
    if (count >= maxBlocksPerDay) continue;

    const dayInfo = slicesByDay.get(dow);
    if (!dayInfo || dayInfo.slices.length === 0) continue;

    const cleanTitle = (cand.title || '').trim();
    if (!cleanTitle) continue;

    let startMin = isValidHHmm(cand.startTime) ? timeToMinutes(cand.startTime) : 9 * 60;
    let endMin = isValidHHmm(cand.endTime) ? timeToMinutes(cand.endTime) : startMin + 60;
    const desiredDur = Math.max(25, Math.min(150, endMin > startMin ? endMin - startMin : 60));

    const existingOcc = existingOccupiedByDay.get(dow) || [];
    const placedOcc = placedIntervalsByDay.get(dow) || [];

    const exactTimeFits =
      startMin >= AWAKE_START_MIN &&
      endMin <= AWAKE_END_MIN &&
      endMin - startMin >= 25 &&
      endMin - startMin <= 180 &&
      !existingOcc.some((iv) => hasTimeOverlap(startMin, endMin, iv.start, iv.end)) &&
      !placedOcc.some((iv) => hasTimeOverlap(startMin, endMin, iv.start, iv.end));

    let chosenStart: number;
    let chosenEnd: number;

    if (exactTimeFits) {
      chosenStart = startMin;
      chosenEnd = endMin;
      // Carve from slices so future fallbacks don't collide either
      const nextSlices: TimeSlice[] = [];
      for (const s of dayInfo.slices) {
        if (!hasTimeOverlap(chosenStart - 5, chosenEnd + 5, s.start, s.end)) {
          nextSlices.push(s);
        } else {
          if (chosenStart - 5 - s.start >= 25) {
            nextSlices.push({ start: s.start, end: chosenStart - 5 });
          }
          if (s.end - (chosenEnd + 5) >= 25) {
            nextSlices.push({ start: chosenEnd + 5, end: s.end });
          }
        }
      }
      dayInfo.slices = nextSlices;
    } else {
      const relocated = allocateNearPreferredStart(dayInfo.slices, desiredDur, startMin, 25);
      if (!relocated) continue;
      chosenStart = relocated.start;
      chosenEnd = relocated.end;
      // Final hard collision check
      if (
        existingOcc.some((iv) => hasTimeOverlap(chosenStart, chosenEnd, iv.start, iv.end)) ||
        placedOcc.some((iv) => hasTimeOverlap(chosenStart, chosenEnd, iv.start, iv.end))
      ) {
        continue;
      }
    }

    const blockType: TimetableBlockType = VALID_BLOCK_TYPES.includes(cand.type)
      ? cand.type
      : 'fixed_habit';
    const energyCost: TimetableBlock['energyCost'] = VALID_ENERGY_COSTS.includes(cand.energyCost)
      ? cand.energyCost
      : 'MEDIUM';
    const primaryStat: AttributeKey = STAT_KEYS.includes(cand.primaryStat)
      ? cand.primaryStat
      : inferStatFromText(cleanTitle);
    const goalId = cand.goalId && goalIds.has(cand.goalId) ? cand.goalId : undefined;
    const reason = (cand.reason || '').trim() || `Tối ưu lịch tuần cho chỉ số ${primaryStat}.`;

    placedOcc.push({ start: chosenStart, end: chosenEnd });
    placedCountByDay.set(dow, count + 1);

    verified.push({
      id: uid('bp'),
      dayOfWeek: dow,
      dayLabel: dayInfo.dayLabel,
      startTime: minutesToTime(chosenStart),
      endTime: minutesToTime(chosenEnd),
      title: cleanTitle,
      type: blockType,
      energyCost,
      primaryStat,
      goalId,
      skillId: inferSkillIdForTask(cleanTitle, reason, primaryStat, skills),
      reason,
      selected: true,
    });
  }

  // Sort Mon..Sun then startTime ASC
  const dayRank = new Map(WEEK_ORDER.map((d, idx) => [d, idx]));
  verified.sort(
    (a, b) =>
      (dayRank.get(a.dayOfWeek) ?? 9) - (dayRank.get(b.dayOfWeek) ?? 9) ||
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  return verified;
}

/**
 * 3. Generates a conflict-free 7-day AI Weekly Blueprint respecting sleep 23:30–07:00
 * and every existing timetable block, anchored to empiricalPeakHour and weakestStats.
 */
export async function generateWeeklyBlueprint(options?: {
  focusNote?: string;
  maxBlocksPerDay?: number;
}): Promise<WeeklyBlueprintDraft> {
  const maxBlocksPerDay = Math.max(1, Math.min(4, Math.round(options?.maxBlocksPerDay ?? 2)));
  const focusNote = (options?.focusNote || '').trim();

  const player = db.getPlayer();
  const existingBlocks = db.getTimetableBlocks();
  const analytics7d = computeLongTermReview('7d');
  const goals = db.getGoals();
  const skills = db.getSkills();
  const aiSettings = db.getAISettings();

  const fallbackDraft = buildDeterministicWeeklyBlueprint({
    existingBlocks,
    player,
    analytics7d,
    goals,
    skills,
    focusNote,
    maxBlocksPerDay,
  });

  if (isLlmConfigured(aiSettings)) {
    try {
      const freeScheduleByDay = WEEK_ORDER.map((dow) => {
        const info = buildAwakeFreeSlicesForDay(existingBlocks, dow, player.energyLevel);
        return {
          dayOfWeek: dow,
          dayLabel: info.dayLabel,
          overloadRisk: info.overloadRisk,
          freeWindows: info.slices.map((s) => `${minutesToTime(s.start)}-${minutesToTime(s.end)}`),
        };
      });

      const systemPrompt = `Bạn là CHRONOS — Kiến trúc sư Lịch Tuần (Weekly Blueprint) của THE SYSTEM.
Thiết kế lịch hành động 7 ngày (Thứ 2=1..Thứ 7=6, Chủ Nhật=0) với tối đa ${maxBlocksPerDay} khối/ngày.
QUY TẮC BẮT BUỘC:
1. Chỉ đặt khối BÊN TRONG danh sách freeWindows đã cung cấp của từng ngày (tuyệt đối không chạm giờ ngủ 23:30–07:00 hay lịch cố định).
2. Ưu tiên đặt khối Deep Work / Học sâu gần giờ vàng thực tế (${analytics7d.empiricalPeakHour || '09:00–10:30'}) nếu còn trống.
3. Chèn khối cân bằng các chỉ số yếu (${analytics7d.weakestStats.join(', ')}) xen kẽ trong tuần.
4. Viết tiêu đề và lý do ngắn gọn bằng tiếng Việt.
CHỈ trả về JSON hợp lệ:
{
  "summary": "1-2 câu tóm tắt chiến lược tuần bằng tiếng Việt",
  "blocks": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "10:15",
      "title": "Deep Work: ...",
      "type": "fixed_habit" | "class_work" | "rest_buffer",
      "energyCost": "NONE" | "LOW" | "MEDIUM" | "HIGH",
      "primaryStat": "INT" | "PER" | "STR" | "VIT" | "AGI" | "CHA",
      "goalId": "optional matching goal id",
      "reason": "1 câu ngắn giải thích vì sao đặt vào khung này"
    }
  ]
}`;

      const userPrompt = JSON.stringify(
        {
          focusNote: focusNote || null,
          maxBlocksPerDay,
          empiricalPeakHour: analytics7d.empiricalPeakHour,
          weakestStats: analytics7d.weakestStats,
          playerEnergy: player.energyLevel,
          goals: goals.slice(0, 5).map((g) => ({
            id: g.id,
            title: g.title,
            category: g.category,
            priority: g.priority,
            progress: g.progress,
          })),
          freeScheduleByDay,
        },
        null,
        2
      );

      const raw = await callOpenAICompatible(aiSettings, systemPrompt, userPrompt);
      const parsed = raw ? extractJsonBlock<{ summary?: string; blocks?: Array<Record<string, any>> }>(raw) : null;

      if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        const candidates = parsed.blocks.map((b) => ({
          dayOfWeek: Number(b.dayOfWeek),
          startTime: String(b.startTime || ''),
          endTime: String(b.endTime || ''),
          title: String(b.title || ''),
          type: (VALID_BLOCK_TYPES.includes(b.type) ? b.type : 'fixed_habit') as TimetableBlockType,
          energyCost: (VALID_ENERGY_COSTS.includes(b.energyCost)
            ? b.energyCost
            : 'MEDIUM') as TimetableBlock['energyCost'],
          primaryStat: (STAT_KEYS.includes(b.primaryStat)
            ? b.primaryStat
            : inferStatFromText(String(b.title || ''))) as AttributeKey,
          goalId: typeof b.goalId === 'string' ? b.goalId : undefined,
          reason: typeof b.reason === 'string' ? b.reason : '',
        }));

        const validatedBlocks = validateAndPlaceBlocksZeroCollision(
          candidates,
          existingBlocks,
          player.energyLevel,
          maxBlocksPerDay,
          goals,
          skills
        );

        if (validatedBlocks.length > 0) {
          return {
            generatedAt: new Date().toISOString(),
            mode: 'llm',
            empiricalPeakHour: analytics7d.empiricalPeakHour,
            weakestStats: analytics7d.weakestStats,
            summary:
              typeof parsed.summary === 'string' && parsed.summary.trim()
                ? parsed.summary.trim()
                : fallbackDraft.summary,
            blocks: validatedBlocks,
          };
        }
      }
    } catch (err) {
      console.warn('[AI Analytics] Live LLM weekly blueprint failed, using deterministic fallback:', err);
    }
  }

  return fallbackDraft;
}

/**
 * 4. Applies selected WeeklyBlueprintBlockDraft items inside a single SQLite transaction,
 * enforcing zero overlap against existing timetable blocks and optionally syncing today's blocks
 * into linked Today Quests.
 */
export function applyWeeklyBlueprint(
  blocks: WeeklyBlueprintBlockDraft[],
  syncTodayQuests = true
): { addedBlocksCount: number; addedQuestsCount: number } {
  const selected = (Array.isArray(blocks) ? blocks : []).filter((b) => Boolean(b && b.selected));
  if (selected.length === 0) {
    return { addedBlocksCount: 0, addedQuestsCount: 0 };
  }

  const todayDow = getVnDayOfWeek();
  const todayKey = getVnTodayKey();
  const skills = db.getSkills();
  const goals = db.getGoals();
  const goalIds = new Set(goals.map((g) => g.id));
  const skillIds = new Set(skills.map((s) => s.id));

  let addedBlocksCount = 0;
  let addedQuestsCount = 0;

  db.runTransaction(() => {
    const existing = db.getTimetableBlocks();
    const occupiedByDay = new Map<number, TimeSlice[]>();
    for (let d = 0; d <= 6; d += 1) {
      occupiedByDay.set(d, []);
    }
    for (const blk of existing) {
      const s = timeToMinutes(blk.startTime);
      const e = timeToMinutes(blk.endTime);
      if (e > s) {
        occupiedByDay.get(blk.dayOfWeek)?.push({ start: s, end: e });
      }
    }

    for (const draft of selected) {
      const dow = Math.round(Number(draft.dayOfWeek));
      if (dow < 0 || dow > 6) continue;
      if (!isValidHHmm(draft.startTime) || !isValidHHmm(draft.endTime)) continue;

      const startMin = timeToMinutes(draft.startTime);
      const endMin = timeToMinutes(draft.endTime);
      if (endMin - startMin < 10) continue;

      const cleanTitle = (draft.title || '').trim();
      if (!cleanTitle) continue;

      const dayOccupied = occupiedByDay.get(dow)!;
      if (dayOccupied.some((iv) => hasTimeOverlap(startMin, endMin, iv.start, iv.end))) {
        continue;
      }

      const blockType: TimetableBlockType = VALID_BLOCK_TYPES.includes(draft.type)
        ? draft.type
        : 'fixed_habit';
      const energyCost: TimetableBlock['energyCost'] = VALID_ENERGY_COSTS.includes(draft.energyCost)
        ? draft.energyCost
        : 'MEDIUM';
      const startTime = minutesToTime(startMin);
      const endTime = minutesToTime(endMin);
      const blockId = uid('tt-bp');

      const block: TimetableBlock = {
        id: blockId,
        dayOfWeek: dow,
        startTime,
        endTime,
        title: cleanTitle,
        type: blockType,
        energyCost,
        isRecurring: true,
        notes: draft.reason?.trim()
          ? `AI Weekly Blueprint · ${draft.reason.trim().slice(0, 140)}`
          : 'AI Weekly Blueprint',
      };

      db.saveTimetableBlock(block);
      dayOccupied.push({ start: startMin, end: endMin });
      addedBlocksCount += 1;

      if (
        syncTodayQuests &&
        dow === todayDow &&
        blockType !== 'sleep' &&
        blockType !== 'commute_meal'
      ) {
        const dur = Math.max(15, endMin - startMin);
        const isRest = blockType === 'rest_buffer';
        const validGoalId = draft.goalId && goalIds.has(draft.goalId) ? draft.goalId : undefined;
        const qType: QuestType = isRest ? 'recovery' : validGoalId ? 'main' : 'daily';
        const qRank: QuestRank = dur >= 75 ? 'A' : dur >= 50 ? 'B' : dur >= 30 ? 'C' : 'D';
        const primaryStat: AttributeKey = STAT_KEYS.includes(draft.primaryStat)
          ? draft.primaryStat
          : inferStatFromText(cleanTitle);
        const secondaryStat = SECONDARY_STAT_PAIR[primaryStat];

        const rewards = computeBalancedQuestRewards({
          durationMinutes: dur,
          rank: qRank,
          type: qType,
          requiresProof: false,
          primaryStat,
          secondaryStat,
        });

        const skillId =
          (draft.skillId && skillIds.has(draft.skillId) ? draft.skillId : undefined) ||
          inferSkillIdForTask(cleanTitle, draft.reason, primaryStat, skills);

        const quest: Quest = {
          id: uid('q-bp'),
          dateKey: todayKey,
          type: qType,
          rank: qRank,
          title: cleanTitle,
          description:
            draft.reason?.trim() ||
            `Được đồng bộ từ AI Weekly Blueprint (${startTime}–${endTime}).`,
          learningMethod: isRest ? 'Huberman NSDR / Active Recovery' : 'Timeboxed Deep Execution',
          reasoning: `Tạo tự động từ AI Weekly Blueprint cho khung giờ ${startTime}–${endTime}.`,
          agentSource: 'CHRONOS',
          goalId: validGoalId,
          skillId,
          linkedBlockId: blockId,
          scheduledSlot: `${startTime} - ${endTime}`,
          durationMinutes: dur,
          xpReward: rewards.xpReward,
          masteryReward: rewards.masteryReward,
          goldReward: rewards.goldReward,
          statRewards: rewards.statRewards,
          subtasks: [],
          status: 'pending',
          requiresProof: false,
          createdAt: new Date().toISOString(),
        };

        db.saveQuest(quest);
        addedQuestsCount += 1;
      }
    }

    if (addedBlocksCount > 0) {
      db.addMemoryLog({
        id: uid('log'),
        timestamp: new Date().toISOString(),
        agent: 'CHRONOS',
        eventType: 'ORCHESTRATION',
        summary: `Áp dụng AI Weekly Blueprint: +${addedBlocksCount} khung giờ${addedQuestsCount > 0 ? `, +${addedQuestsCount} Quest hôm nay` : ''}`,
        insight: `Đã ghi ${addedBlocksCount} khối lịch không trùng lặp vào Thời khóa biểu tuần và đồng bộ ${addedQuestsCount} nhiệm vụ cho hôm nay.`,
      });
    }
  });

  db.checkpointWal();

  return { addedBlocksCount, addedQuestsCount };
}
