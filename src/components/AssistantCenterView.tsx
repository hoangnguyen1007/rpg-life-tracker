import React, { useCallback, useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import {
  PixelRivets,
  PxAutomaton,
  PxBell,
  PxBolt,
  PxCheck,
  PxChevron,
  PxClock,
  PxClose,
  PxDashboard,
  PxEye,
  PxEyeOff,
  PxFlame,
  PxGear,
  PxMiniToggle,
  PxPhone,
  PxPlus,
  PxRefresh,
  PxSave,
  PxShield,
  PxSparkle,
  PxSun,
  PxTarget,
  PxTrash,
  PxWarn,
} from './PixelIcons';
import type {
  ActivityCategory,
  ActivityRule,
  AssistantOverviewPayload,
  AssistantSettings,
  AttributeKey,
  BackupStatusPayload,
  LanAccessPayload,
  Quest,
  SystemStatePayload,
} from '../types/system';
import { isTauriDesktop, systemApi } from '../utils/api';

export interface AssistantCenterViewProps {
  overview: AssistantOverviewPayload | null;
  pendingQuests?: Quest[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
  onToggleTracker: (enabled: boolean) => Promise<void>;
  onUpdateSettings: (patch: Partial<AssistantSettings>) => Promise<void>;
  onInstallStartup: (opts: { createDesktopShortcut: boolean; launchTray: boolean }) => Promise<void>;
  onUninstallStartup: (opts: { removeDesktopShortcut: boolean }) => Promise<void>;
  onLaunchTray: () => Promise<void>;
  onTestNotification: () => Promise<void>;
  onDismissNudge: (id: string) => Promise<void>;
  onSyncFocusToSkill: () => Promise<void>;
  onReclassifyApp?: (payload: {
    keyword: string;
    category: Exclude<ActivityCategory, 'idle'>;
  }) => Promise<void>;
  onConvertFocusToQuest?: (payload: {
    mode: 'complete_new' | 'credit_pending';
    title?: string;
    questId?: string;
    primaryStat?: AttributeKey;
  }) => Promise<void>;
  onRunOrchestrate?: () => Promise<void>;
  onSetDnd?: (minutes: number) => Promise<void>;
  onStateChanged?: (state: SystemStatePayload) => void;
  hudVisible?: boolean;
  onToggleHudVisible?: () => void;
  onDockHudCorner?: () => void;
}

const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; badgeCls: string; barCls: string }
> = {
  deep_work: {
    label: 'Deep Work',
    badgeCls: 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]',
    barCls: 'bg-[var(--px-green)]',
  },
  study_research: {
    label: 'Học tập',
    badgeCls: 'border-[var(--px-blue)] bg-[var(--bg-surface-2)] text-[var(--px-blue-text)]',
    barCls: 'bg-[var(--px-blue)]',
  },
  communication: {
    label: 'Giao tiếp',
    badgeCls: 'border-[var(--px-plum)] bg-[var(--bg-surface-2)] text-[var(--px-plum-text)]',
    barCls: 'bg-[var(--px-plum)]',
  },
  distraction: {
    label: 'Xao nhãng',
    badgeCls: 'border-[var(--px-red)] bg-[var(--bg-surface-2)] text-[var(--px-red-text)]',
    barCls: 'bg-[var(--px-red)]',
  },
  other: {
    label: 'Khác',
    badgeCls: 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-sub',
    barCls: 'bg-[var(--border-strong)]',
  },
  idle: {
    label: 'Nghỉ / Idle',
    badgeCls: 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-dim',
    barCls: 'bg-[var(--border-hairline)]',
  },
};

const QUICK_RECLASSIFY_CHOICES: Array<{
  category: Exclude<ActivityCategory, 'idle' | 'other'>;
  label: string;
}> = [
  { category: 'deep_work', label: 'Deep Work' },
  { category: 'study_research', label: 'Học tập' },
  { category: 'communication', label: 'Giao tiếp' },
  { category: 'distraction', label: 'Xao nhãng' },
];

export const AssistantCenterView: React.FC<AssistantCenterViewProps> = ({
  overview,
  pendingQuests = [],
  loading = false,
  onRefresh,
  onToggleTracker,
  onUpdateSettings,
  onInstallStartup,
  onUninstallStartup,
  onLaunchTray,
  onTestNotification,
  onDismissNudge,
  onSyncFocusToSkill,
  onReclassifyApp,
  onConvertFocusToQuest,
  onRunOrchestrate,
  onSetDnd,
  onStateChanged,
  hudVisible = false,
  onToggleHudVisible,
  onDockHudCorner,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleCategory, setNewRuleCategory] =
    useState<Exclude<ActivityCategory, 'idle'>>('deep_work');
  const [selectedPendingQuestId, setSelectedPendingQuestId] = useState<string>(
    () => pendingQuests[0]?.id || ''
  );

  // LAN Mobile QR Pairing State
  const [lanInfo, setLanInfo] = useState<LanAccessPayload | null>(null);
  const [copiedLanUrl, setCopiedLanUrl] = useState(false);
  const [lanNotice, setLanNotice] = useState<string | null>(null);

  // Rotating Auto-Backup State
  const [backupStatus, setBackupStatus] = useState<BackupStatusPayload | null>(null);
  const [backupDirInput, setBackupDirInput] = useState('');
  const [retentionInput, setRetentionInput] = useState(14);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const loadLanAndBackup = useCallback(async () => {
    try {
      const [lanRes, bakRes] = await Promise.all([
        systemApi.getLanInfo(),
        systemApi.getBackupStatus(),
      ]);
      setLanInfo(lanRes);
      setBackupStatus(bakRes);
      setBackupDirInput(bakRes.backupDir || '');
      setRetentionInput(bakRes.retentionDays || 14);
    } catch {
      // Non-fatal if backend endpoints are warming up
    }
  }, []);

  useEffect(() => {
    void loadLanAndBackup();
  }, [loadLanAndBackup]);

  useEffect(() => {
    if (
      pendingQuests.length > 0 &&
      !pendingQuests.some((q) => q.id === selectedPendingQuestId)
    ) {
      setSelectedPendingQuestId(pendingQuests[0].id);
    }
  }, [pendingQuests, selectedPendingQuestId]);

  const runBusy = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  if (!overview) {
    return (
      <section className="studio-surface relative p-8 text-center">
        <PixelRivets />
        <PxAutomaton size={28} className="mx-auto text-[var(--px-gold-text)]" />
        <h2 className="mt-2 font-display text-base font-extrabold text-main">
          Trợ Lý PC &amp; Theo Dõi Hoạt Động
        </h2>
        <p className="mt-1 text-xs text-sub">
          {loading ? 'Đang tải trạng thái Trợ lý PC...' : 'Chưa có dữ liệu từ daemon cục bộ.'}
        </p>
        <button
          type="button"
          onClick={() => runBusy('refresh', onRefresh)}
          disabled={loading || busyKey === 'refresh'}
          className="btn-primary mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs"
        >
          <PxRefresh size={14} className={loading ? 'animate-spin' : ''} />
          <span>Tải Trạng Thái</span>
        </button>
      </section>
    );
  }

  const { settings, startup, activity, briefing, nudges, trackerRunning } = overview;

  const segTotal = Math.max(
    1,
    activity.deepWorkMinutes +
      activity.studyMinutes +
      activity.communicationMinutes +
      activity.distractionMinutes +
      activity.otherMinutes
  );

  const segments: Array<{ key: ActivityCategory; mins: number }> = [
    { key: 'deep_work', mins: activity.deepWorkMinutes },
    { key: 'study_research', mins: activity.studyMinutes },
    { key: 'communication', mins: activity.communicationMinutes },
    { key: 'distraction', mins: activity.distractionMinutes },
    { key: 'other', mins: activity.otherMinutes },
  ];

  // Build 18-hour timeline (06h -> 23h)
  const hourlyMap = new Map(
    (activity.hourlyBreakdown || []).map((h) => [h.hour, h])
  );
  const hourlyBars = Array.from({ length: 18 }, (_, i) => {
    const hr = 6 + i;
    return (
      hourlyMap.get(hr) || {
        hour: hr,
        deepWorkMins: 0,
        studyMins: 0,
        commMins: 0,
        distractionMins: 0,
        otherMins: 0,
        dominantCategory: 'none' as const,
      }
    );
  });
  const maxHourTotal = Math.max(
    15,
    ...hourlyBars.map(
      (h) => h.deepWorkMins + h.studyMins + h.commMins + h.distractionMins + h.otherMins
    )
  );

  const distractionBudget =
    activity.distractionBudgetMinutes ?? settings.distractionBudgetMinutes ?? 45;
  const distractionPct = Math.min(
    100,
    Math.round((activity.distractionMinutes / Math.max(1, distractionBudget)) * 100)
  );
  const isOverBudget = activity.distractionMinutes > distractionBudget;

  const suggestedSession = activity.suggestedFocusSession;
  const effectiveQuestId = selectedPendingQuestId || pendingQuests[0]?.id || '';

  const dndRemainingMins =
    overview.dndActive && overview.dndUntil
      ? Math.max(1, Math.ceil((Date.parse(overview.dndUntil) - Date.now()) / 60000))
      : 0;
  const alertLevel = overview.distractionAlertLevel || 'none';

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const kw = newRuleKeyword.trim().toLowerCase();
    if (!kw) return;
    const nextRule: ActivityRule = {
      id: `rule-${Date.now()}`,
      keyword: kw,
      category: newRuleCategory,
    };
    await runBusy('rules', () =>
      onUpdateSettings({ customRules: [nextRule, ...(settings.customRules || [])] })
    );
    setNewRuleKeyword('');
  };

  const handleRemoveRule = async (id: string) => {
    await runBusy(`del-${id}`, () =>
      onUpdateSettings({
        customRules: (settings.customRules || []).filter((r) => r.id !== id),
      })
    );
  };

  const handleSetDndAction = async (minutes: number) => {
    await runBusy('dnd', async () => {
      if (onSetDnd) {
        await onSetDnd(minutes);
      } else {
        await systemApi.setAssistantDnd(minutes);
        await onRefresh();
      }
    });
  };

  const handleToggleLan = async (enabled: boolean) => {
    await runBusy('lan-toggle', async () => {
      setLanNotice(null);
      const res = await systemApi.updateLanConfig({ enabled });
      setLanInfo(res.lan);
      setLanNotice(res.message);
    });
  };

  const handleRotateLanToken = async () => {
    await runBusy('lan-rotate', async () => {
      setLanNotice(null);
      const res = await systemApi.updateLanConfig({ rotateToken: true });
      setLanInfo(res.lan);
      setLanNotice(res.message);
    });
  };

  const handleSaveBackupConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await runBusy('bak-cfg', async () => {
      setBackupNotice(null);
      const res = await systemApi.updateBackupConfig({
        enabled: true,
        backupDir: backupDirInput.trim(),
        retentionDays: Math.max(1, Math.min(90, retentionInput || 14)),
      });
      setBackupStatus(res.status);
      setBackupNotice(res.message);
    });
  };

  const handleRunBackupNow = async () => {
    await runBusy('bak-run', async () => {
      setBackupNotice(null);
      const res = await systemApi.runBackupNow();
      setBackupStatus(res.status);
      setBackupNotice(res.message);
    });
  };

  const handleRestoreBackup = async (filename: string) => {
    await runBusy(`bak-res-${filename}`, async () => {
      setBackupNotice(null);
      const res = await systemApi.restoreBackup(filename);
      setConfirmRestoreFile(null);
      setBackupNotice(res.message);
      if (onStateChanged) onStateChanged(res.state);
      const freshStatus = await systemApi.getBackupStatus();
      setBackupStatus(freshStatus);
    });
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Morning Briefing & Smart Status Strip */}
      <section className="studio-surface relative p-5">
        <PixelRivets />
        <div className="flex flex-col gap-3 border-b-2 pb-4 lg:flex-row lg:items-center lg:justify-between studio-divider">
          <div className="flex items-start gap-3">
            <div className="px-inset rounded-none border-[var(--px-gold)] p-2 text-[var(--px-gold-text)]">
              <PxSun size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-extrabold text-main">
                  {briefing.greeting}
                </h2>
                <span className="font-mono text-[11px] font-bold text-[var(--px-gold-text)]">
                  {briefing.dayLabel} · {briefing.activeChapterLabel}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-sub">{briefing.suggestedAction}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onRunOrchestrate && (
              <button
                type="button"
                disabled={busyKey === 'orch'}
                onClick={() => runBusy('orch', onRunOrchestrate)}
                className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs"
              >
                <PxSparkle size={14} />
                <span>AI Lập Kế Hoạch</span>
              </button>
            )}
            <button
              type="button"
              disabled={busyKey === 'refresh'}
              onClick={() => runBusy('refresh', async () => {
                await onRefresh();
                await loadLanAndBackup();
              })}
              className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs"
            >
              <PxRefresh size={14} className={busyKey === 'refresh' ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="px-inset rounded-none px-3 py-2">
            <div className="font-mono text-[10px] uppercase text-dim">Lịch cố định</div>
            <div className="mt-0.5 font-mono text-sm font-extrabold text-main">
              {briefing.fixedBlocksCount} khối
            </div>
          </div>
          <div className="px-inset rounded-none px-3 py-2">
            <div className="font-mono text-[10px] uppercase text-dim">Giờ rảnh</div>
            <div className="mt-0.5 font-mono text-sm font-extrabold text-[var(--px-green-text)]">
              {briefing.freeHours.toFixed(1)}h
            </div>
          </div>
          <div className="px-inset rounded-none px-3 py-2">
            <div className="font-mono text-[10px] uppercase text-dim">Khung vàng Deep Work</div>
            <div className="mt-0.5 truncate font-mono text-xs font-extrabold text-[var(--px-gold-text)]">
              {briefing.bestDeepWorkWindow || 'Chưa có'}
            </div>
          </div>
          <div className="px-inset rounded-none px-3 py-2">
            <div className="font-mono text-[10px] uppercase text-dim">Việc chờ</div>
            <div className="mt-0.5 font-mono text-sm font-extrabold text-main">
              {briefing.pendingQuestsCount} việc
            </div>
          </div>
        </div>
      </section>

      {/* Calm Guard Status + DND Snooze + Floating Mini HUD Launcher Bar */}
      <section className="studio-surface relative p-4 sm:p-5">
        <PixelRivets />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-wide text-main">
              <PxShield size={14} className="text-[var(--px-gold-text)]" />
              <span>Calm Guard &amp; Mini HUD:</span>
            </span>
            <span
              className={`rounded-none border-2 px-2.5 py-1 font-mono text-[11px] font-bold ${
                alertLevel === 'toast'
                  ? 'border-[var(--px-red)] bg-[var(--bg-surface-2)] text-[var(--px-red-text)]'
                  : alertLevel === 'soft_hud'
                    ? 'border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]'
                    : 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]'
              }`}
            >
              Guard:{' '}
              {alertLevel === 'toast'
                ? `Cảnh báo Toast (${Math.floor((overview.distractionStreakSeconds || 0) / 60)}p)`
                : alertLevel === 'soft_hud'
                  ? `Nhắc nhẹ HUD (${overview.distractionStreakSeconds || 0}s)`
                  : 'Ổn định (None)'}
            </span>
            <span
              className={`rounded-none border-2 px-2.5 py-1 font-mono text-[11px] font-bold ${
                overview.externalTrackerActive
                  ? 'border-[var(--px-blue)] bg-[var(--bg-surface-2)] text-[var(--px-blue-text)]'
                  : 'border-[var(--border-ink)] bg-[var(--bg-subtle)] text-sub'
              }`}
            >
              Engine: {overview.externalTrackerActive ? 'Rust Win32 Native' : 'Windows PowerShell'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {overview.dndActive ? (
              <div className="flex items-center gap-2">
                <span className="rounded-none border-2 border-[var(--px-gold)] bg-[var(--bg-surface-2)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--px-gold-text)]">
                  Đang tạm im ({dndRemainingMins}p)
                </span>
                <button
                  type="button"
                  disabled={busyKey === 'dnd'}
                  onClick={() => handleSetDndAction(0)}
                  className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <PxBell size={14} className="text-[var(--px-green-text)]" />
                  <span>Tắt DND</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busyKey === 'dnd'}
                onClick={() => handleSetDndAction(60)}
                className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <PxBell size={14} muted className="text-[var(--px-gold-text)]" />
                <span>Tạm im 1 giờ (DND)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onToggleHudVisible) {
                  onToggleHudVisible();
                } else {
                  window.open('/#/hud', 'rpg_hud', 'width=430,height=250');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${
                hudVisible ? 'btn-secondary' : 'btn-primary'
              }`}
              title="Bật hoặc ẩn 2D Pixel HUD nổi trên màn hình (Ctrl+Shift+Space)"
            >
              {hudVisible ? (
                <>
                  <PxEyeOff size={14} className="text-[var(--px-gold-text)]" />
                  <span>Ẩn Mini HUD</span>
                </>
              ) : (
                <>
                  <PxEye size={14} />
                  <span>Hiện Mini HUD</span>
                </>
              )}
            </button>

            {onDockHudCorner && (
              <button
                type="button"
                onClick={onDockHudCorner}
                className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                title="Đưa Mini HUD về lại góc phải phía trên thanh Taskbar"
              >
                <PxMiniToggle size={14} className="text-[var(--px-blue-text)]" />
                <span>Về góc Taskbar</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Smart Unlogged Focus -> Quest Bridge Card */}
      {activity.uncreditedFocusMinutes >= 10 && (
        <section className="studio-surface relative border-[var(--px-green)] bg-[var(--bg-surface-2)] p-4 sm:p-5">
          <PixelRivets />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="px-inset rounded-none border-[var(--px-green)] p-2 text-[var(--px-green-text)]">
                <PxFlame size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-pixel rounded-none border-2 border-[var(--px-green)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[9px] font-bold text-[var(--px-green-text)]">
                    FOCUS BRIDGE · +{activity.uncreditedFocusMinutes} PHÚT CHƯA QUY ĐỔI
                  </span>
                  {suggestedSession?.topApp && (
                    <span className="font-mono text-xs font-bold text-main">
                      App chính: {suggestedSession.topApp}
                    </span>
                  )}
                  {suggestedSession?.skillName && (
                    <span className="font-mono text-[11px] font-bold text-[var(--px-blue-text)]">
                      → {suggestedSession.skillName}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-sub">
                  PC ghi nhận <strong className="text-main">{activity.uncreditedFocusMinutes} phút</strong> tập trung thực tế
                  {suggestedSession?.suggestedTitle ? ` (${suggestedSession.suggestedTitle})` : ''}. Quy đổi ngay thành Quest để nhận XP, Gold, SP và Skill XP!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onConvertFocusToQuest && (
                <button
                  type="button"
                  disabled={busyKey === 'convert-new'}
                  onClick={() =>
                    runBusy('convert-new', () =>
                      onConvertFocusToQuest({
                        mode: 'complete_new',
                        title:
                          suggestedSession?.suggestedTitle ||
                          `Phiên Tập Trung (${activity.uncreditedFocusMinutes}p)`,
                        primaryStat: suggestedSession?.primaryStat || 'INT',
                      })
                    )
                  }
                  className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs"
                >
                  <PxCheck size={14} />
                  <span>Ghi nhận thành Quest đã xong</span>
                </button>
              )}

              {onConvertFocusToQuest && pendingQuests.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={effectiveQuestId}
                    onChange={(e) => setSelectedPendingQuestId(e.target.value)}
                    className="max-w-[180px] rounded-none px-2 py-1.5 text-xs"
                    aria-label="Chọn Quest đang chờ"
                  >
                    {pendingQuests.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!effectiveQuestId || busyKey === 'convert-pending'}
                    onClick={() =>
                      runBusy('convert-pending', () =>
                        onConvertFocusToQuest({
                          mode: 'credit_pending',
                          questId: effectiveQuestId,
                        })
                      )
                    }
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Gắn vào Quest đang chờ
                  </button>
                </div>
              )}

              <button
                type="button"
                disabled={busyKey === 'sync-skill'}
                onClick={() => runBusy('sync-skill', onSyncFocusToSkill)}
                className="btn-emerald flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <PxBolt size={14} />
                <span>Chỉ cộng Skill XP</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Section 2: Khởi động cùng PC & Chế độ Desktop */}
      <section className="studio-surface relative p-5">
        <PixelRivets />
        <div className="flex flex-col gap-3 border-b-2 pb-3.5 lg:flex-row lg:items-center lg:justify-between studio-divider">
          <div className="flex items-center gap-2.5">
            <PxDashboard size={16} className="text-[var(--px-gold-text)]" />
            <div>
              <h3 className="font-display text-sm font-extrabold text-main">
                Khởi động cùng PC &amp; Chế độ Desktop
              </h3>
              <p className="text-xs text-sub">
                Ứng dụng Desktop Tauri v2 (rpg-life-tracker.exe · ~29MB RAM) với 2D Pixel Mini HUD luôn nổi, System Tray bản địa và Rust Win32 Tracker.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span
              className={`rounded-none border-2 px-2.5 py-1 font-bold ${
                overview.externalTrackerActive || isTauriDesktop()
                  ? 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]'
                  : 'border-[var(--px-plum)] bg-[var(--bg-surface-2)] text-[var(--px-plum-text)]'
              }`}
            >
              {overview.externalTrackerActive || isTauriDesktop()
                ? 'Tauri v2 Native (.exe)'
                : 'Sẵn sàng (.exe)'}
            </span>
            <span
              className={`rounded-none border-2 px-2.5 py-1 font-bold ${
                startup.startupInstalled
                  ? 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]'
                  : 'border-[var(--border-ink)] bg-[var(--bg-subtle)] text-dim'
              }`}
            >
              Tự chạy khi bật PC: {startup.startupInstalled ? 'Đã cài' : 'Chưa cài'}
            </span>
            <span
              className={`rounded-none border-2 px-2.5 py-1 font-bold ${
                startup.desktopShortcutInstalled
                  ? 'border-[var(--px-blue)] bg-[var(--bg-surface-2)] text-[var(--px-blue-text)]'
                  : 'border-[var(--border-ink)] bg-[var(--bg-subtle)] text-dim'
              }`}
            >
              Shortcut Desktop App: {startup.desktopShortcutInstalled ? 'Đã có' : 'Chưa có'}
            </span>
            <span
              className={`rounded-none border-2 px-2.5 py-1 font-bold ${
                startup.traySupported
                  ? 'border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]'
                  : 'border-[var(--border-ink)] bg-[var(--bg-subtle)] text-dim'
              }`}
            >
              System Tray: {startup.traySupported ? 'Sẵn sàng' : 'Không hỗ trợ'}
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          {!startup.startupInstalled ? (
            <button
              type="button"
              disabled={busyKey === 'install'}
              onClick={() =>
                runBusy('install', () =>
                  onInstallStartup({ createDesktopShortcut: true, launchTray: true })
                )
              }
              className="btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs"
            >
              <PxBolt size={14} />
              <span>Cài Tự Khởi Động cùng Windows (+ Shortcut App)</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busyKey === 'uninstall'}
                onClick={() =>
                  runBusy('uninstall', () =>
                    onUninstallStartup({ removeDesktopShortcut: false })
                  )
                }
                className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-xs text-[var(--px-red-text)]"
              >
                <PxClose size={14} />
                <span>Gỡ Tự Khởi Động</span>
              </button>
              <button
                type="button"
                disabled={busyKey === 'tray'}
                onClick={() => runBusy('tray', onLaunchTray)}
                className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-xs"
              >
                <PxGear size={14} className="text-[var(--px-gold-text)]" />
                <span>Mở Icon Khay Hệ Thống</span>
              </button>
            </>
          )}

          <button
            type="button"
            disabled={busyKey === 'toast'}
            onClick={() => runBusy('toast', onTestNotification)}
            className="btn-secondary flex items-center gap-1.5 px-3.5 py-2 text-xs"
          >
            <PxBell size={14} className="text-[var(--px-blue-text)]" />
            <span>Thử Thông Báo Windows</span>
          </button>
        </div>

        <p className="mt-2.5 font-mono text-[11px] text-sub">
          Phím tắt: <span className="font-bold text-[var(--px-gold-text)]">Ctrl+Shift+Space</span> Ẩn/Hiện Mini HUD ·{' '}
          <span className="font-bold text-[var(--px-blue-text)]">Ctrl+Shift+Alt+H</span> Mở Dashboard · Click trái icon Khay Hệ Thống.
        </p>
      </section>

      {/* Sections 3 & 4: Two-Column Ledger (Live PC Tracker + 24h Timeline | Proactive Rules) */}
      <section className="studio-surface relative overflow-hidden">
        <PixelRivets />
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Section 3: Theo dõi Hoạt động Thông minh (Live PC Tracker) */}
          <div className="space-y-4 p-5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <PxTarget size={16} className="text-[var(--px-green-text)]" />
                <h3 className="font-display text-sm font-extrabold text-main">
                  Theo dõi Hoạt động Thông minh (Live PC Tracker)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-inset rounded-none border-[var(--px-gold)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--px-gold-text)]">
                  Focus Score: {activity.focusScore}%
                </span>
                <button
                  type="button"
                  disabled={busyKey === 'tracker'}
                  onClick={() => runBusy('tracker', () => onToggleTracker(!trackerRunning))}
                  className={
                    trackerRunning
                      ? 'btn-emerald px-3 py-1 text-xs'
                      : 'btn-secondary px-3 py-1 text-xs'
                  }
                >
                  {trackerRunning ? 'Đang Bật Tracker' : 'Đang Tắt Tracker'}
                </button>
              </div>
            </div>

            {activity.currentApp && (
              <div className="px-inset flex flex-wrap items-center justify-between gap-2 rounded-none px-3 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-none bg-[var(--px-green)]" />
                  <span className="truncate font-mono font-bold text-main">
                    {activity.currentApp.processName}
                  </span>
                  <span className="truncate text-dim">
                    — {activity.currentApp.windowTitle || 'Active'}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-none border-2 px-2 py-0.5 font-mono text-[10px] font-bold ${
                    CATEGORY_META[activity.currentApp.category].badgeCls
                  }`}
                >
                  {CATEGORY_META[activity.currentApp.category].label}
                </span>
              </div>
            )}

            {/* Segmented Horizontal Pixel Bar */}
            <div>
              <div className="rpg-bar-track flex h-4 w-full rounded-none">
                {segments.map((seg) => {
                  if (seg.mins <= 0) return null;
                  const pct = (seg.mins / segTotal) * 100;
                  return (
                    <div
                      key={seg.key}
                      title={`${CATEGORY_META[seg.key].label}: ${seg.mins}p`}
                      className={`h-full ${CATEGORY_META[seg.key].barCls}`}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-sub">
                {segments.map((seg) => (
                  <span key={seg.key} className="inline-flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-none border border-[var(--border-ink)] ${CATEGORY_META[seg.key].barCls}`} />
                    <span>
                      {CATEGORY_META[seg.key].label}: <strong className="text-main">{seg.mins}p</strong>
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* 24h Pixel Focus Timeline (06h -> 23h) + Peak Focus Hour + Distraction Budget */}
            <div className="px-inset space-y-3 rounded-none p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-main">
                  <PxClock size={14} className="text-[var(--px-blue-text)]" />
                  <span>Nhịp Tập Trung Theo Giờ (06h → 23h)</span>
                </div>
                <div className="font-mono text-[11px] text-[var(--px-gold-text)]">
                  Giờ Vàng Thực Tế: <strong>{activity.peakFocusHour || 'Chưa đủ dữ liệu'}</strong>
                </div>
              </div>

              <div
                className="grid items-end gap-1 pt-1"
                style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}
              >
                {hourlyBars.map((h) => {
                  const total =
                    h.deepWorkMins +
                    h.studyMins +
                    h.commMins +
                    h.distractionMins +
                    h.otherMins;
                  const heightPx = total > 0 ? Math.max(6, Math.round((total / maxHourTotal) * 44)) : 3;
                  const barCls =
                    h.dominantCategory === 'none'
                      ? 'bg-[var(--border-hairline)]'
                      : CATEGORY_META[h.dominantCategory]?.barCls || 'bg-[var(--border-strong)]';
                  const tip = `${String(h.hour).padStart(2, '0')}h: Deep Work ${h.deepWorkMins}p · Học tập ${h.studyMins}p · Giao tiếp ${h.commMins}p · Xao nhãng ${h.distractionMins}p · Khác ${h.otherMins}p`;
                  return (
                    <div key={h.hour} className="flex flex-col items-center gap-1" title={tip}>
                      <div className="flex h-11 w-full items-end">
                        <div
                          className={`w-full rounded-none transition-all ${barCls}`}
                          style={{ height: `${heightPx}px` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-dim">
                        {h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Distraction Budget Bar */}
              <div className="border-t-2 pt-2.5 studio-divider">
                <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                  <span className="font-semibold text-sub">Ngân Sách Xao Nhãng Hôm Nay</span>
                  <span className={isOverBudget ? 'font-bold text-[var(--px-red-text)]' : 'font-bold text-main'}>
                    {activity.distractionMinutes}p / {distractionBudget}p
                    {isOverBudget ? ' (Vượt ngưỡng!)' : ''}
                  </span>
                </div>
                <div className="rpg-bar-track h-2.5 w-full rounded-none">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${distractionPct}%`,
                      backgroundColor: isOverBudget
                        ? 'var(--px-red)'
                        : distractionPct >= 75
                          ? 'var(--px-gold)'
                          : 'var(--px-green)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Top Apps Today + 1-Click Reclassify Picker */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-display text-xs font-extrabold uppercase tracking-wide text-dim">
                  Top Ứng Dụng Hôm Nay (Phân loại nhanh 1-click)
                </h4>
              </div>
              {activity.topApps.length === 0 ? (
                <p className="text-xs text-dim">
                  Chưa ghi nhận hoạt động PC nào hôm nay. Bật Tracker để tự động phân loại thời gian làm việc/học tập.
                </p>
              ) : (
                <div className="divide-y-2 border-2 border-[var(--border-ink)]">
                  {activity.topApps.slice(0, 6).map((app) => (
                    <div
                      key={`${app.processName}-${app.category}`}
                      className="flex flex-col gap-2 px-3 py-2.5 text-xs studio-subtle sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono font-bold text-main">
                          {app.processName}
                        </span>
                        <span
                          className={`shrink-0 rounded-none border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            CATEGORY_META[app.category].badgeCls
                          }`}
                        >
                          {CATEGORY_META[app.category].label}
                        </span>
                        <span className="shrink-0 font-mono font-bold text-main">
                          {app.minutes}p
                        </span>
                      </div>

                      {onReclassifyApp && (
                        <div className="flex flex-wrap items-center gap-1">
                          {QUICK_RECLASSIFY_CHOICES.map((choice) => {
                            const active = app.category === choice.category;
                            return (
                              <button
                                key={choice.category}
                                type="button"
                                disabled={
                                  active ||
                                  busyKey === `reclass-${app.processName}-${choice.category}`
                                }
                                onClick={() =>
                                  runBusy(`reclass-${app.processName}-${choice.category}`, () =>
                                    onReclassifyApp({
                                      keyword: app.processName,
                                      category: choice.category,
                                    })
                                  )
                                }
                                className={`rounded-none border-2 px-1.5 py-0.5 font-mono text-[10px] transition ${
                                  active
                                    ? `${CATEGORY_META[choice.category].badgeCls} font-bold`
                                    : 'border-[var(--border-ink)] bg-[var(--bg-surface)] text-dim hover:border-[var(--px-gold)] hover:text-main'
                                }`}
                              >
                                {choice.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Collapsible Custom Rules Drawer */}
            <div className="border-t-2 pt-3 studio-divider">
              <button
                type="button"
                onClick={() => setShowRulesDrawer((v) => !v)}
                className="btn-secondary flex w-full items-center justify-between px-3 py-2 text-xs"
              >
                <span>
                  Tùy chỉnh Quy tắc phân loại ({settings.customRules?.length || 0} quy tắc riêng)
                </span>
                <PxChevron size={13} dir={showRulesDrawer ? 'up' : 'down'} />
              </button>

              {showRulesDrawer && (
                <div className="px-inset mt-3 space-y-3 rounded-none p-3">
                  <form onSubmit={handleAddRule} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newRuleKeyword}
                      onChange={(e) => setNewRuleKeyword(e.target.value)}
                      placeholder="Từ khóa (vd: figma, blender, docs)..."
                      className="flex-1 rounded-none px-2.5 py-1.5 text-xs"
                    />
                    <select
                      value={newRuleCategory}
                      onChange={(e) =>
                        setNewRuleCategory(e.target.value as Exclude<ActivityCategory, 'idle'>)
                      }
                      className="rounded-none px-2.5 py-1.5 text-xs"
                    >
                      <option value="deep_work">Deep Work</option>
                      <option value="study_research">Học tập</option>
                      <option value="communication">Giao tiếp</option>
                      <option value="distraction">Xao nhãng</option>
                      <option value="other">Khác</option>
                    </select>
                    <button
                      type="submit"
                      disabled={!newRuleKeyword.trim() || busyKey === 'rules'}
                      className="btn-primary flex shrink-0 items-center justify-center gap-1 px-3 py-1.5 text-xs"
                    >
                      <PxPlus size={13} />
                      <span>Thêm</span>
                    </button>
                  </form>

                  {(settings.customRules || []).length > 0 && (
                    <div className="divide-y-2 studio-divider">
                      {settings.customRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between gap-2 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-main">{rule.keyword}</span>
                            <span
                              className={`rounded-none border-2 px-1.5 py-0.5 font-mono text-[10px] ${
                                CATEGORY_META[rule.category].badgeCls
                              }`}
                            >
                              {CATEGORY_META[rule.category].label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(rule.id)}
                            className="p-1 text-dim hover:text-[var(--px-red-text)]"
                            title="Xóa quy tắc"
                          >
                            <PxTrash size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Trợ lý Chủ động & Quy tắc Nhắc nhở */}
          <div className="space-y-4 border-t-2 p-5 lg:col-span-5 lg:border-l-2 lg:border-t-0 studio-divider">
            <div className="flex items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <PxShield size={16} className="text-[var(--px-gold-text)]" />
                <h3 className="font-display text-sm font-extrabold text-main">
                  Trợ lý Chủ động &amp; Quy tắc Nhắc nhở
                </h3>
              </div>
              <span className="font-mono text-[10px] text-dim">
                Im lặng {settings.quietHoursStart} – {settings.quietHoursEnd}
              </span>
            </div>

            <div className="divide-y-2 border-2 border-[var(--border-ink)]">
              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">
                  Tự hiện 2D Pixel HUD khi mở app (Ctrl+Shift+Space)
                </span>
                <input
                  type="checkbox"
                  checked={settings.hudVisibleOnStart ?? true}
                  onChange={(e) =>
                    onUpdateSettings({ hudVisibleOnStart: e.target.checked })
                  }
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">Mục tiêu tập trung mỗi ngày</span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <input
                    type="number"
                    min={30}
                    max={720}
                    step={15}
                    value={settings.dailyFocusGoalMinutes ?? 180}
                    onChange={(e) =>
                      onUpdateSettings({
                        dailyFocusGoalMinutes: Math.max(30, Number(e.target.value) || 180),
                      })
                    }
                    className="w-16 rounded-none px-1.5 py-0.5 text-center text-xs"
                  />
                  <span className="text-dim">phút</span>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">Thông báo Windows Toast</span>
                <input
                  type="checkbox"
                  checked={settings.windowsToastEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ windowsToastEnabled: e.target.checked })
                  }
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">
                  Tự tạm dừng Quest khi rời máy (AFK)
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoPauseQuestOnIdle ?? true}
                  onChange={(e) =>
                    onUpdateSettings({ autoPauseQuestOnIdle: e.target.checked })
                  }
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">Ngân sách Xao nhãng (phút/ngày)</span>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={settings.distractionBudgetMinutes ?? 45}
                    onChange={(e) =>
                      onUpdateSettings({
                        distractionBudgetMinutes: Math.max(5, Number(e.target.value) || 45),
                      })
                    }
                    className="w-14 rounded-none px-1.5 py-0.5 text-center text-xs"
                  />
                  <span className="text-dim">phút</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs studio-subtle">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.distractionGuardEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ distractionGuardEnabled: e.target.checked })
                    }
                  />
                  <span className="font-semibold text-main">
                    Chống xao nhãng khi đang chạy Quest
                  </span>
                </label>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={settings.distractionThresholdMinutes}
                    onChange={(e) =>
                      onUpdateSettings({
                        distractionThresholdMinutes: Math.max(1, Number(e.target.value) || 3),
                      })
                    }
                    className="w-12 rounded-none px-1.5 py-0.5 text-center text-xs"
                  />
                  <span className="text-dim">phút</span>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">
                  Nhắc trước khung lịch {settings.upcomingReminderLeadMinutes} phút
                </span>
                <input
                  type="checkbox"
                  checked={settings.upcomingBlockReminderEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ upcomingBlockReminderEnabled: e.target.checked })
                  }
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">
                  Nhắc nghỉ mắt / đứng dậy sau {settings.ultradianBreakMinutes} phút tập trung
                </span>
                <input
                  type="checkbox"
                  checked={settings.ultradianBreakEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ ultradianBreakEnabled: e.target.checked })
                  }
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs studio-subtle">
                <span className="font-semibold text-main">
                  Nhắc phản tư &amp; Chốt ngày ({settings.eveningWinddownTime})
                </span>
                <input
                  type="checkbox"
                  checked={settings.eveningWinddownEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ eveningWinddownEnabled: e.target.checked })
                  }
                />
              </label>
            </div>

            {/* Recent Nudges Feed */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-display text-xs font-extrabold uppercase tracking-wide text-dim">
                  Nhắc Nhở Gần Đây ({nudges.filter((n) => !n.dismissed).length})
                </h4>
              </div>

              {nudges.filter((n) => !n.dismissed).length === 0 ? (
                <p className="px-inset rounded-none p-3 text-xs text-dim">
                  Không có nhắc nhở mới. Hệ thống sẽ nhẹ nhàng nhắc khi gần tới khung giờ hoặc khi bạn xao nhãng quá lâu.
                </p>
              ) : (
                <div className="divide-y-2 border-2 border-[var(--border-ink)]">
                  {nudges
                    .filter((n) => !n.dismissed)
                    .slice(0, 6)
                    .map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-2 p-2.5 text-xs studio-subtle"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <PxSparkle size={12} className="text-[var(--px-gold-text)]" />
                            <span className="font-bold text-main">{n.title}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-sub">{n.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => runBusy(`dismiss-${n.id}`, () => onDismissNudge(n.id))}
                          className="p-1 text-dim hover:text-main"
                          title="Đóng nhắc nhở"
                        >
                          <PxClose size={13} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sections 5 & 6: Two-Column Ledger (LAN QR Mobile Pairing | Rotating SQLite Auto-Backup) */}
      <section className="studio-surface relative overflow-hidden">
        <PixelRivets />
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Kết nối Điện thoại qua QR Mạng LAN / Tailscale */}
          <div id="lan-qr-card" className="space-y-4 p-5 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <PxPhone size={16} className="text-[var(--px-blue-text)]" />
                <h3 className="font-display text-sm font-extrabold text-main">
                  Kết nối Điện thoại qua QR Mạng LAN / Tailscale
                </h3>
              </div>
              {lanInfo?.tailscaleIp && (
                <span className="rounded-none border-2 border-[var(--px-blue)] bg-[var(--bg-surface-2)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--px-blue-text)]">
                  Tailscale: {lanInfo.tailscaleIp}
                </span>
              )}
            </div>

            <label className="px-inset flex cursor-pointer items-center justify-between gap-3 rounded-none px-3 py-2.5 text-xs">
              <span className="font-semibold text-main">
                Cho phép truy cập từ điện thoại trong LAN
              </span>
              <input
                type="checkbox"
                checked={Boolean(lanInfo?.enabled)}
                disabled={busyKey === 'lan-toggle'}
                onChange={(e) => handleToggleLan(e.target.checked)}
              />
            </label>

            {lanNotice && (
              <p className="px-inset rounded-none border-[var(--px-green)] px-3 py-1.5 font-mono text-[11px] text-[var(--px-green-text)]">
                {lanNotice}
              </p>
            )}

            {lanInfo?.enabled ? (
              <div className="px-inset flex flex-col gap-4 rounded-none p-3.5 sm:flex-row sm:items-start">
                {lanInfo.qrSvg ? (
                  <div className="shrink-0 self-center rounded-none border-2 border-[var(--border-ink)] bg-white p-2 sm:self-start">
                    {lanInfo.qrSvg.trim().startsWith('<svg') ? (
                      <div
                        className="h-32 w-32 [&>svg]:h-full [&>svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: lanInfo.qrSvg }}
                      />
                    ) : (
                      <img
                        src={lanInfo.qrSvg}
                        alt="QR kết nối điện thoại LAN"
                        className="h-32 w-32"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-none border-2 border-[var(--border-ink)]">
                    <PxPhone size={28} className="text-dim" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-2.5 text-xs">
                  {lanInfo.mobileUrl && (
                    <div>
                      <div className="font-mono text-[10px] uppercase text-dim">
                        Link mở trên Điện thoại
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          readOnly
                          value={lanInfo.mobileUrl}
                          className="min-w-0 flex-1 rounded-none px-2 py-1 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(lanInfo.mobileUrl || '');
                            setCopiedLanUrl(true);
                            setTimeout(() => setCopiedLanUrl(false), 2000);
                          }}
                          className="btn-secondary flex shrink-0 items-center gap-1 px-2.5 py-1 text-[11px]"
                        >
                          <Copy className="h-3 w-3" />
                          <span>{copiedLanUrl ? 'Đã copy' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] uppercase text-dim">Mã PIN 6 số: </span>
                      <span className="rounded-none border-2 border-[var(--px-gold)] bg-[var(--bg-surface-2)] px-2 py-0.5 font-mono text-sm font-extrabold tracking-widest text-[var(--px-gold-text)]">
                        {lanInfo.pairPin}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={busyKey === 'lan-rotate'}
                      onClick={handleRotateLanToken}
                      className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-[11px]"
                    >
                      <PxRefresh size={12} />
                      <span>Đổi mã bảo mật mới</span>
                    </button>
                  </div>

                  <p className="text-[11px] leading-snug text-dim">
                    Bảo mật: <strong className="text-main">localhost</strong> trên PC không cần PIN; các thiết bị qua LAN/Tailscale bắt buộc quét QR hoặc nhập mã PIN 6 số.
                  </p>
                </div>
              </div>
            ) : (
              <p className="px-inset rounded-none p-3 text-xs text-dim">
                Bật công tắc trên để tạo mã QR &amp; PIN 6 số giúp check-in Quest nhanh từ điện thoại qua Wi-Fi nội bộ hoặc Tailscale.
              </p>
            )}
          </div>

          {/* Tự động Sao lưu SQLite Xoay Vòng (Auto-Backup) */}
          <div className="space-y-4 border-t-2 p-5 lg:col-span-6 lg:border-l-2 lg:border-t-0 studio-divider">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <PxSave size={16} className="text-[var(--px-green-text)]" />
                <h3 className="font-display text-sm font-extrabold text-main">
                  Tự động Sao lưu SQLite Xoay Vòng (Auto-Backup)
                </h3>
              </div>
              <span className="font-mono text-[10px] text-dim">
                {backupStatus?.lastBackupAt
                  ? `Gần nhất: ${backupStatus.lastBackupAt.slice(0, 16).replace('T', ' ')}`
                  : 'Chưa sao lưu'}
              </span>
            </div>

            {backupStatus && (
              <div className="px-inset rounded-none px-3 py-2 font-mono text-[11px] text-sub">
                Thư mục đích: <strong className="break-all text-main">{backupStatus.resolvedDir}</strong>
              </div>
            )}

            <form onSubmit={handleSaveBackupConfig} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-[11px] font-semibold text-sub">
                    Thư mục sao lưu (hỗ trợ dán đường dẫn OneDrive / Google Drive cục bộ)
                  </label>
                  <input
                    value={backupDirInput}
                    onChange={(e) => setBackupDirInput(e.target.value)}
                    placeholder="Để trống = mặc định data/backups/"
                    className="w-full rounded-none px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-sub">
                    Giữ (ngày)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={retentionInput}
                    onChange={(e) => setRetentionInput(Number(e.target.value) || 14)}
                    className="w-full rounded-none px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={busyKey === 'bak-cfg'}
                  className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <PxSave size={13} className="text-[var(--px-blue-text)]" />
                  <span>Lưu cấu hình</span>
                </button>
                <button
                  type="button"
                  disabled={busyKey === 'bak-run'}
                  onClick={handleRunBackupNow}
                  className="btn-emerald flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  <PxRefresh size={13} />
                  <span>Sao lưu ngay</span>
                </button>
              </div>
            </form>

            {backupNotice && (
              <p className="px-inset rounded-none border-[var(--px-green)] px-3 py-1.5 font-mono text-[11px] text-[var(--px-green-text)]">
                {backupNotice}
              </p>
            )}

            <div>
              <h4 className="mb-1.5 font-display text-xs font-extrabold uppercase tracking-wide text-dim">
                Bản Sao Lưu Gần Đây ({backupStatus?.backups.length || 0})
              </h4>
              {!backupStatus || backupStatus.backups.length === 0 ? (
                <p className="px-inset rounded-none p-2.5 text-xs text-dim">
                  Chưa có file sao lưu nào. Bấm &ldquo;Sao lưu ngay&rdquo; để tạo bản chụp SQLite an toàn.
                </p>
              ) : (
                <div className="divide-y-2 border-2 border-[var(--border-ink)]">
                  {backupStatus.backups.slice(0, 5).map((b) => {
                    const confirming = confirmRestoreFile === b.filename;
                    return (
                      <div key={b.filename} className="space-y-1.5 px-3 py-2 text-xs studio-subtle">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono font-bold text-main">{b.filename}</div>
                            <div className="font-mono text-[10px] text-dim">
                              {(b.sizeBytes / 1024).toFixed(1)} KB · {b.createdAt.slice(0, 19).replace('T', ' ')}
                            </div>
                          </div>
                          {!confirming && (
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreFile(b.filename)}
                              className="btn-secondary shrink-0 px-2.5 py-1 text-[11px]"
                            >
                              Khôi phục
                            </button>
                          )}
                        </div>

                        {confirming && (
                          <div className="px-inset flex flex-wrap items-center justify-between gap-2 rounded-none border-[var(--px-gold)] p-2 text-[11px]">
                            <span className="flex items-center gap-1.5 text-[var(--px-gold-text)]">
                              <PxWarn size={13} />
                              <span>Hệ thống sẽ tự động tạo bản sao lưu an toàn hiện tại trước khi khôi phục. Tiếp tục?</span>
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={busyKey === `bak-res-${b.filename}`}
                                onClick={() => handleRestoreBackup(b.filename)}
                                className="btn-primary px-2.5 py-1 text-[11px]"
                              >
                                Xác nhận Khôi phục
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreFile(null)}
                                className="btn-secondary px-2 py-1 text-[11px]"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
