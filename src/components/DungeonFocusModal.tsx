import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActivityCategory,
  HeroAvatarStyle,
  HunterRank,
  MonsterArchetype,
  Quest,
  WeeklyRaidBoss,
} from '../types/system';
import {
  soundEngine,
  type AmbienceMode,
  type SoundEngineSnapshot,
} from '../utils/soundEngine';
import { PixelHeroSprite, PixelMonsterSprite } from './DungeonSprites';
import { RaidBossSprite } from './RaidBossSprites';
import {
  PixelRivets,
  PxBolt,
  PxBook,
  PxCheck,
  PxClose,
  PxFlame,
  PxPause,
  PxPlay,
  PxRefresh,
  PxSkull,
  PxSoundOff,
  PxSoundOn,
  PxSparkle,
  PxSword,
  PxWarn,
} from './PixelIcons';

export interface DungeonFocusModalProps {
  quest: Quest;
  heroRank?: HunterRank;
  heroAvatarStyle?: HeroAvatarStyle;
  weeklyRaid?: WeeklyRaidBoss | null;
  fallbackMonsterArchetype?: MonsterArchetype;
  fallbackMonsterName?: string;
  currentActivity?: {
    category: ActivityCategory;
    processName: string;
    windowTitle: string;
  } | null;
  onStartQuest?: (questId: string) => Promise<void>;
  onPauseQuest?: (questId: string) => Promise<void>;
  onToggleSubtask: (questId: string, subtaskId: string) => Promise<void>;
  onClearDungeon: (
    questId: string,
    proofNote?: string,
    meta?: { overtimeMinutes: number; distractions: number; microGapCount: number }
  ) => Promise<void>;
  onClose: () => void;
}

type FocusViewMode = 'battle' | 'zen';

interface FloatingDamagePop {
  id: number;
  label: string;
  target: 'enemy' | 'hero';
  tone: 'normal' | 'crit' | 'subtask' | 'counter';
}

interface TimerMirror {
  running: boolean;
  startedAtMs: number | null;
  baseSeconds: number;
}

const VIEW_MODE_STORAGE_KEY = 'rpg_focus_view_mode';

const AMBIENCE_OPTIONS: Array<{ mode: AmbienceMode; label: string }> = [
  { mode: 'off', label: 'Tắt' },
  { mode: 'rain', label: 'Mưa' },
  { mode: 'campfire', label: 'Lửa trại' },
  { mode: 'brown_noise', label: 'Brown' },
  { mode: 'tavern_8bit', label: '8-Bit' },
];

function readSavedViewMode(): FocusViewMode {
  try {
    const saved =
      typeof window !== 'undefined' ? window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) : null;
    return saved === 'zen' ? 'zen' : 'battle';
  } catch {
    return 'battle';
  }
}

function saveViewMode(mode: FocusViewMode): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // Ignore storage errors
  }
}

function deriveTimerMirrorFromQuest(quest: Quest): TimerMirror {
  const baseSeconds = Math.max(0, quest.pausedAccumulatedSeconds ?? 0);
  if (quest.startedAt && !quest.isPaused) {
    const parsed = Date.parse(quest.startedAt);
    return {
      running: true,
      startedAtMs: Number.isNaN(parsed) ? Date.now() : parsed,
      baseSeconds,
    };
  }
  if (quest.isPaused) {
    return {
      running: false,
      startedAtMs: null,
      baseSeconds,
    };
  }
  // Brand-new unstarted quest: optimistically start immediately while auto-calling onStartQuest
  return {
    running: true,
    startedAtMs: Date.now(),
    baseSeconds,
  };
}

function computeElapsedFromMirror(mirror: TimerMirror, nowMs: number): number {
  if (mirror.running && mirror.startedAtMs !== null) {
    return mirror.baseSeconds + Math.max(0, Math.floor((nowMs - mirror.startedAtMs) / 1000));
  }
  return mirror.baseSeconds;
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const DungeonFocusModal: React.FC<DungeonFocusModalProps> = ({
  quest,
  heroRank = 'E-Rank',
  heroAvatarStyle = 'shadow_monarch',
  weeklyRaid = null,
  fallbackMonsterArchetype = 'slime',
  fallbackMonsterName = 'Quái Vật Trì Hoãn',
  currentActivity = null,
  onStartQuest,
  onPauseQuest,
  onToggleSubtask,
  onClearDungeon,
  onClose,
}) => {
  const totalSeconds = Math.max(60, quest.durationMinutes * 60);

  // 1. True 2-way SQLite Timer Mirror
  const [mirror, setMirror] = useState<TimerMirror>(() => deriveTimerMirrorFromQuest(quest));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timerBusy, setTimerBusy] = useState(false);
  const [clearing, setClearing] = useState(false);

  // 2. View mode (BATTLE vs ZEN)
  const [viewMode, setViewMode] = useState<FocusViewMode>(() => readSavedViewMode());

  // 3. Battle combat state
  const [combo, setCombo] = useState(0);
  const [heroLungeActive, setHeroLungeActive] = useState(false);
  const [monsterHitActive, setMonsterHitActive] = useState(false);
  const [arenaShakeActive, setArenaShakeActive] = useState(false);
  const [floatingDmg, setFloatingDmg] = useState<FloatingDamagePop | null>(null);
  const [sessionBonusDmg, setSessionBonusDmg] = useState(0);

  // 4. Distraction & Micro-Gap state
  const [distractions, setDistractions] = useState(0);
  const [lastOffendingApp, setLastOffendingApp] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [microGapLeft, setMicroGapLeft] = useState<number | null>(null);
  const [microGapCount, setMicroGapCount] = useState(0);
  const [showMicroGapNudge, setShowMicroGapNudge] = useState(false);

  // 5. Integrated 2-channel audio snapshot
  const [audioSnap, setAudioSnap] = useState<SoundEngineSnapshot>(() =>
    soundEngine.getSnapshot()
  );

  // Refs for clean async & 1s interval handling
  const autoStartedQuestIdRef = useRef<string | null>(null);
  const toggleInFlightRef = useRef(false);
  const lastHitMinuteRef = useRef<number>(
    Math.floor(computeElapsedFromMirror(deriveTimerMirrorFromQuest(quest), Date.now()) / 60)
  );
  const overtimeFanfarePlayedRef = useRef<boolean>(
    computeElapsedFromMirror(deriveTimerMirrorFromQuest(quest), Date.now()) >= totalSeconds
  );
  const currentActivityRef = useRef(currentActivity);
  const distractionStreakSecRef = useRef(0);
  const lastCounterAtMsRef = useRef(0);
  const continuousFocusSecRef = useRef(0);
  const comboRef = useRef(combo);
  const animTimersRef = useRef<number[]>([]);

  useEffect(() => {
    currentActivityRef.current = currentActivity;
  }, [currentActivity]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  // Clear pending animation timers on unmount
  useEffect(() => {
    return () => {
      for (const id of animTimersRef.current) {
        window.clearTimeout(id);
      }
      animTimersRef.current = [];
    };
  }, []);

  const scheduleAnimReset = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      fn();
      animTimersRef.current = animTimersRef.current.filter((t) => t !== id);
    }, ms);
    animTimersRef.current.push(id);
  }, []);

  const triggerHeroStrike = useCallback(
    (label: string, tone: 'normal' | 'crit' | 'subtask', dmgValue: number) => {
      setHeroLungeActive(false);
      setMonsterHitActive(false);
      window.requestAnimationFrame(() => {
        setHeroLungeActive(true);
        setMonsterHitActive(true);
        setFloatingDmg({ id: Date.now() + Math.random(), label, target: 'enemy', tone });
        setSessionBonusDmg((prev) => prev + dmgValue);
      });
      scheduleAnimReset(() => {
        setHeroLungeActive(false);
        setMonsterHitActive(false);
      }, 420);
      scheduleAnimReset(() => {
        setFloatingDmg((cur) => (cur && cur.label === label ? null : cur));
      }, 950);
    },
    [scheduleAnimReset]
  );

  const triggerMonsterCounter = useCallback(
    (sourceLabel: string | null) => {
      setArenaShakeActive(false);
      setCombo(0);
      setDistractions((d) => d + 1);
      if (sourceLabel) {
        setLastOffendingApp(sourceLabel);
      }
      soundEngine.monsterCounter();
      window.requestAnimationFrame(() => {
        setArenaShakeActive(true);
        setFloatingDmg({
          id: Date.now() + Math.random(),
          label: 'PHẢN ĐÒN! -COMBO',
          target: 'hero',
          tone: 'counter',
        });
      });
      scheduleAnimReset(() => {
        setArenaShakeActive(false);
      }, 460);
      scheduleAnimReset(() => {
        setFloatingDmg((cur) => (cur && cur.target === 'hero' ? null : cur));
      }, 1050);
    },
    [scheduleAnimReset]
  );

  // Sync mirror when server quest timer fields update (e.g. paused/resumed from Mini HUD)
  useEffect(() => {
    if (toggleInFlightRef.current) return;
    if (quest.startedAt || quest.isPaused) {
      setMirror(deriveTimerMirrorFromQuest(quest));
      setNowMs(Date.now());
    }
  }, [quest.id, quest.startedAt, quest.isPaused, quest.pausedAccumulatedSeconds]);

  // Auto-start unstarted quest in SQLite once on mount
  useEffect(() => {
    if (
      !quest.startedAt &&
      !quest.isPaused &&
      onStartQuest &&
      autoStartedQuestIdRef.current !== quest.id
    ) {
      autoStartedQuestIdRef.current = quest.id;
      toggleInFlightRef.current = true;
      void onStartQuest(quest.id).finally(() => {
        toggleInFlightRef.current = false;
      });
    }
  }, [quest.id, quest.startedAt, quest.isPaused, onStartQuest]);

  // Subscribe to soundEngine + stop ambience cleanly on unmount
  useEffect(() => {
    const unsubscribe = soundEngine.subscribe(setAudioSnap);
    return () => {
      unsubscribe();
      soundEngine.stopAmbience();
    };
  }, []);

  // Auto-pause/resume ambience when Focus timer pauses/resumes
  useEffect(() => {
    soundEngine.setAmbiencePaused(!mirror.running);
  }, [mirror.running]);

  // Main 1-second Focus Arena loop: timer tick, minute combat strike, overtime fanfare,
  // live PC distraction counter-attack (10s debounce + 45s cooldown), and 15-min Micro-Gap nudge
  useEffect(() => {
    if (!mirror.running || microGapLeft !== null) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);

      const elapsed = computeElapsedFromMirror(mirror, now);

      // Overtime Flow entry fanfare (fires once when crossing totalSeconds)
      if (elapsed >= totalSeconds && !overtimeFanfarePlayedRef.current) {
        overtimeFanfarePlayedRef.current = true;
        soundEngine.overtimeFanfare();
      }

      // Per-minute combat strike in Battle Arena
      const currentMinute = Math.floor(elapsed / 60);
      if (currentMinute > lastHitMinuteRef.current) {
        lastHitMinuteRef.current = currentMinute;
        const nextCombo = Math.min(5, comboRef.current + 1);
        setCombo(nextCombo);
        const isCrit = nextCombo >= 3 || currentMinute % 5 === 0;
        if (isCrit) {
          soundEngine.focusCrit();
          triggerHeroStrike('CRIT -24 HP!', 'crit', 24);
        } else {
          soundEngine.focusHit();
          triggerHeroStrike('-12 HP', 'normal', 12);
        }
      }

      // Smart 10s Micro-Gap Neural Replay Nudge every 15 continuous minutes (900s)
      continuousFocusSecRef.current += 1;
      if (continuousFocusSecRef.current >= 900) {
        setShowMicroGapNudge(true);
      }

      // Live PC Distraction Counter-Attack (>= 10s continuous distraction, 45s cooldown)
      const act = currentActivityRef.current;
      if (act && act.category === 'distraction') {
        distractionStreakSecRef.current += 1;
        if (
          distractionStreakSecRef.current >= 10 &&
          now - lastCounterAtMsRef.current >= 45_000
        ) {
          lastCounterAtMsRef.current = now;
          distractionStreakSecRef.current = 0;
          const cleanName = (act.processName || 'Ứng dụng xao nhãng').replace(/\.exe$/i, '');
          triggerMonsterCounter(cleanName);
        }
      } else {
        distractionStreakSecRef.current = 0;
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [mirror, microGapLeft, totalSeconds, triggerHeroStrike, triggerMonsterCounter]);

  // 10s Micro-Gap Neural Replay countdown timer
  useEffect(() => {
    if (microGapLeft === null) return;
    if (microGapLeft <= 0) {
      setMicroGapLeft(null);
      setMicroGapCount((c) => c + 1);
      continuousFocusSecRef.current = 0;
      soundEngine.microGapChime();
      return;
    }
    const gapTimer = window.setTimeout(() => {
      setMicroGapLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(gapTimer);
  }, [microGapLeft]);

  const handleToggleRunning = async () => {
    if (timerBusy) return;
    const now = Date.now();
    const currentElapsed = computeElapsedFromMirror(mirror, now);
    const nextRunning = !mirror.running;

    // Optimistic immediate UI response
    setNowMs(now);
    setMirror(
      nextRunning
        ? { running: true, startedAtMs: now, baseSeconds: currentElapsed }
        : { running: false, startedAtMs: null, baseSeconds: currentElapsed }
    );
    soundEngine.setAmbiencePaused(!nextRunning);
    distractionStreakSecRef.current = 0;

    if (nextRunning && onStartQuest) {
      setTimerBusy(true);
      toggleInFlightRef.current = true;
      try {
        await onStartQuest(quest.id);
      } finally {
        toggleInFlightRef.current = false;
        setTimerBusy(false);
      }
    } else if (!nextRunning && onPauseQuest) {
      setTimerBusy(true);
      toggleInFlightRef.current = true;
      try {
        await onPauseQuest(quest.id);
      } finally {
        toggleInFlightRef.current = false;
        setTimerBusy(false);
      }
    }
  };

  const handleSubtaskClick = async (subtaskId: string, currentlyDone: boolean) => {
    if (!currentlyDone) {
      const nextCombo = Math.min(5, comboRef.current + 1);
      setCombo(nextCombo);
      soundEngine.focusCrit();
      triggerHeroStrike('SUBTASK -45 HP!', 'subtask', 45);
    } else {
      soundEngine.click();
    }
    await onToggleSubtask(quest.id, subtaskId);
  };

  const handleStartMicroGap = () => {
    setShowMicroGapNudge(false);
    continuousFocusSecRef.current = 0;
    distractionStreakSecRef.current = 0;
    setMicroGapLeft(10);
    soundEngine.microGapChime();
  };

  const handleDismissMicroGapNudge = () => {
    setShowMicroGapNudge(false);
    continuousFocusSecRef.current = 0;
  };

  const handleComplete = async () => {
    if (clearing) return;
    setClearing(true);
    soundEngine.focusVictory();
    soundEngine.stopAmbience();
    try {
      await onClearDungeon(quest.id, proofNote.trim() || undefined, {
        overtimeMinutes,
        distractions,
        microGapCount,
      });
    } finally {
      setClearing(false);
    }
  };

  const handleSwitchViewMode = (mode: FocusViewMode) => {
    soundEngine.click();
    setViewMode(mode);
    saveViewMode(mode);
  };

  // Derived Display Values
  const elapsedSeconds = computeElapsedFromMirror(mirror, nowMs);
  const isOvertime = elapsedSeconds >= totalSeconds;
  const overtimeSeconds = isOvertime ? elapsedSeconds - totalSeconds : 0;
  const overtimeMinutes = isOvertime ? Math.floor(overtimeSeconds / 60) : 0;
  const remainingSeconds = isOvertime ? 0 : Math.max(0, totalSeconds - elapsedSeconds);
  const displayClock = isOvertime
    ? `+${formatMmSs(overtimeSeconds)}`
    : formatMmSs(remainingSeconds);

  const elapsedPct = Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100));
  const completedSubtasks = quest.subtasks.filter((s) => s.done).length;
  const totalSubtasks = quest.subtasks.length;
  const progressPct =
    totalSubtasks > 0
      ? Math.min(100, Math.round((completedSubtasks / totalSubtasks) * 55 + elapsedPct * 0.45))
      : elapsedPct;

  // Enemy Display (Active Weekly Raid Boss OR Quest Fallback Monster)
  const useRaidBoss = Boolean(weeklyRaid && weeklyRaid.status === 'active');
  const enemyName = useRaidBoss
    ? weeklyRaid!.name
    : fallbackMonsterName || 'Quái Vật Trì Hoãn';
  const enemyMaxHp = useRaidBoss ? Math.max(1, weeklyRaid!.maxHp) : Math.max(100, quest.durationMinutes * 12);
  const enemyCurrentHp = useRaidBoss
    ? Math.max(0, weeklyRaid!.currentHp - Math.min(weeklyRaid!.currentHp, sessionBonusDmg))
    : Math.max(0, Math.round(enemyMaxHp * (1 - progressPct / 100)));
  const enemyHpPct = Math.min(100, Math.max(0, Math.round((enemyCurrentHp / enemyMaxHp) * 100)));

  const statusTagLabel = isOvertime
    ? 'OVERTIME FLOW'
    : mirror.running
      ? 'FOCUS ON'
      : 'PAUSED';

  const statusTagColor = isOvertime
    ? 'var(--px-green-text)'
    : mirror.running
      ? 'var(--px-gold-text)'
      : 'var(--px-blue-text)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4">
      <div
        className={`rpg-window relative max-h-[94vh] w-full max-w-[640px] overflow-y-auto rounded-none p-5 ${
          arenaShakeActive ? 'anim-px-arena-shake' : ''
        }`}
      >
        <PixelRivets />

        {/* Header Row: Mode Toggle + Title + Close */}
        <div className="flex items-start justify-between gap-3 border-b-2 pb-3 rpg-divider">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="font-pixel inline-flex items-center gap-1 rounded-none border-2 border-[var(--border-ink)] px-2 py-0.5 text-[9px] font-bold uppercase"
                style={{
                  backgroundColor: isOvertime ? 'var(--px-green)' : 'var(--px-gold)',
                  color: isOvertime ? '#ffffff' : '#140e04',
                }}
              >
                <PxSword size={10} color={isOvertime ? '#ffffff' : '#140e04'} />
                {isOvertime ? 'OVERTIME FLOW · +BONUS XP & RAID DMG' : 'FOCUS ARENA · +25% XP & +SP'}
              </span>

              {/* BATTLE vs ZEN Toggle */}
              <div className="inline-flex border-2 border-[var(--border-ink)] bg-[var(--bg-subtle)]">
                <button
                  type="button"
                  onClick={() => handleSwitchViewMode('battle')}
                  className={`flex items-center gap-1 rounded-none px-2 py-0.5 font-pixel text-[9px] font-bold ${
                    viewMode === 'battle'
                      ? 'bg-[var(--px-gold)] text-[#140e04]'
                      : 'text-sub hover:text-main'
                  }`}
                >
                  <PxSword size={10} color={viewMode === 'battle' ? '#140e04' : 'currentColor'} />
                  <span>BATTLE</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchViewMode('zen')}
                  className={`flex items-center gap-1 rounded-none border-l-2 border-[var(--border-ink)] px-2 py-0.5 font-pixel text-[9px] font-bold ${
                    viewMode === 'zen'
                      ? 'bg-[var(--px-blue)] text-white'
                      : 'text-sub hover:text-main'
                  }`}
                >
                  <PxBook size={10} color={viewMode === 'zen' ? '#ffffff' : 'currentColor'} />
                  <span>ZEN</span>
                </button>
              </div>
            </div>

            <h2 className="mt-1.5 truncate font-display text-base font-extrabold text-main sm:text-lg">
              {quest.title}
            </h2>
            <p className="truncate text-[11px] text-sub">
              {quest.learningMethod || 'Deep Work Focus Session'} · Dự kiến {quest.durationMinutes}p
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-none"
            aria-label="Đóng"
          >
            <PxClose size={13} />
          </button>
        </div>

        {/* BATTLE VIEWPORT (16-Bit Dungeon Stage) OR ZEN SERENE TIMER */}
        {viewMode === 'battle' ? (
          <div className="mt-4 space-y-3">
            {/* Framed #12101a 16-Bit Dungeon Battle Viewport */}
            <div className="relative overflow-hidden rounded-none border-2 border-[var(--border-ink)] bg-[#12101a] text-[#f3ead8]">
              <PixelRivets className="bg-[#d4a24c]" />

              {/* Top Battle HUD Bar: Combo Badge + Enemy Name & HP */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#2e2942] bg-[#181523] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="font-pixel inline-flex items-center gap-1 rounded-none border-2 border-[#09070f] px-2 py-0.5 text-[9px] font-bold"
                    style={{
                      backgroundColor: combo >= 3 ? '#c99330' : combo >= 1 ? '#2e8b57' : '#2b263d',
                      color: combo >= 3 ? '#140e04' : '#f3ead8',
                    }}
                  >
                    <PxFlame size={10} />
                    {combo > 0 ? `COMBO x${combo}` : 'COMBO x0'}
                  </span>

                  <span
                    className="font-mono text-sm font-extrabold tabular-nums"
                    style={{ color: isOvertime ? '#52c484' : '#f0c46c' }}
                  >
                    {displayClock}
                  </span>
                  <span
                    className="font-pixel text-[8px] uppercase"
                    style={{ color: statusTagColor }}
                  >
                    {statusTagLabel}
                  </span>
                </div>

                <div className="flex min-w-[165px] flex-1 flex-col items-end gap-1 sm:max-w-[240px]">
                  <div className="flex w-full items-center justify-between gap-1.5 text-[10px]">
                    <span className="flex min-w-0 items-center gap-1 truncate font-display font-bold text-[#f3ead8]">
                      <PxSkull size={11} color="#e86b7a" />
                      <span className="truncate">{enemyName}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[9.5px] font-bold tabular-nums text-[#e86b7a]">
                      {enemyCurrentHp}/{enemyMaxHp}
                    </span>
                  </div>
                  <div className="rpg-bar-track h-2.5 w-full">
                    <div
                      className="h-full"
                      style={{
                        width: `${enemyHpPct}%`,
                        backgroundColor: useRaidBoss ? '#b83a4b' : '#c99330',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Center Pixel Sprite Stage */}
              <div className="relative flex min-h-[112px] items-end justify-between px-6 pb-2 pt-5 sm:px-10">
                {/* Floating Pixel Damage Number */}
                {floatingDmg && (
                  <div
                    key={floatingDmg.id}
                    className={`anim-px-dmg-float pointer-events-none absolute top-2 z-20 rounded-none border-2 border-[#09070f] px-2 py-0.5 font-pixel text-[10px] font-bold ${
                      floatingDmg.target === 'hero' ? 'left-5 sm:left-8' : 'right-5 sm:right-8'
                    }`}
                    style={{
                      backgroundColor:
                        floatingDmg.tone === 'crit'
                          ? '#c99330'
                          : floatingDmg.tone === 'subtask'
                            ? '#2e8b57'
                            : floatingDmg.tone === 'counter'
                              ? '#b83a4b'
                              : '#211c30',
                      color: floatingDmg.tone === 'crit' ? '#140e04' : '#ffffff',
                    }}
                  >
                    {floatingDmg.label}
                  </div>
                )}

                {/* Left: Hero Sprite */}
                <div className={`relative z-10 ${heroLungeActive ? 'anim-px-hero-lunge' : ''}`}>
                  <PixelHeroSprite
                    rank={heroRank}
                    avatarStyle={heroAvatarStyle}
                    size={68}
                    mood={distractions >= 3 ? 'wounded' : 'healthy'}
                    guarding={!mirror.running}
                  />
                </div>

                {/* Center Focus Clash Badge */}
                <div className="mb-4 flex flex-col items-center gap-1 text-center">
                  <span className="font-pixel text-[9px] text-[#847a99]">
                    {useRaidBoss ? `RAID ${weeklyRaid!.difficultyTier}-RANK` : 'FOCUS DUEL'}
                  </span>
                  {isOvertime ? (
                    <span className="rounded-none border border-[#2e8b57] bg-[#162d22] px-2 py-0.5 font-mono text-[10px] font-extrabold text-[#52c484]">
                      +{overtimeMinutes}p Flow · +Bonus XP &amp; Raid DMG
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-[#c5bcd6]">
                      Tiến độ <strong className="text-[#f0c46c]">{progressPct}%</strong>
                    </span>
                  )}
                </div>

                {/* Right: Active Raid Boss OR Fallback Monster Sprite */}
                <div className={`relative z-10 ${monsterHitActive ? 'anim-px-monster-hit' : ''}`}>
                  {useRaidBoss ? (
                    <RaidBossSprite
                      archetype={weeklyRaid!.archetype}
                      size={74}
                      enraged={arenaShakeActive || isOvertime}
                    />
                  ) : (
                    <PixelMonsterSprite
                      archetype={fallbackMonsterArchetype}
                      size={68}
                      enraged={arenaShakeActive}
                    />
                  )}
                </div>
              </div>

              {/* 16-Bit Pixel Stone Floor Strip */}
              <div
                className="h-3 w-full border-t-2 border-[#3f3859] bg-[#211c30]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, #211c30 0, #211c30 14px, #09070f 14px, #09070f 16px)',
                }}
              />
            </div>

            {/* Session Progress Segmented Bar */}
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-sub">
                <span>
                  {isOvertime
                    ? `Overtime Flow: +${overtimeMinutes}p (+Bonus XP & Raid DMG)`
                    : 'Tiến độ phiên tập trung'}
                </span>
                <span className="font-bold text-main">{progressPct}%</span>
              </div>
              <div className="rpg-bar-track h-2.5 w-full">
                <div
                  className="h-full"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: isOvertime ? 'var(--px-green)' : 'var(--px-gold)',
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ZEN MODE: Serene Large Pixel Countdown */
          <div className="my-4 flex flex-col items-center">
            <div
              className="px-inset flex min-w-[230px] flex-col items-center justify-center rounded-none border-2 px-6 py-5"
              style={{ borderColor: isOvertime ? 'var(--px-green)' : 'var(--px-gold)' }}
            >
              <div
                className="font-mono text-4xl font-extrabold tabular-nums"
                style={{ color: isOvertime ? 'var(--px-green-text)' : 'var(--text-primary)' }}
              >
                {displayClock}
              </div>
              <span
                className="font-pixel mt-1.5 text-[9px] font-bold uppercase"
                style={{ color: statusTagColor }}
              >
                {statusTagLabel}
              </span>
              {isOvertime && (
                <span className="mt-1 font-mono text-[10px] font-bold text-[var(--px-green-text)]">
                  +{overtimeMinutes}p Flow · +Bonus XP &amp; Raid DMG
                </span>
              )}
            </div>

            <div className="mt-3 w-full max-w-md">
              <div className="mb-1 flex justify-between font-mono text-xs text-sub">
                <span>Tiến độ phiên tập trung</span>
                <span className="font-bold text-main">{progressPct}%</span>
              </div>
              <div className="rpg-bar-track h-2.5 w-full">
                <div
                  className="h-full"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: isOvertime ? 'var(--px-green)' : 'var(--px-gold)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Calm Crimson Distraction Counter-Attack Chip */}
        {lastOffendingApp && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-none border-2 border-[var(--px-red)] bg-[var(--px-red)]/15 px-3 py-1.5 text-xs">
            <span className="flex items-center gap-1.5 font-mono font-bold text-[var(--px-red-text)]">
              <PxWarn size={13} danger />
              <span>Phản đòn từ: {lastOffendingApp}</span>
            </span>
            <button
              type="button"
              onClick={() => setLastOffendingApp(null)}
              className="text-[10px] font-bold text-sub hover:text-main"
            >
              Ẩn
            </button>
          </div>
        )}

        {/* Smart 15-Minute 10s Micro-Gap Neural Replay Nudge (never auto-pauses) */}
        {showMicroGapNudge && microGapLeft === null && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-none border-2 border-[var(--px-plum)] bg-[var(--px-plum)]/15 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--px-plum-text)]">
              <PxSparkle size={13} color="var(--px-plum-text)" />
              <span>Đã tập trung 15p — Nghỉ 10s giúp củng cố ký ức 20x?</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleStartMicroGap}
                className="btn-arcane rounded-none px-2.5 py-1 text-[11px]"
              >
                Nghỉ 10s
              </button>
              <button
                type="button"
                onClick={handleDismissMicroGapNudge}
                className="btn-secondary rounded-none px-2 py-1 text-[11px]"
              >
                Để sau
              </button>
            </div>
          </div>
        )}

        {/* Active 10s Micro-Gap Neural Replay Panel */}
        {microGapLeft !== null && (
          <div className="mt-3 rounded-none border-2 border-[var(--px-plum)] bg-[var(--px-plum)]/15 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--px-plum-text)]">
              <PxSparkle size={14} color="var(--px-plum-text)" />
              <span>10s Micro-Gap Neural Replay · 20x Hippocampal Replay</span>
            </div>
            <div className="font-pixel my-1.5 text-2xl font-bold text-[var(--px-plum-text)]">
              {microGapLeft}s
            </div>
            <p className="text-xs text-sub">
              NIH / Huberman: Nhắm mắt thả lỏng 10 giây giữa phiên học giúp hồi hải mã phát lại ký ức nhanh gấp 20 lần.
            </p>
            <button
              type="button"
              onClick={() => setMicroGapLeft(null)}
              className="btn-secondary mt-2 rounded-none px-3 py-1 text-xs"
            >
              Quay lại ngay
            </button>
          </div>
        )}

        {microGapLeft === null && microGapCount > 0 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-none border-2 border-[var(--px-green)] bg-[var(--px-green)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--px-green-text)]">
            <PxCheck size={13} />
            <span>Đã hoàn tất {microGapCount} chu kỳ Tái tạo Thần kinh 10s (20x Replay).</span>
          </div>
        )}

        {/* Subtasks Checklist */}
        {quest.subtasks.length > 0 && (
          <div className="px-inset mt-3 space-y-2 rounded-none p-3">
            {quest.subtasks.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => void handleSubtaskClick(st.id, st.done)}
                className="flex w-full items-center gap-2 text-left text-xs text-main"
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-none border-2 border-[var(--border-ink)]"
                  style={{
                    backgroundColor: st.done ? 'var(--px-green)' : 'var(--bg-surface)',
                    color: '#ffffff',
                  }}
                >
                  {st.done && <PxCheck size={10} />}
                </span>
                <span className={st.done ? 'text-dim line-through' : ''}>{st.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Integrated 2-Channel 16-Bit Focus Audio Strip */}
        <div className="px-inset mt-3 space-y-2 rounded-none p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-pixel text-[9px] font-bold uppercase text-sub">
              {audioSnap.enabled ? (
                <PxSoundOn size={13} color="var(--px-gold-text)" />
              ) : (
                <PxSoundOff size={13} color="var(--px-red-text)" />
              )}
              <span>Âm thanh Tập trung (2 Kênh)</span>
            </span>

            <div className="flex flex-wrap items-center gap-1">
              {AMBIENCE_OPTIONS.map((opt) => {
                const active = audioSnap.ambienceMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => {
                      soundEngine.setAmbience(opt.mode);
                      soundEngine.setAmbiencePaused(!mirror.running);
                    }}
                    className={`rounded-none px-2 py-0.5 font-mono text-[10px] font-bold ${
                      active ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-[11px] text-sub">
              <span className="w-16 shrink-0 font-mono font-bold">Nền</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audioSnap.ambienceVolume * 100)}
                onChange={(e) => soundEngine.setAmbienceVolume(Number(e.target.value) / 100)}
                className="px-slider flex-1"
                aria-label="Âm lượng âm thanh nền"
              />
              <span className="w-8 shrink-0 text-right font-mono text-[10px] font-bold tabular-nums text-main">
                {Math.round(audioSnap.ambienceVolume * 100)}%
              </span>
            </label>

            <label className="flex items-center gap-2 text-[11px] text-sub">
              <button
                type="button"
                onClick={() => soundEngine.setEnabled(!audioSnap.enabled)}
                className="flex w-16 shrink-0 items-center gap-1 font-mono font-bold text-sub hover:text-main"
                title={audioSnap.enabled ? 'Tắt SFX 16-bit' : 'Bật SFX 16-bit'}
              >
                {audioSnap.enabled ? <PxSoundOn size={12} /> : <PxSoundOff size={12} />}
                <span>SFX</span>
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(audioSnap.sfxVolume * 100)}
                onChange={(e) => soundEngine.setSfxVolume(Number(e.target.value) / 100)}
                className="px-slider flex-1"
                aria-label="Âm lượng hiệu ứng 16-bit"
              />
              <span className="w-8 shrink-0 text-right font-mono text-[10px] font-bold tabular-nums text-main">
                {Math.round(audioSnap.sfxVolume * 100)}%
              </span>
            </label>
          </div>
        </div>

        {/* Proof Note Input */}
        <input
          value={proofNote}
          onChange={(e) => setProofNote(e.target.value)}
          placeholder="Ghi ngắn gọn kết quả đạt được sau phiên tập trung..."
          className="mt-3 w-full rounded-none px-3 py-2 text-xs"
        />

        {/* Primary Action Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
          <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
            <button
              type="button"
              disabled={timerBusy}
              onClick={() => void handleToggleRunning()}
              className="btn-secondary flex items-center gap-1.5 whitespace-nowrap rounded-none px-2.5 py-2 text-xs"
            >
              {timerBusy ? (
                <PxRefresh size={12} className="animate-spin" />
              ) : mirror.running ? (
                <PxPause size={12} />
              ) : (
                <PxPlay size={12} />
              )}
              <span>{mirror.running ? 'Tạm dừng' : 'Tiếp tục'}</span>
            </button>

            <button
              type="button"
              onClick={() => triggerMonsterCounter('Tự ghi nhận')}
              className="btn-secondary flex items-center gap-1.5 whitespace-nowrap rounded-none px-2.5 py-2 text-xs"
              title="Ghi nhận thủ công 1 lần xao nhãng (reset Combo)"
            >
              <PxWarn size={13} danger={distractions > 0} />
              <span className="font-mono font-bold">+1 Xao nhãng ({distractions})</span>
            </button>

            <button
              type="button"
              disabled={microGapLeft !== null}
              onClick={handleStartMicroGap}
              className="btn-secondary flex items-center gap-1 whitespace-nowrap rounded-none px-2.5 py-2 text-xs text-[var(--px-plum-text)]"
              title="Nghỉ 10 giây Tái tạo Thần kinh — 20x Hippocampal Replay"
            >
              <PxBolt size={13} color="var(--px-plum-text)" />
              <span>Nghỉ 10s</span>
            </button>
          </div>

          <button
            type="button"
            disabled={clearing}
            onClick={() => void handleComplete()}
            className={`${isOvertime ? 'btn-emerald' : 'btn-primary'} flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-none px-3.5 py-2 text-xs font-extrabold`}
          >
            {clearing ? (
              <PxRefresh size={14} className="animate-spin" />
            ) : (
              <PxSword size={14} color={isOvertime ? '#ffffff' : '#140e04'} />
            )}
            <span>
              {isOvertime
                ? `Hoàn thành (+Flow ${overtimeMinutes}p)`
                : 'Hoàn thành (+25% XP)'}
            </span>
          </button>
        </div>

        {/* Science Tip Footer */}
        <div className="px-inset mt-3 flex items-start gap-2 rounded-none px-3 py-2 text-[11px] text-sub">
          <PxBook size={14} color="var(--px-gold-text)" className="mt-0.5" />
          <span>
            <strong>Focused vs. Diffused Mode (Barbara Oakley):</strong> Tập trung sâu 25–90 phút ở Focused Mode; nếu gặp điểm nghẽn quá 15 phút, hãy tạm rời màn hình đi bộ để não chuyển sang Diffused Mode kết nối ý tưởng.
          </span>
        </div>
      </div>
    </div>
  );
};
