import React, { useEffect, useState } from 'react';
import {
  PixelRivets,
  PxBolt,
  PxCheck,
  PxClock,
  PxCoin,
  PxFlame,
  PxGem,
  PxLock,
  PxRefresh,
  PxShield,
  PxSkull,
  PxSparkle,
  PxStar,
  PxSword,
  PxTarget,
  PxWarn,
} from './PixelIcons';
import { PxTreasureChest, RaidBossSprite } from './RaidBossSprites';
import type {
  RaidChest,
  RaidChestId,
  RaidCombatEvent,
  RaidDifficultyTier,
  WeeklyRaidPayload,
} from '../types/system';
import { soundEngine } from '../utils/soundEngine';
import { getVnTodayKey } from '../utils/timeVn';

export interface WeeklyRaidBossArenaProps {
  data: WeeklyRaidPayload | null;
  loading?: boolean;
  onChangeDifficulty: (tier: RaidDifficultyTier) => Promise<void>;
  onClaimChest: (chestId: RaidChestId) => Promise<void>;
  onRegenerateAi: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

const DIFFICULTY_TIERS: Array<{
  tier: RaidDifficultyTier;
  label: string;
  multLabel: string;
  hint: string;
}> = [
  {
    tier: 'B',
    label: 'B-Rank Cân bằng',
    multLabel: 'x1.0',
    hint: 'Mục tiêu vừa sức theo nhịp tuần thực tế',
  },
  {
    tier: 'A',
    label: 'A-Rank Thử thách',
    multLabel: 'x1.35',
    hint: 'Máu Boss +35%, thưởng rương & danh hiệu cao hơn',
  },
  {
    tier: 'S',
    label: 'S-Rank Ác mộng',
    multLabel: 'x1.75',
    hint: 'Máu Boss +75% dành cho tuần nước rút kỷ luật cao',
  },
];

function formatCountdownVn(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return `Còn ${days} ngày ${hours}g ${mins}p`;
}

function stripOuterQuotes(text: string): string {
  return text.trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
}

function formatCombatTimeVn(timestamp: string): string {
  try {
    const dt = new Date(timestamp);
    if (Number.isNaN(dt.getTime())) {
      return timestamp.slice(11, 16);
    }
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dt);
  } catch {
    return timestamp.slice(11, 16);
  }
}

function getCombatEventTone(kind: RaidCombatEvent['kind']): {
  badgeText: string;
  badgeCls: string;
  amountCls: string;
  prefix: string;
} {
  switch (kind) {
    case 'deep_work':
      return {
        badgeText: 'DEEP WORK',
        badgeCls: 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]',
        amountCls: 'text-[var(--px-green-text)]',
        prefix: '-',
      };
    case 'study':
      return {
        badgeText: 'STUDY',
        badgeCls: 'border-[var(--px-blue)] bg-[var(--bg-surface-2)] text-[var(--px-blue-text)]',
        amountCls: 'text-[var(--px-blue-text)]',
        prefix: '-',
      };
    case 'quest':
      return {
        badgeText: 'QUEST',
        badgeCls: 'border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]',
        amountCls: 'text-[var(--px-gold-text)]',
        prefix: '-',
      };
    case 'overkill':
      return {
        badgeText: 'OVERKILL',
        badgeCls: 'border-[var(--px-plum)] bg-[var(--bg-surface-2)] text-[var(--px-plum-text)]',
        amountCls: 'text-[var(--px-plum-text)]',
        prefix: '-',
      };
    case 'dark_regen':
      return {
        badgeText: 'DARK REGEN',
        badgeCls: 'border-[var(--px-red)] bg-[var(--bg-surface-2)] text-[var(--px-red-text)]',
        amountCls: 'text-[var(--px-red-text)]',
        prefix: '+',
      };
    case 'boss_strike':
      return {
        badgeText: 'BOSS STRIKE',
        badgeCls: 'border-[var(--px-red)] bg-[var(--bg-surface-2)] text-[var(--px-red-text)]',
        amountCls: 'text-[var(--px-red-text)]',
        prefix: '+',
      };
    default:
      return {
        badgeText: 'SYSTEM',
        badgeCls: 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-sub',
        amountCls: 'text-sub',
        prefix: '',
      };
  }
}

function getChestCardHeading(chest: RaidChest): string {
  if (chest.id === 'victory') return '0% Đại Thắng';
  if (chest.id === 'overkill') return 'Rương Overkill';
  return `Mốc ${chest.hpThresholdPct}% HP`;
}

export const WeeklyRaidBossArena: React.FC<WeeklyRaidBossArenaProps> = ({
  data,
  loading = false,
  onChangeDifficulty,
  onClaimChest,
  onRegenerateAi,
  onRefresh,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState<number>(
    data?.secondsUntilReset ?? 0
  );

  useEffect(() => {
    setCountdownSec(data?.secondsUntilReset ?? 0);
  }, [data?.secondsUntilReset]);

  useEffect(() => {
    if (!data || data.secondsUntilReset <= 0) return;
    const id = window.setInterval(() => {
      setCountdownSec((prev) => Math.max(0, prev - 30));
    }, 30000);
    return () => window.clearInterval(id);
  }, [data?.secondsUntilReset]);

  const runBusy = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  if (!data) {
    return (
      <section className="studio-surface relative p-8 text-center">
        <PixelRivets />
        <PxSkull size={32} className="mx-auto text-[var(--px-red-text)]" />
        <h3 className="mt-3 font-display text-base font-extrabold text-main">
          Boss Đột Kích Tuần
        </h3>
        <p className="mt-1 text-xs text-sub">
          {loading
            ? 'Đang triệu hồi Boss Tuần từ Hầm Ngục...'
            : 'Chưa tải được dữ liệu Boss Đột Kích Tuần.'}
        </p>
        <button
          type="button"
          disabled={loading || busyKey === 'refresh'}
          onClick={() => runBusy('refresh', onRefresh)}
          className="btn-primary mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs"
        >
          {loading || busyKey === 'refresh' ? (
            <PxRefresh size={14} className="animate-spin" />
          ) : (
            <PxRefresh size={14} />
          )}
          <span>Tải Boss Đột Kích</span>
        </button>
      </section>
    );
  }

  const {
    raid,
    history,
    todayDistractionMinutes,
    distractionBudgetMinutes,
    bossDamageBonusPct,
    focusScoreToday,
    streakDays,
    canChangeDifficulty,
    canRegenerateAi,
    justSettledPenalty,
  } = data;

  const isDefeated = raid.status === 'defeated' || raid.currentHp <= 0;
  const hpRatio = raid.maxHp > 0 ? Math.max(0, Math.min(1, raid.currentHp / raid.maxHp)) : 0;
  const hpPct = Math.round(hpRatio * 100);
  const isEnraged = !isDefeated && raid.currentHp > 0 && hpRatio < 0.3;

  const todayKey = getVnTodayKey();
  const darkRegenTriggeredToday = raid.regenAppliedDates.includes(todayKey);
  const isOverDistraction = todayDistractionMinutes > distractionBudgetMinutes;
  const distractionPct = Math.min(
    100,
    Math.round((todayDistractionMinutes / Math.max(1, distractionBudgetMinutes)) * 100)
  );

  const milestoneChests = raid.chests.filter((c) => c.id !== 'overkill');
  const overkillChest = raid.chests.find((c) => c.id === 'overkill');
  const orderedChests = overkillChest ? [...milestoneChests, overkillChest] : milestoneChests;

  return (
    <div className="space-y-4">
      {/* Previous Week Penalty Settlement Notice (if applicable) */}
      {justSettledPenalty && (
        <section className="studio-surface relative border-[var(--px-red)] bg-[var(--bg-surface-2)] p-4">
          <PixelRivets />
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <PxWarn size={16} danger />
            <span className="font-display font-extrabold text-[var(--px-red-text)]">
              Tổng kết Raid tuần {justSettledPenalty.weekKey}:
            </span>
            <span className="text-main">
              Chưa hạ được <strong>{justSettledPenalty.bossName}</strong> trước 23:59 Chủ nhật — chịu phạt{' '}
              <strong className="font-mono text-[var(--px-red-text)]">-{justSettledPenalty.hpLost} HP</strong> &amp;{' '}
              <strong className="font-mono text-[var(--px-gold-text)]">-{justSettledPenalty.goldLost} Gold</strong>
              {justSettledPenalty.died ? ' (Kích hoạt Điểm Hồi Sinh)' : ''}.
            </span>
          </div>
        </section>
      )}

      {/* 1) Top Header Strip + Difficulty Tier Selector */}
      <section className="studio-surface relative p-4 sm:p-5">
        <PixelRivets />
        <div className="flex flex-col gap-3 border-b-2 pb-4 lg:flex-row lg:items-center lg:justify-between studio-divider">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <PxSkull size={18} className="text-[var(--px-red-text)]" />
              <h2 className="font-display text-base font-extrabold tracking-tight text-main sm:text-lg">
                BOSS ĐỘT KÍCH TUẦN · {raid.weekKey}
              </h2>
              <span
                className={`font-pixel rounded-none border-2 px-2 py-0.5 text-[9px] font-bold ${
                  raid.generatedBy === 'ai'
                    ? 'border-[var(--px-plum)] bg-[var(--bg-surface-2)] text-[var(--px-plum-text)]'
                    : 'border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]'
                }`}
              >
                {raid.generatedBy === 'ai' ? 'AI GENERATED' : 'LOCAL ROSTER'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-sub">
              <span>
                {raid.weekStartDate} → {raid.weekEndDate}
              </span>
              <span className="text-dim">·</span>
              <span className="px-inset inline-flex items-center gap-1 rounded-none px-2 py-0.5 font-bold text-[var(--px-gold-text)]">
                <PxClock size={12} />
                <span>{formatCountdownVn(countdownSec)}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canRegenerateAi || loading || busyKey === 'regen-ai'}
              onClick={() => runBusy('regen-ai', onRegenerateAi)}
              className="btn-arcane flex items-center gap-1.5 px-3 py-1.5 text-xs"
              title={
                canRegenerateAi
                  ? 'Dùng AI tạo Boss Tuần mới phù hợp mục tiêu hiện tại'
                  : 'Đã hết lượt tạo Boss AI lại hoặc Boss đã bị hạ gục'
              }
            >
              {busyKey === 'regen-ai' ? (
                <PxRefresh size={14} className="animate-spin" />
              ) : (
                <PxSparkle size={14} />
              )}
              <span>Tạo Boss AI mới</span>
            </button>

            <button
              type="button"
              disabled={loading || busyKey === 'refresh'}
              onClick={() => runBusy('refresh', onRefresh)}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              title="Làm mới trạng thái Boss & sát thương Focus"
              aria-label="Làm mới Raid"
            >
              <PxRefresh
                size={14}
                className={loading || busyKey === 'refresh' ? 'animate-spin' : ''}
              />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Difficulty Tier Selector */}
        <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold uppercase text-dim">
              Độ khó tuần:
            </span>
            <div className="px-inset flex flex-wrap items-center gap-1 rounded-none p-1">
              {DIFFICULTY_TIERS.map((opt) => {
                const active = raid.difficultyTier === opt.tier;
                const locked = !canChangeDifficulty || isDefeated || busyKey === `tier-${opt.tier}`;
                return (
                  <button
                    key={opt.tier}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      if (active || locked) return;
                      soundEngine.click();
                      void runBusy(`tier-${opt.tier}`, () => onChangeDifficulty(opt.tier));
                    }}
                    title={
                      isDefeated
                        ? 'Boss tuần này đã bị hạ gục'
                        : !canChangeDifficulty
                          ? 'Không thể đổi độ khó sau khi đã nhận rương hoặc vượt ngưỡng khóa'
                          : opt.hint
                    }
                    className={`rounded-none px-2.5 py-1 font-mono text-[11px] font-bold transition ${
                      active
                        ? 'border-2 border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                        : 'text-sub hover:text-main disabled:opacity-50'
                    }`}
                  >
                    {opt.label} {opt.multLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {(!canChangeDifficulty || isDefeated) && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-dim">
              <PxLock size={12} />
              <span>
                {isDefeated
                  ? 'Đã hạ Boss · Khóa độ khó tuần này'
                  : 'Đã khóa độ khó tuần này'}
              </span>
            </span>
          )}
        </div>
      </section>

      {/* 2) 16-Bit Battle Viewport + Boss Plaque */}
      <section className="studio-surface relative p-4 sm:p-5">
        <PixelRivets />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Framed Dark 16-Bit Dungeon Stage */}
          <div className="lg:col-span-4">
            <div className="relative flex min-h-[210px] flex-col items-center justify-between overflow-hidden rounded-none border-2 border-[var(--border-ink)] bg-[#12101a] p-4 shadow-[inset_2px_2px_0_#09070f,inset_-2px_-2px_0_#2e2942]">
              <PixelRivets />
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-pixel text-[9px] font-bold tracking-wider text-[#847a99]">
                  {raid.difficultyTier}-RANK BOSS
                </span>
                <span
                  className={`font-pixel rounded-none border-2 px-2 py-0.5 text-[9px] font-bold ${
                    isDefeated
                      ? 'border-[#2e8b57] bg-[#163626] text-[#52c484]'
                      : isEnraged
                        ? 'border-[#d94154] bg-[#3b1c26] text-[#e86b7a]'
                        : 'border-[#c99330] bg-[#2b2214] text-[#f0c46c]'
                  }`}
                >
                  {isDefeated
                    ? 'ĐÃ HẠ GỤC · OVERKILL'
                    : isEnraged
                      ? 'CUỒNG NỘ <30%'
                      : 'THƯỜNG'}
                </span>
              </div>

              <div className="my-3 flex items-center justify-center">
                <RaidBossSprite
                  archetype={raid.archetype}
                  size={96}
                  enraged={isEnraged}
                  defeated={isDefeated}
                />
              </div>

              {/* Subtle 16-bit Pixel Dungeon Brick Floor */}
              <div className="w-full">
                <div className="grid grid-cols-8 gap-0.5 border-t-2 border-[#2e2942] pt-1.5">
                  {Array.from({ length: 8 }, (_, idx) => (
                    <span
                      key={idx}
                      className={`h-2 rounded-none border border-[#09070f] ${
                        idx % 2 === 0 ? 'bg-[#211c30]' : 'bg-[#181523]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Boss Lore, Taunt, Weakness & Multipliers */}
          <div className="flex flex-col justify-between gap-3.5 lg:col-span-8">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-display text-xl font-extrabold text-main">
                    {raid.name}
                  </h3>
                  <p className="font-mono text-xs font-bold text-[var(--px-gold-text)]">
                    {raid.title}
                  </p>
                </div>
                <span className="px-inset inline-flex items-center gap-1 rounded-none border-[var(--px-gold)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--px-gold-text)]">
                  <PxStar size={12} />
                  <span>Danh hiệu: {raid.rewardTitle}</span>
                </span>
              </div>

              <p className="text-xs leading-relaxed text-sub">{raid.lore}</p>

              <div className="px-inset rounded-none border-l-4 border-l-[var(--px-red)] px-3 py-2 text-xs italic text-main">
                &ldquo;{stripOuterQuotes(raid.taunt)}&rdquo;
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Weakness Plaque */}
              <div className="px-inset flex flex-wrap items-center justify-between gap-2 rounded-none border-[var(--px-blue)] px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <PxTarget size={15} className="text-[var(--px-blue-text)]" />
                  <span className="font-bold text-main">Điểm Yếu Tuần:</span>
                  <span className="font-semibold text-[var(--px-blue-text)]">
                    {raid.weaknessLabel}
                  </span>
                </div>
                <span className="rounded-none border-2 border-[var(--px-gold)] bg-[var(--bg-surface-2)] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[var(--px-gold-text)]">
                  x{raid.weaknessMultiplier.toFixed(2)} DMG
                </span>
              </div>

              {/* Compact Multiplier Pills */}
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="px-inset inline-flex items-center gap-1.5 rounded-none px-2.5 py-1 font-bold text-[var(--px-green-text)]">
                  <PxBolt size={12} />
                  <span>Focus Score: {focusScoreToday}%</span>
                </span>
                <span className="px-inset inline-flex items-center gap-1.5 rounded-none px-2.5 py-1 font-bold text-[var(--px-gold-text)]">
                  <PxFlame size={12} />
                  <span>Streak: {streakDays}d</span>
                </span>
                <span className="px-inset inline-flex items-center gap-1.5 rounded-none px-2.5 py-1 font-bold text-[var(--px-plum-text)]">
                  <PxSword size={12} />
                  <span>+BOSS: +{bossDamageBonusPct}%</span>
                </span>
                <span className="px-inset inline-flex items-center gap-1.5 rounded-none px-2.5 py-1 text-sub">
                  <span>
                    Đã đánh: <strong className="text-main">{raid.appliedDeepWorkMinutes}p</strong> DW ·{' '}
                    <strong className="text-main">{raid.appliedStudyMinutes}p</strong> Study ·{' '}
                    <strong className="text-main">{raid.appliedQuestIds.length}</strong> Quest
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3) Segmented Boss HP Bar + Interactive Milestone & Victory Chests */}
      <section className="studio-surface relative space-y-4 p-4 sm:p-5">
        <PixelRivets />
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PxSword size={16} className="text-[var(--px-red-text)]" />
              <span className="font-display text-sm font-extrabold text-main">
                Sinh Lực Boss (Boss HP)
              </span>
              {isEnraged && (
                <span className="font-pixel rounded-none border-2 border-[var(--px-red)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--px-red-text)]">
                  ENRAGED
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className="font-extrabold text-main">
                {raid.currentHp.toLocaleString('vi-VN')} / {raid.maxHp.toLocaleString('vi-VN')} HP ({hpPct}%)
              </span>
              <span className="text-[var(--px-gold-text)]">
                Tổng sát thương: <strong>{raid.totalDamageDealt.toLocaleString('vi-VN')} HP</strong>
              </span>
              {raid.overkillDamage > 0 && (
                <span className="rounded-none border border-[var(--px-plum)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--px-plum-text)]">
                  Overkill +{raid.overkillDamage.toLocaleString('vi-VN')}
                </span>
              )}
            </div>
          </div>

          {/* Thick Segmented Pixel HP Track with 25% / 50% / 75% Tick Markers */}
          <div className="rpg-bar-track relative h-6 w-full rounded-none">
            <div
              className="h-full transition-all"
              style={{
                width: `${hpPct}%`,
                backgroundColor: isDefeated
                  ? 'var(--border-strong)'
                  : isEnraged
                    ? '#d94154'
                    : 'var(--px-red)',
              }}
            />
            {[25, 50, 75].map((tick) => (
              <div
                key={tick}
                className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-[var(--px-gold)]"
                style={{ left: `${tick}%` }}
                title={`Mốc rương ${tick}% HP`}
              />
            ))}
          </div>
          <div className="relative mt-1 h-4 font-mono text-[10px] font-bold text-dim">
            <span className="absolute left-0">0%</span>
            <span className="absolute left-1/4 -translate-x-1/2 text-[var(--px-gold-text)]">25%</span>
            <span className="absolute left-1/2 -translate-x-1/2 text-[var(--px-gold-text)]">50%</span>
            <span className="absolute left-3/4 -translate-x-1/2 text-[var(--px-gold-text)]">75%</span>
            <span className="absolute right-0">100%</span>
          </div>
        </div>

        {/* 4 Milestone/Victory Chests + 5th Overkill Vault Card */}
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="font-display text-xs font-extrabold uppercase tracking-wide text-main">
              Rương Kho Báu Mốc HP &amp; Rương Đại Thắng
            </h4>
            <span className="font-mono text-[11px] text-sub">
              Đã mở: <strong className="text-[var(--px-gold-text)]">{raid.chests.filter((c) => c.claimed).length}</strong> / {raid.chests.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {orderedChests.map((chest) => {
              const isGrand = chest.id === 'victory';
              const isOverkill = chest.id === 'overkill';
              const chestVisualState: 'locked' | 'ready' | 'claimed' = chest.claimed
                ? 'claimed'
                : chest.unlocked
                  ? 'ready'
                  : 'locked';
              const highlightOverkill = isOverkill && isDefeated;
              const claimingThis = busyKey === `claim-${chest.id}`;

              return (
                <div
                  key={chest.id}
                  className={`rpg-pane relative flex flex-col justify-between gap-2.5 p-3 ${
                    highlightOverkill
                      ? 'border-[var(--px-plum)] bg-[var(--bg-surface-2)]'
                      : chest.unlocked && !chest.claimed
                        ? 'border-[var(--px-gold)] bg-[var(--bg-surface-2)]'
                        : ''
                  }`}
                >
                  <PixelRivets />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-pixel text-[9px] font-bold text-[var(--px-gold-text)]">
                        {getChestCardHeading(chest)}
                      </div>
                      <div className="mt-0.5 truncate font-display text-xs font-extrabold text-main">
                        {chest.label}
                      </div>
                    </div>
                    <PxTreasureChest
                      state={chestVisualState}
                      size={28}
                      isGrand={isGrand || isOverkill}
                    />
                  </div>

                  {/* Loot Preview */}
                  <div className="px-inset space-y-1 rounded-none p-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[var(--px-gold-text)]">
                      <span className="inline-flex items-center gap-1">
                        <PxCoin size={12} />
                        Gold
                      </span>
                      <strong>+{chest.gold}</strong>
                    </div>
                    {chest.runestones > 0 && (
                      <div className="flex items-center justify-between text-[var(--px-blue-text)]">
                        <span className="inline-flex items-center gap-1">
                          <PxGem size={12} />
                          Runestone
                        </span>
                        <strong>+{chest.runestones}</strong>
                      </div>
                    )}
                    {chest.sp > 0 && (
                      <div className="flex items-center justify-between text-[var(--px-green-text)]">
                        <span className="inline-flex items-center gap-1">
                          <PxStar size={12} />
                          Skill Pt
                        </span>
                        <strong>+{chest.sp} SP</strong>
                      </div>
                    )}
                    {(chest.lootItemName || chest.dropsLootItem) && (
                      <div className="truncate border-t border-[var(--border-hairline)] pt-1 text-[10px] font-bold text-[var(--px-plum-text)]">
                        Loot: {chest.lootItemName || 'Trang bị Boss ngẫu nhiên'}
                      </div>
                    )}
                  </div>

                  {/* Action State */}
                  {chest.claimed ? (
                    <div className="flex items-center justify-center gap-1 rounded-none border-2 border-[var(--px-green)] bg-[var(--bg-subtle)] py-1.5 font-mono text-[11px] font-bold text-[var(--px-green-text)]">
                      <PxCheck size={12} />
                      <span>Đã nhận</span>
                    </div>
                  ) : chest.unlocked ? (
                    <button
                      type="button"
                      disabled={claimingThis}
                      onClick={() =>
                        runBusy(`claim-${chest.id}`, async () => {
                          if (chest.id === 'victory') {
                            soundEngine.levelUp();
                          } else {
                            soundEngine.coinLoot();
                          }
                          await onClaimChest(chest.id);
                        })
                      }
                      className={`${
                        isGrand || isOverkill ? 'btn-arcane' : 'btn-primary'
                      } flex w-full items-center justify-center gap-1.5 py-1.5 text-xs`}
                    >
                      {claimingThis ? (
                        <PxRefresh size={14} className="animate-spin" />
                      ) : (
                        <PxSparkle size={13} />
                      )}
                      <span>Mở Rương</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-1 rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-subtle)] py-1.5 font-mono text-[11px] font-bold text-dim">
                      <PxLock size={12} />
                      <span>Khóa</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4) Dark Regen Discipline Alert Bar */}
      <section
        className={`studio-surface relative p-4 ${
          darkRegenTriggeredToday || isOverDistraction
            ? 'border-[var(--px-red)] bg-[var(--bg-surface-2)]'
            : ''
        }`}
      >
        <PixelRivets />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-display font-extrabold text-main">
              <PxShield
                size={15}
                className={
                  darkRegenTriggeredToday || isOverDistraction
                    ? 'text-[var(--px-red-text)]'
                    : 'text-[var(--px-green-text)]'
                }
              />
              <span>Kỷ Luật Dark Regen:</span>
            </span>
            <span className="px-inset rounded-none px-2.5 py-1 font-mono text-[11px]">
              Xao nhãng hôm nay:{' '}
              <strong
                className={
                  isOverDistraction
                    ? 'text-[var(--px-red-text)]'
                    : 'text-[var(--px-green-text)]'
                }
              >
                {todayDistractionMinutes}p / {distractionBudgetMinutes}p
              </strong>{' '}
              ({distractionPct}%)
            </span>
            <span
              className={`rounded-none border-2 px-2.5 py-1 font-mono text-[11px] font-bold ${
                darkRegenTriggeredToday
                  ? 'border-[var(--px-red)] bg-[var(--bg-subtle)] text-[var(--px-red-text)]'
                  : 'border-[var(--px-green)] bg-[var(--bg-subtle)] text-[var(--px-green-text)]'
              }`}
            >
              {darkRegenTriggeredToday
                ? 'Boss đã hồi Dark Regen hôm nay (+5%–8% HP)'
                : 'Chưa kích hoạt Dark Regen hôm nay'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--px-red-text)]">
            <PxWarn size={13} danger />
            <span>Chủ nhật 23:59 chưa hạ Boss: -25% HP &amp; -10% Gold</span>
          </div>
        </div>
      </section>

      {/* 5) Clean 2-Column Bottom Section: Combat Log | Past Raid History */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Combat Log */}
        <section className="studio-surface relative p-4 sm:p-5 lg:col-span-7">
          <PixelRivets />
          <div className="mb-3 flex items-center justify-between gap-2 border-b-2 pb-2.5 studio-divider">
            <div className="flex items-center gap-2">
              <PxSword size={15} className="text-[var(--px-gold-text)]" />
              <h3 className="font-display text-sm font-extrabold text-main">
                Nhật Ký Chiến Đấu Tuần Này
              </h3>
            </div>
            <span className="font-mono text-[11px] text-dim">
              {raid.combatLog.length} sự kiện
            </span>
          </div>

          {raid.combatLog.length === 0 ? (
            <div className="px-inset rounded-none p-4 text-center text-xs text-dim">
              Chưa có đòn đánh nào tuần này. Hoàn thành Quest hoặc giữ tập trung Deep Work / Study trên PC để tấn công Boss!
            </div>
          ) : (
            <div className="px-inset max-h-72 divide-y-2 overflow-y-auto rounded-none studio-divider">
              {raid.combatLog.slice(0, 40).map((ev) => {
                const tone = getCombatEventTone(ev.kind);
                return (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={`font-pixel shrink-0 rounded-none border px-1.5 py-0.5 text-[8px] font-bold ${tone.badgeCls}`}
                      >
                        {tone.badgeText}
                      </span>
                      {ev.isCrit && (
                        <span className="font-pixel inline-flex shrink-0 items-center gap-0.5 rounded-none border border-[var(--px-gold)] bg-[var(--px-gold)] px-1 py-0.5 text-[8px] font-bold text-[#140e04]">
                          CRIT
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-main">{ev.label}</div>
                        <div className="truncate font-mono text-[10px] text-dim">
                          {ev.dateKey} · {formatCombatTimeVn(ev.timestamp)}
                          {ev.detail ? ` · ${ev.detail}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-mono">
                      <span className={`text-xs font-extrabold ${tone.amountCls}`}>
                        {tone.prefix}
                        {ev.amount.toLocaleString('vi-VN')} HP
                      </span>
                      {ev.multiplier && ev.multiplier > 1 && (
                        <div className="text-[10px] text-dim">x{ev.multiplier.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Past Weekly Raid History */}
        <section className="studio-surface relative p-4 sm:p-5 lg:col-span-5">
          <PixelRivets />
          <div className="mb-3 flex items-center justify-between gap-2 border-b-2 pb-2.5 studio-divider">
            <div className="flex items-center gap-2">
              <PxSkull size={15} className="text-[var(--px-plum-text)]" />
              <h3 className="font-display text-sm font-extrabold text-main">
                Lịch Sử Raid Các Tuần Trước
              </h3>
            </div>
            <span className="font-mono text-[11px] text-dim">
              {history.length} tuần
            </span>
          </div>

          {history.length === 0 ? (
            <div className="px-inset rounded-none p-5 text-center text-xs text-sub">
              Tuần đầu tiên tham chiến — hạ Boss để lưu chiến tích!
            </div>
          ) : (
            <div className="px-inset max-h-72 divide-y-2 overflow-y-auto rounded-none studio-divider">
              {history.map((item) => {
                const won = item.status === 'defeated';
                return (
                  <div key={item.weekKey} className="space-y-1 px-3 py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-sub">
                            {item.weekKey}
                          </span>
                          <span className="rounded-none border border-[var(--border-ink)] bg-[var(--bg-surface-2)] px-1.5 py-0 font-mono text-[10px] font-bold text-[var(--px-gold-text)]">
                            {item.difficultyTier}-Rank
                          </span>
                        </div>
                        <div className="truncate font-display font-bold text-main">
                          {item.bossName}
                        </div>
                      </div>

                      <span
                        className={`font-pixel shrink-0 rounded-none border-2 px-2 py-0.5 text-[9px] font-bold ${
                          won
                            ? 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]'
                            : 'border-[var(--px-red)] bg-[var(--bg-surface-2)] text-[var(--px-red-text)]'
                        }`}
                      >
                        {won ? 'THẮNG' : 'THẤT BẠI'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-dim">
                      <span>
                        Sát thương: <strong className="text-main">{item.totalDamageDealt.toLocaleString('vi-VN')}</strong> / {item.maxHp.toLocaleString('vi-VN')}
                        {item.overkillDamage > 0 ? ` (+${item.overkillDamage} OK)` : ''}
                      </span>
                      <span>Rương: {item.chestsClaimed}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
