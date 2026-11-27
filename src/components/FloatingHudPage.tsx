import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AssistantOverviewPayload,
  AttributeKey,
  HabitCompletionKind,
  Quest,
  QuestType,
  SystemStatePayload,
} from '../types/system';
import { isTauriDesktop } from '../utils/api';
import { getVnTodayKey } from '../utils/timeVn';
import { PixelHeroSprite } from './DungeonSprites';
import {
  PxBell,
  PxCalendar,
  PxCheck,
  PxChevron,
  PxClose,
  PxDashboard,
  PxFlame,
  PxHide,
  PxMiniToggle,
  PxPause,
  PxPlay,
  PxPlus,
  PxSword,
  PxWarn,
} from './PixelIcons';

export interface HudQuickAddOptions {
  type?: QuestType;
  primaryStat?: AttributeKey;
  syncToTimetable?: boolean;
  goalId?: string;
}

export interface FloatingHudPageProps {
  state: SystemStatePayload | null;
  overview: AssistantOverviewPayload | null;
  onStartQuest: (id: string) => Promise<void>;
  onPauseQuest: (id: string) => Promise<void>;
  onCompleteQuest: (id: string) => Promise<void>;
  onQuickAddQuest: (
    title: string,
    durationMinutes: number,
    options?: HudQuickAddOptions
  ) => Promise<void>;
  onToggleDnd: (minutes: number) => Promise<void>;
  onCheckinHabit?: (habitId: string, kind: HabitCompletionKind | 'undo') => Promise<void>;
  onConvertFocusToQuest?: (payload: {
    mode: 'complete_new' | 'credit_pending';
    title?: string;
    questId?: string;
    primaryStat?: AttributeKey;
  }) => Promise<void>;
  onHideHud?: () => void;
  onOpenMainApp: () => void;
}

type HudMode = 'mini' | 'normal' | 'expanded';

interface TauriWindowBridge {
  __TAURI__?: {
    core?: {
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
    event?: {
      listen?: (event: string, handler: (event: unknown) => void) => Promise<() => void>;
    };
  };
  __TAURI_INTERNALS__?: unknown;
}

const HUD_MODE_STORAGE_KEY = 'rpg_hud_mode';
export const QUEST_COMPOSER_DRAFT_KEY = 'rpg_quest_composer_draft';
const QUICK_DURATIONS = [15, 25, 45, 60] as const;

const TYPE_SHORT_LABELS: Record<QuestType, string> = {
  daily: 'Daily',
  main: 'Main ★',
  side: 'Side',
  recovery: 'Hồi phục',
  emergency: 'Khẩn',
  hidden: 'Hidden',
};

function readPersistedHudMode(): 'mini' | 'normal' {
  try {
    const saved =
      typeof window !== 'undefined' ? window.localStorage.getItem(HUD_MODE_STORAGE_KEY) : null;
    return saved === 'mini' ? 'mini' : 'normal';
  } catch {
    return 'normal';
  }
}

function savePersistedHudMode(mode: 'mini' | 'normal'): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HUD_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // No-op
  }
}

function isRunningInTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as TauriWindowBridge;
  return isTauriDesktop() || Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

function invokeTauriSafe(cmd: string, args?: Record<string, unknown>): void {
  try {
    const w = window as unknown as TauriWindowBridge;
    const p = w.__TAURI__?.core?.invoke?.(cmd, args);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // No-op
  }
}

function getQuestElapsedSeconds(quest: Quest, nowMs: number): number {
  const base = quest.pausedAccumulatedSeconds ?? 0;
  if (quest.startedAt && !quest.isPaused) {
    const parsed = Date.parse(quest.startedAt);
    if (!Number.isNaN(parsed)) {
      return base + Math.max(0, Math.floor((nowMs - parsed) / 1000));
    }
  }
  return base;
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const FloatingHudPage: React.FC<FloatingHudPageProps> = ({
  state,
  overview,
  onStartQuest,
  onPauseQuest,
  onCompleteQuest,
  onQuickAddQuest,
  onToggleDnd,
  onCheckinHabit,
  onHideHud,
  onOpenMainApp,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hudMode, setHudMode] = useState<HudMode>(() => readPersistedHudMode());
  const [selectedPendingIdx, setSelectedPendingIdx] = useState(0);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDuration, setQuickDuration] = useState<number>(25);
  const [quickType, setQuickType] = useState<QuestType>('daily');
  const [quickStat, setQuickStat] = useState<AttributeKey | 'AUTO'>('AUTO');
  const [quickSyncCalendar, setQuickSyncCalendar] = useState<boolean>(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [previewHidden, setPreviewHidden] = useState(false);

  const quickInputRef = useRef<HTMLInputElement | null>(null);
  const hudModeRef = useRef<HudMode>(hudMode);

  useEffect(() => {
    hudModeRef.current = hudMode;
  }, [hudMode]);

  const inTauri = isRunningInTauri();
  const todayKey = getVnTodayKey();
  const quests = state?.quests ?? [];
  const pendingQuests = useMemo(
    () =>
      quests
        .filter((q) => q.status === 'pending')
        .sort((a, b) => {
          const aMain = a.type === 'main' ? 1 : 0;
          const bMain = b.type === 'main' ? 1 : 0;
          if (aMain !== bMain) return bMain - aMain;
          return Number(b.dateKey === todayKey) - Number(a.dateKey === todayKey);
        }),
    [quests, todayKey]
  );

  const activeQuest =
    pendingQuests.find((q) => q.startedAt && !q.isPaused) ||
    pendingQuests.find((q) => q.isPaused || (q.pausedAccumulatedSeconds ?? 0) > 0) ||
    null;

  const isRunning = Boolean(activeQuest && activeQuest.startedAt && !activeQuest.isPaused);
  const safeIdx =
    pendingQuests.length > 0 ? Math.min(selectedPendingIdx, pendingQuests.length - 1) : 0;
  const targetQuest = activeQuest || pendingQuests[safeIdx] || null;
  const targetQuestPrimaryStat = targetQuest
    ? (Object.keys(targetQuest.statRewards || {})[0] as AttributeKey) || 'INT'
    : null;

  const habits = state?.habits ?? [];
  const dueHabits = useMemo(() => habits.filter((h) => h.dueToday !== false), [habits]);
  const pendingHabits = useMemo(
    () => dueHabits.filter((h) => !h.completedToday),
    [dueHabits]
  );
  const completedHabitsCount = dueHabits.length - pendingHabits.length;
  const mvdActive = Boolean(state?.disciplineSettings?.minimumViableDayActive);

  const dndUntilMs = overview?.dndUntil ? Date.parse(overview.dndUntil) : Number.NaN;
  const isDndActive =
    Boolean(overview?.dndActive) || (!Number.isNaN(dndUntilMs) && dndUntilMs > nowMs);

  const distractionAlert =
    overview?.distractionAlertLevel === 'soft_hud' ||
    overview?.distractionAlertLevel === 'toast';

  const deepWorkMins = Math.round(
    overview?.activity?.deepWorkMinutes ?? state?.assistantSummary?.deepWorkMinutes ?? 0
  );
  const studyMins = Math.round(overview?.activity?.studyMinutes ?? 0);
  const focusTotalMins = deepWorkMins + studyMins;
  const dailyFocusGoalMins = Math.max(
    30,
    Math.round(
      state?.disciplineSettings?.dailyFocusGoalMinutes ??
        overview?.settings?.dailyFocusGoalMinutes ??
        180
    )
  );
  const focusScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(overview?.activity?.focusScore ?? state?.assistantSummary?.focusScore ?? 0)
    )
  );

  const player = state?.player ?? null;
  const hp = Math.max(0, player?.hp ?? 100);
  const maxHp = Math.max(100, player?.maxHp ?? 100);
  const hpPct = Math.min(100, Math.round((hp / maxHp) * 100));
  const heroMood: 'healthy' | 'wounded' | 'critical' =
    hpPct <= 25 ? 'critical' : hpPct <= 55 ? 'wounded' : 'healthy';

  useEffect(() => {
    const intervalMs = isRunning || isDndActive ? 1000 : 15000;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [isRunning, isDndActive]);

  useEffect(() => {
    if (hudMode === 'expanded') {
      const id = window.setTimeout(() => quickInputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [hudMode]);

  const switchHudMode = useCallback((nextMode: HudMode) => {
    setHudMode(nextMode);
    if (nextMode === 'mini' || nextMode === 'normal') {
      savePersistedHudMode(nextMode);
    }
    invokeTauriSafe('resize_hud', { mode: nextMode });
  }, []);

  useEffect(() => {
    if (!inTauri) return;
    if (readPersistedHudMode() === 'mini') {
      invokeTauriSafe('resize_hud', { mode: 'mini' });
    }
  }, [inTauri]);

  useEffect(() => {
    if (!inTauri) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    const listen = (window as unknown as TauriWindowBridge).__TAURI__?.event?.listen;
    if (typeof listen !== 'function') return;
    Promise.resolve(
      listen('tauri-hud-toggle-mode', () => {
        switchHudMode(hudModeRef.current === 'mini' ? 'normal' : 'mini');
      })
    )
      .then((fn) => {
        if (disposed) fn?.();
        else unlisten = fn;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [inTauri, switchHudMode]);

  const handleHideClick = () => {
    if (onHideHud) {
      onHideHud();
      return;
    }
    if (inTauri) {
      invokeTauriSafe('set_hud_visible', { visible: false });
      return;
    }
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    setPreviewHidden(true);
  };

  const handleOpenMainWithDraft = () => {
    try {
      if (quickTitle.trim() || hudMode === 'expanded') {
        window.localStorage.setItem(
          QUEST_COMPOSER_DRAFT_KEY,
          JSON.stringify({
            title: quickTitle.trim(),
            durationMinutes: quickDuration,
            type: quickType,
            primaryStat: quickStat === 'AUTO' ? undefined : quickStat,
            syncToTimetable: quickSyncCalendar,
            openAdvanced: true,
            ts: Date.now(),
          })
        );
      }
    } catch {
      // Ignore storage error
    }
    onOpenMainApp();
  };

  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

  const elapsedSec = activeQuest ? getQuestElapsedSeconds(activeQuest, nowMs) : 0;
  const plannedSec = Math.max(60, (activeQuest?.durationMinutes ?? 25) * 60);
  const isOvertime = Boolean(activeQuest) && elapsedSec >= plannedSec;
  const clockLabel = activeQuest
    ? isOvertime
      ? `+${formatMmSs(elapsedSec - plannedSec)}`
      : formatMmSs(Math.max(0, plannedSec - elapsedSec))
    : targetQuest
      ? `${targetQuest.durationMinutes}p`
      : '--:--';
  const progressPct = activeQuest
    ? Math.min(100, Math.round((elapsedSec / plannedSec) * 100))
    : 0;

  const runAction = async (key: string, fn: () => Promise<void>) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  // ==================== MINI MODE (284x68px) ====================
  const miniPlaque = (
    <div
      className={`px-hud-frame flex h-[68px] w-[284px] select-none items-center gap-[8px] overflow-hidden px-[8px] py-[6px] text-[#f4ecdc] ${
        distractionAlert ? 'px-hud-frame-alert' : ''
      }`}
    >
      <div
        data-tauri-drag-region
        className="flex h-[32px] w-[32px] shrink-0 cursor-grab items-center justify-center border border-[#d4a24c] bg-[#100e18] active:cursor-grabbing"
        title="Kéo để di chuyển HUD"
      >
        <div className="pointer-events-none">
          <PixelHeroSprite
            rank={player?.rank || 'E-Rank'}
            avatarStyle={player?.profile.avatarStyle || 'shadow_monarch'}
            mood={heroMood}
            size={24}
            className="!animate-none"
          />
        </div>
      </div>

      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 cursor-grab flex-col justify-center gap-[4px] overflow-hidden active:cursor-grabbing"
      >
        {distractionAlert ? (
          <div className="pointer-events-none flex items-center gap-1 font-pixel text-[8px] font-bold text-[#ff6b7a]">
            <PxWarn size={10} danger />
            <span className="truncate">ĐANG XAO NHÃNG!</span>
          </div>
        ) : (
          <div className="pointer-events-none flex items-center gap-[5px] leading-none">
            <span className="font-mono text-[11px] font-extrabold tabular-nums text-[#f0c46c]">
              {clockLabel}
            </span>
            <span className="truncate font-display text-[11px] font-bold text-[#f4ecdc]">
              {targetQuest ? targetQuest.title : pendingHabits[0]?.title || 'Sẵn sàng Focus'}
            </span>
          </div>
        )}
        <div className="pointer-events-none flex items-center gap-[6px] font-mono text-[9px] text-[#bfb6d1] tabular-nums leading-none">
          <span className="text-[#56c989]">Focus {focusScore}%</span>
          <span>·</span>
          <span>Việc {pendingQuests.length}</span>
          <span>·</span>
          <span>
            TQ {completedHabitsCount}/{dueHabits.length}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-[3px]">
        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          disabled={!targetQuest || busyKey !== null}
          onClick={() =>
            void runAction('play', async () => {
              if (!targetQuest) return;
              if (isRunning && activeQuest) await onPauseQuest(activeQuest.id);
              else await onStartQuest(targetQuest.id);
            })
          }
          className={`px-hud-btn flex h-[24px] w-[24px] items-center justify-center disabled:opacity-40 ${
            isRunning ? 'px-hud-btn-gold' : 'px-hud-btn-green'
          }`}
          title={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
        >
          {isRunning ? <PxPause size={9} /> : <PxPlay size={9} />}
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          onClick={() => switchHudMode('normal')}
          className="px-hud-btn px-hud-btn-slate flex h-[24px] w-[24px] items-center justify-center"
          title="Mở rộng HUD"
        >
          <PxMiniToggle size={9} expand />
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          onClick={handleHideClick}
          className="px-hud-btn px-hud-btn-slate flex h-[24px] w-[24px] items-center justify-center"
          title="Ẩn HUD"
        >
          <PxHide size={9} />
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          onClick={onOpenMainApp}
          className="px-hud-btn px-hud-btn-blue flex h-[24px] w-[24px] items-center justify-center"
          title="Mở ứng dụng chính (Phóng to)"
        >
          <PxDashboard size={9} />
        </button>
      </div>
    </div>
  );

  // ==================== NORMAL / EXPANDED MODE (396x178px / 396x228px) ====================
  const fullPlaque = (
    <div
      className={`px-hud-frame flex w-[396px] select-none flex-col justify-between px-[10px] py-[8px] text-[#f4ecdc] ${
        hudMode === 'expanded' ? 'h-[228px]' : 'h-[178px]'
      } ${distractionAlert ? 'px-hud-frame-alert' : ''}`}
    >
      {/* ROW 1: Ultra-Clean Header (28px, draggable) */}
      <div
        data-tauri-drag-region
        className="flex h-[28px] cursor-grab items-center justify-between gap-2 active:cursor-grabbing"
      >
        <div className="pointer-events-none flex min-w-0 items-center gap-2">
          <div className="flex h-[24px] w-[24px] shrink-0 items-center justify-center border border-[#d4a24c] bg-[#100e18]">
            <PixelHeroSprite
              rank={player?.rank || 'E-Rank'}
              avatarStyle={player?.profile.avatarStyle || 'shadow_monarch'}
              mood={heroMood}
              size={20}
              className="!animate-none"
            />
          </div>
          <span className="font-pixel text-[8px] font-bold text-[#f0c46c]">
            LV.{player?.level ?? 1}
          </span>
          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] font-bold text-[#f0c46c]">
            <PxFlame size={10} /> {player?.streakDays ?? 0}d
          </span>
          {distractionAlert ? (
            <span className="inline-flex items-center gap-1 bg-[#b83a4b] px-1.5 py-0.5 font-pixel text-[7.5px] font-bold text-white">
              <PxWarn size={9} color="#ffffff" /> XAO NHÃNG!
            </span>
          ) : (
            <span className="font-mono text-[10px] text-[#bfb6d1]">
              Focus <strong className="text-[#56c989]">{focusTotalMins}p</strong>/{dailyFocusGoalMins}p
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-[3px]">
          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            onClick={() =>
              void runAction('dnd', () => onToggleDnd(isDndActive ? 0 : 60))
            }
            className={`px-hud-btn flex h-[22px] w-[22px] items-center justify-center ${
              isDndActive ? 'px-hud-btn-gold' : 'px-hud-btn-slate'
            }`}
            title={isDndActive ? 'Tắt DND' : 'Tạm im thông báo 1 giờ'}
          >
            <PxBell size={9} muted={isDndActive} />
          </button>
          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            onClick={() => switchHudMode('mini')}
            className="px-hud-btn px-hud-btn-slate flex h-[22px] w-[22px] items-center justify-center"
            title="Thu gọn Mini"
          >
            <PxMiniToggle size={9} />
          </button>
          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            onClick={handleHideClick}
            className="px-hud-btn px-hud-btn-slate flex h-[22px] w-[22px] items-center justify-center"
            title="Ẩn HUD"
          >
            <PxHide size={9} />
          </button>
          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            onClick={handleOpenMainWithDraft}
            className="px-hud-btn px-hud-btn-blue flex h-[22px] w-[22px] items-center justify-center"
            title="Mở ứng dụng chính (đồng bộ tức thì)"
          >
            <PxDashboard size={9} />
          </button>
        </div>
      </div>

      {/* ROW 2: Current Task & Live Timer (58px) */}
      <div className="px-hud-inset flex h-[58px] flex-col justify-between px-[8px] py-[5px]">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <PxSword size={11} color={isRunning ? '#f0c46c' : '#78b0ee'} />
            {targetQuest && (
              <span className="shrink-0 border border-[#463e63] bg-[#1f1b2e] px-1 py-0 font-mono text-[8.5px] font-bold text-[#f0c46c]">
                {TYPE_SHORT_LABELS[targetQuest.type] || 'Daily'}
                {targetQuestPrimaryStat ? `·${targetQuestPrimaryStat}` : ''}
              </span>
            )}
            <span className="truncate font-display text-[11.5px] font-bold text-[#f4ecdc]">
              {targetQuest ? targetQuest.title : 'Chưa có nhiệm vụ — bấm + để thêm'}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-[3px]">
            {!activeQuest && pendingQuests.length > 1 && (
              <>
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  onMouseDown={stopDrag}
                  onClick={() =>
                    setSelectedPendingIdx(
                      (i) => (i - 1 + pendingQuests.length) % pendingQuests.length
                    )
                  }
                  className="px-hud-btn px-hud-btn-slate flex h-[20px] w-[16px] items-center justify-center"
                  title="Việc trước"
                >
                  <PxChevron dir="left" size={8} />
                </button>
                <span className="font-mono text-[9px] text-[#bfb6d1] tabular-nums">
                  {safeIdx + 1}/{pendingQuests.length}
                </span>
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  onMouseDown={stopDrag}
                  onClick={() => setSelectedPendingIdx((i) => (i + 1) % pendingQuests.length)}
                  className="px-hud-btn px-hud-btn-slate flex h-[20px] w-[16px] items-center justify-center"
                  title="Việc tiếp theo"
                >
                  <PxChevron dir="right" size={8} />
                </button>
              </>
            )}
            <span
              className="px-0.5 font-mono text-[11.5px] font-extrabold tabular-nums"
              style={{ color: isOvertime ? '#56c989' : isRunning ? '#f0c46c' : '#bfb6d1' }}
            >
              {clockLabel}
            </span>
            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              disabled={!targetQuest || busyKey !== null}
              onClick={() =>
                void runAction('play', async () => {
                  if (!targetQuest) return;
                  if (isRunning && activeQuest) await onPauseQuest(activeQuest.id);
                  else await onStartQuest(targetQuest.id);
                })
              }
              className={`px-hud-btn flex h-[22px] w-[23px] items-center justify-center disabled:opacity-40 ${
                isRunning ? 'px-hud-btn-gold' : 'px-hud-btn-green'
              }`}
              title={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
            >
              {isRunning ? <PxPause size={9} /> : <PxPlay size={9} />}
            </button>
            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              disabled={!targetQuest || busyKey !== null}
              onClick={() =>
                void runAction('done', async () => {
                  if (!targetQuest) return;
                  await onCompleteQuest(targetQuest.id);
                })
              }
              className="px-hud-btn px-hud-btn-blue flex h-[22px] w-[23px] items-center justify-center disabled:opacity-40"
              title="Hoàn thành"
            >
              <PxCheck size={10} />
            </button>
            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              onClick={() => switchHudMode(hudMode === 'expanded' ? 'normal' : 'expanded')}
              className={`px-hud-btn flex h-[22px] w-[22px] items-center justify-center ${
                hudMode === 'expanded' ? 'px-hud-btn-gold' : 'px-hud-btn-slate'
              }`}
              title="Thêm nhanh nhiệm vụ (đồng bộ với App chính)"
            >
              {hudMode === 'expanded' ? <PxClose size={9} /> : <PxPlus size={9} />}
            </button>
          </div>
        </div>

        <div className="px-hud-bar-track h-[7px] w-full">
          <div
            className="h-full"
            style={{
              width: `${progressPct}%`,
              backgroundColor: isOvertime ? '#2e8b57' : '#c99330',
            }}
          />
        </div>
      </div>

      {/* ROW 3: 1-Click Core Habits Quick-Check Strip (when normal) OR Compact Habits + Unified Quick-Add (when expanded) */}
      {hudMode !== 'expanded' ? (
        <div className="px-hud-inset flex h-[64px] flex-col justify-between px-[8px] py-[5px]">
          <div className="flex items-center justify-between font-mono text-[9.5px]">
            <span className="font-bold text-[#bfb6d1]">
              Thói quen hôm nay ({completedHabitsCount}/{dueHabits.length})
            </span>
            {mvdActive ? (
              <span className="font-bold text-[#f0c46c]">MVD · 2p giữ chuỗi</span>
            ) : (
              <button
                type="button"
                data-tauri-drag-region="false"
                onMouseDown={stopDrag}
                onClick={onOpenMainApp}
                className="font-bold text-[#78b0ee] hover:underline"
              >
                Quản lý đầy đủ ↗
              </button>
            )}
          </div>

          {dueHabits.length === 0 ? (
            <div className="flex items-center justify-between text-[10px] text-[#847a99]">
              <span>Chưa thiết lập thói quen cốt lõi.</span>
              <button
                type="button"
                data-tauri-drag-region="false"
                onMouseDown={stopDrag}
                onClick={onOpenMainApp}
                className="font-mono font-bold text-[#f0c46c] hover:underline"
              >
                Thiết lập →
              </button>
            </div>
          ) : pendingHabits.length === 0 ? (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#56c989]">
              <PxCheck size={12} color="#56c989" />
              <span>Đã hoàn thành toàn bộ thói quen hôm nay!</span>
            </div>
          ) : (
            <div className="space-y-[3px]">
              {pendingHabits.slice(0, 2).map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-[#f4ecdc]">
                    {h.title}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {onCheckinHabit && (
                      <>
                        <button
                          type="button"
                          data-tauri-drag-region="false"
                          onMouseDown={stopDrag}
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(`hm-${h.id}`, () => onCheckinHabit(h.id, 'minimum'))
                          }
                          className="px-hud-btn px-hud-btn-slate px-[5px] py-[1px] font-mono text-[8.5px] font-bold text-[#f0c46c]"
                          title={`Giữ chuỗi bản tối thiểu: ${h.minimumSpec}`}
                        >
                          2p
                        </button>
                        <button
                          type="button"
                          data-tauri-drag-region="false"
                          onMouseDown={stopDrag}
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(`hf-${h.id}`, () => onCheckinHabit(h.id, 'full'))
                          }
                          className="px-hud-btn px-hud-btn-green flex h-[18px] w-[20px] items-center justify-center"
                          title={`Check-in bản chuẩn: ${h.standardSpec}`}
                        >
                          <PxCheck size={9} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* EXPANDED UNIFIED QUEST COMPOSER (114px) */
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!quickTitle.trim() || busyKey) return;
            void runAction('add', async () => {
              await onQuickAddQuest(quickTitle.trim(), quickDuration, {
                type: quickType,
                primaryStat: quickStat === 'AUTO' ? undefined : quickStat,
                syncToTimetable: quickSyncCalendar,
              });
              setQuickTitle('');
              switchHudMode('normal');
            });
          }}
          className="px-hud-inset flex h-[114px] flex-col justify-between px-[8px] py-[6px]"
        >
          <div className="flex items-center justify-between gap-1 font-mono text-[9px]">
            <span className="font-bold text-[#f0c46c]">THÊM NHIỆM VỤ ĐỒNG BỘ</span>
            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              onClick={handleOpenMainWithDraft}
              className="font-bold text-[#78b0ee] hover:underline"
              title="Mở trình tạo nhiệm vụ chi tiết trên App chính"
            >
              Mở trình quản lý đầy đủ ↗
            </button>
          </div>

          <div className="flex items-center gap-[4px]">
            <input
              ref={quickInputRef}
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Nhập tên nhiệm vụ... (Enter)"
              className="h-[28px] min-w-0 flex-1 px-2 text-[11px]"
            />
            <button
              type="submit"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              disabled={!quickTitle.trim() || busyKey !== null}
              className="px-hud-btn px-hud-btn-green h-[28px] px-[9px] font-mono text-[10px] font-bold disabled:opacity-40"
            >
              + Thêm
            </button>
          </div>

          <div className="flex items-center justify-between gap-[4px]">
            {/* Duration Presets */}
            <div className="flex items-center gap-[2px]">
              {QUICK_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  data-tauri-drag-region="false"
                  onMouseDown={stopDrag}
                  onClick={() => setQuickDuration(d)}
                  className={`px-hud-btn h-[22px] px-[5px] font-mono text-[9px] font-bold ${
                    quickDuration === d ? 'px-hud-btn-gold' : 'px-hud-btn-slate'
                  }`}
                >
                  {d}p
                </button>
              ))}
            </div>

            {/* Quest Type Selector */}
            <select
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              value={quickType}
              onChange={(e) => setQuickType(e.target.value as QuestType)}
              className="h-[22px] px-1 font-mono text-[9px] font-bold"
              title="Loại nhiệm vụ"
            >
              <option value="daily">Daily</option>
              <option value="main">Main ★</option>
              <option value="side">Side</option>
              <option value="recovery">Hồi phục</option>
              <option value="emergency">Khẩn cấp</option>
            </select>

            {/* Primary Stat Selector */}
            <select
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              value={quickStat}
              onChange={(e) => setQuickStat(e.target.value as AttributeKey | 'AUTO')}
              className="h-[22px] px-1 font-mono text-[9px] font-bold"
              title="Chỉ số cộng thêm (Tự động nhận diện theo tên việc)"
            >
              <option value="AUTO">Chỉ số: Tự động</option>
              <option value="INT">+INT (Tư duy)</option>
              <option value="PER">+PER (Học sâu)</option>
              <option value="AGI">+AGI (Kỷ luật)</option>
              <option value="STR">+STR (Thể lực)</option>
              <option value="VIT">+VIT (Hồi phục)</option>
              <option value="CHA">+CHA (Giao tiếp)</option>
            </select>

            {/* Sync to Timetable Toggle */}
            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              onClick={() => setQuickSyncCalendar((v) => !v)}
              className={`px-hud-btn flex h-[22px] items-center gap-0.5 px-[5px] font-mono text-[8.5px] font-bold ${
                quickSyncCalendar ? 'px-hud-btn-blue' : 'px-hud-btn-slate'
              }`}
              title="Tự động xếp vào khung giờ trống trên Thời Khóa Biểu hôm nay"
            >
              <PxCalendar size={8} />
              <span>{quickSyncCalendar ? 'Gắn lịch' : 'Linh hoạt'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );

  if (inTauri) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent">
        {hudMode === 'mini' ? miniPlaque : fullPlaque}
      </div>
    );
  }

  // Browser preview container
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0d17] p-6">
      {previewHidden ? (
        <button
          type="button"
          onClick={() => setPreviewHidden(false)}
          className="btn-primary px-4 py-2 text-xs"
        >
          Hiện lại Mini HUD
        </button>
      ) : (
        <>
          {hudMode === 'mini' ? miniPlaque : fullPlaque}
          <div className="flex items-center gap-2 text-xs text-sub">
            <button
              type="button"
              onClick={() => switchHudMode(hudMode === 'mini' ? 'normal' : 'mini')}
              className="btn-secondary px-3 py-1 text-xs"
            >
              Chế độ: {hudMode === 'mini' ? 'Mini (284×68)' : 'Normal (396×178)'}
            </button>
            <button
              type="button"
              onClick={onOpenMainApp}
              className="btn-secondary px-3 py-1 text-xs"
            >
              Về Ứng dụng chính
            </button>
          </div>
        </>
      )}
    </div>
  );
};
