import React, { useState } from 'react';
import {
  Check,
  Coins,
  Command,
  Edit3,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Moon,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { AISettings, PlayerState, SystemStatePayload } from '../types/system';
import { PixelHeart, PixelHeroSprite } from './DungeonSprites';

interface TopSystemHudProps {
  player: PlayerState;
  aiSettings?: AISettings;
  theme: 'light' | 'dark';
  soundEnabled?: boolean;
  lastSavedAt?: string;
  assistantSummary?: SystemStatePayload['assistantSummary'];
  hudVisible?: boolean;
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
  onToggleHudVisible,
  onOpenAssistant,
  onToggleTheme,
  onToggleSound,
  onOpenSettings,
  onOpenReset,
  onOpenCommandPalette,
  onOpenSkillTree,
  onQuickRename,
}) => {
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [nameDraft, setNameDraft] = useState(player.profile.name);
  const [classDraft, setClassDraft] = useState(player.hunterClass);

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

  return (
    <header className="rpg-hud-bar px-3.5 py-2.5 sm:px-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* TOP-LEFT CORNER 2D PIXEL RPG STATUS PLAQUE */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Pixel Hero Sprite Frame + LV Badge */}
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-amber-500/70 bg-[#0d111d] rounded-[2px]">
              <PixelHeroSprite
                rank={player.rank}
                avatarStyle={player.profile.avatarStyle}
                mood={heroMood}
                size={44}
              />
            </div>
            <span className="font-pixel absolute -bottom-1.5 -right-1.5 border border-amber-300 bg-amber-500 px-1 py-0.5 text-[9px] font-bold leading-none text-[#160f05] rounded-[2px]">
              LV.{player.level}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
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
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingIdentity(false)}
                  className="btn-secondary p-1.5"
                  title="Hủy"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <div className="flex items-center gap-1.5">
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
                    className="p-0.5 text-dim transition hover:text-amber-400"
                    title="Đổi tên & danh xưng"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <span className="font-pixel border border-amber-500/45 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 dark:text-amber-300 rounded-[2px]">
                    {player.rank}
                  </span>
                  <span
                    className="font-mono border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-300 rounded-[2px]"
                    title={player.currentCheckpoint?.label || 'Checkpoint hiện tại'}
                  >
                    🚩 Ch.{player.currentCheckpoint?.chapterNumber ?? 1}-
                    {player.currentCheckpoint?.stageNumber ?? 1}
                  </span>
                </div>

                {/* Pixel Hearts Row */}
                <div
                  className="flex items-center gap-0.5 border-2 border-rose-900/40 bg-[#120b14]/75 px-1.5 py-0.5 rounded-[2px]"
                  title="Sinh lực Kỷ luật (HP): chỉ trừ khi bỏ lỡ nhiệm vụ bắt buộc, hồi khi hoàn thành Quest / Nghỉ Chủ Động / dùng Elixir"
                  aria-label={`HP ${hp} trên ${maxHp}`}
                >
                  {heartStates.map((st, i) => (
                    <PixelHeart key={i} state={st} size={15} critical={isCriticalHp} />
                  ))}
                </div>
              </div>
            )}

            {/* Pixel HP Bar + Pixel EXP Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex min-w-[155px] max-w-[220px] flex-1 items-center gap-1.5">
                <span className="font-pixel text-[9px] font-bold text-rose-500 dark:text-rose-400">
                  HP
                </span>
                <div className="rpg-bar-track h-3.5 flex-1">
                  <div
                    className="h-full bg-gradient-to-r from-rose-700 via-rose-500 to-red-400 transition-all duration-300"
                    style={{ width: `${hpPct}%` }}
                  />
                  <span className="font-mono absolute inset-0 z-10 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)]">
                    {hp}/{maxHp}
                  </span>
                </div>
              </div>

              <div className="flex min-w-[145px] max-w-[200px] flex-1 items-center gap-1.5">
                <span className="font-pixel text-[9px] font-bold text-sky-600 dark:text-cyan-400">
                  EXP
                </span>
                <div className="rpg-bar-track h-3.5 flex-1">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${xpPct}%` }}
                  />
                  <span className="font-mono absolute inset-0 z-10 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)]">
                    {player.currentXp}/{player.xpToNextLevel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TOP-RIGHT COMPACT RESOURCE & TOOL COUNTERS */}
        <div className="flex flex-wrap items-center gap-2">
          {assistantSummary?.trackerRunning && onOpenAssistant && (
            <button
              type="button"
              onClick={onOpenAssistant}
              className="flex items-center gap-1.5 border-2 border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-300 rounded-[2px]"
              title="Trợ Lý PC đang theo dõi Focus — bấm để mở"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>Focus {assistantSummary.focusScore}%</span>
            </button>
          )}

          {onToggleHudVisible && (
            <button
              type="button"
              onClick={onToggleHudVisible}
              className={`flex items-center gap-1.5 border-2 px-2.5 py-1.5 font-mono text-[11px] font-bold transition rounded-[2px] ${
                hudVisible
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-600 hover:bg-cyan-500/25 dark:text-cyan-300'
                  : 'studio-subtle studio-divider text-sub hover:border-amber-500/50 hover:text-main'
              }`}
              title={
                hudVisible
                  ? 'Mini HUD 2D Pixel đang hiện — bấm để ẩn (hoặc bấm icon khay hệ thống / Ctrl+Shift+Space)'
                  : 'Mini HUD 2D Pixel đang ẩn — bấm để hiện ngay lên màn hình (Ctrl+Shift+Space)'
              }
            >
              {hudVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{hudVisible ? 'Mini HUD: Hiện' : 'Mini HUD: Ẩn'}</span>
            </button>
          )}

          {/* Clickable SP Badge -> Cây Kĩ Năng */}
          <button
            type="button"
            onClick={onOpenSkillTree}
            className={`flex items-center gap-1.5 border-2 px-2.5 py-1.5 text-xs font-bold transition rounded-[2px] ${
              sp > 0
                ? 'border-amber-400 bg-amber-500/20 text-amber-600 dark:text-amber-300 hover:bg-amber-500/30'
                : 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20'
            }`}
            title="Điểm Kĩ Năng (SP) — Mở Cây Kĩ Năng"
          >
            <Sparkles className={`h-3.5 w-3.5 ${sp > 0 ? 'animate-pulse text-amber-500' : 'text-violet-500'}`} />
            <span className="font-pixel text-[10px]">{sp} SP</span>
          </button>

          {/* Gold & Runestones Counters */}
          <div
            className="flex items-center gap-2 border-2 px-2.5 py-1.5 text-xs studio-subtle studio-divider rounded-[2px]"
            title="Gold & Runestones nâng cấp kỹ năng"
          >
            <span className="flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400">
              <Coins className="h-3.5 w-3.5" />
              {player.gold} G
            </span>
            <span className="text-dim">|</span>
            <span className="flex items-center gap-1 font-mono font-bold text-sky-600 dark:text-cyan-400">
              <Gem className="h-3.5 w-3.5" />
              {player.runestones}
            </span>
          </div>

          {/* Streak Days */}
          <div
            className="flex items-center gap-1 border-2 px-2.5 py-1.5 text-xs studio-subtle studio-divider rounded-[2px]"
            title="Chuỗi ngày rèn luyện liên tiếp"
          >
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-mono font-bold text-main">{player.streakDays}d</span>
          </div>

          {/* Energy Level Pill (Decoupled from HP) */}
          <div
            className={`flex items-center gap-1 border-2 px-2.5 py-1.5 text-xs rounded-[2px] ${
              player.energyLevel >= 70
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
            }`}
            title="Thể trạng hôm nay — giúp AI cân chỉnh độ nặng nhiệm vụ (độc lập với HP)"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="font-mono font-bold">{player.energyLevel}%</span>
          </div>

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs"
              title="Bảng Lệnh Nhanh (Ctrl+K / Cmd+K)"
            >
              <Command className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-mono text-[11px] text-dim">⌘K</span>
            </button>
          )}

          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="btn-secondary p-2"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <VolumeX className="h-4 w-4 text-dim" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className="btn-secondary p-2"
            title={theme === 'dark' ? 'Đổi sang Quán Trọ Sáng (Light)' : 'Đổi sang Hầm Ngục Tối (Dark)'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600" />
            )}
          </button>

          {onOpenReset && (
            <button
              type="button"
              onClick={onOpenReset}
              className="btn-secondary p-2 text-rose-400 hover:text-rose-300"
              title="Reset tiến trình"
              aria-label="Reset tiến trình"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-secondary p-2"
            title="Cài đặt AI & SQLite Vault"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
