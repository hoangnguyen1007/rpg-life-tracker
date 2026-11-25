import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Flame,
  KeyRound,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Timer,
  Zap,
} from 'lucide-react';
import type {
  AssistantOverviewPayload,
  Quest,
  SystemStatePayload,
} from '../types/system';
import { formatVnTimeShort, getVnTodayKey } from '../utils/timeVn';
import { PixelHeart, PixelHeroSprite } from './DungeonSprites';

export interface MobileQuickViewProps {
  state: SystemStatePayload | null;
  overview: AssistantOverviewPayload | null;
  authRequired: boolean;
  onPairWithPin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  onCheckinEnergy: (energyLevel: number) => Promise<void>;
  onStartQuest: (id: string) => Promise<void>;
  onPauseQuest: (id: string) => Promise<void>;
  onCompleteQuest: (id: string) => Promise<void>;
  onQuickAddQuest: (title: string, durationMinutes: number) => Promise<void>;
  onToggleDnd: (minutes: number) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const ENERGY_OPTIONS: Array<{
  val: number;
  label: string;
  dotCls: string;
}> = [
  { val: 100, label: 'Sung sức', dotCls: 'bg-emerald-400' },
  { val: 75, label: 'Ổn định', dotCls: 'bg-sky-400' },
  { val: 45, label: 'Hơi mệt', dotCls: 'bg-amber-400' },
  { val: 20, label: 'Cạn pin', dotCls: 'bg-rose-400' },
];

const QUICK_DURATIONS = [25, 45, 60] as const;

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  daily: { label: 'Daily', cls: 'border-sky-500/45 bg-sky-500/15 text-sky-300' },
  main: { label: 'Main', cls: 'border-amber-500/45 bg-amber-500/15 text-amber-300' },
  side: { label: 'Side', cls: 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300' },
  hidden: { label: 'Hidden', cls: 'border-violet-500/45 bg-violet-500/15 text-violet-300' },
  emergency: { label: 'Urgent', cls: 'border-rose-500/45 bg-rose-500/15 text-rose-300' },
  recovery: { label: 'Recovery', cls: 'border-teal-500/45 bg-teal-500/15 text-teal-300' },
};

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

function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MobileQuickView: React.FC<MobileQuickViewProps> = ({
  state,
  overview,
  authRequired,
  onPairWithPin,
  onCheckinEnergy,
  onStartQuest,
  onPauseQuest,
  onCompleteQuest,
  onQuickAddQuest,
  onToggleDnd,
  onRefresh,
}) => {
  // PIN Pairing state
  const [pinInput, setPinInput] = useState('');
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);

  // Quick-Add state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDuration, setQuickDuration] = useState<number>(25);
  const [quickAdding, setQuickAdding] = useState(false);

  // Action busy states
  const [refreshing, setRefreshing] = useState(false);
  const [togglingDnd, setTogglingDnd] = useState(false);
  const [checkingEnergyVal, setCheckingEnergyVal] = useState<number | null>(null);
  const [busyQuest, setBusyQuest] = useState<{ id: string; action: 'start' | 'pause' | 'complete' } | null>(
    null
  );
  const [showCompleted, setShowCompleted] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Live 1s clock for running timers & DND
  const [nowMs, setNowMs] = useState(() => Date.now());

  const todayKey = getVnTodayKey();
  const quests = state?.quests ?? [];
  const todayQuests = useMemo(
    () => quests.filter((q) => q.dateKey === todayKey || q.status === 'pending'),
    [quests, todayKey]
  );
  const pendingQuests = useMemo(
    () => todayQuests.filter((q) => q.status === 'pending'),
    [todayQuests]
  );
  const completedQuests = useMemo(
    () => todayQuests.filter((q) => q.status === 'completed'),
    [todayQuests]
  );

  const activeSession = useMemo(
    () =>
      pendingQuests.find((q) => q.startedAt && !q.isPaused) ||
      pendingQuests.find((q) => q.isPaused || (q.pausedAccumulatedSeconds ?? 0) > 0) ||
      null,
    [pendingQuests]
  );

  const hasRunningQuest = pendingQuests.some((q) => q.startedAt && !q.isPaused);
  const dndUntilMs = overview?.dndUntil ? Date.parse(overview.dndUntil) : Number.NaN;
  const isDndActive =
    Boolean(overview?.dndActive) || (!Number.isNaN(dndUntilMs) && dndUntilMs > nowMs);

  useEffect(() => {
    if (!hasRunningQuest && !isDndActive) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunningQuest, isDndActive]);

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 2600);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const showToast = (msg: string) => setToastMsg(msg);

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = pinInput.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) {
      setPairError('Vui lòng nhập đủ 6 chữ số của Mã PIN trên PC.');
      return;
    }
    setPairing(true);
    setPairError(null);
    try {
      const res = await onPairWithPin(cleaned);
      if (!res.ok) {
        setPairError(res.error || 'Mã PIN không đúng hoặc kết nối LAN chưa bật trên PC.');
      } else {
        setPinInput('');
      }
    } catch (err) {
      setPairError(
        err instanceof Error ? err.message : 'Không thể ghép nối tới máy chủ PC.'
      );
    } finally {
      setPairing(false);
    }
  };

  // ==================== 1. LAN PIN PAIRING SCREEN ====================
  if (authRequired) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8">
        <div className="rpg-window space-y-5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border-2 border-amber-500/70 bg-amber-500/15 text-amber-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="font-pixel text-[9px] uppercase tracking-wider text-amber-400">
                THE SYSTEM · MOBILE PWA
              </span>
              <h1 className="font-display text-base font-extrabold text-main">
                Ghép nối với PC bằng Mã PIN 6 số
              </h1>
            </div>
          </div>

          <div className="space-y-2 rounded-[2px] border-2 border-sky-500/35 bg-sky-500/10 p-3 text-xs text-sub">
            <div className="flex items-start gap-2">
              <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <p>
                Mở tab <strong className="text-main">Trợ Lý PC</strong> trên máy tính và bật{' '}
                <strong className="text-main">Kết nối Điện thoại qua QR Mạng LAN</strong>. Bạn có
                thể quét mã QR để đăng nhập tự động hoặc nhập Mã PIN 6 số dưới đây.
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handlePairSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="lan-pair-pin"
                className="flex items-center gap-1.5 text-xs font-bold text-sub"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                <span>Nhập Mã PIN 6 số trên PC</span>
              </label>

              <input
                id="lan-pair-pin"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPinInput(digits);
                  if (pairError) setPairError(null);
                }}
                placeholder="• • • • • •"
                disabled={pairing}
                className="w-full py-3.5 text-center font-mono text-2xl font-extrabold tracking-[0.42em] text-amber-300 placeholder:tracking-[0.25em] placeholder:text-dim"
              />

              {/* 6-slot progress indicator */}
              <div className="grid grid-cols-6 gap-1.5 pt-1" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-[1px] transition-colors ${
                      i < pinInput.length ? 'bg-amber-400' : 'bg-[#2d3856]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {pairError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-[2px] border-2 border-rose-500/60 bg-rose-500/15 px-3 py-2.5 text-xs font-medium text-rose-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{pairError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pairing || pinInput.length !== 6}
              className="btn-primary flex min-h-[46px] w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold"
            >
              {pairing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Ghép nối ngay</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center font-mono text-[10px] text-dim">
            Token được lưu cục bộ trên trình duyệt điện thoại · Chỉ hoạt động trong mạng LAN /
            Tailscale của bạn.
          </p>
        </div>
      </div>
    );
  }

  // ==================== 2. LOADING STATE ====================
  if (!state) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-8">
        <div className="rpg-window flex w-full flex-col items-center gap-3 p-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
          <p className="font-display text-sm font-bold text-main">
            Đang đồng bộ dữ liệu từ PC...
          </p>
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
            className="btn-secondary mt-1 flex items-center gap-1.5 px-4 py-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>
    );
  }

  // ==================== 3. PAIRED & LOADED 1-THUMB MOBILE COCKPIT ====================
  const { player } = state;
  const hp = Math.max(0, player.hp ?? 100);
  const maxHp = Math.max(100, player.maxHp ?? 100);
  const hpPct = Math.min(100, Math.round((hp / maxHp) * 100));
  const totalHearts = Math.min(8, Math.max(5, Math.round(maxHp / 20)));
  const hpPerHeart = maxHp / totalHearts;
  const heartStates: Array<'full' | 'half' | 'empty'> = Array.from(
    { length: totalHearts },
    (_, idx) => {
      const thresholdFull = (idx + 1) * hpPerHeart;
      const thresholdHalf = idx * hpPerHeart + hpPerHeart * 0.45;
      if (hp >= thresholdFull - 0.5) return 'full';
      if (hp >= thresholdHalf) return 'half';
      return 'empty';
    }
  );
  const isCriticalHp = hpPct <= 25;
  const heroMood: 'healthy' | 'wounded' | 'critical' =
    hpPct <= 25 ? 'critical' : hpPct <= 55 ? 'wounded' : 'healthy';

  const focusScore = Math.round(
    overview?.activity?.focusScore ?? state.assistantSummary?.focusScore ?? 0
  );
  const distractionAlert =
    overview?.distractionAlertLevel === 'soft_hud' ||
    overview?.distractionAlertLevel === 'toast';

  const handleRefreshClick = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
      showToast('Đã đồng bộ trạng thái mới nhất.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDndClick = async () => {
    if (togglingDnd) return;
    setTogglingDnd(true);
    try {
      const nextMinutes = isDndActive ? 0 : 60;
      await onToggleDnd(nextMinutes);
      showToast(nextMinutes > 0 ? 'Đã bật Tạm im thông báo 1 giờ.' : 'Đã tắt chế độ Tạm im.');
    } finally {
      setTogglingDnd(false);
    }
  };

  const handleEnergyClick = async (val: number, label: string) => {
    if (checkingEnergyVal !== null) return;
    setCheckingEnergyVal(val);
    try {
      await onCheckinEnergy(val);
      showToast(`Đã cập nhật thể trạng: ${label} (${val}%)`);
    } finally {
      setCheckingEnergyVal(null);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickTitle.trim();
    if (!cleaned || quickAdding) return;
    setQuickAdding(true);
    try {
      await onQuickAddQuest(cleaned, quickDuration);
      setQuickTitle('');
      showToast(`Đã thêm Quest (${quickDuration}p).`);
    } finally {
      setQuickAdding(false);
    }
  };

  const handleQuestAction = async (
    questId: string,
    action: 'start' | 'pause' | 'complete'
  ) => {
    if (busyQuest) return;
    setBusyQuest({ id: questId, action });
    try {
      if (action === 'start') {
        await onStartQuest(questId);
      } else if (action === 'pause') {
        await onPauseQuest(questId);
      } else {
        await onCompleteQuest(questId);
        showToast('Đã hoàn thành Quest! +XP & Gold');
      }
    } finally {
      setBusyQuest(null);
    }
  };

  const activeElapsedSec = activeSession ? getQuestElapsedSeconds(activeSession, nowMs) : 0;
  const activeEstimatedSec = activeSession ? Math.max(60, activeSession.durationMinutes * 60) : 60;
  const activePct = Math.min(100, Math.round((activeElapsedSec / activeEstimatedSec) * 100));
  const activeIsRunning = Boolean(activeSession?.startedAt && !activeSession?.isPaused);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 px-3 pb-10 pt-3">
      {/* Compact Mobile RPG Header */}
      <header className="rpg-hud-bar space-y-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          {/* Hero Sprite + Name + LV */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-[2px] border-2 border-amber-500/70 bg-[#0d111d]">
                <PixelHeroSprite
                  rank={player.rank}
                  avatarStyle={player.profile.avatarStyle}
                  mood={heroMood}
                  size={34}
                />
              </div>
              <span className="font-pixel absolute -bottom-1.5 -right-1.5 rounded-[2px] border border-amber-300 bg-amber-500 px-1 py-0.5 text-[8px] font-bold leading-none text-[#160f05]">
                LV.{player.level}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate font-display text-sm font-extrabold text-main">
                  {player.profile.name}
                </h1>
                <span className="font-pixel shrink-0 rounded-[2px] border border-amber-500/45 bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-amber-300">
                  {player.rank}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-dim">
                <span className="inline-flex items-center gap-0.5 text-amber-400">
                  <Flame className="h-3 w-3" />
                  {player.streakDays}d
                </span>
                <span className="inline-flex items-center gap-0.5 text-amber-300">
                  <Coins className="h-3 w-3" />
                  {player.gold}G
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Controls: DND 1h & Refresh */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={togglingDnd}
              onClick={() => void handleDndClick()}
              className={`flex h-10 items-center gap-1 rounded-[2px] border-2 px-2.5 text-xs font-bold transition ${
                isDndActive
                  ? 'border-violet-400 bg-violet-500/25 text-violet-200'
                  : 'btn-secondary'
              }`}
              title={isDndActive ? 'Tắt Tạm im (DND)' : 'Tạm im thông báo 1 giờ'}
              aria-label={isDndActive ? 'Tắt Tạm im' : 'Bật Tạm im 1 giờ'}
            >
              {togglingDnd ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isDndActive ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              <span className="font-mono text-[11px]">{isDndActive ? 'DND' : '1h'}</span>
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handleRefreshClick()}
              className="btn-secondary flex h-10 w-10 items-center justify-center"
              title="Đồng bộ dữ liệu"
              aria-label="Đồng bộ dữ liệu"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* HP Hearts + Segmented Pixel HP Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-0.5 rounded-[2px] border border-rose-900/45 bg-[#120b14]/80 px-1.5 py-0.5"
              aria-label={`HP ${hp} trên ${maxHp}`}
            >
              {heartStates.map((st, idx) => (
                <PixelHeart key={idx} state={st} size={13} critical={isCriticalHp} />
              ))}
            </div>
            <span className="font-mono text-[11px] font-bold text-rose-300">
              HP {hp}/{maxHp}
            </span>
          </div>
          <div className="rpg-bar-track h-2.5 w-full">
            <div
              className="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-red-400 transition-all duration-300"
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>

        {/* Status Pills: Energy %, Focus X%, DND info */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-[2px] border px-2 py-1 font-mono text-[11px] font-bold ${
              player.energyLevel >= 70
                ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300'
                : player.energyLevel >= 40
                  ? 'border-amber-500/45 bg-amber-500/15 text-amber-300'
                  : 'border-rose-500/45 bg-rose-500/15 text-rose-300'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Energy {player.energyLevel}%
          </span>

          <span
            className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 font-mono text-[11px] font-bold ${
              distractionAlert
                ? 'border-rose-400/80 bg-rose-500/20 text-rose-200'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                distractionAlert ? 'animate-pulse bg-rose-400' : 'bg-emerald-400'
              }`}
            />
            Focus {focusScore}%
            {distractionAlert && <span className="text-[10px] text-rose-300">· Xao nhãng!</span>}
          </span>

          {isDndActive && overview?.dndUntil && (
            <span className="inline-flex items-center gap-1 rounded-[2px] border border-violet-500/45 bg-violet-500/15 px-2 py-1 font-mono text-[10px] font-bold text-violet-200">
              <BellOff className="h-3 w-3" />
              Im lặng đến {formatVnTimeShort(overview.dndUntil)}
            </span>
          )}
        </div>
      </header>

      {/* Ephemeral Mobile Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="rounded-[2px] border-2 border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-center font-mono text-xs font-bold text-emerald-200"
        >
          {toastMsg}
        </div>
      )}

      {/* 4-Pill Thể Trạng Quick Switcher (NEVER drains HP) */}
      <section className="rpg-pane space-y-2 p-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-display font-bold text-main">Thể trạng hôm nay</span>
          <span className="font-mono text-[10px] text-emerald-400">Không trừ HP</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {ENERGY_OPTIONS.map((opt) => {
            const selected = Math.abs(player.energyLevel - opt.val) <= 12;
            const busy = checkingEnergyVal === opt.val;
            return (
              <button
                key={opt.val}
                type="button"
                disabled={checkingEnergyVal !== null}
                onClick={() => void handleEnergyClick(opt.val, opt.label)}
                className={`flex min-h-[42px] flex-col items-center justify-center gap-1 rounded-[2px] border-2 px-1 py-1.5 text-[11px] font-bold transition ${
                  selected
                    ? 'border-amber-300 bg-amber-500 text-[#180f03]'
                    : 'border-[#2d3856] bg-[#101522] text-sub hover:border-[#475780] hover:text-main'
                }`}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selected ? 'bg-[#180f03]' : opt.dotCls
                    }`}
                  />
                )}
                <span className="leading-none">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sticky 1-Thumb Quick-Add Bar */}
      <form
        onSubmit={(e) => void handleQuickAddSubmit(e)}
        className="rpg-hud-bar sticky top-2 z-20 space-y-2 bg-[#141927]/95 p-2.5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Thêm nhanh việc..."
            disabled={quickAdding}
            className="h-11 min-w-0 flex-1 px-3 text-sm"
          />
          <button
            type="submit"
            disabled={!quickTitle.trim() || quickAdding}
            className="btn-primary flex h-11 shrink-0 items-center gap-1 px-3.5 text-xs font-extrabold"
          >
            {quickAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>Thêm</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {QUICK_DURATIONS.map((mins) => {
            const active = quickDuration === mins;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => setQuickDuration(mins)}
                className={`flex h-8 items-center justify-center gap-1 rounded-[2px] border font-mono text-xs font-bold transition ${
                  active
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-[#2d3856] bg-[#101522] text-dim hover:text-main'
                }`}
              >
                <Clock className="h-3 w-3" />
                <span>{mins}p</span>
              </button>
            );
          })}
        </div>
      </form>

      {/* Active Running / Paused Quest Spotlight */}
      {activeSession && (
        <section className="rounded-[2px] border-2 border-amber-500/75 bg-amber-500/10 p-3 shadow-[3px_3px_0_#05070c]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-[2px] border border-amber-500/60 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
              <Timer className="h-3 w-3" />
              {activeIsRunning ? 'ĐANG CHẠY' : 'TẠM DỪNG'}
            </span>
            <span className="rounded-[2px] border border-amber-500/60 bg-[#0d111d] px-2.5 py-0.5 font-mono text-base font-extrabold tabular-nums text-amber-300">
              {formatTimer(activeElapsedSec)}
            </span>
          </div>

          <h2 className="mt-2 font-display text-sm font-extrabold text-main">
            {activeSession.title}
          </h2>

          <div className="mt-2 space-y-1">
            <div className="rpg-bar-track h-2 w-full">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
                style={{ width: `${activePct}%` }}
              />
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-sub">
              <span>Dự kiến {activeSession.durationMinutes}p</span>
              <span>{activePct}%</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {activeIsRunning ? (
              <button
                type="button"
                disabled={busyQuest !== null}
                onClick={() => void handleQuestAction(activeSession.id, 'pause')}
                className="btn-secondary flex min-h-[44px] items-center justify-center gap-1.5 border-amber-500/60 text-xs font-bold text-amber-300"
              >
                {busyQuest?.id === activeSession.id && busyQuest.action === 'pause' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span>⏸ Tạm dừng</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busyQuest !== null}
                onClick={() => void handleQuestAction(activeSession.id, 'start')}
                className="btn-secondary flex min-h-[44px] items-center justify-center gap-1.5 border-emerald-500/60 text-xs font-bold text-emerald-300"
              >
                {busyQuest?.id === activeSession.id && busyQuest.action === 'start' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <span>▶ Tiếp tục</span>
              </button>
            )}

            <button
              type="button"
              disabled={busyQuest !== null}
              onClick={() => void handleQuestAction(activeSession.id, 'complete')}
              className="btn-emerald flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-extrabold"
            >
              {busyQuest?.id === activeSession.id && busyQuest.action === 'complete' && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>✓ Xong</span>
            </button>
          </div>
        </section>
      )}

      {/* Today's Quests List */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-extrabold text-main">
              Quest Hôm Nay
            </h2>
            <span className="rounded-[2px] border border-[#3a486e] bg-[#1a2133] px-1.5 py-0.5 font-mono text-[10px] font-bold text-sub">
              Còn {pendingQuests.length}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 rounded-[2px] border border-emerald-500/45 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {completedQuests.length}/{todayQuests.length} xong
          </span>
        </div>

        {pendingQuests.length === 0 ? (
          <div className="rpg-pane space-y-1.5 p-5 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
            <p className="font-display text-sm font-bold text-main">
              Không còn Quest tồn đọng!
            </p>
            <p className="text-xs text-dim">
              Dùng thanh Thêm nhanh phía trên để tạo việc mới hoặc nghỉ ngơi phục hồi.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingQuests.map((quest) => {
              const running = Boolean(quest.startedAt && !quest.isPaused);
              const paused = Boolean(
                !running && (quest.isPaused || (quest.pausedAccumulatedSeconds ?? 0) > 0)
              );
              const elapsed = getQuestElapsedSeconds(quest, nowMs);
              const typeMeta = TYPE_BADGE[quest.type] || TYPE_BADGE.daily;
              const isStarting =
                busyQuest?.id === quest.id && busyQuest.action === 'start';
              const isPausing =
                busyQuest?.id === quest.id && busyQuest.action === 'pause';
              const isCompleting =
                busyQuest?.id === quest.id && busyQuest.action === 'complete';

              return (
                <article
                  key={quest.id}
                  className={`rpg-pane space-y-2.5 p-3 transition-colors ${
                    running ? 'border-amber-500/80 bg-amber-500/5' : ''
                  }`}
                >
                  {/* Meta row */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-bold ${typeMeta.cls}`}
                      >
                        {typeMeta.label}
                      </span>
                      <span className="font-pixel rounded-[2px] border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-300">
                        {quest.rank}
                      </span>
                      <span className="font-mono text-[11px] text-dim">
                        {quest.durationMinutes}p
                        {quest.scheduledSlot && quest.scheduledSlot !== 'Flexible'
                          ? ` · ${quest.scheduledSlot}`
                          : ''}
                      </span>
                    </div>

                    {(running || paused) && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-mono text-[11px] font-extrabold tabular-nums ${
                          running
                            ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                            : 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        <Timer className="h-3 w-3" />
                        {formatTimer(elapsed)}
                      </span>
                    )}
                  </div>

                  {/* Title + Rewards */}
                  <div>
                    <h3 className="font-display text-sm font-bold leading-snug text-main">
                      {quest.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-dim">
                      <span className="text-sky-400">+{quest.xpReward} XP</span>
                      <span>·</span>
                      <span className="text-amber-400">+{quest.goldReward}G</span>
                    </div>
                  </div>

                  {/* Big 1-Thumb Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {running ? (
                      <button
                        type="button"
                        disabled={busyQuest !== null}
                        onClick={() => void handleQuestAction(quest.id, 'pause')}
                        className="btn-secondary flex min-h-[44px] items-center justify-center gap-1.5 border-amber-500/60 text-xs font-bold text-amber-300"
                      >
                        {isPausing && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>⏸ Tạm dừng</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyQuest !== null}
                        onClick={() => void handleQuestAction(quest.id, 'start')}
                        className="btn-secondary flex min-h-[44px] items-center justify-center gap-1.5 border-emerald-500/50 text-xs font-bold text-emerald-300"
                      >
                        {isStarting && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>{paused ? '▶ Tiếp tục' : '▶ Bắt đầu'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busyQuest !== null}
                      onClick={() => void handleQuestAction(quest.id, 'complete')}
                      className="btn-emerald flex min-h-[44px] items-center justify-center gap-1.5 text-xs font-extrabold"
                    >
                      {isCompleting && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>✓ Xong</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Collapsible Completed Quests Summary */}
        {completedQuests.length > 0 && (
          <div className="rpg-pane overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-xs font-bold text-sub"
            >
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Đã hoàn thành hôm nay ({completedQuests.length})
              </span>
              {showCompleted ? (
                <ChevronUp className="h-4 w-4 text-dim" />
              ) : (
                <ChevronDown className="h-4 w-4 text-dim" />
              )}
            </button>

            {showCompleted && (
              <ul className="divide-y rpg-divider border-t rpg-divider px-3 py-1">
                {completedQuests.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <span className="truncate text-sub line-through">{q.title}</span>
                    <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-400">
                      +{q.xpReward} XP
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default MobileQuickView;
