import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActivityCategory,
  AssistantOverviewPayload,
  AttributeKey,
  Quest,
  SystemStatePayload,
  TimetableBlock,
} from '../types/system';
import { isTauriDesktop } from '../utils/api';
import { getVnNowMinutes, getVnTodayKey } from '../utils/timeVn';
import { PixelHeart, PixelHeroSprite } from './DungeonSprites';
import {
  PixelRivets,
  PxBell,
  PxBolt,
  PxCheck,
  PxChevron,
  PxClock,
  PxClose,
  PxDashboard,
  PxFlame,
  PxHide,
  PxMiniToggle,
  PxPause,
  PxPlay,
  PxPlus,
  PxTarget,
  PxWarn,
} from './PixelIcons';

export interface FloatingHudPageProps {
  state: SystemStatePayload | null;
  overview: AssistantOverviewPayload | null;
  onStartQuest: (id: string) => Promise<void>;
  onPauseQuest: (id: string) => Promise<void>;
  onCompleteQuest: (id: string) => Promise<void>;
  onQuickAddQuest: (title: string, durationMinutes: number) => Promise<void>;
  onToggleDnd: (minutes: number) => Promise<void>;
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
type PreviewBg = 'dark' | 'light' | 'transparent';

interface TauriWindowBridge {
  __TAURI__?: {
    core?: {
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
    event?: {
      listen?: (
        event: string,
        handler: (event: unknown) => void
      ) => Promise<() => void>;
    };
  };
  __TAURI_INTERNALS__?: unknown;
}

const HUD_MODE_STORAGE_KEY = 'rpg_hud_mode';
const QUICK_DURATIONS = [25, 45, 60] as const;

function readPersistedHudMode(): 'mini' | 'normal' {
  try {
    const saved =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(HUD_MODE_STORAGE_KEY)
        : null;
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
    // Safe no-op if storage is unavailable
  }
}

const CATEGORY_INFO: Record<ActivityCategory, { label: string; color: string }> = {
  deep_work: { label: 'Làm sâu', color: '#38a169' },
  study_research: { label: 'Học tập', color: '#3b82c4' },
  communication: { label: 'Giao tiếp', color: '#8f6ec9' },
  distraction: { label: 'Xao nhãng', color: '#c93b4b' },
  other: { label: 'Khác', color: '#7a7090' },
  idle: { label: 'Nghỉ', color: '#5c5470' },
};

function isRunningInTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as TauriWindowBridge;
  return isTauriDesktop() || Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

function invokeTauriSafe(cmd: string, args?: Record<string, unknown>): void {
  try {
    const w = window as unknown as TauriWindowBridge;
    const maybePromise = w.__TAURI__?.core?.invoke?.(cmd, args);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {
        // Safe no-op if running outside Tauri or command unavailable
      });
    }
  } catch {
    // Safe no-op in browser preview
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

function formatDurationVn(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins}p`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}g` : `${h}g ${m}p`;
}

function parseHhMm(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

function formatShortProcessName(processName?: string): string {
  if (!processName) return '';
  const cleaned = processName.replace(/\.exe$/i, '').trim();
  if (!cleaned) return '';
  return cleaned.length > 15 ? `${cleaned.slice(0, 14)}…` : cleaned;
}

function computeDisciplineGrade(params: {
  focusScore: number;
  focusTotalMins: number;
  distractionPct: number;
  distractionAlert: boolean;
}): {
  grade: 'S' | 'A' | 'B' | 'C';
  stamp: string;
  bg: string;
  fg: string;
  title: string;
} {
  const { focusScore, focusTotalMins, distractionPct, distractionAlert } = params;
  if (distractionAlert) {
    return {
      grade: 'C',
      stamp: 'XAO NHÃNG!',
      bg: '#b83a4b',
      fg: '#ffffff',
      title: 'Đang bị xao nhãng trong lúc làm nhiệm vụ — quay lại tập trung!',
    };
  }
  if (focusScore >= 85 && focusTotalMins >= 90 && distractionPct <= 50) {
    return {
      grade: 'S',
      stamp: 'HẠNG S',
      bg: '#c99330',
      fg: '#140e04',
      title: 'Kỷ luật xuất sắc hôm nay (Focus >= 85%, >= 1g 30p tập trung)',
    };
  }
  if (focusScore >= 70 && focusTotalMins >= 45 && distractionPct <= 75) {
    return {
      grade: 'A',
      stamp: 'HẠNG A',
      bg: '#2e8b57',
      fg: '#ffffff',
      title: 'Kỷ luật vững nhịp (Focus >= 70%, >= 45p tập trung)',
    };
  }
  if (focusScore >= 50 && distractionPct <= 95) {
    return {
      grade: 'B',
      stamp: 'HẠNG B',
      bg: '#3267a8',
      fg: '#ffffff',
      title: 'Kỷ luật ổn định — đẩy thêm phiên tập trung để lên Hạng A',
    };
  }
  return {
    grade: 'C',
    stamp: 'CẦN SIẾT',
    bg: '#b8622a',
    fg: '#ffffff',
    title: 'Cần siết lại nhịp tập trung và giảm ứng dụng xao nhãng',
  };
}

function computeNextScheduleContext(
  blocks: TimetableBlock[] | undefined,
  totalFreeMinutes: number | undefined,
  nowVnMins: number
): { kind: 'active' | 'upcoming' | 'free'; text: string; shortText: string; title: string } {
  const validBlocks = (blocks ?? [])
    .filter((b) => b.type !== 'sleep')
    .map((b) => ({
      block: b,
      start: parseHhMm(b.startTime),
      end: parseHhMm(b.endTime),
    }))
    .filter((item) => item.start >= 0 && item.end > item.start)
    .sort((a, b) => a.start - b.start);

  const current = validBlocks.find((item) => item.start <= nowVnMins && item.end > nowVnMins);
  if (current) {
    const remain = Math.max(1, current.end - nowVnMins);
    const remainLabel = formatDurationVn(remain);
    return {
      kind: 'active',
      text: `Còn ${remainLabel} · ${current.block.title}`,
      shortText: `Còn ${remainLabel} · ${current.block.title}`,
      title: `Đang trong khung lịch (${current.block.startTime}–${current.block.endTime}): ${current.block.title} — còn ${remainLabel}`,
    };
  }

  const upcoming = validBlocks.find((item) => item.start > nowVnMins);
  if (upcoming) {
    const waitMins = Math.max(1, upcoming.start - nowVnMins);
    const waitLabel = formatDurationVn(waitMins);
    return {
      kind: 'upcoming',
      text: `Còn ${waitLabel} → ${upcoming.block.startTime} ${upcoming.block.title}`,
      shortText: `Còn ${waitLabel} → ${upcoming.block.startTime} ${upcoming.block.title}`,
      title: `Lịch kế tiếp sau ${waitLabel}: ${upcoming.block.startTime}–${upcoming.block.endTime} ${upcoming.block.title}`,
    };
  }

  const freeHrs = ((totalFreeMinutes ?? 0) / 60).toFixed(1).replace(/\.0$/, '');
  return {
    kind: 'free',
    text: `Trống lịch · rảnh ${freeHrs}g`,
    shortText: `Rảnh ${freeHrs}g hôm nay`,
    title: `Không còn lịch cố định hôm nay · Rảnh ${freeHrs} giờ`,
  };
}

// ==================== BUSY INDICATOR & SHARED PIXEL RIVETS ====================

const PxBusyDots: React.FC = () => (
  <span className="font-pixel text-[8px] leading-none">..</span>
);

const PixelCornerRivets: React.FC = () => (
  <PixelRivets className="bg-[#d4a24c]" />
);

// ==================== MAIN 16-BIT 2D PIXEL DISCIPLINE HUD ====================

export const FloatingHudPage: React.FC<FloatingHudPageProps> = ({
  state,
  overview,
  onStartQuest,
  onPauseQuest,
  onCompleteQuest,
  onQuickAddQuest,
  onToggleDnd,
  onConvertFocusToQuest,
  onHideHud,
  onOpenMainApp,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [hudMode, setHudMode] = useState<HudMode>(() => readPersistedHudMode());
  const [selectedPendingIdx, setSelectedPendingIdx] = useState(0);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDuration, setQuickDuration] = useState<number>(25);
  const [busyAction, setBusyAction] = useState<'play' | 'complete' | 'dnd' | 'add' | 'rescue' | null>(null);
  const [previewBg, setPreviewBg] = useState<PreviewBg>('dark');
  const [previewHidden, setPreviewHidden] = useState(false);
  const quickInputRef = useRef<HTMLInputElement | null>(null);
  const hudModeRef = useRef<HudMode>(hudMode);

  useEffect(() => {
    hudModeRef.current = hudMode;
  }, [hudMode]);

  const inTauri = isRunningInTauri();

  const todayKey = getVnTodayKey();
  const quests = state?.quests ?? [];
  const todayQuests = quests.filter((q) => q.dateKey === todayKey || q.status === 'pending');
  const pendingQuests = quests
    .filter((q) => q.status === 'pending')
    .sort((a, b) => Number(b.dateKey === todayKey) - Number(a.dateKey === todayKey));
  const doneToday = todayQuests.filter((q) => q.status === 'completed').length;
  const totalToday = todayQuests.length;

  const activeQuest =
    pendingQuests.find((q) => q.startedAt && !q.isPaused) ||
    pendingQuests.find((q) => q.isPaused || (q.pausedAccumulatedSeconds ?? 0) > 0) ||
    null;

  const isRunning = Boolean(activeQuest && activeQuest.startedAt && !activeQuest.isPaused);
  const isPaused = Boolean(activeQuest && !isRunning);
  const safePendingIdx =
    pendingQuests.length > 0 ? Math.min(selectedPendingIdx, pendingQuests.length - 1) : 0;
  const selectedPendingQuest = pendingQuests[safePendingIdx] || null;
  const targetQuest = activeQuest || selectedPendingQuest;

  const dndUntilMs = overview?.dndUntil ? Date.parse(overview.dndUntil) : Number.NaN;
  const isDndActive =
    Boolean(overview?.dndActive) || (!Number.isNaN(dndUntilMs) && dndUntilMs > nowMs);
  const dndRemainingMin =
    isDndActive && !Number.isNaN(dndUntilMs)
      ? Math.max(1, Math.ceil((dndUntilMs - nowMs) / 60000))
      : null;

  const distractionAlert =
    overview?.distractionAlertLevel === 'soft_hud' ||
    overview?.distractionAlertLevel === 'toast';

  // Real-time Discipline Telemetry
  const deepWorkMins = Math.round(
    overview?.activity?.deepWorkMinutes ?? state?.assistantSummary?.deepWorkMinutes ?? 0
  );
  const studyMins = Math.round(overview?.activity?.studyMinutes ?? 0);
  const focusTotalMins = deepWorkMins + studyMins;
  const dailyFocusGoalMins = Math.max(
    30,
    Math.round(overview?.settings?.dailyFocusGoalMinutes ?? 180)
  );
  const focusGoalPct = Math.min(100, Math.round((focusTotalMins / dailyFocusGoalMins) * 100));
  const focusScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(overview?.activity?.focusScore ?? state?.assistantSummary?.focusScore ?? 0)
    )
  );
  const uncreditedFocusMins = Math.round(overview?.activity?.uncreditedFocusMinutes ?? 0);
  const suggestedSession = overview?.activity?.suggestedFocusSession ?? null;

  const distractionMins = Math.round(overview?.activity?.distractionMinutes ?? 0);
  const budgetMins = Math.max(
    5,
    Math.round(
      overview?.activity?.distractionBudgetMinutes ??
        overview?.settings?.distractionBudgetMinutes ??
        45
    )
  );
  const distractionPct = Math.min(100, Math.round((distractionMins / budgetMins) * 100));
  const safeRemainMins = Math.max(0, budgetMins - distractionMins);

  const currentApp = overview?.activity?.currentApp ?? null;
  const currentCategory: ActivityCategory =
    currentApp?.category ?? state?.assistantSummary?.currentCategory ?? 'idle';
  const categoryMeta = CATEGORY_INFO[currentCategory] || CATEGORY_INFO.other;
  const shortAppName = formatShortProcessName(currentApp?.processName);

  // Player Discipline Vitals
  const player = state?.player ?? null;
  const hp = Math.max(0, player?.hp ?? 100);
  const maxHp = Math.max(100, player?.maxHp ?? 100);
  const hpPct = Math.min(100, Math.round((hp / maxHp) * 100));
  const isCriticalHp = hpPct <= 25;
  const heroMood: 'healthy' | 'wounded' | 'critical' =
    hpPct <= 25 ? 'critical' : hpPct <= 55 ? 'wounded' : 'healthy';

  const heartCount = 5;
  const hpPerHeart = maxHp / heartCount;
  const heartStates: Array<'full' | 'half' | 'empty'> = Array.from(
    { length: heartCount },
    (_, idx) => {
      const fullAt = (idx + 1) * hpPerHeart;
      const halfAt = idx * hpPerHeart + hpPerHeart * 0.45;
      if (hp >= fullAt - 0.5) return 'full';
      if (hp >= halfAt) return 'half';
      return 'empty';
    }
  );

  const gradeInfo = computeDisciplineGrade({
    focusScore,
    focusTotalMins,
    distractionPct,
    distractionAlert,
  });

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

  // Restore persisted compact 'mini' mode on Tauri cold launch
  useEffect(() => {
    if (!inTauri) return;
    if (readPersistedHudMode() === 'mini') {
      invokeTauriSafe('resize_hud', { mode: 'mini' });
    }
  }, [inTauri]);

  // Listen to Tauri System Tray "tauri-hud-toggle-mode" event (mini <-> normal)
  useEffect(() => {
    if (!inTauri) return;
    let disposed = false;
    let unlistenFn: (() => void) | null = null;
    const w = window as unknown as TauriWindowBridge;
    const listen = w.__TAURI__?.event?.listen;
    if (typeof listen !== 'function') return;

    Promise.resolve(
      listen('tauri-hud-toggle-mode', () => {
        const next: 'mini' | 'normal' = hudModeRef.current === 'mini' ? 'normal' : 'mini';
        switchHudMode(next);
      })
    )
      .then((fn) => {
        if (disposed) {
          fn?.();
        } else {
          unlistenFn = fn;
        }
      })
      .catch(() => {
        // Safe no-op if Tauri event bridge is unavailable
      });

    return () => {
      disposed = true;
      if (unlistenFn) {
        try {
          unlistenFn();
        } catch {
          // Ignore cleanup error
        }
      }
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

  const stopDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handlePlayPause = async () => {
    if (busyAction || !targetQuest) return;
    setBusyAction('play');
    try {
      if (isRunning && activeQuest) {
        await onPauseQuest(activeQuest.id);
      } else {
        await onStartQuest(targetQuest.id);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleComplete = async () => {
    if (busyAction || !targetQuest) return;
    setBusyAction('complete');
    try {
      await onCompleteQuest(targetQuest.id);
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleDnd = async () => {
    if (busyAction) return;
    setBusyAction('dnd');
    try {
      await onToggleDnd(isDndActive ? 0 : 60);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRescueFocus = async () => {
    if (busyAction || !onConvertFocusToQuest || uncreditedFocusMins < 10) return;
    setBusyAction('rescue');
    try {
      await onConvertFocusToQuest({
        mode: 'complete_new',
        title:
          suggestedSession?.suggestedTitle ||
          `Phiên Tập Trung (${formatDurationVn(uncreditedFocusMins)})`,
        primaryStat: suggestedSession?.primaryStat || 'INT',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickTitle.trim();
    if (!cleaned || busyAction) return;
    setBusyAction('add');
    try {
      await onQuickAddQuest(cleaned, quickDuration);
      setQuickTitle('');
      switchHudMode('normal');
    } finally {
      setBusyAction(null);
    }
  };

  const elapsedSec = activeQuest ? getQuestElapsedSeconds(activeQuest, nowMs) : 0;
  const activePlannedSec = Math.max(60, (activeQuest?.durationMinutes ?? 25) * 60);
  const questProgressPct = activeQuest
    ? Math.min(100, Math.round((elapsedSec / activePlannedSec) * 100))
    : 0;
  const nowVnMins = getVnNowMinutes(new Date(nowMs));
  const nextSchedule = computeNextScheduleContext(
    state?.todayAnalysis?.blocks,
    state?.todayAnalysis?.totalFreeMinutes,
    nowVnMins
  );

  const focusBarColor =
    focusScore >= 70 ? '#38a169' : focusScore >= 45 ? '#c99330' : '#b83a4b';
  const distractionBarColor =
    distractionAlert || distractionPct > 85
      ? '#c93b4b'
      : distractionPct >= 50
        ? '#d99026'
        : '#4a7ab5';
  const energyLevel = player?.energyLevel ?? 75;
  const energyColor =
    energyLevel >= 70 ? '#52c484' : energyLevel >= 40 ? '#e6c24c' : '#e55365';

  const hasPurityBadge =
    Boolean(activeQuest) && (activeQuest?.verifiedFocusSeconds ?? 0) >= 60;
  const purityPct = activeQuest?.focusIntegrityPct ?? 100;
  const flowBonusReady =
    Boolean(activeQuest) &&
    (activeQuest?.verifiedFocusSeconds ?? 0) >= 600 &&
    purityPct >= 80;
  const showUnloggedRescue =
    !activeQuest &&
    !selectedPendingQuest &&
    uncreditedFocusMins >= 15 &&
    Boolean(onConvertFocusToQuest);

  // ==================== MINI MODE (284x68px inside 292x76px Tauri window) ====================
  const miniPlaque = (
    <div
      className={`px-hud-frame relative flex h-[68px] max-h-[68px] w-[284px] select-none items-center gap-[6px] overflow-hidden px-[6px] py-[6px] text-[#f3ead8] ${
        distractionAlert ? 'px-hud-frame-alert' : ''
      }`}
    >
      <PixelCornerRivets />

      {/* Draggable Portrait */}
      <div
        data-tauri-drag-region
        className="flex h-[30px] w-[30px] shrink-0 cursor-grab items-center justify-center border-2 border-[#d4a24c] bg-[#100e18] active:cursor-grabbing"
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

      {/* Draggable Single-Line Safe Telemetry */}
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 cursor-grab flex-col justify-center gap-[5px] overflow-hidden active:cursor-grabbing"
        title={
          activeQuest
            ? `${activeQuest.title} (${formatMmSs(elapsedSec)} / ${activeQuest.durationMinutes}p)`
            : `${gradeInfo.title} · ${nextSchedule.title}`
        }
      >
        <div className="pointer-events-none flex min-w-0 items-center gap-[4px] overflow-hidden whitespace-nowrap leading-none">
          <span
            className="shrink-0 border border-[#09070f] px-[3px] py-[1px] font-pixel text-[7.5px] font-bold"
            style={{ backgroundColor: gradeInfo.bg, color: gradeInfo.fg }}
          >
            {gradeInfo.grade}
          </span>
          <span
            className="shrink-0 font-mono text-[10px] font-extrabold tabular-nums"
            style={{ color: distractionAlert ? '#ff6b7a' : focusBarColor }}
          >
            {focusScore}%
          </span>
          <span className="min-w-0 truncate whitespace-nowrap font-mono text-[9.5px] font-bold text-[#d2c8e0] tabular-nums">
            {formatDurationVn(focusTotalMins)}/{formatDurationVn(dailyFocusGoalMins)}
          </span>
        </div>

        <div
          className="pointer-events-none flex min-w-0 items-center gap-[4px] overflow-hidden whitespace-nowrap leading-none"
          title={activeQuest ? activeQuest.title : nextSchedule.title}
        >
          {distractionAlert ? (
            <span className="min-w-0 truncate whitespace-nowrap font-pixel text-[8px] font-bold text-[#ff6b7a]">
              ! ĐANG XAO NHÃNG
            </span>
          ) : activeQuest ? (
            <>
              <span
                className="shrink-0 font-mono text-[10.5px] font-extrabold tabular-nums"
                style={{ color: isRunning ? '#f0c46c' : '#8eb8eb' }}
              >
                {formatMmSs(elapsedSec)}
              </span>
              <span className="min-w-0 truncate whitespace-nowrap font-mono text-[9px] text-[#b7adc9]">
                {activeQuest.title}
              </span>
            </>
          ) : (
            <span className="min-w-0 truncate whitespace-nowrap font-mono text-[9.5px] font-bold text-[#e6c278] tabular-nums">
              {nextSchedule.shortText}
            </span>
          )}
        </div>
      </div>

      {/* 4 Compact Tactile Pixel Buttons: Play, Expand, Hide, Dashboard */}
      <div className="flex shrink-0 items-center gap-[3px]">
        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          disabled={!targetQuest || busyAction !== null}
          onClick={() => void handlePlayPause()}
          className={`px-hud-btn flex h-[24px] w-[24px] items-center justify-center disabled:opacity-40 ${
            isRunning ? 'px-hud-btn-gold' : 'px-hud-btn-green'
          }`}
          title={isRunning ? 'Tạm dừng nhiệm vụ' : 'Bắt đầu nhiệm vụ'}
          aria-label={isRunning ? 'Tạm dừng nhiệm vụ' : 'Bắt đầu nhiệm vụ'}
        >
          {busyAction === 'play' ? <PxBusyDots /> : isRunning ? <PxPause size={9} /> : <PxPlay size={9} />}
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          onClick={() => switchHudMode('normal')}
          className="px-hud-btn px-hud-btn-slate flex h-[24px] w-[24px] items-center justify-center"
          title="Mở rộng bảng kỷ luật đầy đủ"
          aria-label="Mở rộng HUD"
        >
          <PxMiniToggle size={9} expand />
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          onClick={handleHideClick}
          className="px-hud-btn px-hud-btn-slate flex h-[24px] w-[24px] items-center justify-center"
          title="Ẩn HUD về khay hệ thống (Ctrl+Shift+Space để hiện lại)"
          aria-label="Ẩn HUD"
        >
          <PxHide size={9} />
        </button>

        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          onClick={onOpenMainApp}
          className="px-hud-btn px-hud-btn-blue flex h-[24px] w-[24px] items-center justify-center"
          title="Mở Bảng điều khiển chính"
          aria-label="Mở Bảng điều khiển chính"
        >
          <PxDashboard size={9} />
        </button>
      </div>
    </div>
  );

  // ==================== NORMAL / EXPANDED MODE (396x178px / 396x228px) ====================
  const fullPlaque = (
    <div
      className={`px-hud-frame relative flex w-[396px] select-none flex-col px-[8px] py-[6px] text-[#f3ead8] ${
        hudMode === 'expanded' ? 'h-[228px]' : 'h-[178px]'
      } ${distractionAlert ? 'px-hud-frame-alert' : ''}`}
    >
      <PixelCornerRivets />

      {/* ROW 1: Pixel Identity, Discipline Grade Stamp & Window Controls (32px, draggable) */}
      <div
        data-tauri-drag-region
        className="flex h-[32px] cursor-grab items-center justify-between gap-[6px] active:cursor-grabbing"
      >
        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-[6px]">
          {/* 28x28 Gold-Beveled Pixel Portrait */}
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center border-2 border-[#d4a24c] bg-[#100e18]">
            <PixelHeroSprite
              rank={player?.rank || 'E-Rank'}
              avatarStyle={player?.profile.avatarStyle || 'shadow_monarch'}
              mood={heroMood}
              size={24}
              className="!animate-none"
            />
          </div>

          {/* LV + Instant Discipline Grade Stamp */}
          <div className="flex shrink-0 flex-col gap-[2px] leading-none" title={gradeInfo.title}>
            <div className="flex items-center gap-[3px]">
              <span className="border border-[#09070f] bg-[#c99330] px-[4px] py-[1px] font-pixel text-[7.5px] font-bold text-[#140e04]">
                LV.{player?.level ?? 1}
              </span>
              <span
                className="border border-[#09070f] px-[4px] py-[1px] font-pixel text-[7px] font-bold"
                style={{ backgroundColor: gradeInfo.bg, color: gradeInfo.fg }}
              >
                {gradeInfo.stamp}
              </span>
            </div>
            <div className="flex items-center gap-[3px]">
              <div className="flex items-center gap-[1px]">
                {heartStates.map((st, idx) => (
                  <PixelHeart key={idx} state={st} size={9} critical={isCriticalHp} />
                ))}
              </div>
              <span className="font-mono text-[8.5px] font-bold text-[#e57380] tabular-nums">
                {hp}/{maxHp}
              </span>
            </div>
          </div>

          {/* Streak & Energy */}
          <div className="flex shrink-0 flex-col justify-center gap-[3px] border-l-2 border-[#2e2942] pl-[6px] font-mono text-[9.5px] font-bold leading-none tabular-nums">
            <span className="flex items-center gap-[3px] text-[#f0b44c]" title="Chuỗi ngày giữ kỷ luật">
              <PxFlame size={9} />
              {player?.streakDays ?? 0} ngày
            </span>
            <span className="flex items-center gap-[3px]" style={{ color: energyColor }} title="Thể trạng hôm nay (không trừ HP)">
              <PxBolt size={9} color={energyColor} />
              Pin {energyLevel}%
            </span>
          </div>
        </div>

        {/* Right: 4 Crisp 16-bit Controls (DND, Mini, Hide HUD, Open Dashboard) */}
        <div className="flex shrink-0 items-center gap-[3px]">
          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            disabled={busyAction !== null}
            onClick={() => void handleToggleDnd()}
            className={`px-hud-btn flex h-[24px] w-[24px] items-center justify-center disabled:opacity-40 ${
              isDndActive ? 'px-hud-btn-gold' : 'px-hud-btn-slate'
            }`}
            title={
              isDndActive
                ? `Đang tạm im thông báo (còn ${dndRemainingMin ?? 60}p) — bấm để tắt`
                : 'Tạm im thông báo 1 giờ (DND)'
            }
            aria-label={isDndActive ? 'Tắt tạm im' : 'Bật tạm im 1 giờ'}
          >
            {busyAction === 'dnd' ? <PxBusyDots /> : <PxBell size={10} muted={isDndActive} />}
          </button>

          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            onClick={() => switchHudMode('mini')}
            className="px-hud-btn px-hud-btn-slate flex h-[24px] w-[24px] items-center justify-center"
            title="Thu gọn thành thanh Mini gọn (284×68)"
            aria-label="Thu gọn chế độ Mini"
          >
            <PxMiniToggle size={10} />
          </button>

          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            onClick={handleHideClick}
            className="px-hud-btn px-hud-btn-slate flex h-[24px] w-[24px] items-center justify-center"
            title="Ẩn HUD về khay hệ thống (Ctrl+Shift+Space để hiện lại)"
            aria-label="Ẩn HUD"
          >
            <PxHide size={10} />
          </button>

          <button
            type="button"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            onClick={onOpenMainApp}
            className="px-hud-btn px-hud-btn-blue flex h-[24px] w-[24px] items-center justify-center"
            title="Mở Bảng điều khiển đầy đủ"
            aria-label="Mở Bảng điều khiển chính"
          >
            <PxDashboard size={10} />
          </button>
        </div>
      </div>

      {/* ROW 2: 2 Crystal-Clear Discipline Cards (54px) */}
      <div className="mt-[5px] grid h-[54px] grid-cols-2 gap-[6px]">
        {/* Card A: Tập trung & Mục tiêu hôm nay */}
        <div
          data-tauri-drag-region
          className="px-hud-inset flex cursor-grab flex-col justify-between px-[6px] py-[4px] active:cursor-grabbing"
          title={`Mục tiêu tập trung hôm nay: ${formatDurationVn(focusTotalMins)} / ${formatDurationVn(dailyFocusGoalMins)} (Làm sâu ${deepWorkMins}p + Học ${studyMins}p · Điểm tập trung ${focusScore}%)`}
        >
          <div className="pointer-events-none flex items-center justify-between gap-1 leading-none">
            <span className="flex items-center gap-[3px] font-mono text-[9.5px] font-bold text-[#ede5f7]">
              <PxTarget size={9} />
              Tập trung
            </span>
            <span className="font-mono text-[10px] font-extrabold tabular-nums" style={{ color: focusBarColor }}>
              {formatDurationVn(focusTotalMins)}
              <span className="font-normal text-[#8b80a6]">/{formatDurationVn(dailyFocusGoalMins)}</span>
            </span>
          </div>

          <div className="px-hud-bar-track pointer-events-none h-[10px] w-full">
            <div
              className="h-full transition-none"
              style={{ width: `${focusGoalPct}%`, backgroundColor: focusBarColor }}
            />
          </div>

          <div className="pointer-events-none flex items-center justify-between font-mono text-[8.5px] leading-none tabular-nums">
            <span className="text-[#c5bcd6]">
              Điểm <strong style={{ color: focusBarColor }}>{focusScore}%</strong>
            </span>
            <span className="truncate text-[#8b80a6]">
              Sâu {deepWorkMins}p · Học {studyMins}p
            </span>
          </div>
        </div>

        {/* Card B: Hạn mức Xao nhãng & Nhiệm vụ ngày */}
        <div
          data-tauri-drag-region
          className="px-hud-inset flex cursor-grab flex-col justify-between px-[6px] py-[4px] active:cursor-grabbing"
          title={`Xao nhãng: ${distractionMins}p / hạn mức ${budgetMins}p · Nhiệm vụ đã hoàn thành hôm nay: ${doneToday}/${totalToday}`}
        >
          <div className="pointer-events-none flex items-center justify-between gap-1 leading-none">
            <span className="flex items-center gap-[3px] font-mono text-[9.5px] font-bold text-[#ede5f7]">
              <PxWarn size={9} danger={distractionAlert || distractionPct > 85} />
              Xao nhãng
            </span>
            <span
              className="font-mono text-[10px] font-extrabold tabular-nums"
              style={{ color: distractionBarColor }}
            >
              {distractionMins}p<span className="font-normal text-[#8b80a6]">/{budgetMins}p</span>
            </span>
          </div>

          <div className="px-hud-bar-track pointer-events-none h-[10px] w-full">
            <div
              className="h-full transition-none"
              style={{ width: `${distractionPct}%`, backgroundColor: distractionBarColor }}
            />
          </div>

          <div className="pointer-events-none flex items-center justify-between font-mono text-[8.5px] leading-none tabular-nums">
            {distractionAlert ? (
              <span className="font-pixel text-[7.5px] font-bold text-[#ff6b7a]">
                ! QUAY LẠI NGAY
              </span>
            ) : distractionMins >= budgetMins ? (
              <span className="font-bold text-[#ff6b7a]">Vượt hạn mức!</span>
            ) : (
              <span className="text-[#998fb3]">Còn {safeRemainMins}p an toàn</span>
            )}
            <span className="font-bold text-[#d4a24c]">
              Việc {doneToday}/{totalToday}
            </span>
          </div>
        </div>
      </div>

      {/* ROW 3: Live PC Context & Smart Next-Schedule Countdown (24px, draggable) */}
      <div
        data-tauri-drag-region
        className="px-hud-inset mt-[5px] flex h-[24px] cursor-grab items-center justify-between gap-[6px] px-[6px] active:cursor-grabbing"
      >
        <div
          className="pointer-events-none flex min-w-0 max-w-[43%] items-center gap-[4px] font-mono text-[9px] leading-none text-[#e0d8eb]"
          title={
            currentApp
              ? `Đang dùng: ${currentApp.processName} (${categoryMeta.label})`
              : 'Theo dõi ứng dụng trên PC'
          }
        >
          <span
            className="h-[6px] w-[6px] shrink-0 border border-[#09070f]"
            style={{ backgroundColor: categoryMeta.color }}
          />
          <span className="truncate">
            {shortAppName ? `${shortAppName} · ${categoryMeta.label}` : `PC · ${categoryMeta.label}`}
          </span>
        </div>

        <div
          className="pointer-events-none flex min-w-0 flex-1 items-center justify-end gap-[4px] border-l-2 border-[#2e2942] pl-[6px] font-mono text-[9px] font-bold leading-none text-[#f0c46c]"
          title={nextSchedule.title}
        >
          <PxClock size={9} color={nextSchedule.kind === 'active' ? '#52c484' : '#d4a24c'} />
          <span className="truncate">
            {nextSchedule.kind === 'active' ? `Đang lịch · ${nextSchedule.text}` : nextSchedule.text}
          </span>
        </div>
      </div>

      {/* ROW 4: Smart Quest Execution / Unlogged Focus Rescue Dock (38px) */}
      <div className="mt-[5px] flex h-[38px] items-center gap-[4px]">
        {showUnloggedRescue ? (
          <div className="px-hud-inset flex h-[38px] min-w-0 flex-1 items-center justify-between gap-[6px] border-[#c99330] px-[7px]">
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[9.5px] font-extrabold text-[#f0c46c]">
                ⚡ +{formatDurationVn(uncreditedFocusMins)} tập trung chưa lưu
              </div>
              <div className="truncate font-mono text-[8.5px] text-[#b7adc9]">
                Quy đổi ngay thành Quest để nhận XP &amp; Gold
              </div>
            </div>
            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              disabled={busyAction !== null}
              onClick={() => void handleRescueFocus()}
              className="px-hud-btn px-hud-btn-gold h-[26px] shrink-0 px-[7px] font-pixel text-[7.5px] font-bold disabled:opacity-40"
              title="Lưu phiên tập trung PC thành Quest đã hoàn thành"
            >
              {busyAction === 'rescue' ? <PxBusyDots /> : 'Lưu Quest'}
            </button>
          </div>
        ) : (
          <div
            data-tauri-drag-region
            className="px-hud-inset flex h-[38px] min-w-0 flex-1 cursor-grab flex-col justify-center gap-[3px] px-[7px] active:cursor-grabbing"
            title={
              activeQuest
                ? `${activeQuest.title} (${formatMmSs(elapsedSec)} / ${activeQuest.durationMinutes}p)`
                : selectedPendingQuest
                  ? `Nhiệm vụ chờ: ${selectedPendingQuest.title} (${selectedPendingQuest.durationMinutes}p)`
                  : 'Chưa có nhiệm vụ chờ — bấm + để thêm nhanh'
            }
          >
            {!state ? (
              <span className="pointer-events-none truncate font-mono text-[10px] text-[#847a99]">
                Đang kết nối máy chủ PC...
              </span>
            ) : activeQuest ? (
              <>
                <div className="pointer-events-none flex min-w-0 items-center justify-between gap-[6px] leading-none">
                  <div className="flex min-w-0 flex-1 items-center gap-[4px]">
                    <span
                      className="h-[6px] w-[6px] shrink-0 border border-[#09070f]"
                      style={{ backgroundColor: isRunning ? '#38a169' : '#d99026' }}
                    />
                    <span className="truncate font-display text-[11px] font-bold text-[#f3ead8]">
                      {activeQuest.title}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-[4px]">
                    {flowBonusReady && (
                      <span
                        className="border border-[#09070f] bg-[#c99330] px-[3px] py-[1px] font-mono text-[8px] font-extrabold text-[#140e04]"
                        title="Đủ điều kiện Flow Bonus +15% XP khi hoàn thành!"
                      >
                        ★+15%
                      </span>
                    )}
                    {hasPurityBadge && !flowBonusReady && (
                      <span className="font-mono text-[8.5px] font-bold text-[#6ee7a8] tabular-nums">
                        {purityPct}%
                      </span>
                    )}
                    <span
                      className="font-mono text-[11px] font-extrabold tabular-nums"
                      style={{ color: isRunning ? '#f0c46c' : '#8eb8eb' }}
                    >
                      {formatMmSs(elapsedSec)}
                    </span>
                    <span className="font-mono text-[8.5px] text-[#847a99] tabular-nums">
                      /{activeQuest.durationMinutes}p
                    </span>
                  </div>
                </div>
                <div className="px-hud-bar-track pointer-events-none h-[6px] w-full">
                  <div
                    className="h-full transition-none"
                    style={{
                      width: `${questProgressPct}%`,
                      backgroundColor: isRunning ? '#c99330' : '#4a7ab5',
                    }}
                  />
                </div>
              </>
            ) : selectedPendingQuest ? (
              <div className="flex min-w-0 items-center justify-between gap-[4px]">
                <div className="pointer-events-none min-w-0 flex-1">
                  <div className="truncate font-display text-[11px] font-bold text-[#e8dff5]">
                    {selectedPendingQuest.title}
                  </div>
                  <div className="font-mono text-[8.5px] text-[#968cb0] tabular-nums">
                    Dự kiến {selectedPendingQuest.durationMinutes}p
                    {pendingQuests.length > 1
                      ? ` · Việc ${safePendingIdx + 1}/${pendingQuests.length}`
                      : ' · Sẵn sàng bấm ▶'}
                  </div>
                </div>
                {pendingQuests.length > 1 && (
                  <div className="flex shrink-0 items-center gap-[2px]">
                    <button
                      type="button"
                      data-tauri-drag-region="false"
                      onMouseDown={stopDrag}
                      onClick={() =>
                        setSelectedPendingIdx((idx) =>
                          idx <= 0 ? pendingQuests.length - 1 : idx - 1
                        )
                      }
                      className="px-hud-btn px-hud-btn-slate flex h-[20px] w-[18px] items-center justify-center"
                      title="Xem nhiệm vụ trước"
                      aria-label="Nhiệm vụ trước"
                    >
                      <PxChevron dir="left" />
                    </button>
                    <button
                      type="button"
                      data-tauri-drag-region="false"
                      onMouseDown={stopDrag}
                      onClick={() =>
                        setSelectedPendingIdx((idx) => (idx + 1) % pendingQuests.length)
                      }
                      className="px-hud-btn px-hud-btn-slate flex h-[20px] w-[18px] items-center justify-center"
                      title="Xem nhiệm vụ tiếp theo"
                      aria-label="Nhiệm vụ tiếp theo"
                    >
                      <PxChevron dir="right" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="pointer-events-none">
                <div className="truncate font-mono text-[10px] font-bold text-[#c9bfd8]">
                  Chưa có nhiệm vụ đang chờ
                </div>
                <div className="truncate font-mono text-[8.5px] text-[#847a99]">
                  Bấm nút + bên phải để thêm việc kỉ luật ngay
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3 Chunky Tactile 16-Bit Action Buttons: [▶/⏸], [✓], [+] */}
        {!showUnloggedRescue && (
          <>
            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              disabled={!targetQuest || busyAction !== null}
              onClick={() => void handlePlayPause()}
              className={`px-hud-btn flex h-[38px] w-[32px] shrink-0 items-center justify-center disabled:opacity-40 ${
                isRunning ? 'px-hud-btn-gold' : 'px-hud-btn-green'
              }`}
              title={
                isRunning
                  ? 'Tạm dừng nhiệm vụ đang chạy'
                  : isPaused
                    ? 'Tiếp tục nhiệm vụ'
                    : selectedPendingQuest
                      ? `Bắt đầu: ${selectedPendingQuest.title}`
                      : 'Chưa có nhiệm vụ để chạy'
              }
              aria-label={isRunning ? 'Tạm dừng nhiệm vụ' : 'Bắt đầu nhiệm vụ'}
            >
              {busyAction === 'play' ? (
                <PxBusyDots />
              ) : isRunning ? (
                <PxPause size={10} />
              ) : (
                <PxPlay size={10} />
              )}
            </button>

            <button
              type="button"
              data-tauri-drag-region="false"
              onMouseDown={stopDrag}
              disabled={!targetQuest || busyAction !== null}
              onClick={() => void handleComplete()}
              className="px-hud-btn px-hud-btn-gold flex h-[38px] w-[32px] shrink-0 items-center justify-center disabled:opacity-40"
              title={
                targetQuest
                  ? `Hoàn thành ngay: ${targetQuest.title}`
                  : 'Chưa có nhiệm vụ để hoàn thành'
              }
              aria-label="Hoàn thành nhiệm vụ"
            >
              {busyAction === 'complete' ? <PxBusyDots /> : <PxCheck size={10} />}
            </button>
          </>
        )}

        <button
          type="button"
          data-tauri-drag-region="false"
          onMouseDown={stopDrag}
          onClick={() => switchHudMode(hudMode === 'expanded' ? 'normal' : 'expanded')}
          className={`px-hud-btn flex h-[38px] w-[32px] shrink-0 items-center justify-center ${
            hudMode === 'expanded' ? 'px-hud-btn-red' : 'px-hud-btn-slate'
          }`}
          title={hudMode === 'expanded' ? 'Đóng khung thêm nhanh' : 'Thêm nhanh việc kỉ luật (+)'}
          aria-label="Mở hoặc đóng thêm nhanh"
          aria-expanded={hudMode === 'expanded'}
        >
          {hudMode === 'expanded' ? <PxClose size={10} /> : <PxPlus size={10} />}
        </button>
      </div>

      {/* EXPANDED DRAWER: Sunken Pixel Quick-Add Strip */}
      {hudMode === 'expanded' && (
        <form
          onSubmit={(e) => void handleQuickAddSubmit(e)}
          className="mt-[6px] flex h-[40px] items-center gap-[4px] border-t-2 border-[#09070f] pt-[6px]"
        >
          <input
            ref={quickInputRef}
            type="text"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') switchHudMode('normal');
            }}
            placeholder="Thêm việc kỉ luật..."
            disabled={busyAction === 'add'}
            className="px-hud-inset h-[30px] min-w-0 flex-1 rounded-none px-[7px] font-mono text-[10.5px] text-[#f3ead8] placeholder:text-[#736987] focus:border-[#d4a24c] focus:shadow-none"
          />

          <div className="flex shrink-0 items-center gap-[3px]">
            {QUICK_DURATIONS.map((mins) => (
              <button
                key={mins}
                type="button"
                data-tauri-drag-region="false"
                onMouseDown={stopDrag}
                onClick={() => setQuickDuration(mins)}
                className={`px-hud-btn h-[30px] px-[6px] font-mono text-[9.5px] font-bold tabular-nums ${
                  quickDuration === mins ? 'px-hud-btn-gold' : 'px-hud-btn-slate'
                }`}
              >
                {mins}p
              </button>
            ))}
          </div>

          <button
            type="submit"
            data-tauri-drag-region="false"
            onMouseDown={stopDrag}
            disabled={!quickTitle.trim() || busyAction === 'add'}
            className="px-hud-btn px-hud-btn-gold flex h-[30px] shrink-0 items-center gap-[3px] px-[8px] font-pixel text-[8px] font-bold disabled:opacity-40"
          >
            {busyAction === 'add' ? <PxBusyDots /> : <PxPlus size={8} />}
            <span>Thêm</span>
          </button>
        </form>
      )}
    </div>
  );

  const activePlaque = hudMode === 'mini' ? miniPlaque : fullPlaque;

  // Inside Tauri transparent Always-on-Top window
  if (inTauri) {
    return (
      <div className="flex h-screen w-full items-start justify-start overflow-hidden bg-transparent pl-[2px] pt-[2px]">
        {activePlaque}
      </div>
    );
  }

  // Browser Preview Mode (!inTauri): Authentic 2D Pixel Preview Bar
  const previewSurfaceStyle: React.CSSProperties =
    previewBg === 'dark'
      ? {
          backgroundColor: '#12101a',
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }
      : previewBg === 'light'
        ? {
            backgroundColor: '#e6dfd1',
            backgroundImage:
              'linear-gradient(to right, rgba(24,21,35,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,21,35,0.06) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }
        : {
            backgroundColor: '#242031',
            backgroundImage:
              'linear-gradient(45deg, #322d44 25%, transparent 25%), linear-gradient(-45deg, #322d44 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #322d44 75%), linear-gradient(-45deg, transparent 75%, #322d44 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          };

  return (
    <div
      style={previewSurfaceStyle}
      className="flex h-screen w-full flex-col items-center justify-center gap-5 overflow-hidden p-4"
    >
      <div className="px-hud-frame relative flex flex-wrap items-center justify-center gap-2 px-3 py-2 text-[#f3ead8]">
        <PixelCornerRivets />
        <span className="font-pixel text-[8.5px] font-bold text-[#d4a24c]">
          2D PIXEL HUD
        </span>

        <div className="flex items-center gap-1">
          {(
            [
              { key: 'dark', label: 'Nền tối' },
              { key: 'light', label: 'Nền sáng' },
              { key: 'transparent', label: 'Trong suốt' },
            ] as const
          ).map((bg) => (
            <button
              key={bg.key}
              type="button"
              onClick={() => setPreviewBg(bg.key)}
              className={`px-hud-btn px-2 py-1 font-mono text-[10px] font-bold ${
                previewBg === bg.key ? 'px-hud-btn-gold' : 'px-hud-btn-slate'
              }`}
            >
              {bg.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {(['mini', 'normal', 'expanded'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setPreviewHidden(false);
                switchHudMode(m);
              }}
              className={`px-hud-btn px-2 py-1 font-pixel text-[8px] font-bold uppercase ${
                !previewHidden && hudMode === m ? 'px-hud-btn-green' : 'px-hud-btn-slate'
              }`}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreviewHidden((v) => !v)}
            className={`px-hud-btn px-2 py-1 font-mono text-[10px] font-bold ${
              previewHidden ? 'px-hud-btn-gold' : 'px-hud-btn-slate'
            }`}
          >
            {previewHidden ? 'Hiện HUD' : 'Ẩn HUD'}
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenMainApp}
          className="px-hud-btn px-hud-btn-blue px-2 py-1 font-mono text-[10px] font-bold"
        >
          ← Mở Dashboard
        </button>
      </div>

      {previewHidden ? (
        <div className="px-hud-frame relative flex items-center gap-3 px-4 py-3 text-[#d2c8e0]">
          <PixelCornerRivets />
          <span className="font-mono text-xs">
            HUD đang ở trạng thái <strong>Ẩn</strong> (bấm{' '}
            <strong className="text-[#f0c46c]">Ctrl+Shift+Space</strong> trong bản .exe hoặc nút bên cạnh để hiện lại).
          </span>
          <button
            type="button"
            onClick={() => setPreviewHidden(false)}
            className="px-hud-btn px-hud-btn-green px-3 py-1 font-mono text-xs font-bold"
          >
            Hiện lại HUD
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">{activePlaque}</div>
      )}
    </div>
  );
};

export default FloatingHudPage;
