import { db } from './db.ts';
import { shiftVnDateKey } from './evening-closeout.ts';
import { analyzeDaySchedule, timeToMinutes } from './scheduler.ts';
import {
  VN_TIMEZONE,
  getVnDayOfWeekFromDateKey,
  getVnNowMinutes,
  getVnNowParts,
  getVnTodayKey,
} from './time-vn.ts';
import type {
  CoreHabit,
  HabitLogEntry,
  HabitTimeOfDay,
  LocalGoalAlignmentItem,
  LocalGoldenWindow,
  LocalHabitInsight,
  LocalIntelligencePayload,
  Quest,
} from './types.ts';

const vnHourFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: VN_TIMEZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

const DOW_LABELS: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
};

function getHourFromIso(iso: string): number {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 12;
  const h = Number(vnHourFmt.format(dt));
  return h === 24 ? 0 : Math.max(0, Math.min(23, h));
}

function formatHourRange(startHour: number, endHour: number): string {
  const s = String(Math.max(0, Math.min(23, startHour))).padStart(2, '0');
  const e = String(Math.max(1, Math.min(24, endHour))).padStart(2, '0');
  return `${s}:00–${e}:00`;
}

export function isHabitDueOnDate(habit: CoreHabit, dateKey: string): boolean {
  const dow = getVnDayOfWeekFromDateKey(dateKey);
  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekends':
      return dow === 0 || dow === 6;
    case 'custom_days':
      return Array.isArray(habit.customDays) && habit.customDays.length > 0
        ? habit.customDays.includes(dow)
        : true;
    case 'times_per_week':
      return true;
    default:
      return true;
  }
}

function getMondayOfVnWeek(dateKey: string): string {
  const dow = getVnDayOfWeekFromDateKey(dateKey);
  const deltaToMonday = dow === 0 ? -6 : 1 - dow;
  return shiftVnDateKey(dateKey, deltaToMonday);
}

export function computeEnrichedHabits(
  habits: CoreHabit[],
  logs: HabitLogEntry[],
  todayKey: string = getVnTodayKey()
): CoreHabit[] {
  const byHabitDate = new Map<string, Map<string, HabitLogEntry>>();
  for (const log of logs) {
    let m = byHabitDate.get(log.habitId);
    if (!m) {
      m = new Map();
      byHabitDate.set(log.habitId, m);
    }
    m.set(log.dateKey, log);
  }

  const mondayKey = getMondayOfVnWeek(todayKey);

  return habits.map((habit) => {
    const logMap = byHabitDate.get(habit.id) ?? new Map<string, HabitLogEntry>();
    const todayLog = logMap.get(todayKey);
    const dueToday = isHabitDueOnDate(habit, todayKey);

    let completedThisWeekCount = 0;
    for (let i = 0; i < 7; i += 1) {
      const dk = shiftVnDateKey(mondayKey, i);
      if (dk > todayKey) break;
      if (logMap.has(dk)) completedThisWeekCount += 1;
    }

    // Compute current streak (walks back day-by-day up to 60 days)
    let currentStreak = 0;
    let bestStreak = 0;
    let runStreak = 0;

    if (habit.frequency === 'times_per_week') {
      const target = Math.max(1, Math.min(7, habit.targetPerWeek ?? 3));
      // Count consecutive weeks meeting target (plus active current week)
      let weekStart = mondayKey;
      let weeksMet = 0;
      for (let w = 0; w < 12; w += 1) {
        let cnt = 0;
        for (let d = 0; d < 7; d += 1) {
          const dk = shiftVnDateKey(weekStart, d);
          if (logMap.has(dk)) cnt += 1;
        }
        if (w === 0) {
          if (cnt >= target) weeksMet += 1;
        } else if (cnt >= target) {
          weeksMet += 1;
        } else {
          break;
        }
        weekStart = shiftVnDateKey(weekStart, -7);
      }
      currentStreak = weeksMet > 0 ? weeksMet * target : completedThisWeekCount;
      bestStreak = Math.max(currentStreak, logMap.size);
    } else {
      // Starting from today (if done today) or yesterday (grace while today isn't over yet)
      const startOffset = todayLog ? 0 : -1;
      for (let offset = startOffset; offset >= -60; offset -= 1) {
        const dk = shiftVnDateKey(todayKey, offset);
        const due = isHabitDueOnDate(habit, dk);
        if (!due) continue;
        if (logMap.has(dk)) {
          currentStreak += 1;
        } else {
          break;
        }
      }
      for (let offset = -60; offset <= 0; offset += 1) {
        const dk = shiftVnDateKey(todayKey, offset);
        if (!isHabitDueOnDate(habit, dk)) continue;
        if (logMap.has(dk)) {
          runStreak += 1;
          if (runStreak > bestStreak) bestStreak = runStreak;
        } else if (offset < 0) {
          runStreak = 0;
        }
      }
    }

    return {
      ...habit,
      currentStreak,
      bestStreak: Math.max(bestStreak, currentStreak),
      completedToday: todayLog ? todayLog.kind : null,
      completedThisWeekCount,
      dueToday,
    };
  });
}

function getCurrentTimeOfDay(hour: number): HabitTimeOfDay {
  if (hour < 12) return 'morning';
  if (hour >= 18) return 'evening';
  return 'anytime';
}

export function computeLocalIntelligence(now: Date = new Date()): LocalIntelligencePayload {
  const vnNow = getVnNowParts(now);
  const todayKey = vnNow.dateKey;
  const start14Key = shiftVnDateKey(todayKey, -13);
  const start7Key = shiftVnDateKey(todayKey, -6);
  const start60Key = shiftVnDateKey(todayKey, -59);

  const player = db.getPlayer();
  const goals = db.getGoals();
  const quests = db.getQuests();
  const timetable = db.getTimetableBlocks();
  const todayAnalysis = analyzeDaySchedule(timetable, vnNow.dayOfWeek, player.energyLevel);
  const rawHabits = db.getHabits(false);
  const habitLogs60 = db.getHabitLogsRange(start60Key, todayKey);
  const enrichedHabits = computeEnrichedHabits(rawHabits, habitLogs60, todayKey);
  const activityLogs14 = db.getActivityLogsRange(start14Key, todayKey);
  const closeouts14 = db.getRecentDailyCloseouts(14);
  const knowledgeNotes = db.getKnowledgeNotes(200);
  const dueRecalls = db.getDueRecallNotes(todayKey);

  // 1. Empirical Golden Hours & Distraction Peak Hours (from 14d PC Activity Logs)
  const hourBuckets = new Map<
    number,
    { focusSec: number; distractionSec: number; activeSec: number }
  >();
  for (let h = 6; h <= 23; h += 1) {
    hourBuckets.set(h, { focusSec: 0, distractionSec: 0, activeSec: 0 });
  }
  for (const log of activityLogs14) {
    const h = getHourFromIso(log.startedAt);
    const bucket = hourBuckets.get(h);
    if (!bucket) continue;
    const sec = Math.max(0, log.durationSeconds || 0);
    if (log.category === 'idle') continue;
    bucket.activeSec += sec;
    if (log.category === 'deep_work' || log.category === 'study_research') {
      bucket.focusSec += sec;
    } else if (log.category === 'distraction') {
      bucket.distractionSec += sec;
    }
  }

  const scoredHours = Array.from(hourBuckets.entries())
    .map(([hour, b]) => {
      const focusMins = Math.round(b.focusSec / 60);
      const distMins = Math.round(b.distractionSec / 60);
      const score = b.activeSec > 0 ? Math.round((b.focusSec / b.activeSec) * 100) : 0;
      return { hour, focusMins, distMins, score };
    });

  // Merge adjacent top focus hours into clean 1-2h Golden Windows
  const candidateGolden = scoredHours
    .filter((h) => h.focusMins >= 15 && h.score >= 55)
    .sort((a, b) => b.focusMins * (b.score / 100) - a.focusMins * (a.score / 100))
    .slice(0, 4)
    .sort((a, b) => a.hour - b.hour);

  const goldenHours: LocalGoldenWindow[] = [];
  for (const item of candidateGolden) {
    const prev = goldenHours[goldenHours.length - 1];
    if (prev && prev.endHour === item.hour && prev.endHour - prev.startHour < 2) {
      const totalMins = prev.focusMinutes + item.focusMins;
      prev.endHour = item.hour + 1;
      prev.label = formatHourRange(prev.startHour, prev.endHour);
      prev.focusScore = Math.round(
        (prev.focusScore * prev.focusMinutes + item.score * item.focusMins) / Math.max(1, totalMins)
      );
      prev.focusMinutes = totalMins;
    } else {
      goldenHours.push({
        startHour: item.hour,
        endHour: item.hour + 1,
        label: formatHourRange(item.hour, item.hour + 1),
        focusMinutes: item.focusMins,
        focusScore: item.score,
      });
    }
  }
  goldenHours.sort((a, b) => b.focusMinutes - a.focusMinutes);

  const distractionPeakHours = scoredHours
    .filter((h) => h.distMins >= 10)
    .sort((a, b) => b.distMins - a.distMins)
    .slice(0, 2)
    .map((h) => ({
      hour: h.hour,
      label: formatHourRange(h.hour, h.hour + 1),
      distractionMinutes: h.distMins,
    }));

  // 2. Today Load / Overload Guard (remaining free time vs pending quest minutes)
  const nowMin = getVnNowMinutes(now);
  const awakeCapMin = 23 * 60 + 30;
  let remainingFreeMinutes = 0;
  for (const w of todayAnalysis.freeWindows) {
    const ws = Math.max(nowMin, timeToMinutes(w.startTime));
    const we = Math.min(awakeCapMin, timeToMinutes(w.endTime));
    if (we > ws) remainingFreeMinutes += we - ws;
  }

  const pendingTodayQuests = quests.filter(
    (q) => q.status === 'pending' && q.dateKey <= todayKey
  );
  const pendingQuestMinutes = pendingTodayQuests.reduce(
    (acc, q) => acc + Math.max(5, q.durationMinutes || 25),
    0
  );
  const effectiveFreeCap = Math.max(20, Math.round(remainingFreeMinutes * 0.8));
  const overloadRatio =
    pendingQuestMinutes > 0 ? Number((pendingQuestMinutes / effectiveFreeCap).toFixed(2)) : 0;
  const isOverloaded = pendingQuestMinutes > effectiveFreeCap && pendingTodayQuests.length >= 2;
  const recommendedAction = isOverloaded
    ? `Bạn còn ${pendingQuestMinutes}p việc nhưng quỹ rảnh hiệu quả chỉ khoảng ${effectiveFreeCap}p — nên chọn đúng 1–2 việc quan trọng nhất hoặc bật Ngày Tối Thiểu.`
    : null;

  // 3. Estimation Calibration (actualDurationMinutes vs durationMinutes in last 14d)
  const calibratedSamples = quests.filter(
    (q) =>
      q.status === 'completed' &&
      q.dateKey >= start14Key &&
      typeof q.actualDurationMinutes === 'number' &&
      q.actualDurationMinutes > 0 &&
      (q.durationMinutes || 0) >= 10
  );
  let avgRatio = 1.0;
  let calibrationNote: string | null = null;
  if (calibratedSamples.length >= 3) {
    const sumRatio = calibratedSamples.reduce(
      (acc, q) => acc + (q.actualDurationMinutes! / Math.max(10, q.durationMinutes)),
      0
    );
    avgRatio = Number((sumRatio / calibratedSamples.length).toFixed(2));
    if (avgRatio >= 1.2) {
      calibrationNote = `Thực tế bạn thường làm lâu hơn dự kiến ~${Math.round((avgRatio - 1) * 100)}% (${calibratedSamples.length} phiên gần nhất) — nên cộng thêm thời gian đệm khi xếp lịch.`;
    } else if (avgRatio <= 0.8) {
      calibrationNote = `Bạn thường hoàn thành nhanh hơn dự kiến ~${Math.round((1 - avgRatio) * 100)}% — có thể gom việc theo khối tập trung gọn hơn.`;
    }
  }

  // 4. Habit Analytics (14-day consistency, weakest habit, drop-off weekday, MVD saves)
  const logs14ByHabit = new Map<string, HabitLogEntry[]>();
  for (const l of habitLogs60) {
    if (l.dateKey < start14Key) continue;
    const arr = logs14ByHabit.get(l.habitId) || [];
    arr.push(l);
    logs14ByHabit.set(l.habitId, arr);
  }

  const habitItems: LocalHabitInsight[] = enrichedHabits.map((h) => {
    const hLogs = logs14ByHabit.get(h.id) || [];
    const doneDates = new Set(hLogs.map((l) => l.dateKey));
    const mvdSavesCount = hLogs.filter((l) => l.kind === 'minimum').length;

    let dueDays = 0;
    let completedDueDays = 0;
    const missesByDow = new Map<number, number>();

    if (h.frequency === 'times_per_week') {
      dueDays = Math.max(2, (h.targetPerWeek ?? 3) * 2);
      completedDueDays = Math.min(dueDays, hLogs.length);
    } else {
      for (let i = 0; i < 14; i += 1) {
        const dk = shiftVnDateKey(todayKey, -i);
        if (!isHabitDueOnDate(h, dk)) continue;
        dueDays += 1;
        if (doneDates.has(dk)) {
          completedDueDays += 1;
        } else if (i > 0) {
          const dow = getVnDayOfWeekFromDateKey(dk);
          missesByDow.set(dow, (missesByDow.get(dow) || 0) + 1);
        }
      }
    }

    const consistency14dPct =
      dueDays > 0 ? Math.min(100, Math.round((completedDueDays / dueDays) * 100)) : 100;

    let weakestDayLabel: string | null = null;
    let maxMisses = 0;
    for (const [dow, cnt] of missesByDow.entries()) {
      if (cnt > maxMisses) {
        maxMisses = cnt;
        weakestDayLabel = DOW_LABELS[dow] || null;
      }
    }

    return {
      habitId: h.id,
      title: h.title,
      consistency14dPct,
      currentStreak: h.currentStreak ?? 0,
      weakestDayLabel: maxMisses >= 2 ? weakestDayLabel : null,
      mvdSavesCount,
    };
  });

  const dueTodayHabits = enrichedHabits.filter((h) => h.dueToday);
  const completedTodayHabits = dueTodayHabits.filter((h) => Boolean(h.completedToday));
  const avgConsistency14dPct =
    habitItems.length > 0
      ? Math.round(habitItems.reduce((acc, h) => acc + h.consistency14dPct, 0) / habitItems.length)
      : 0;
  const sortedHabitItems = [...habitItems].sort(
    (a, b) => a.consistency14dPct - b.consistency14dPct
  );
  const weakestHabit = sortedHabitItems.length > 0 ? sortedHabitItems[0] : null;
  const strongestHabit =
    sortedHabitItems.length > 0 ? sortedHabitItems[sortedHabitItems.length - 1] : null;

  // 5. Top Bottlenecks (from 14d Evening Closeouts)
  const bottleneckCounts = new Map<string, number>();
  for (const co of closeouts14) {
    for (const tag of co.bottleneckTags || []) {
      const clean = tag.trim();
      if (!clean || clean === 'Nhịp ổn định') continue;
      bottleneckCounts.set(clean, (bottleneckCounts.get(clean) || 0) + 1);
    }
  }
  const topBottlenecks14d = Array.from(bottleneckCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // 6. Goal Alignment (7-day real execution per Goal)
  const goalAlignment: LocalGoalAlignmentItem[] = goals.map((g) => {
    const linkedHabitsCount = enrichedHabits.filter((h) => h.goalId === g.id).length;
    const linkedQuests7d = quests.filter(
      (q) => q.goalId === g.id && q.status === 'completed' && q.dateKey >= start7Key
    );
    const linkedFocusMinutes7d = linkedQuests7d.reduce(
      (acc, q) => acc + (q.actualDurationMinutes ?? q.durationMinutes ?? 25),
      0
    );
    const linkedNotesCount = knowledgeNotes.filter((n) => n.goalId === g.id).length;

    let status: LocalGoalAlignmentItem['status'] = 'neglected';
    if (linkedQuests7d.length >= 2 || linkedFocusMinutes7d >= 60 || linkedHabitsCount > 0) {
      status = linkedQuests7d.length >= 2 || linkedFocusMinutes7d >= 90 ? 'on_track' : 'slow';
    }

    return {
      goalId: g.id,
      title: g.title,
      progress: g.progress,
      linkedHabitsCount,
      linkedQuests7dCompleted: linkedQuests7d.length,
      linkedFocusMinutes7d,
      linkedNotesCount,
      status,
    };
  });

  // 7. Next Best Action (strict priority for Focus-First Cockpit)
  const activeRunningQuest: Quest | undefined =
    pendingTodayQuests.find((q) => Boolean(q.startedAt) && !q.isPaused) ||
    pendingTodayQuests.find((q) => Boolean(q.isPaused) || (q.pausedAccumulatedSeconds ?? 0) > 0);

  const curSlot = getCurrentTimeOfDay(vnNow.hour);
  const dueHabitNow =
    dueTodayHabits.find((h) => !h.completedToday && h.timeOfDay === curSlot) ||
    dueTodayHabits.find((h) => !h.completedToday && h.timeOfDay === 'morning' && vnNow.hour < 14);

  const priorityRankOrder: Record<string, number> = {
    emergency: 0,
    main: 1,
    daily: 2,
    side: 3,
    recovery: 4,
    hidden: 5,
  };
  const topPendingQuest = [...pendingTodayQuests].sort((a, b) => {
    const pa = priorityRankOrder[a.type] ?? 9;
    const pb = priorityRankOrder[b.type] ?? 9;
    return pa - pb;
  })[0];

  let nextBestAction: LocalIntelligencePayload['nextBestAction'];
  if (activeRunningQuest) {
    nextBestAction = {
      kind: 'active_quest',
      title: activeRunningQuest.title,
      subtitle: activeRunningQuest.isPaused
        ? 'Phiên đang tạm dừng — quay lại hoàn tất nốt'
        : 'Phiên tập trung đang chạy',
      reason: 'Hoàn tất trọn vẹn việc đang dở giúp tránh chi phí chuyển đổi ngữ cảnh.',
      targetId: activeRunningQuest.id,
    };
  } else if (dueHabitNow && vnNow.hour < 11) {
    nextBestAction = {
      kind: 'habit_now',
      title: dueHabitNow.title,
      subtitle: `Nghi thức buổi sáng · Bản chuẩn: ${dueHabitNow.standardSpec} · Tối thiểu: ${dueHabitNow.minimumSpec}`,
      reason: 'Khởi đầu ngày bằng 1 thói quen cốt lõi giúp kích hoạt quán tính kỷ luật.',
      targetId: dueHabitNow.id,
    };
  } else if (topPendingQuest) {
    const goldenHint = goldenHours[0]
      ? `Khung giờ vàng thực tế của bạn là ${goldenHours[0].label} (${goldenHours[0].focusScore}% Focus).`
      : `Thời lượng dự kiến ${topPendingQuest.durationMinutes} phút.`;
    nextBestAction = {
      kind: 'top_quest',
      title: topPendingQuest.title,
      subtitle: `${topPendingQuest.scheduledSlot || 'Linh hoạt'} · ${topPendingQuest.durationMinutes}p`,
      reason: goldenHint,
      targetId: topPendingQuest.id,
    };
  } else if (dueHabitNow) {
    nextBestAction = {
      kind: 'habit_now',
      title: dueHabitNow.title,
      subtitle: `Thói quen hôm nay · ${dueHabitNow.standardSpec}`,
      reason: 'Giữ vững chuỗi thói quen cốt lõi trước khi khép lại ngày hôm nay.',
      targetId: dueHabitNow.id,
    };
  } else if (dueRecalls.length > 0) {
    nextBestAction = {
      kind: 'recall_due',
      title: `Ôn nhanh ${dueRecalls.length} thẻ tri thức đến hạn`,
      subtitle: dueRecalls[0].title,
      reason: 'Ôn tập ngắt quãng (Spaced Recall) đúng thời điểm giúp ghi nhớ dài hạn gấp 3 lần.',
      targetId: dueRecalls[0].id,
    };
  } else {
    nextBestAction = {
      kind: 'add_first',
      title: 'Chọn 1 việc quan trọng nhất hôm nay',
      subtitle: 'Thêm 1 nhiệm vụ trọng tâm hoặc bấm Focus 25 phút để bắt đầu.',
      reason: 'Một ngày kỷ luật tốt chỉ cần bắt đầu bằng 1 phiên tập trung 25 phút rõ ràng.',
    };
  }

  // 8. Top 1-Line Contextual Insight Banner (only 1 crisp signal, never noisy)
  let topInsightBanner: LocalIntelligencePayload['topInsightBanner'] = null;
  const neglectedGoal = goalAlignment.find((g) => g.status === 'neglected');

  if (isOverloaded && recommendedAction) {
    topInsightBanner = {
      tone: 'red',
      headline: `Cảnh báo quá tải (${pendingQuestMinutes}p việc / ${effectiveFreeCap}p rảnh)`,
      detail: recommendedAction,
    };
  } else if (player.energyLevel <= db.getDisciplineSettings().mvdAutoSuggestEnergy) {
    topInsightBanner = {
      tone: 'gold',
      headline: `Năng lượng đang thấp (${player.energyLevel}%) — Gợi ý Ngày Tối Thiểu`,
      detail: 'Chuyển các Thói quen sang bản tối thiểu 2–5 phút để giữ chuỗi bền bỉ mà không kiệt sức.',
    };
  } else if (
    distractionPeakHours[0] &&
    vnNow.hour === distractionPeakHours[0].hour
  ) {
    topInsightBanner = {
      tone: 'red',
      headline: `Khung ${distractionPeakHours[0].label} thường dễ xao nhãng nhất`,
      detail: 'Gần đây bạn mất nhiều thời gian xao nhãng vào giờ này — nên mở Focus Mode hoặc đặt giới hạn 25p.',
    };
  } else if (goldenHours[0]) {
    const inGoldenNow =
      vnNow.hour >= goldenHours[0].startHour && vnNow.hour < goldenHours[0].endHour;
    topInsightBanner = {
      tone: inGoldenNow ? 'green' : 'blue',
      headline: inGoldenNow
        ? `Đang trong Giờ Vàng thực tế (${goldenHours[0].label} · ${goldenHours[0].focusScore}% Focus)`
        : `Giờ Vàng thực tế của bạn: ${goldenHours[0].label} (${goldenHours[0].focusScore}% Focus)`,
      detail: inGoldenNow
        ? 'Đây là khung giờ não bạn tập trung tốt nhất 14 ngày qua — ưu tiên việc khó nhất ngay bây giờ.'
        : topBottlenecks14d[0]
          ? `Điểm nghẽn lặp lại gần đây: "${topBottlenecks14d[0].tag}" (${topBottlenecks14d[0].count} lần) — hãy đặt việc quan trọng vào khung giờ vàng.`
          : 'Dữ liệu học trực tiếp từ PC Tracker & lịch sử hoàn thành của bạn.',
    };
  } else if (neglectedGoal) {
    topInsightBanner = {
      tone: 'gold',
      headline: `Mục tiêu "${neglectedGoal.title}" chưa có bước tiến trong 7 ngày qua`,
      detail: 'Gắn 1 Thói quen nhỏ hoặc 1 phiên 25 phút hôm nay để kéo mục tiêu này quay lại quỹ đạo.',
    };
  }

  // 9. Concrete Weekly Adjustment (1 single specific recommendation)
  let weeklyAdjustment =
    'Duy trì đều 1–3 Thói quen cốt lõi và chốt ngày đều đặn để hệ thống học chính xác giờ vàng cá nhân của bạn.';
  if (weakestHabit && weakestHabit.consistency14dPct < 60) {
    weeklyAdjustment = `Tập trung cứu thói quen "${weakestHabit.title}" (${weakestHabit.consistency14dPct}% trong 14 ngày${
      weakestHabit.weakestDayLabel ? `, hay trượt vào ${weakestHabit.weakestDayLabel}` : ''
    }) bằng cách dùng bản tối thiểu 2–5 phút vào những ngày bận.`;
  } else if (topBottlenecks14d[0]) {
    weeklyAdjustment = `Điểm nghẽn lớn nhất 14 ngày qua là "${topBottlenecks14d[0].tag}" (${topBottlenecks14d[0].count} lần). Tuần tới hãy xử lý trước 1 việc trọng tâm vào ${
      goldenHours[0]?.label || 'khung sáng sớm'
    } trước khi chạm vào nguồn xao nhãng.`;
  } else if (neglectedGoal) {
    weeklyAdjustment = `Mục tiêu "${neglectedGoal.title}" đang bị bỏ quên suốt 7 ngày — hãy gắn 1 Thói quen lặp lại hoặc 2 phiên 45p trong tuần tới.`;
  } else if (calibrationNote) {
    weeklyAdjustment = calibrationNote;
  }

  return {
    generatedAt: now.toISOString(),
    dateKey: todayKey,
    goldenHours: goldenHours.slice(0, 3),
    distractionPeakHours,
    todayLoad: {
      pendingQuestMinutes,
      remainingFreeMinutes,
      isOverloaded,
      overloadRatio,
      recommendedAction,
    },
    estimationCalibration: {
      sampleCount: calibratedSamples.length,
      avgRatio,
      note: calibrationNote,
    },
    habitAnalytics: {
      activeCount: enrichedHabits.length,
      completedTodayCount: completedTodayHabits.length,
      dueTodayCount: dueTodayHabits.length,
      avgConsistency14dPct,
      weakestHabit,
      strongestHabit,
      items: habitItems,
    },
    topBottlenecks14d,
    goalAlignment,
    dueRecallCount: dueRecalls.length,
    nextBestAction,
    topInsightBanner,
    weeklyAdjustment,
  };
}
