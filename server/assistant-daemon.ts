import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { db } from './db.ts';
import { desktopTracker } from './desktop-tracker.ts';
import { analyzeDaySchedule, timeToMinutes } from './scheduler.ts';
import { applyTaskContributionToSkill } from './skill-tree-data.ts';
import { getVnDayOfWeek, getVnNowMinutes, getVnNowParts, getVnTodayKey } from './time-vn.ts';
import type {
  AssistantNudge,
  AssistantOverviewPayload,
  AssistantSettings,
  MorningBriefingPayload,
  Quest,
  SystemStatePayload,
} from './types.ts';
import { getStartupStatus } from './windows-startup.ts';

const execFileAsync = promisify(execFile);

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function sendWindowsToast(title: string, message: string): Promise<boolean> {
  if (process.platform !== 'win32' || process.env.THE_SYSTEM_DB_PATH) {
    return false;
  }

  const safeTitle = escapeXml(title.slice(0, 120));
  const safeBody = escapeXml(message.slice(0, 260));

  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xmlStr = @"
<toast duration="short">
  <visual>
    <binding template="ToastGeneric">
      <text>${safeTitle}</text>
      <text>${safeBody}</text>
    </binding>
  </visual>
</toast>
"@
$doc = New-Object Windows.Data.Xml.Dom.XmlDocument
$doc.LoadXml($xmlStr)
$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
`;

  try {
    const encoded = Buffer.from(ps, 'utf16le').toString('base64');
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 8000 }
    );
    return true;
  } catch {
    return false;
  }
}

export function isWithinQuietHours(
  nowMinutes: number,
  quietStartHHmm: string,
  quietEndHHmm: string
): boolean {
  const start = timeToMinutes(quietStartHHmm || '23:30');
  const end = timeToMinutes(quietEndHHmm || '07:00');
  if (start > end) {
    return nowMinutes >= start || nowMinutes < end;
  }
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  return false;
}

export function isDndActive(settings: { dndUntil?: string | null }): boolean {
  if (!settings?.dndUntil) return false;
  const untilMs = new Date(settings.dndUntil).getTime();
  return Number.isFinite(untilMs) && untilMs > Date.now();
}

export function buildMorningBriefing(state: SystemStatePayload): MorningBriefingPayload {
  const vn = getVnNowParts();
  const dateKey = vn.dateKey;
  const hour = vn.hour;
  const name = state.player.profile.name || 'Hunter';

  const greeting =
    hour < 12
      ? `Chào buổi sáng, ${name}`
      : hour < 18
        ? `Chào buổi chiều, ${name}`
        : `Chào buổi tối, ${name}`;

  const fixedBlocksCount = state.todayAnalysis.blocks.filter(
    (b) => b.type !== 'sleep' && b.type !== 'rest_buffer'
  ).length;
  const freeHours = Number((state.todayAnalysis.totalFreeMinutes / 60).toFixed(1));
  const bestWindow = [...state.todayAnalysis.freeWindows].sort(
    (a, b) => b.durationMinutes - a.durationMinutes
  )[0];
  const bestDeepWorkWindow = bestWindow
    ? `${bestWindow.startTime}–${bestWindow.endTime} (${bestWindow.durationMinutes}p)`
    : null;

  const pendingQuestsCount = state.quests.filter(
    (q) => q.dateKey === dateKey && q.status === 'pending'
  ).length;

  const activeCh = state.chapters.find((c) => c.unlocked && !c.completed) || state.chapters[0];
  const activeSt = (activeCh?.stages || []).find((s) => s.unlocked && !s.completed);
  const activeChapterLabel = activeCh
    ? `Ch.${activeCh.chapterNumber}${activeSt ? ` · Màn ${activeSt.code}` : ''}`
    : 'Ch.1';

  let suggestedAction = 'Thêm nhanh 1 việc trọng tâm hôm nay và bấm ▶ Bắt đầu.';
  if (state.player.plannedRestMode) {
    suggestedAction = 'Nghỉ Chủ Động đang bật — ưu tiên phục hồi nhẹ và giữ nhịp thở.';
  } else if (pendingQuestsCount > 0 && bestDeepWorkWindow) {
    suggestedAction = `Đặt phiên tập trung sâu vào khung vàng ${bestDeepWorkWindow} (${pendingQuestsCount} việc đang chờ).`;
  } else if (bestDeepWorkWindow) {
    suggestedAction = `Bạn có khung rảnh đẹp nhất lúc ${bestDeepWorkWindow} — dùng AI Tự Xếp Lịch hoặc Quick-Add để lấp đầy.`;
  }

  return {
    dateKey,
    dayLabel: state.todayAnalysis.dayLabel,
    greeting,
    fixedBlocksCount,
    freeHours,
    bestDeepWorkWindow,
    pendingQuestsCount,
    activeChapterLabel,
    suggestedAction,
  };
}

class AssistantDaemonService {
  private timer: NodeJS.Timeout | null = null;
  private lastDistractionNudgeAt = 0;
  private lastUltradianNudgeAt = 0;
  private remindedBlockKeys = new Set<string>();

  start(): void {
    if (process.env.THE_SYSTEM_DB_PATH) return;
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runTick();
    }, 30_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setDndMinutes(minutes: number): { dndActive: boolean; dndUntil: string | null } {
    const mins = Number.isFinite(minutes) && minutes > 0 ? Math.min(24 * 60, minutes) : 0;
    const settings = db.getAssistantSettings();
    const dndUntil = mins > 0 ? new Date(Date.now() + mins * 60_000).toISOString() : null;
    const updated = db.saveAssistantSettings({
      ...settings,
      dndUntil,
    });
    const dndActive = isDndActive(updated);
    return {
      dndActive,
      dndUntil: dndActive ? (updated.dndUntil ?? null) : null,
    };
  }

  private computeDistractionGuardState(
    settings: AssistantSettings,
    quests: Quest[],
    plannedRestMode = false
  ): {
    distractionAlertLevel: 'none' | 'soft_hud' | 'toast';
    distractionStreakSeconds: number;
    hasRunningQuest: boolean;
  } {
    const dateKey = getVnTodayKey();
    const hasRunningQuest = quests.some(
      (q) => q.dateKey === dateKey && q.status === 'pending' && Boolean(q.startedAt) && !q.isPaused
    );
    const distractionStreakSeconds = hasRunningQuest
      ? desktopTracker.getActiveDistractionStreakSeconds()
      : 0;
    const nowMin = getVnNowMinutes();
    const quiet = isWithinQuietHours(nowMin, settings.quietHoursStart, settings.quietHoursEnd);

    if (
      !settings.distractionGuardEnabled ||
      plannedRestMode ||
      isDndActive(settings) ||
      quiet ||
      !hasRunningQuest
    ) {
      return {
        distractionAlertLevel: 'none',
        distractionStreakSeconds,
        hasRunningQuest,
      };
    }

    const toastThresholdSec = Math.max(60, (settings.distractionThresholdMinutes || 3) * 60);
    if (distractionStreakSeconds >= toastThresholdSec) {
      return {
        distractionAlertLevel: 'toast',
        distractionStreakSeconds,
        hasRunningQuest,
      };
    }
    if (distractionStreakSeconds >= 30) {
      return {
        distractionAlertLevel: 'soft_hud',
        distractionStreakSeconds,
        hasRunningQuest,
      };
    }
    return {
      distractionAlertLevel: 'none',
      distractionStreakSeconds,
      hasRunningQuest,
    };
  }

  private async emitNudge(params: {
    dateKey: string;
    kind: AssistantNudge['kind'];
    title: string;
    message: string;
    forceToast?: boolean;
  }): Promise<AssistantNudge> {
    const settings = db.getAssistantSettings();
    const player = db.getPlayer();
    const nowMin = getVnNowMinutes();
    const quiet = isWithinQuietHours(nowMin, settings.quietHoursStart, settings.quietHoursEnd);
    const dnd = isDndActive(settings);

    let toastSent = false;
    if (
      params.forceToast ||
      (settings.windowsToastEnabled && !quiet && !dnd && !player.plannedRestMode)
    ) {
      toastSent = await sendWindowsToast(params.title, params.message);
    }

    const nudge: AssistantNudge = {
      id: uid('ndg'),
      dateKey: params.dateKey,
      kind: params.kind,
      title: params.title,
      message: params.message,
      createdAt: new Date().toISOString(),
      dismissed: false,
      toastSent,
    };
    db.addAssistantNudge(nudge);
    return nudge;
  }

  async runTick(): Promise<void> {
    try {
      const settings = db.getAssistantSettings();
      const player = db.getPlayer();
      const vn = getVnNowParts();
      const dateKey = vn.dateKey;
      const nowMin = vn.hour * 60 + vn.minute;

      if (
        isWithinQuietHours(nowMin, settings.quietHoursStart, settings.quietHoursEnd) ||
        isDndActive(settings) ||
        player.plannedRestMode
      ) {
        return;
      }

      const existingNudges = db.getAssistantNudges(50);
      const todayNudges = existingNudges.filter((n) => n.dateKey === dateKey);
      const timetable = db.getTimetableBlocks();
      const todayDow = getVnDayOfWeek();
      const dayAnalysis = analyzeDaySchedule(timetable, todayDow, player.energyLevel);
      const todayQuests = db.getQuests(dateKey);

      const currentCategory = desktopTracker.getCurrentApp()?.category;
      const inPureDeepFocus =
        currentCategory === 'deep_work' || currentCategory === 'study_research';

      // 1. Morning Briefing (07:05 - 11:30, once per day; suppressed during pure deep focus)
      if (
        !inPureDeepFocus &&
        nowMin >= 7 * 60 + 5 &&
        nowMin <= 11 * 60 + 30 &&
        !todayNudges.some((n) => n.kind === 'morning_briefing')
      ) {
        const pendingCount = todayQuests.filter((q) => q.status === 'pending').length;
        const bestWin = [...dayAnalysis.freeWindows].sort(
          (a, b) => b.durationMinutes - a.durationMinutes
        )[0];
        const winText = bestWin ? `${bestWin.startTime}–${bestWin.endTime}` : 'Linh hoạt';
        await this.emitNudge({
          dateKey,
          kind: 'morning_briefing',
          title: 'RPG Life Tracker — Chào ngày mới',
          message: `Hôm nay có ${(dayAnalysis.totalFreeMinutes / 60).toFixed(1)}h rảnh (khung vàng: ${winText}) & ${pendingCount} việc chờ.`,
        });
      }

      // 2. 2-Tier Calm Distraction Guard (Tier 1 >=30s soft_hud only; Tier 2 toast after threshold + cooldown)
      const guard = this.computeDistractionGuardState(
        settings,
        todayQuests,
        Boolean(player.plannedRestMode)
      );
      if (guard.distractionAlertLevel === 'toast') {
        const cooldownMs = (settings.distractionCooldownMinutes || 15) * 60 * 1000;
        if (Date.now() - this.lastDistractionNudgeAt >= cooldownMs) {
          this.lastDistractionNudgeAt = Date.now();
          const appName = desktopTracker.getCurrentApp()?.processName || 'ứng dụng giải trí';
          const streakMins = Math.max(1, Math.round(guard.distractionStreakSeconds / 60));
          await this.emitNudge({
            dateKey,
            kind: 'distraction_guard',
            title: 'Nhắc nhẹ Tập Trung',
            message: `Bạn đang mở ${appName} khoảng ${streakMins} phút trong phiên tập trung. Quay lại nhịp chính nhé!`,
          });
        }
      }

      // 3. Upcoming Block / Quest Reminder (5m before start; fixed blocks allowed in deep focus)
      if (settings.upcomingBlockReminderEnabled) {
        const lead = Math.max(1, settings.upcomingReminderLeadMinutes || 5);
        for (const blk of dayAnalysis.blocks) {
          if (blk.type === 'sleep' || blk.type === 'rest_buffer') continue;
          const s = timeToMinutes(blk.startTime);
          const diff = s - nowMin;
          if (diff >= 1 && diff <= lead) {
            const key = `${dateKey}::blk::${blk.id}`;
            if (!this.remindedBlockKeys.has(key)) {
              this.remindedBlockKeys.add(key);
              await this.emitNudge({
                dateKey,
                kind: 'upcoming_block',
                title: `Sắp tới giờ: ${blk.title}`,
                message: `Còn ${diff} phút nữa bắt đầu khung ${blk.startTime}–${blk.endTime}.`,
              });
            }
          }
        }
        if (!inPureDeepFocus) {
          for (const q of todayQuests) {
            if (q.status !== 'pending') continue;
            const m = q.scheduledSlot.match(/^(\d{1,2}:\d{2})/);
            if (!m) continue;
            const s = timeToMinutes(m[1]);
            const diff = s - nowMin;
            if (diff >= 1 && diff <= lead) {
              const key = `${dateKey}::q::${q.id}`;
              if (!this.remindedBlockKeys.has(key)) {
                this.remindedBlockKeys.add(key);
                await this.emitNudge({
                  dateKey,
                  kind: 'upcoming_block',
                  title: `Sắp tới Quest: ${q.title}`,
                  message: `Còn ${diff} phút tới giờ (${q.scheduledSlot}). Bấm ▶ Bắt đầu khi sẵn sàng!`,
                });
              }
            }
          }
        }
      }

      // 4. Ultradian Break Nudge (default >= 80 min continuous focus; allowed in deep focus when enabled)
      if (
        settings.ultradianBreakEnabled &&
        desktopTracker.getContinuousDeepWorkMinutes() >= (settings.ultradianBreakMinutes || 80) &&
        Date.now() - this.lastUltradianNudgeAt >= 45 * 60 * 1000
      ) {
        this.lastUltradianNudgeAt = Date.now();
        await this.emitNudge({
          dateKey,
          kind: 'ultradian_break',
          title: 'Nhắc Nghỉ Mắt & Giãn Cơ',
          message: `Bạn đã tập trung liên tục ~${Math.round(desktopTracker.getContinuousDeepWorkMinutes())} phút. Hãy đứng dậy uống nước & nhìn xa 5 phút!`,
        });
      }

      // 5. Evening Wind-down (default 22:30, once per day; suppressed during pure deep focus)
      const windMin = timeToMinutes(settings.eveningWinddownTime || '22:30');
      if (
        !inPureDeepFocus &&
        settings.eveningWinddownEnabled &&
        nowMin >= windMin &&
        !todayNudges.some((n) => n.kind === 'evening_winddown')
      ) {
        await this.emitNudge({
          dateKey,
          kind: 'evening_winddown',
          title: 'Tổng Kết Cuối Ngày',
          message: 'Đã tới giờ phản tư buổi tối — hãy ghi 1 dòng Reflection và bấm "Chốt Ngày" trước giờ ngủ 23:30.',
        });
      }
    } catch {
      // Keep background daemon resilient
    }
  }

  async sendTestNotification(): Promise<{ ok: boolean; message: string; nudge: AssistantNudge }> {
    const dateKey = getVnTodayKey();
    const title = 'RPG Life Tracker — Thông báo Thử nghiệm';
    const message = 'Trợ lý PC đang hoạt động tốt! Khi cần nhắc tập trung hoặc chốt ngày, hệ thống sẽ báo gọn nhẹ tại đây.';
    const toastSent = await sendWindowsToast(title, message);
    const nudge: AssistantNudge = {
      id: uid('ndg'),
      dateKey,
      kind: 'system',
      title,
      message,
      createdAt: new Date().toISOString(),
      dismissed: false,
      toastSent,
    };
    db.addAssistantNudge(nudge);
    return {
      ok: true,
      message: toastSent
        ? 'Đã gửi Windows Toast Notification & lưu vào Nhật ký Trợ lý!'
        : 'Đã ghi nhận thông báo thử nghiệm vào Nhật ký Trợ lý (Toast bỏ qua trong Test Mode hoặc OS không hỗ trợ).',
      nudge,
    };
  }

  creditUncreditedFocusToSkills(): {
    ok: boolean;
    minutesCredited: number;
    skillXpAdded: number;
    bonusSp: number;
    message: string;
  } {
    const dateKey = getVnTodayKey();
    const logs = db.getActivityLogsByDate(dateKey).filter(
      (l) => !l.creditedToSkill && (l.category === 'deep_work' || l.category === 'study_research')
    );

    const totalSec = logs.reduce((acc, l) => acc + l.durationSeconds, 0);
    const minutesCredited = Math.floor(totalSec / 60);

    if (minutesCredited < 10) {
      return {
        ok: false,
        minutesCredited: 0,
        skillXpAdded: 0,
        bonusSp: 0,
        message: `Hiện mới tích lũy ${minutesCredited}p Deep Work/Học tập chưa quy đổi (cần tối thiểu 10 phút).`,
      };
    }

    const studySec = logs
      .filter((l) => l.category === 'study_research')
      .reduce((acc, l) => acc + l.durationSeconds, 0);
    const deepSec = logs
      .filter((l) => l.category === 'deep_work')
      .reduce((acc, l) => acc + l.durationSeconds, 0);

    const topProc = logs[0]?.processName || 'PC Deep Work';
    const skills = db.getSkills();

    const buckets: Array<{ skillId: string; minutes: number; label: string }> = [];
    const totalFocusSec = deepSec + studySec;
    if (deepSec > 0 && studySec > 0 && totalFocusSec > 0) {
      const deepMins = Math.max(1, Math.round((deepSec / totalFocusSec) * minutesCredited));
      const studyMins = Math.max(1, minutesCredited - deepMins);
      buckets.push({ skillId: 'sk-int-1', minutes: deepMins, label: 'Deep Work' });
      buckets.push({ skillId: 'sk-knw-1', minutes: studyMins, label: 'Học & Nghiên cứu' });
    } else if (studySec >= deepSec) {
      buckets.push({ skillId: 'sk-knw-1', minutes: minutesCredited, label: 'Học & Nghiên cứu' });
    } else {
      buckets.push({ skillId: 'sk-int-1', minutes: minutesCredited, label: 'Deep Work' });
    }

    let skillXpAdded = 0;
    let bonusSp = 0;
    const creditedNames: string[] = [];

    db.runTransaction(() => {
      const player = db.getPlayer();

      for (const b of buckets) {
        if (b.minutes <= 0) continue;
        const targetSkill =
          skills.find((s) => s.id === b.skillId) ||
          skills.find((s) => s.id === 'sk-exe-1') ||
          skills[0];
        if (!targetSkill) continue;

        const bucketXp = Math.max(10, Math.round(b.minutes * 2.2));
        skillXpAdded += bucketXp;

        const res = applyTaskContributionToSkill(targetSkill, {
          dateKey,
          title: `PC ${b.label} (${b.minutes}p · ${topProc})`,
          minutes: b.minutes,
          xpAdded: bucketXp,
        });
        bonusSp += res.bonusSp;
        db.saveSkill(targetSkill);
        creditedNames.push(`${targetSkill.name} (+${bucketXp} XP)`);
      }

      db.markActivityCredited(dateKey);

      if (bonusSp > 0) {
        player.skillPoints = (player.skillPoints || 0) + bonusSp;
        player.totalSkillPointsEarned = (player.totalSkillPointsEarned || 0) + bonusSp;
        db.savePlayer(player);
      }

      db.addAuditLog(
        'SKILL_VERIFIED',
        `Quy đổi ${minutesCredited}p PC Focus → ${creditedNames.join(', ')}${bonusSp > 0 ? ` (+${bonusSp} Bonus SP)` : ''}`,
        { minutesCredited, skillXpAdded, bonusSp, creditedNames }
      );
      db.addMemoryLog({
        id: uid('log'),
        timestamp: new Date().toISOString(),
        agent: 'SCHOLAR',
        eventType: 'QUEST_COMPLETED',
        summary: `PC Focus Sync: +${minutesCredited}p → ${creditedNames.join(' & ')}`,
        insight: `Theo dõi PC tự động xác thực ${minutesCredited} phút tập trung sâu.`,
      });
    });

    db.checkpointWal();

    return {
      ok: true,
      minutesCredited,
      skillXpAdded,
      bonusSp,
      message: `Đã quy đổi ${minutesCredited}p tập trung PC → ${creditedNames.join(' · ')}${bonusSp > 0 ? ` (+${bonusSp} Bonus SP!)` : '!'}`,
    };
  }

  getOverview(state: SystemStatePayload): AssistantOverviewPayload {
    const dateKey = getVnTodayKey();
    const settings = db.getAssistantSettings();
    const dndActive = isDndActive(settings);
    const dndUntil = dndActive ? (settings.dndUntil ?? null) : null;
    const guard = this.computeDistractionGuardState(
      settings,
      state.quests,
      Boolean(state.player.plannedRestMode)
    );
    return {
      settings,
      startup: getStartupStatus(),
      activity: desktopTracker.getDailySummary(dateKey),
      briefing: buildMorningBriefing(state),
      nudges: db.getAssistantNudges(20),
      trackerRunning: desktopTracker.isRunning(),
      distractionAlertLevel: guard.distractionAlertLevel,
      distractionStreakSeconds: guard.distractionStreakSeconds,
      dndActive,
      dndUntil,
      externalTrackerActive: desktopTracker.isExternalTrackerActive(),
    };
  }
}

export const assistantDaemon = new AssistantDaemonService();
