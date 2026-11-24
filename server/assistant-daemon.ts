import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { db } from './db.ts';
import { desktopTracker } from './desktop-tracker.ts';
import { analyzeDaySchedule, inferSkillIdForTask, timeToMinutes } from './scheduler.ts';
import { applyTaskContributionToSkill } from './skill-tree-data.ts';
import { getVnDayOfWeek, getVnNowMinutes, getVnNowParts, getVnTodayKey } from './time-vn.ts';
import type {
  AssistantNudge,
  AssistantOverviewPayload,
  MorningBriefingPayload,
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

    let toastSent = false;
    if (
      params.forceToast ||
      (settings.windowsToastEnabled && !quiet && !player.plannedRestMode)
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

      // 1. Morning Briefing (07:05 - 11:30, once per day)
      if (
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

      // 2. Distraction Guard
      const hasRunningQuest = todayQuests.some(
        (q) => q.status === 'pending' && Boolean(q.startedAt) && !q.isPaused
      );
      const inScheduledFocusBlock = dayAnalysis.blocks.some((b) => {
        if (b.type !== 'fixed_habit' && b.type !== 'class_work') return false;
        const s = timeToMinutes(b.startTime);
        const e = timeToMinutes(b.endTime);
        return nowMin >= s && nowMin < e;
      });

      if (
        settings.distractionGuardEnabled &&
        (hasRunningQuest || inScheduledFocusBlock) &&
        desktopTracker.getContinuousDistractionMinutes() >=
          (settings.distractionThresholdMinutes || 3)
      ) {
        const cooldownMs = (settings.distractionCooldownMinutes || 15) * 60 * 1000;
        if (Date.now() - this.lastDistractionNudgeAt >= cooldownMs) {
          this.lastDistractionNudgeAt = Date.now();
          const appName = desktopTracker.getCurrentApp()?.processName || 'ứng dụng giải trí';
          await this.emitNudge({
            dateKey,
            kind: 'distraction_guard',
            title: 'Nhắc nhẹ Tập Trung',
            message: `Bạn đang mở ${appName} hơn ${settings.distractionThresholdMinutes || 3} phút trong phiên tập trung. Quay lại nhịp chính nhé!`,
          });
        }
      }

      // 3. Upcoming Block / Quest Reminder (5m before start)
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

      // 4. Ultradian Break Nudge (default >= 80 min continuous focus)
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

      // 5. Evening Wind-down (default 22:30, once per day)
      const windMin = timeToMinutes(settings.eveningWinddownTime || '22:30');
      if (
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
    const inferredStat = studySec > deepSec ? 'PER' : 'INT';

    const skills = db.getSkills();
    const targetSkillId =
      studySec > deepSec
        ? skills.find((s) => s.id === 'sk-knw-1')?.id ||
          inferSkillIdForTask(topProc, 'study research active recall', 'PER', skills)
        : inferSkillIdForTask(topProc, 'deep work coding focus', inferredStat, skills) ||
          skills.find((s) => s.id === 'sk-int-1')?.id;

    const targetSkill = skills.find((s) => s.id === targetSkillId) || skills[0];
    if (!targetSkill) {
      return {
        ok: false,
        minutesCredited: 0,
        skillXpAdded: 0,
        bonusSp: 0,
        message: 'Không tìm thấy kỹ năng để quy đổi.',
      };
    }

    const skillXpAdded = Math.max(15, Math.round(minutesCredited * 2.2));
    let bonusSp = 0;

    db.runTransaction(() => {
      const res = applyTaskContributionToSkill(targetSkill, {
        dateKey,
        title: `PC Focus Sync (${minutesCredited}p · ${topProc})`,
        minutes: minutesCredited,
        xpAdded: skillXpAdded,
      });
      bonusSp = res.bonusSp;
      db.saveSkill(targetSkill);
      db.markActivityCredited(dateKey);

      const player = db.getPlayer();
      if (bonusSp > 0) {
        player.skillPoints = (player.skillPoints || 0) + bonusSp;
        player.totalSkillPointsEarned = (player.totalSkillPointsEarned || 0) + bonusSp;
        db.savePlayer(player);
      }

      db.addAuditLog(
        'SKILL_VERIFIED',
        `Quy đổi ${minutesCredited}p PC Focus → +${skillXpAdded} Skill XP cho "${targetSkill.name}"${bonusSp > 0 ? ` (+${bonusSp} Bonus SP)` : ''}`,
        { skillId: targetSkill.id, minutesCredited, skillXpAdded, bonusSp }
      );
      db.addMemoryLog({
        id: uid('log'),
        timestamp: new Date().toISOString(),
        agent: 'SCHOLAR',
        eventType: 'QUEST_COMPLETED',
        summary: `PC Focus Sync: +${minutesCredited}p → "${targetSkill.name}" (+${skillXpAdded} Skill XP)`,
        insight: `Theo dõi PC tự động xác thực ${minutesCredited} phút tập trung sâu.`,
      });
    });

    db.checkpointWal();

    return {
      ok: true,
      minutesCredited,
      skillXpAdded,
      bonusSp,
      message: `Đã quy đổi ${minutesCredited}p tập trung trên PC → +${skillXpAdded} Skill XP cho "${targetSkill.name}"${bonusSp > 0 ? ` (+${bonusSp} Bonus SP!)` : '!'}`,
    };
  }

  getOverview(state: SystemStatePayload): AssistantOverviewPayload {
    const dateKey = getVnTodayKey();
    return {
      settings: db.getAssistantSettings(),
      startup: getStartupStatus(),
      activity: desktopTracker.getDailySummary(dateKey),
      briefing: buildMorningBriefing(state),
      nudges: db.getAssistantNudges(20),
      trackerRunning: desktopTracker.isRunning(),
    };
  }
}

export const assistantDaemon = new AssistantDaemonService();
