import React, { useEffect, useRef, useState } from 'react';
import type { PlayerState, Quest, SystemStatePayload } from '../types/system';
import { soundEngine, type AmbienceMode, type SoundEngineSnapshot } from '../utils/soundEngine';
import { PixelHeroSprite } from './DungeonSprites';
import {
  PxAutomaton,
  PxBolt,
  PxCalendar,
  PxCheck,
  PxChevron,
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
  PxScroll,
  PxSkillTree,
  PxSoundOff,
  PxSoundOn,
  PxSparkle,
  PxSun,
  PxSword,
  PxTarget,
} from './PixelIcons';

export type MainNavKey = 'today' | 'timetable' | 'growth' | 'rpg' | 'assistant';

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

export interface SidebarNavProps {
  player: PlayerState;
  activeTab: MainNavKey;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectTab: (tab: MainNavKey) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  hudVisible: boolean;
  onToggleHudVisible: () => void;
  activeFocusQuest: Quest | null;
  onOpenActiveFocus: () => void;
  onQuickStartFocus: (durationMinutes: number, title?: string) => Promise<void>;
  onOpenAiDrawer: () => void;
  aiDrawerOpen: boolean;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onQuickRename: (name: string, hunterClass: string) => Promise<void>;
  assistantSummary?: SystemStatePayload['assistantSummary'];
  badges: {
    todayPendingCount: number;
    dueRecallCount: number;
    rpgActionCount: number;
    unreadNudges: number;
  };
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  player,
  activeTab,
  collapsed,
  onToggleCollapse,
  onSelectTab,
  theme,
  onToggleTheme,
  hudVisible,
  onToggleHudVisible,
  activeFocusQuest,
  onOpenActiveFocus,
  onQuickStartFocus,
  onOpenAiDrawer,
  aiDrawerOpen,
  onOpenCommandPalette,
  onOpenSettings,
  onQuickRename,
  assistantSummary,
  badges,
}) => {
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.profile.name);
  const [classDraft, setClassDraft] = useState(player.hunterClass);
  const [audioSnap, setAudioSnap] = useState<SoundEngineSnapshot>(() => soundEngine.getSnapshot());
  const [audioOpen, setAudioOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusDuration, setFocusDuration] = useState<number>(25);
  const [focusTitleDraft, setFocusTitleDraft] = useState('');
  const [startingFocus, setStartingFocus] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => soundEngine.subscribe(setAudioSnap), []);

  useEffect(() => {
    if (!activeFocusQuest) return;
    setNowMs(Date.now());
    if (activeFocusQuest.isPaused) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeFocusQuest]);

  useEffect(() => {
    if (!audioOpen && !focusOpen) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAudioOpen(false);
        setFocusOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAudioOpen(false);
        setFocusOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [audioOpen, focusOpen]);

  const hp = Math.max(0, player.hp ?? 100);
  const maxHp = Math.max(100, player.maxHp ?? 100);
  const hpPct = Math.min(100, Math.round((hp / maxHp) * 100));
  const xpPct = Math.min(
    100,
    Math.round((player.currentXp / Math.max(1, player.xpToNextLevel)) * 100)
  );
  const heroMood: 'healthy' | 'wounded' | 'critical' =
    hpPct <= 25 ? 'critical' : hpPct <= 55 ? 'wounded' : 'healthy';

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

  const navItems: Array<{
    key: MainNavKey;
    label: string;
    icon: React.ReactNode;
    badge?: string | null;
    dotColor?: string;
  }> = [
    {
      key: 'today',
      label: 'Hôm Nay',
      icon: <PxScroll size={16} />,
      badge: badges.todayPendingCount > 0 ? String(badges.todayPendingCount) : null,
    },
    {
      key: 'timetable',
      label: 'Lịch & Nhịp',
      icon: <PxCalendar size={16} />,
    },
    {
      key: 'growth',
      label: 'Mục Tiêu & Review',
      icon: <PxTarget size={16} />,
      badge: badges.dueRecallCount > 0 ? `${badges.dueRecallCount} ôn` : null,
    },
    {
      key: 'rpg',
      label: 'Kĩ Năng & RPG',
      icon: <PxSkillTree size={16} />,
      badge: badges.rpgActionCount > 0 ? `+${badges.rpgActionCount}` : null,
    },
    {
      key: 'assistant',
      label: 'Trợ Lý PC',
      icon: <PxAutomaton size={16} />,
      dotColor: assistantSummary?.trackerRunning ? 'var(--px-green-text)' : undefined,
      badge: badges.unreadNudges > 0 ? String(badges.unreadNudges) : null,
    },
  ];

  const ambiencePlaying = audioSnap.ambienceMode !== 'off' && !audioSnap.ambiencePaused;

  return (
    <>
      {/* Mobile / Narrow Top Compact Strip */}
      <div className="flex items-center justify-between gap-2 border-b-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 py-2 lg:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <div className="px-inset flex h-8 w-8 shrink-0 items-center justify-center">
            <PixelHeroSprite
              rank={player.rank}
              avatarStyle={player.profile.avatarStyle}
              mood={heroMood}
              size={26}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-xs font-extrabold text-main">
                {player.profile.name}
              </span>
              <span className="font-pixel text-[9px] text-[var(--px-gold-text)]">
                LV.{player.level}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-sub">
              <span className="text-[var(--px-red-text)]">HP {hp}/{maxHp}</span>
              <span className="inline-flex items-center gap-0.5 text-[var(--px-gold-text)]">
                <PxFlame size={10} /> {player.streakDays}d
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                soundEngine.click();
                onSelectTab(item.key);
              }}
              className={`shrink-0 px-2 py-1.5 text-xs ${
                activeTab === item.key
                  ? 'border border-[var(--px-gold)] bg-[var(--bg-surface-2)] font-bold text-[var(--px-gold-text)]'
                  : 'text-sub hover:text-main'
              }`}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenAiDrawer}
            className={`shrink-0 px-2 py-1.5 text-xs ${
              aiDrawerOpen ? 'btn-primary' : 'btn-secondary'
            }`}
            title="Cố vấn AI"
          >
            <PxAutomaton size={14} />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-secondary shrink-0 p-1.5"
            title="Cài đặt"
          >
            <PxGear size={14} />
          </button>
        </div>
      </div>

      {/* Desktop Collapsible Left Sidebar */}
      <aside
        className={`px-shell-sidebar hidden shrink-0 flex-col justify-between lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto transition-[width] duration-150 ${
          collapsed ? 'w-[68px]' : 'w-[244px]'
        }`}
      >
        <div className="flex flex-col">
          {/* Compact 16-Bit Hero Plaque */}
          <div className="border-b border-[var(--border-hairline)] p-3">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="px-inset flex h-11 w-11 items-center justify-center">
                    <PixelHeroSprite
                      rank={player.rank}
                      avatarStyle={player.profile.avatarStyle}
                      mood={heroMood}
                      size={36}
                    />
                  </div>
                  <span className="font-pixel absolute -bottom-1 -right-1 border border-[var(--border-ink)] bg-[var(--px-gold)] px-1 py-0.5 text-[8px] font-bold leading-none text-[#140e04]">
                    {player.level}
                  </span>
                </div>

                {!collapsed && !editingIdentity && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-display text-sm font-extrabold text-main">
                        {player.profile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setNameDraft(player.profile.name);
                          setClassDraft(player.hunterClass);
                          setEditingIdentity(true);
                        }}
                        className="p-0.5 text-dim opacity-70 hover:text-[var(--px-gold-text)] hover:opacity-100"
                        title="Đổi tên & danh xưng"
                      >
                        <PxEdit size={11} />
                      </button>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px]">
                      <span className="font-bold text-[var(--px-gold-text)]">{player.rank}</span>
                      <span className="text-dim">·</span>
                      <span className="inline-flex items-center gap-0.5 font-bold text-main">
                        <PxFlame size={10} />
                        {player.streakDays}d
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!collapsed && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    onToggleCollapse();
                  }}
                  className="p-1 text-dim hover:bg-[var(--bg-surface-2)] hover:text-main"
                  title="Thu gọn thanh bên"
                  aria-label="Thu gọn thanh bên"
                >
                  <PxChevron dir="left" size={12} />
                </button>
              )}
            </div>

            {collapsed && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.click();
                  onToggleCollapse();
                }}
                className="mt-2 flex w-full justify-center py-1 text-dim hover:bg-[var(--bg-surface-2)] hover:text-main"
                title="Mở rộng thanh bên"
                aria-label="Mở rộng thanh bên"
              >
                <PxChevron dir="right" size={12} />
              </button>
            )}

            {!collapsed && editingIdentity && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await onQuickRename(
                    nameDraft.trim() || player.profile.name,
                    classDraft.trim() || player.hunterClass
                  );
                  setEditingIdentity(false);
                }}
                className="mt-2.5 space-y-1.5"
              >
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Tên hiển thị"
                  className="w-full px-2 py-1 text-xs"
                />
                <input
                  value={classDraft}
                  onChange={(e) => setClassDraft(e.target.value)}
                  placeholder="Danh xưng"
                  className="w-full px-2 py-1 text-xs"
                />
                <div className="flex items-center gap-1.5">
                  <button type="submit" className="btn-primary flex-1 py-1 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <PxCheck size={11} /> Lưu
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIdentity(false)}
                    className="btn-secondary px-2 py-1 text-[11px]"
                  >
                    <PxClose size={11} />
                  </button>
                </div>
              </form>
            )}

            {/* Slim HP & EXP Bars */}
            {!collapsed && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 font-pixel text-[8px] font-bold text-[var(--px-red-text)]">
                    HP
                  </span>
                  <div className="rpg-bar-track h-2.5 flex-1">
                    <div
                      className="h-full transition-all duration-200"
                      style={{ width: `${hpPct}%`, backgroundColor: 'var(--px-red)' }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-[10px] font-bold text-sub">
                    {hp}/{maxHp}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-7 font-pixel text-[8px] font-bold text-[var(--px-blue-text)]">
                    EXP
                  </span>
                  <div className="rpg-bar-track h-2.5 flex-1">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${xpPct}%`, backgroundColor: 'var(--px-blue)' }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-[10px] text-dim">
                    {xpPct}%
                  </span>
                </div>

                {/* Live Resource Counters Strip (Gold, Runestones, SP, Energy) */}
                <div className="px-inset mt-2 flex items-center justify-between px-2 py-1 font-mono text-[10px] font-bold">
                  <span
                    className="inline-flex items-center gap-0.5 text-[var(--px-gold-text)]"
                    title="Gold hiện có"
                  >
                    <PxCoin size={11} />
                    {player.gold}G
                  </span>
                  <span
                    className="inline-flex items-center gap-0.5 text-[var(--px-blue-text)]"
                    title="Runestones nâng cấp kỹ năng"
                  >
                    <PxGem size={11} />
                    {player.runestones}
                  </span>
                  <span
                    className="inline-flex items-center gap-0.5 text-[var(--px-plum-text)]"
                    title="Điểm Kĩ Năng (SP)"
                  >
                    <PxSparkle size={11} color="var(--px-plum-text)" />
                    {player.skillPoints ?? 0}SP
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 ${
                      player.energyLevel >= 70
                        ? 'text-[var(--px-green-text)]'
                        : 'text-[var(--px-gold-text)]'
                    }`}
                    title="Thể trạng hôm nay"
                  >
                    <PxBolt
                      size={11}
                      color={
                        player.energyLevel >= 70
                          ? 'var(--px-green-text)'
                          : 'var(--px-gold-text)'
                      }
                    />
                    {player.energyLevel}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 5 Flat Navigation Items */}
          <nav className="space-y-1 p-2" aria-label="Điều hướng chính">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    onSelectTab(item.key);
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`px-nav-item ${active ? 'px-nav-item-active' : ''} ${
                    collapsed ? 'justify-center px-0' : 'justify-between'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="relative shrink-0">
                      {item.icon}
                      {item.dotColor && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5"
                          style={{ backgroundColor: item.dotColor }}
                        />
                      )}
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </span>

                  {!collapsed && item.badge && (
                    <span
                      className={`shrink-0 px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        active
                          ? 'bg-[var(--px-gold)] text-[#140e04]'
                          : 'bg-[var(--bg-subtle)] text-sub'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Primary Actions & Compact Utility Row */}
        <div ref={popoverRef} className="relative border-t border-[var(--border-hairline)] p-2.5 space-y-2">
          {/* Focus Quick Action / Live Countdown */}
          {activeFocusQuest ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.click();
                onOpenActiveFocus();
              }}
              className={`flex w-full items-center justify-center gap-1.5 border-2 border-[var(--border-ink)] px-2.5 py-2 font-mono text-xs font-extrabold ${
                activeOvertime
                  ? 'bg-[var(--px-plum)] text-white'
                  : 'bg-[var(--px-gold)] text-[#140e04]'
              }`}
              title={`Đang Focus: ${activeFocusQuest.title}`}
            >
              <PxSword size={14} color={activeOvertime ? '#ffffff' : '#140e04'} />
              {!collapsed && (
                <span className="tabular-nums">
                  {activeFocusQuest.isPaused ? `⏸ ${activeClockLabel}` : activeClockLabel}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundEngine.click();
                setAudioOpen(false);
                setFocusOpen((v) => !v);
              }}
              className="btn-emerald flex w-full items-center justify-center gap-1.5 px-2.5 py-2 text-xs"
              title="Bắt đầu nhanh phiên Focus"
            >
              <PxSword size={14} color="#ffffff" />
              {!collapsed && <span>Focus Nhanh</span>}
            </button>
          )}

          {/* AI Coach Drawer Trigger */}
          <button
            type="button"
            onClick={() => {
              soundEngine.click();
              onOpenAiDrawer();
            }}
            className={`flex w-full items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs ${
              aiDrawerOpen ? 'btn-primary' : 'btn-secondary'
            }`}
            title="Mở ngăn kéo Cố vấn AI"
          >
            <PxAutomaton size={14} />
            {!collapsed && <span>Cố vấn AI</span>}
          </button>

          {/* Compact Utility Icons Row */}
          <div
            className={`flex items-center pt-1 ${
              collapsed ? 'flex-col gap-1.5' : 'justify-between gap-1'
            }`}
          >
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="p-1.5 text-dim hover:bg-[var(--bg-surface-2)] hover:text-main"
              title="Bảng lệnh nhanh (Ctrl+K)"
            >
              <PxCmd size={14} />
            </button>

            <button
              type="button"
              onClick={() => {
                setFocusOpen(false);
                setAudioOpen((v) => !v);
                if (audioSnap.enabled) soundEngine.click();
              }}
              className="relative p-1.5 text-dim hover:bg-[var(--bg-surface-2)] hover:text-main"
              title="Âm thanh 16-bit & Nhạc nền Tập trung"
            >
              {audioSnap.enabled ? (
                <PxSoundOn size={14} color="var(--px-green-text)" />
              ) : (
                <PxSoundOff size={14} />
              )}
              {ambiencePlaying && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 bg-[var(--px-gold)]" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleHudVisible}
              className={`p-1.5 hover:bg-[var(--bg-surface-2)] ${
                hudVisible ? 'text-[var(--px-blue-text)]' : 'text-dim hover:text-main'
              }`}
              title={hudVisible ? 'Mini HUD đang hiện — bấm để ẩn' : 'Hiện Mini HUD desktop'}
            >
              {hudVisible ? <PxEye size={14} /> : <PxEyeOff size={14} />}
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 text-dim hover:bg-[var(--bg-surface-2)] hover:text-main"
              title={theme === 'dark' ? 'Đổi sang Giao diện Sáng' : 'Đổi sang Giao diện Tối'}
            >
              {theme === 'dark' ? (
                <PxSun size={14} color="var(--px-gold-text)" />
              ) : (
                <PxMoon size={14} color="var(--px-blue-text)" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 text-dim hover:bg-[var(--bg-surface-2)] hover:text-main"
              title="Cài đặt AI, Sao lưu & Reset"
            >
              <PxGear size={14} />
            </button>
          </div>

          {/* Quick Focus Popover */}
          {focusOpen && !activeFocusQuest && (
            <div className="absolute bottom-full left-2 z-50 mb-2 w-64">
              <div className="rpg-window p-3">
                <div className="mb-2 flex items-center justify-between border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="font-pixel text-[10px] font-bold text-[var(--px-gold-text)]">
                    FOCUS NHANH
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocusOpen(false)}
                    className="p-0.5 text-dim hover:text-main"
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
                      className={`border py-1.5 font-mono text-[11px] font-bold ${
                        focusDuration === mins
                          ? 'border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-sub hover:text-main'
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
                          await onQuickStartFocus(focusDuration, focusTitleDraft.trim() || undefined);
                          setFocusTitleDraft('');
                          setFocusOpen(false);
                        } finally {
                          setStartingFocus(false);
                        }
                      })();
                    }
                  }}
                  placeholder="Tên phiên (để trống tự đặt)..."
                  className="mt-2 w-full px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={startingFocus}
                  onClick={async () => {
                    setStartingFocus(true);
                    try {
                      await onQuickStartFocus(focusDuration, focusTitleDraft.trim() || undefined);
                      setFocusTitleDraft('');
                      setFocusOpen(false);
                    } finally {
                      setStartingFocus(false);
                    }
                  }}
                  className="btn-primary mt-2 w-full py-1.5 text-xs"
                >
                  {startingFocus ? 'Đang mở...' : `Bắt đầu ngay (${focusDuration}p)`}
                </button>
              </div>
            </div>
          )}

          {/* Audio Mixer Popover */}
          {audioOpen && (
            <div className="absolute bottom-full left-2 z-50 mb-2 w-72">
              <div className="rpg-window p-3">
                <div className="mb-2 flex items-center justify-between border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="font-pixel text-[10px] font-bold text-[var(--px-gold-text)]">
                    ÂM THANH 16-BIT
                  </span>
                  <button
                    type="button"
                    onClick={() => setAudioOpen(false)}
                    className="p-0.5 text-dim hover:text-main"
                  >
                    <PxClose size={12} />
                  </button>
                </div>
                <div className="px-inset space-y-1.5 p-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-main">
                      SFX ({Math.round(audioSnap.sfxVolume * 100)}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !audioSnap.enabled;
                        soundEngine.setEnabled(next);
                        if (next) soundEngine.click();
                      }}
                      className={`px-1.5 py-0.5 font-mono text-[10px] font-bold ${
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
                  />
                </div>
                <div className="px-inset mt-2 space-y-2 p-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-main">Nhạc nền Tập trung</span>
                    <span className="font-mono font-bold text-[var(--px-gold-text)]">
                      {Math.round(audioSnap.ambienceVolume * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {AMBIENCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => {
                          soundEngine.click();
                          soundEngine.setAmbience(opt.mode);
                        }}
                        className={`border py-1 text-center font-mono text-[10px] font-bold ${
                          audioSnap.ambienceMode === opt.mode
                            ? 'border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-muted)] text-sub hover:text-main'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(audioSnap.ambienceVolume * 100)}
                    onChange={(e) => soundEngine.setAmbienceVolume(Number(e.target.value) / 100)}
                    className="px-slider w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
