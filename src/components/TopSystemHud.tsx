import React, { useEffect, useRef, useState } from 'react';
import type { AISettings, PlayerState, Quest, SystemStatePayload } from '../types/system';
import { soundEngine, type AmbienceMode, type SoundEngineSnapshot } from '../utils/soundEngine';
import { PixelHeart, PixelHeroSprite } from './DungeonSprites';
import {
  PixelRivets,
  PxBolt,
  PxCheck,
  PxClose,
  PxCmd,
  PxCoin,
  PxEdit,
  PxEye,
  PxEyeOff,
  PxFlame,
  PxGear,
  PxGem,
  PxMoon,
  PxReset,
  PxSoundOff,
  PxSoundOn,
  PxSparkle,
  PxSun,
  PxSword,
} from './PixelIcons';

const FOCUS_PRESETS = [25, 45, 60, 90] as const;

const AMBIENCE_OPTIONS: Array<{ mode: AmbienceMode; label: string }> = [
  { mode: 'off', label: 'Tắt' },
  { mode: 'rain', label: 'Mưa' },
  { mode: 'campfire', label: 'Lửa' },
  { mode: 'brown_noise', label: 'Brown' },
  { mode: 'tavern_8bit', label: '8-Bit' },
];

function formatCompactMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface TopSystemHudProps {
  player: PlayerState;
  aiSettings?: AISettings;
  theme: 'light' | 'dark';
  soundEnabled?: boolean;
  lastSavedAt?: string;
  assistantSummary?: SystemStatePayload['assistantSummary'];
  hudVisible?: boolean;
  activeFocusQuest?: Quest | null;
  onOpenActiveFocus?: () => void;
  onQuickStartFocus?: (durationMinutes: number, title?: string) => Promise<void>;
  onToggleHudVisible?: () => void;
  onOpenAssistant?: () => void;
  onToggleTheme: () => void;
  onToggleSound?: () => void;
  onOpenSettings: () => void;
  onOpenReset?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSkillTree?: () => void;
  onQuickRename: (name: string, hunterClass: string) => Promise<void>;
}

export const TopSystemHud: React.FC<TopSystemHudProps> = ({
  player,
  theme,
  soundEnabled = true,
  assistantSummary,
  hudVisible = false,
  activeFocusQuest,
  onOpenActiveFocus,
  onQuickStartFocus,
  onToggleHudVisible,
  onOpenAssistant,
  onToggleTheme,
  onOpenSettings,
  onOpenReset,
  onOpenCommandPalette,
  onOpenSkillTree,
  onQuickRename,
}) => {
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.profile.name);
  const [classDraft, setClassDraft] = useState(player.hunterClass);

  const [audioSnap, setAudioSnap] = useState<SoundEngineSnapshot>(() => soundEngine.getSnapshot());
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);
  const [focusDuration, setFocusDuration] = useState<number>(25);
  const [focusTitleDraft, setFocusTitleDraft] = useState('');
  const [startingFocus, setStartingFocus] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const focusPopoverRef = useRef<HTMLDivElement | null>(null);
  const audioPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return soundEngine.subscribe(setAudioSnap);
  }, []);

  useEffect(() => {
    if (!activeFocusQuest) return;
    setNowMs(Date.now());
    if (activeFocusQuest.isPaused) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeFocusQuest]);

  useEffect(() => {
    if (!audioMenuOpen && !focusMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (focusMenuOpen && focusPopoverRef.current && !focusPopoverRef.current.contains(target)) {
        setFocusMenuOpen(false);
      }
      if (audioMenuOpen && audioPopoverRef.current && !audioPopoverRef.current.contains(target)) {
        setAudioMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusMenuOpen(false);
        setAudioMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [audioMenuOpen, focusMenuOpen]);

  const hp = Math.max(0, player.hp ?? 100);
  const maxHp = Math.max(100, player.maxHp ?? 100);
  const hpPct = Math.min(100, Math.round((hp / maxHp) * 100));
  const xpPct = Math.min(
    100,
    Math.round((player.currentXp / Math.max(1, player.xpToNextLevel)) * 100)
  );

  // 20 HP per Heart (100 Max HP = 5 Hearts, scaling up with Vitality/Level)
  const totalHearts = Math.min(10, Math.max(5, Math.round(maxHp / 20)));
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
  const sp = player.skillPoints ?? 0;

  const sfxActive = audioSnap.enabled && soundEnabled;
  const ambiencePlaying = audioSnap.ambienceMode !== 'off' && !audioSnap.ambiencePaused;

  let activeClockLabel = '';
  let activeOvertime = false;
  if (activeFocusQuest) {
    const baseSec = activeFocusQuest.pausedAccumulatedSeconds ?? 0;
    const runningSec =
      activeFocusQuest.startedAt && !activeFocusQuest.isPaused
        ? Math.max(0, Math.floor((nowMs - Date.parse(activeFocusQuest.startedAt)) / 1000))
        : 0;
    const elapsedSec = baseSec + runningSec;
    const targetSec = Math.max(60, (activeFocusQuest.durationMinutes || 25) * 60);
    if (elapsedSec <= targetSec) {
      activeClockLabel = formatCompactMmSs(targetSec - elapsedSec);
    } else {
      activeOvertime = true;
      activeClockLabel = `+${formatCompactMmSs(elapsedSec - targetSec)}`;
    }
  }

  return (
    <header className="rpg-hud-bar relative rounded-none px-3 py-2 sm:px-3.5">
      <PixelRivets />
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-2">
        {/* TOP-LEFT CORNER 16-BIT PIXEL RPG STATUS PLAQUE */}
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Pixel Hero Sprite Frame + LV Badge */}
          <div className="relative shrink-0">
            <div className="px-inset flex h-12 w-12 items-center justify-center rounded-none">
              <PixelHeroSprite
                rank={player.rank}
                avatarStyle={player.profile.avatarStyle}
                mood={heroMood}
                size={42}
              />
            </div>
            <span className="font-pixel absolute -bottom-1 -right-1 rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-1 py-0.5 text-[9px] font-bold leading-none text-[#140e04]">
              LV.{player.level}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            {editingIdentity ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await onQuickRename(
                    nameDraft.trim() || player.profile.name,
                    classDraft.trim() || player.hunterClass
                  );
                  setEditingIdentity(false);
                }}
                className="flex flex-wrap items-center gap-1.5"
              >
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Tên hiển thị"
                  className="w-32 px-2 py-1 text-xs"
                />
                <input
                  value={classDraft}
                  onChange={(e) => setClassDraft(e.target.value)}
                  placeholder="Danh xưng"
                  className="w-36 px-2 py-1 text-xs"
                />
                <button type="submit" className="btn-primary p-1.5" title="Lưu">
                  <PxCheck size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIdentity(false)}
                  className="btn-secondary p-1.5"
                  title="Hủy"
                >
                  <PxClose size={13} />
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h1 className="truncate font-display text-sm font-extrabold text-main sm:text-base">
                    {player.profile.name}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(player.profile.name);
                      setClassDraft(player.hunterClass);
                      setEditingIdentity(true);
                    }}
                    className="p-0.5 text-dim hover:text-[var(--px-gold-text)]"
                    title="Đổi tên & danh xưng"
                  >
                    <PxEdit size={12} />
                  </button>
                  <span className="font-pixel shrink-0 rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-muted)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--px-gold-text)]">
                    {player.rank}
                  </span>
                  <span
                    className="px-inset flex shrink-0 items-center gap-1 rounded-none px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--px-blue-text)]"
                    title={player.currentCheckpoint?.label || 'Checkpoint hiện tại'}
                  >
                    <span className="inline-block h-1.5 w-1.5 bg-[var(--px-blue-text)]" />
                    Ch.{player.currentCheckpoint?.chapterNumber ?? 1}-
                    {player.currentCheckpoint?.stageNumber ?? 1}
                  </span>
                </div>

                {/* Pixel Hearts Row */}
                <div
                  className="px-inset flex items-center gap-0.5 rounded-none px-1.5 py-0.5"
                  title="Sinh lực Kỷ luật (HP): chỉ trừ khi bỏ lỡ nhiệm vụ bắt buộc, hồi khi hoàn thành Quest / Nghỉ Chủ Động / dùng Elixir"
                  aria-label={`HP ${hp} trên ${maxHp}`}
                >
                  {heartStates.map((st, i) => (
                    <PixelHeart key={i} state={st} size={14} critical={isCriticalHp} />
                  ))}
                </div>
              </div>
            )}

            {/* Pixel HP Bar + Pixel EXP Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[125px] max-w-[190px] flex-1 items-center gap-1.5 xl:max-w-[170px]">
                <span className="font-pixel text-[9px] font-bold text-[var(--px-red-text)]">
                  HP
                </span>
                <div className="rpg-bar-track h-3.5 flex-1 rounded-none">
                  <div
                    className="h-full transition-all duration-200"
                    style={{ width: `${hpPct}%`, backgroundColor: 'var(--px-red)' }}
                  />
                  <span className="font-mono absolute inset-0 z-10 flex items-center justify-center text-[10px] font-bold text-white [text-shadow:1px_1px_0_#000]">
                    {hp}/{maxHp}
                  </span>
                </div>
              </div>

              <div className="flex min-w-[125px] max-w-[185px] flex-1 items-center gap-1.5 xl:max-w-[165px]">
                <span className="font-pixel text-[9px] font-bold text-[var(--px-blue-text)]">
                  EXP
                </span>
                <div className="rpg-bar-track h-3.5 flex-1 rounded-none">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${xpPct}%`, backgroundColor: 'var(--px-blue)' }}
                  />
                  <span className="font-mono absolute inset-0 z-10 flex items-center justify-center text-[10px] font-bold text-white [text-shadow:1px_1px_0_#000]">
                    {player.currentXp}/{player.xpToNextLevel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TOP-RIGHT COMPACT RESOURCE & TOOL COUNTERS (Strict 1-row at 1280x800) */}
        <div className="flex flex-wrap items-center gap-1.5 xl:flex-nowrap xl:gap-1">
          {assistantSummary?.trackerRunning && onOpenAssistant && (
            <button
              type="button"
              onClick={onOpenAssistant}
              className="px-inset flex shrink-0 items-center gap-1 rounded-none px-1.5 py-1 font-mono text-[11px] font-bold text-[var(--px-green-text)] hover:border-[var(--px-green)]"
              title="Trợ Lý PC đang theo dõi Focus — bấm để mở"
            >
              <span className="h-2 w-2 shrink-0 bg-[var(--px-green-text)]" />
              <span className="whitespace-nowrap">Focus {assistantSummary.focusScore}%</span>
            </button>
          )}

          {onToggleHudVisible && (
            <button
              type="button"
              onClick={onToggleHudVisible}
              className={`flex shrink-0 items-center gap-1 rounded-none border-2 px-1.5 py-1 font-mono text-[11px] font-bold ${
                hudVisible
                  ? 'border-[var(--border-ink)] bg-[var(--px-blue)] text-white shadow-[inset_2px_2px_0_rgba(255,255,255,0.22),inset_-2px_-2px_0_rgba(0,0,0,0.4)]'
                  : 'px-inset text-sub hover:text-main'
              }`}
              title={
                hudVisible
                  ? 'Mini HUD 2D Pixel đang hiện — bấm để ẩn (hoặc bấm icon khay hệ thống / Ctrl+Shift+Space)'
                  : 'Mini HUD 2D Pixel đang ẩn — bấm để hiện ngay lên màn hình (Ctrl+Shift+Space)'
              }
            >
              {hudVisible ? <PxEye size={12} /> : <PxEyeOff size={12} />}
              <span className="whitespace-nowrap">
                {hudVisible ? 'HUD: Hiện' : 'HUD: Ẩn'}
              </span>
            </button>
          )}

          {/* Quick-Focus Arena Trigger / Live Countdown Pill */}
          {(activeFocusQuest || onQuickStartFocus) && (
            <div ref={focusPopoverRef} className="relative shrink-0">
              {activeFocusQuest ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    setFocusMenuOpen(false);
                    setAudioMenuOpen(false);
                    onOpenActiveFocus?.();
                  }}
                  className={`flex shrink-0 items-center gap-1 rounded-none border-2 border-[var(--border-ink)] px-2 py-1 font-mono text-[11px] font-extrabold shadow-[inset_2px_2px_0_rgba(255,255,255,0.28),inset_-2px_-2px_0_rgba(0,0,0,0.35)] ${
                    activeOvertime
                      ? 'bg-[var(--px-plum)] text-white'
                      : 'bg-[var(--px-gold)] text-[#140e04]'
                  }`}
                  title={`Đang Focus: ${activeFocusQuest.title} — Bấm để mở lại Đấu Trường Tập Trung`}
                >
                  <PxSword size={12} color={activeOvertime ? '#ffffff' : '#140e04'} />
                  <span className="tabular-nums whitespace-nowrap">
                    {activeFocusQuest.isPaused ? `⏸ ${activeClockLabel}` : activeClockLabel}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    setAudioMenuOpen(false);
                    setFocusMenuOpen((v) => !v);
                  }}
                  className="btn-emerald flex shrink-0 items-center gap-1 rounded-none px-2 py-1 text-[11px]"
                  title="Bắt đầu nhanh Phiên Tập Trung (Focus Dungeon Arena)"
                >
                  <PxSword size={12} color="#ffffff" />
                  <span className="whitespace-nowrap">Focus</span>
                </button>
              )}

              {focusMenuOpen && !activeFocusQuest && onQuickStartFocus && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64">
                  <div className="rpg-window rounded-none p-3">
                    <PixelRivets />
                    <div className="mb-2 flex items-center justify-between border-b-2 pb-1.5 rpg-divider">
                      <span className="font-pixel flex items-center gap-1.5 text-[10px] font-bold text-[var(--px-gold-text)]">
                        <PxSword size={12} color="var(--px-gold-text)" />
                        FOCUS NHANH
                      </span>
                      <button
                        type="button"
                        onClick={() => setFocusMenuOpen(false)}
                        className="p-0.5 text-dim hover:text-main"
                        aria-label="Đóng Focus nhanh"
                      >
                        <PxClose size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {FOCUS_PRESETS.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            soundEngine.click();
                            setFocusDuration(mins);
                          }}
                          className={`rounded-none border-2 px-1 py-1.5 font-mono text-[11px] font-bold ${
                            focusDuration === mins
                              ? 'border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                              : 'px-inset text-sub hover:text-main'
                          }`}
                        >
                          {mins}p
                        </button>
                      ))}
                    </div>

                    <input
                      value={focusTitleDraft}
                      onChange={(e) => setFocusTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !startingFocus) {
                          e.preventDefault();
                          void (async () => {
                            setStartingFocus(true);
                            try {
                              await onQuickStartFocus(
                                focusDuration,
                                focusTitleDraft.trim() || undefined
                              );
                              setFocusTitleDraft('');
                              setFocusMenuOpen(false);
                            } finally {
                              setStartingFocus(false);
                            }
                          })();
                        }
                      }}
                      placeholder="Tên phiên (để trống tự đặt)..."
                      className="mt-2 w-full rounded-none px-2 py-1.5 text-xs"
                    />

                    <button
                      type="button"
                      disabled={startingFocus}
                      onClick={async () => {
                        setStartingFocus(true);
                        try {
                          await onQuickStartFocus(focusDuration, focusTitleDraft.trim() || undefined);
                          setFocusTitleDraft('');
                          setFocusMenuOpen(false);
                        } finally {
                          setStartingFocus(false);
                        }
                      }}
                      className="btn-primary mt-2 flex w-full items-center justify-center gap-1.5 rounded-none py-1.5 text-xs"
                    >
                      <PxSword size={12} color="#140e04" />
                      <span>{startingFocus ? 'Đang mở...' : `Bắt đầu ngay (${focusDuration}p)`}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clickable SP Badge -> Cây Kĩ Năng */}
          <button
            type="button"
            onClick={onOpenSkillTree}
            className={`flex shrink-0 items-center gap-1 rounded-none border-2 border-[var(--border-ink)] px-1.5 py-1 text-xs font-bold ${
              sp > 0
                ? 'bg-[var(--px-gold)] text-[#140e04] shadow-[inset_2px_2px_0_rgba(255,255,255,0.28),inset_-2px_-2px_0_rgba(0,0,0,0.35)]'
                : 'px-inset text-[var(--px-plum-text)] hover:text-main'
            }`}
            title="Điểm Kĩ Năng (SP) — Mở Cây Kĩ Năng"
          >
            <PxSparkle size={12} color={sp > 0 ? '#140e04' : 'var(--px-plum-text)'} />
            <span className="font-pixel whitespace-nowrap text-[10px]">{sp} SP</span>
          </button>

          {/* Gold & Runestones Counters */}
          <div
            className="px-inset flex shrink-0 items-center gap-1 rounded-none px-1.5 py-1 text-xs"
            title="Gold & Runestones nâng cấp kỹ năng"
          >
            <span className="flex items-center gap-1 whitespace-nowrap font-mono font-bold text-[var(--px-gold-text)]">
              <PxCoin size={12} />
              {player.gold}G
            </span>
            <span className="text-dim">|</span>
            <span className="flex items-center gap-1 whitespace-nowrap font-mono font-bold text-[var(--px-blue-text)]">
              <PxGem size={12} />
              {player.runestones}
            </span>
          </div>

          {/* Streak Days */}
          <div
            className="px-inset flex shrink-0 items-center gap-1 rounded-none px-1.5 py-1 text-xs"
            title="Chuỗi ngày rèn luyện liên tiếp"
          >
            <PxFlame size={12} />
            <span className="font-mono font-bold text-main">{player.streakDays}d</span>
          </div>

          {/* Energy Level Pill (Decoupled from HP) */}
          <div
            className={`px-inset flex shrink-0 items-center gap-1 rounded-none px-1.5 py-1 text-xs ${
              player.energyLevel >= 70
                ? 'text-[var(--px-green-text)]'
                : 'text-[var(--px-gold-text)]'
            }`}
            title="Thể trạng hôm nay — giúp AI cân chỉnh độ nặng nhiệm vụ (độc lập với HP)"
          >
            <PxBolt
              size={12}
              color={player.energyLevel >= 70 ? 'var(--px-green-text)' : 'var(--px-gold-text)'}
            />
            <span className="font-mono font-bold">{player.energyLevel}%</span>
          </div>

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="btn-secondary flex shrink-0 items-center gap-1 rounded-none px-1.5 py-1 text-xs"
              title="Bảng Lệnh Nhanh (Ctrl+K / Cmd+K)"
            >
              <PxCmd size={12} color="var(--px-gold-text)" />
              <span className="font-mono text-[11px] text-sub">⌘K</span>
            </button>
          )}

          {/* 2-Channel 16-Bit Audio Mixer Trigger + Popover */}
          <div ref={audioPopoverRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setFocusMenuOpen(false);
                setAudioMenuOpen((v) => !v);
                if (sfxActive) soundEngine.click();
              }}
              className="btn-secondary relative shrink-0 rounded-none p-1.5"
              title="Bộ trộn âm thanh 16-bit (SFX & Nhạc nền Tập trung)"
              aria-label="Bộ trộn âm thanh"
            >
              {sfxActive ? (
                <PxSoundOn size={14} color="var(--px-green-text)" />
              ) : (
                <PxSoundOff size={14} color="var(--text-muted)" />
              )}
              {ambiencePlaying && (
                <span
                  aria-hidden="true"
                  className="absolute right-[2px] top-[2px] h-1.5 w-1.5 bg-[var(--px-gold)]"
                />
              )}
            </button>

            {audioMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-[296px]">
                <div className="rpg-window rounded-none p-3">
                  <PixelRivets />
                  <div className="mb-2.5 flex items-center justify-between border-b-2 pb-1.5 rpg-divider">
                    <span className="font-pixel flex items-center gap-1.5 text-[10px] font-bold text-[var(--px-gold-text)]">
                      <PxSoundOn size={12} color="var(--px-gold-text)" />
                      ÂM THANH 16-BIT
                    </span>
                    <button
                      type="button"
                      onClick={() => setAudioMenuOpen(false)}
                      className="p-0.5 text-dim hover:text-main"
                      aria-label="Đóng bộ trộn âm thanh"
                    >
                      <PxClose size={12} />
                    </button>
                  </div>

                  {/* Channel 1: 16-Bit SFX */}
                  <div className="px-inset space-y-1.5 rounded-none p-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-main">
                        Âm lượng SFX 16-bit ({Math.round(audioSnap.sfxVolume * 100)}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !audioSnap.enabled;
                          soundEngine.setEnabled(next);
                          if (next) soundEngine.click();
                        }}
                        className={`rounded-none border-2 border-[var(--border-ink)] px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          audioSnap.enabled
                            ? 'bg-[var(--px-green)] text-white'
                            : 'bg-[var(--bg-muted)] text-dim'
                        }`}
                      >
                        {audioSnap.enabled ? 'BẬT' : 'TẮT'}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(audioSnap.sfxVolume * 100)}
                      onChange={(e) => soundEngine.setSfxVolume(Number(e.target.value) / 100)}
                      className="px-slider w-full"
                      aria-label="Âm lượng SFX 16-bit"
                    />
                  </div>

                  {/* Channel 2: Focus Ambience */}
                  <div className="px-inset mt-2 space-y-2 rounded-none p-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-main">Âm thanh Tập trung</span>
                      <span className="font-mono font-bold text-[var(--px-gold-text)]">
                        {Math.round(audioSnap.ambienceVolume * 100)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {AMBIENCE_OPTIONS.map((opt) => {
                        const active = audioSnap.ambienceMode === opt.mode;
                        return (
                          <button
                            key={opt.mode}
                            type="button"
                            onClick={() => {
                              soundEngine.click();
                              soundEngine.setAmbience(opt.mode);
                            }}
                            className={`whitespace-nowrap rounded-none border-2 px-1.5 py-1 text-center font-mono text-[10px] font-bold ${
                              active
                                ? 'border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                                : 'border-[var(--border-ink)] bg-[var(--bg-muted)] text-sub hover:text-main'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(audioSnap.ambienceVolume * 100)}
                      onChange={(e) => soundEngine.setAmbienceVolume(Number(e.target.value) / 100)}
                      className="px-slider w-full"
                      aria-label="Âm lượng Ambience"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="btn-secondary shrink-0 rounded-none p-1.5"
            title={theme === 'dark' ? 'Đổi sang Quán Trọ Sáng (Light)' : 'Đổi sang Hầm Ngục Tối (Dark)'}
          >
            {theme === 'dark' ? (
              <PxSun size={14} color="var(--px-gold-text)" />
            ) : (
              <PxMoon size={14} color="var(--px-blue-text)" />
            )}
          </button>

          {onOpenReset && (
            <button
              type="button"
              onClick={onOpenReset}
              className="btn-secondary shrink-0 rounded-none p-1.5 text-[var(--px-red-text)]"
              title="Reset tiến trình"
              aria-label="Reset tiến trình"
            >
              <PxReset size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-secondary shrink-0 rounded-none p-1.5"
            title="Cài đặt AI & SQLite Vault"
          >
            <PxGear size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
