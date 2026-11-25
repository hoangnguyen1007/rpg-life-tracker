import React, { useMemo } from 'react';
import type {
  AttributeKey,
  AuditLogEntry,
  DailyProgressSnapshot,
  PlayerGrowthBonuses,
  PlayerState,
  Quest,
  StorageInfoPayload,
} from '../types/system';
import {
  PixelCheckpointCrystal,
  PixelHeroSprite,
  PixelTombstone,
} from './DungeonSprites';
import {
  PixelRivets,
  PxBook,
  PxCheck,
  PxClock,
  PxCoin,
  PxCrown,
  PxFlame,
  PxGem,
  PxMoon,
  PxScroll,
  PxShield,
  PxSkillTree,
  PxStar,
  PxStatAgi,
  PxStatCha,
  PxStatInt,
  PxStatPer,
  PxStatStr,
  PxStatVit,
} from './PixelIcons';
import { getVnTodayKey } from '../utils/timeVn';

interface StatusWindowProps {
  player: PlayerState;
  dailySnapshots: DailyProgressSnapshot[];
  storageInfo: StorageInfoPayload;
  auditLogs?: AuditLogEntry[];
  growthBonuses?: PlayerGrowthBonuses;
  quests?: Quest[];
  onSelectTitle: (title: string) => void;
}

const STAT_META: Array<{
  key: AttributeKey;
  label: string;
  desc: string;
  barHex: string;
  textVar: string;
  Icon: React.FC<{ size?: number; color?: string; className?: string }>;
}> = [
  {
    key: 'INT',
    label: 'Intelligence',
    desc: 'Tư duy hệ thống, Phân tích & Chuyên môn',
    barHex: '#3267a8',
    textVar: 'var(--px-blue-text)',
    Icon: PxStatInt,
  },
  {
    key: 'PER',
    label: 'Perception',
    desc: 'Ngoại ngữ, Nghiên cứu & Tổng hợp tri thức',
    barHex: '#2f7d8c',
    textVar: 'var(--px-blue-text)',
    Icon: PxStatPer,
  },
  {
    key: 'AGI',
    label: 'Agility',
    desc: 'Tốc độ Deep Work & Timeboxing',
    barHex: '#2e8b57',
    textVar: 'var(--px-green-text)',
    Icon: PxStatAgi,
  },
  {
    key: 'STR',
    label: 'Strength',
    desc: 'Thể lực & Sức mạnh cơ bắp',
    barHex: '#c99330',
    textVar: 'var(--px-gold-text)',
    Icon: PxStatStr,
  },
  {
    key: 'VIT',
    label: 'Vitality',
    desc: 'Giấc ngủ, Phục hồi & Chống kiệt sức',
    barHex: '#b83a4b',
    textVar: 'var(--px-red-text)',
    Icon: PxStatVit,
  },
  {
    key: 'CHA',
    label: 'Charisma',
    desc: 'Giao tiếp, Thuyết phục & Kỹ năng mềm',
    barHex: '#73499e',
    textVar: 'var(--px-plum-text)',
    Icon: PxStatCha,
  },
];

const RANK_THRESHOLDS = [
  { rank: 'E-Rank', min: 0 },
  { rank: 'D-Rank', min: 100 },
  { rank: 'C-Rank', min: 250 },
  { rank: 'B-Rank', min: 550 },
  { rank: 'A-Rank', min: 1000 },
  { rank: 'S-Rank', min: 1600 },
  { rank: 'National Level', min: 2500 },
];

function formatLocalDateKey(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseVnDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
}

export const StatusWindow: React.FC<StatusWindowProps> = ({
  player,
  dailySnapshots,
  storageInfo: _storageInfo,
  auditLogs: _auditLogs = [],
  growthBonuses,
  quests = [],
  onSelectTitle,
}) => {
  const svgW = 360;
  const svgH = 290;
  const centerX = svgW / 2;
  const centerY = svgH / 2;
  const maxRadius = 86;
  const maxStatValue = Math.max(40, ...Object.values(player.stats)) + 5;

  const points = STAT_META.map((item, index) => {
    const angle = (Math.PI * 2 * index) / STAT_META.length - Math.PI / 2;
    const val = player.stats[item.key] || 10;
    const r = (val / maxStatValue) * maxRadius;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const textAnchor: 'start' | 'end' | 'middle' =
      Math.abs(cosA) < 0.15 ? 'middle' : cosA > 0 ? 'start' : 'end';
    return {
      ...item,
      value: val,
      x: Math.round(centerX + cosA * r),
      y: Math.round(centerY + sinA * r),
      lx: Math.round(centerX + cosA * (maxRadius + 18)),
      ly: Math.round(centerY + sinA * (maxRadius + 20)),
      ax: Math.round(centerX + cosA * maxRadius),
      ay: Math.round(centerY + sinA * maxRadius),
      textAnchor,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const currentRankIdx = RANK_THRESHOLDS.findIndex((r) => r.rank === player.rank);
  const nextRank = RANK_THRESHOLDS[currentRankIdx + 1];
  const prevMin = RANK_THRESHOLDS[currentRankIdx]?.min ?? 0;
  const masteryPct = nextRank
    ? Math.min(100, Math.round(((player.masteryScore - prevMin) / (nextRank.min - prevMin)) * 100))
    : 100;

  const xpPct = Math.min(
    100,
    Math.round((player.currentXp / Math.max(1, player.xpToNextLevel)) * 100)
  );

  const snapshotByDate = useMemo(
    () => new Map(dailySnapshots.map((s) => [s.dateKey, s])),
    [dailySnapshots]
  );

  const todayKey = getVnTodayKey();

  // Build exact 14-day series (T-13 .. Today in Asia/Ho_Chi_Minh)
  const chart14Days = useMemo(() => {
    const todayUtc = parseVnDateKey(todayKey);
    const list: Array<{
      dateKey: string;
      shortLabel: string;
      xpEarned: number;
      focusMinutes: number;
      isToday: boolean;
    }> = [];
    for (let offset = 13; offset >= 0; offset--) {
      const d = new Date(todayUtc.getTime() - offset * 86400000);
      const key = formatLocalDateKey(d);
      const snap = snapshotByDate.get(key);
      list.push({
        dateKey: key,
        shortLabel: offset === 0 ? 'Nay' : `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
        xpEarned: snap?.xpEarned ?? 0,
        focusMinutes: snap?.focusMinutes ?? 0,
        isToday: offset === 0,
      });
    }
    return list;
  }, [snapshotByDate, todayKey]);

  // Build exact 28-day discipline heatmap (T-27 .. Today in Asia/Ho_Chi_Minh, 4x7 grid)
  const heatmap28Days = useMemo(() => {
    const todayUtc = parseVnDateKey(todayKey);
    const list: Array<{
      dateKey: string;
      questsCompleted: number;
      focusMinutes: number;
      isRestDay: boolean;
      isToday: boolean;
    }> = [];
    for (let offset = 27; offset >= 0; offset--) {
      const d = new Date(todayUtc.getTime() - offset * 86400000);
      const key = formatLocalDateKey(d);
      const snap = snapshotByDate.get(key);
      list.push({
        dateKey: key,
        questsCompleted: snap?.questsCompleted ?? 0,
        focusMinutes: snap?.focusMinutes ?? 0,
        isRestDay: Boolean(snap?.isRestDay),
        isToday: offset === 0,
      });
    }
    return list;
  }, [snapshotByDate, todayKey]);

  const max14Xp = Math.max(100, ...chart14Days.map((d) => d.xpEarned));
  const max14Focus = Math.max(60, ...chart14Days.map((d) => d.focusMinutes));

  const consistent28Count = heatmap28Days.filter(
    (d) => d.questsCompleted > 0 || d.isRestDay
  ).length;
  const consistency28Pct = Math.round((consistent28Count / 28) * 100);

  const todayQuests = quests.filter((q) => q.dateKey === todayKey && q.status !== 'rejected');
  const todayCompleted = todayQuests.filter((q) => q.status === 'completed').length;
  const totalFocusMins = dailySnapshots.reduce((acc, s) => acc + (s.focusMinutes || 0), 0);
  const totalFocusHours = (totalFocusMins / 60).toFixed(1);

  const cp = player.currentCheckpoint;

  return (
    <div className="space-y-4">
      {/* Top Hero Plaque & 4 Discipline KPI Blocks */}
      <section className="rpg-window relative p-5">
        <PixelRivets />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="px-inset flex h-20 w-20 shrink-0 items-center justify-center border-2 border-[var(--px-gold)]">
              <PixelHeroSprite
                avatarStyle={player.profile.avatarStyle}
                rank={player.rank}
                size={64}
                className="anim-hero-idle"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-2 py-0.5 font-pixel text-[10px] font-bold text-[#140e04]">
                  {player.rank}
                </span>
                <span className="font-mono text-xs text-dim">{player.hunterClass}</span>
              </div>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-main">
                {player.profile.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sub">
                <span>
                  Danh hiệu:{' '}
                  <strong className="text-[var(--px-gold-text)]">{player.activeTitle}</strong>
                </span>
                <span className="inline-flex items-center gap-1 font-mono font-bold text-[var(--px-plum-text)]">
                  <PxSkillTree size={12} /> {player.skillPoints ?? 0} SP
                </span>
                <span className="inline-flex items-center gap-1 font-mono font-bold text-[var(--px-gold-text)]">
                  <PxCoin size={12} /> {player.gold} Gold
                </span>
                <span className="inline-flex items-center gap-1 font-mono font-bold text-[var(--px-blue-text)]">
                  <PxGem size={12} /> {player.runestones}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[440px]">
            <div className="px-inset p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--px-blue-text)]">
                <span>Cấp Độ (Lv.{player.level})</span>
                <PxStar size={14} color="var(--px-blue-text)" />
              </div>
              <p className="mt-1 font-mono text-base font-bold text-main">
                {player.currentXp} / {player.xpToNextLevel} XP
              </p>
              <div className="rpg-bar-track mt-2 h-3 w-full">
                <div
                  className="h-full"
                  style={{ width: `${xpPct}%`, backgroundColor: '#3267a8' }}
                />
              </div>
            </div>

            <div className="px-inset p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--px-gold-text)]">
                <span>Thực Lực ({player.rank})</span>
                <PxCrown size={15} />
              </div>
              <p className="mt-1 font-mono text-base font-bold text-main">
                {player.masteryScore}{' '}
                <span className="text-xs font-normal text-dim">
                  {nextRank ? `/ ${nextRank.min} (${nextRank.rank})` : 'MAX'}
                </span>
              </p>
              <div className="rpg-bar-track mt-2 h-3 w-full">
                <div
                  className="h-full"
                  style={{ width: `${masteryPct}%`, backgroundColor: '#c99330' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Visual KPI Blocks */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t-2 pt-4 lg:grid-cols-4 studio-divider">
          <div className="px-inset flex items-center gap-3 px-3.5 py-2.5">
            <PxFlame size={20} />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">
                Chuỗi Kỷ Luật
              </div>
              <div className="font-mono text-sm font-extrabold text-main">
                {player.streakDays} ngày
              </div>
            </div>
          </div>

          <div className="px-inset flex items-center gap-3 px-3.5 py-2.5">
            <PxSkillTree size={20} color="var(--px-plum-text)" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">
                Kĩ Năng Đã Nâng
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm font-extrabold text-main">
                <span>{growthBonuses?.totalSkillLevels ?? 0} cấp</span>
                {(growthBonuses?.totalAscensions ?? 0) > 0 && (
                  <span className="rounded-none border border-[var(--border-ink)] bg-[var(--px-gold)] px-1.5 py-0.5 text-[10px] font-bold text-[#140e04]">
                    {growthBonuses!.totalAscensions} ∞
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-inset flex items-center gap-3 px-3.5 py-2.5">
            <PxClock size={20} color="var(--px-blue-text)" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">
                Tổng Giờ Focus
              </div>
              <div className="font-mono text-sm font-extrabold text-main">
                {totalFocusHours}h{' '}
                <span className="text-[11px] font-normal text-dim">
                  ({todayCompleted}/{todayQuests.length} nay)
                </span>
              </div>
            </div>
          </div>

          <div className="px-inset flex items-center gap-3 px-3.5 py-2.5">
            <div className="flex shrink-0 items-center gap-1">
              <PixelCheckpointCrystal size={20} />
              <PixelTombstone size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">
                Checkpoint
              </div>
              <div className="flex items-center gap-1 truncate font-mono text-xs font-extrabold text-main">
                <PxShield size={12} color="var(--px-gold-text)" />
                <span>
                  Ch.{cp?.chapterNumber ?? 1}-{cp?.stageNumber ?? 1}
                </span>
                <span className="font-normal text-dim">
                  ({player.deathCount ?? 0} lần gục)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 14-Day Pixel Growth Chart + 28-Day Discipline Heatmap */}
      <section className="rpg-pane relative overflow-hidden">
        <PixelRivets />
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Biểu Đồ Tăng Trưởng 14 Ngày */}
          <div className="p-5 lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-extrabold text-main">
                  Biểu Đồ Tăng Trưởng 14 Ngày
                </h3>
                <p className="text-[11px] text-dim">
                  Cột vàng: XP kiếm được · Cột xanh lam: Phút tập trung thực tế
                </p>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-sub">
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 border border-[var(--border-ink)]"
                    style={{ backgroundColor: '#c99330' }}
                  />{' '}
                  XP
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 border border-[var(--border-ink)]"
                    style={{ backgroundColor: '#3267a8' }}
                  />{' '}
                  Focus (phút)
                </span>
              </div>
            </div>

            <div className="px-inset p-3">
              <svg
                viewBox="0 0 560 156"
                shapeRendering="crispEdges"
                className="w-full"
                role="img"
                aria-label="14-day XP and Focus growth chart"
              >
                {[20, 50, 80, 110].map((y) => (
                  <line
                    key={y}
                    x1="8"
                    y1={y}
                    x2="552"
                    y2={y}
                    stroke="var(--border-hairline)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                ))}
                <line
                  x1="8"
                  y1="126"
                  x2="552"
                  y2="126"
                  stroke="var(--border-ink)"
                  strokeWidth="2"
                />

                {chart14Days.map((day, idx) => {
                  const slotW = 544 / 14;
                  const baseX = Math.round(8 + idx * slotW);
                  const xpH =
                    day.xpEarned > 0
                      ? Math.max(6, Math.round((day.xpEarned / max14Xp) * 100))
                      : 3;
                  const focusH =
                    day.focusMinutes > 0
                      ? Math.max(6, Math.round((day.focusMinutes / max14Focus) * 100))
                      : 3;

                  return (
                    <g key={day.dateKey}>
                      <title>
                        {day.dateKey}: +{day.xpEarned} XP · {day.focusMinutes} phút focus
                      </title>
                      {/* Flat 16-bit Gold XP Bar */}
                      <rect
                        x={baseX + 5}
                        y={126 - xpH}
                        width={12}
                        height={xpH}
                        fill={day.xpEarned > 0 ? '#c99330' : 'var(--border-hairline)'}
                      />
                      {day.xpEarned > 0 && (
                        <rect
                          x={baseX + 5}
                          y={126 - xpH}
                          width={12}
                          height={2}
                          fill="#f0c46c"
                        />
                      )}
                      {/* Flat 16-bit Cobalt Focus Bar */}
                      <rect
                        x={baseX + 19}
                        y={126 - focusH}
                        width={12}
                        height={focusH}
                        fill={day.focusMinutes > 0 ? '#3267a8' : 'var(--border-hairline)'}
                      />
                      {day.focusMinutes > 0 && (
                        <rect
                          x={baseX + 19}
                          y={126 - focusH}
                          width={12}
                          height={2}
                          fill="#74ace8"
                        />
                      )}
                      {/* Date Label */}
                      {(idx % 2 === 0 || day.isToday) && (
                        <text
                          x={Math.round(baseX + slotW / 2)}
                          y="144"
                          textAnchor="middle"
                          fill={day.isToday ? 'var(--px-gold-text)' : 'var(--text-muted)'}
                          fontSize="9"
                          fontWeight={day.isToday ? '700' : '500'}
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {day.shortLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Right: Bản Đồ Kỷ Luật 28 Ngày (4x7 Pixel Discipline Heatmap) */}
          <div className="border-t-2 p-5 lg:col-span-5 lg:border-l-2 lg:border-t-0 studio-divider">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-extrabold text-main">
                  Bản Đồ Kỷ Luật 28 Ngày
                </h3>
                <p className="text-[11px] text-dim">
                  Ổn định {consistency28Pct}% ({consistent28Count}/28 ngày)
                </p>
              </div>
              <span className="rounded-none border-2 border-[var(--border-ink)] bg-[#2e8b57] px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                {consistency28Pct}%
              </span>
            </div>

            <div className="px-inset p-3">
              <div className="grid grid-cols-7 gap-1.5">
                {heatmap28Days.map((cell) => {
                  let cls =
                    'bg-[#dfd1b5] text-[#6e5c45] dark:bg-[#182921] dark:text-[#7c9c8b]';
                  if (cell.isRestDay) {
                    cls = 'bg-[#3267a8] text-white';
                  } else if (cell.questsCompleted >= 5) {
                    cls = 'bg-[#c99330] text-[#140e04]';
                  } else if (cell.questsCompleted >= 3) {
                    cls = 'bg-[#2e8b57] text-white dark:bg-[#38a169] dark:text-white';
                  } else if (cell.questsCompleted >= 1) {
                    cls =
                      'bg-[#7ab892] text-[#0e2a1b] dark:bg-[#224a34] dark:text-[#b7e0c6]';
                  }

                  return (
                    <div
                      key={cell.dateKey}
                      title={`${cell.dateKey}: ${
                        cell.isRestDay
                          ? 'Grace Day (Nghỉ chủ động)'
                          : `${cell.questsCompleted} nhiệm vụ · ${cell.focusMinutes}p focus`
                      }`}
                      className={`flex h-9 flex-col items-center justify-center rounded-none border-2 border-[var(--border-ink)] font-mono text-[9px] leading-none ${cls} ${
                        cell.isToday
                          ? 'outline outline-2 outline-offset-1 outline-[var(--px-gold)]'
                          : ''
                      }`}
                    >
                      <span className="font-bold">{cell.dateKey.slice(8)}</span>
                      <span className="mt-0.5 text-[8px] opacity-90">
                        {cell.isRestDay
                          ? 'REST'
                          : cell.questsCompleted > 0
                          ? `${cell.questsCompleted}`
                          : '·'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-2 pt-2 font-mono text-[10px] text-dim studio-divider">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 border border-[var(--border-ink)] bg-[#dfd1b5] dark:bg-[#182921]" />{' '}
                  0
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 border border-[var(--border-ink)]"
                    style={{ backgroundColor: '#3267a8' }}
                  />{' '}
                  Grace
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 border border-[var(--border-ink)] bg-[#7ab892] dark:bg-[#224a34]" />{' '}
                  1–2
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 border border-[var(--border-ink)] bg-[#2e8b57] dark:bg-[#38a169]" />{' '}
                  3–4
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 border border-[var(--border-ink)]"
                    style={{ backgroundColor: '#c99330' }}
                  />{' '}
                  5+
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6-Stat Pixel Cards & 6-Axis Radar Chart */}
      <section className="rpg-window relative overflow-hidden">
        <PixelRivets />
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="p-5 lg:col-span-7">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-extrabold text-main">
                6 Chỉ Số Anh Hùng
              </h3>
              <span className="font-pixel text-[9px] text-[var(--px-gold-text)]">
                16-BIT ATTRIBUTES
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {STAT_META.map((stat) => {
                const val = player.stats[stat.key] || 0;
                const barPct = Math.min(100, Math.round((val / maxStatValue) * 100));
                const StatIcon = stat.Icon;
                return (
                  <div key={stat.key} className="px-inset p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)]">
                          <StatIcon size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-pixel text-[11px] font-bold"
                              style={{ color: stat.textVar }}
                            >
                              {stat.key}
                            </span>
                            <span className="truncate text-xs font-bold text-main">
                              {stat.label}
                            </span>
                          </div>
                          <p className="truncate text-[10px] text-dim">{stat.desc}</p>
                        </div>
                      </div>
                      <span className="shrink-0 font-pixel text-sm font-bold text-main">
                        {val}
                      </span>
                    </div>
                    <div className="rpg-bar-track mt-2.5 h-2.5 w-full">
                      <div
                        className="h-full"
                        style={{ width: `${barPct}%`, backgroundColor: stat.barHex }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Skill Growth Passive Multipliers */}
            {growthBonuses && (
              <div className="mt-4 border-t-2 pt-3.5 studio-divider">
                <p className="mb-2 text-xs font-bold text-sub">
                  Hệ Số Bổ Trợ Từ Cây Kĩ Năng:
                </p>
                <div className="flex flex-wrap gap-2 font-mono text-[11px] font-bold">
                  <span className="px-inset px-2.5 py-1 text-[var(--px-plum-text)]">
                    +{growthBonuses.xpBonusPct}% XP
                  </span>
                  <span className="px-inset px-2.5 py-1 text-[var(--px-gold-text)]">
                    +{growthBonuses.goldBonusPct}% Gold
                  </span>
                  <span className="px-inset px-2.5 py-1 text-[var(--px-blue-text)]">
                    +{growthBonuses.masteryBonusPct}% Mastery
                  </span>
                  <span className="px-inset inline-flex items-center gap-1 px-2.5 py-1 text-[var(--px-red-text)]">
                    Max {growthBonuses.maxHearts} <PxStatVit size={12} />
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 border-t-2 pt-3.5 studio-divider">
              <p className="mb-2 text-xs font-bold text-sub">
                Danh hiệu đã mở khóa (bấm để trang bị):
              </p>
              <div className="flex flex-wrap gap-2">
                {player.unlockedTitles.map((t) => {
                  const active = t === player.activeTitle;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onSelectTitle(t)}
                      className={`inline-flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs font-semibold ${
                        active ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {active && <PxCheck size={12} />}
                      <span>{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between border-t-2 p-5 lg:col-span-5 lg:border-l-2 lg:border-t-0 studio-divider">
            <div className="w-full">
              <h3 className="font-display text-base font-extrabold text-main">
                Biểu Đồ Cân Bằng 6 Trục
              </h3>
              <p className="text-xs text-dim">
                Phản ánh phát triển toàn diện trí tuệ, thể lực và ảnh hưởng
              </p>
            </div>

            <div className="px-inset my-3 flex w-full items-center justify-center p-2">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[330px]">
                {[0.25, 0.5, 0.75, 1].map((scale) => {
                  const ringPts = STAT_META.map((_, idx) => {
                    const angle = (Math.PI * 2 * idx) / STAT_META.length - Math.PI / 2;
                    const r = maxRadius * scale;
                    return `${Math.round(centerX + Math.cos(angle) * r)},${Math.round(
                      centerY + Math.sin(angle) * r
                    )}`;
                  }).join(' ');
                  return (
                    <polygon
                      key={scale}
                      points={ringPts}
                      fill="none"
                      stroke="var(--border-strong)"
                      strokeWidth="1.5"
                    />
                  );
                })}
                {points.map((p) => (
                  <line
                    key={p.key}
                    x1={centerX}
                    y1={centerY}
                    x2={p.ax}
                    y2={p.ay}
                    stroke="var(--border-hairline)"
                    strokeWidth="1"
                  />
                ))}
                <polygon
                  points={polygonPoints}
                  fill="#c99330"
                  fillOpacity="0.24"
                  stroke="#c99330"
                  strokeWidth="2.5"
                />
                {points.map((p) => (
                  <g key={p.key}>
                    <rect
                      x={p.x - 4}
                      y={p.y - 4}
                      width="8"
                      height="8"
                      fill={p.barHex}
                      stroke="var(--border-ink)"
                      strokeWidth="1.5"
                      shapeRendering="crispEdges"
                    />
                    <text
                      x={p.lx}
                      y={p.ly}
                      textAnchor={p.textAnchor}
                      dominantBaseline="middle"
                      fill="var(--text-primary)"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {p.key} ({p.value})
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="w-full border-t-2 pt-3 studio-divider">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-main">
                <PxStar size={14} />
                <span>Thành Tựu ({player.achievements.length})</span>
              </div>
              <div className="space-y-1.5 text-xs text-sub">
                {player.achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className="px-inset flex items-center justify-between gap-2 px-2.5 py-1.5"
                  >
                    <span className="font-medium text-main">{ach.title}</span>
                    <span className="font-pixel text-[9px] text-[var(--px-gold-text)]">
                      {ach.rarity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Reflections & Recent Snapshots Ledger */}
      <section className="rpg-pane relative p-5">
        <PixelRivets />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PxScroll size={16} color="var(--px-gold-text)" />
            <h3 className="font-display text-base font-extrabold text-main">
              Nhật Ký Rèn Luyện &amp; Phản Tư Từng Ngày
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-dim">
            <PxBook size={13} />
            {dailySnapshots.filter((s) => Boolean(s.reflectionNote?.trim())).length} phản tư
          </span>
        </div>

        {dailySnapshots.length === 0 ? (
          <p className="text-xs text-dim">
            Hoàn thành nhiệm vụ hoặc ghi nhật ký phản tư để bắt đầu lưu lịch sử theo ngày.
          </p>
        ) : (
          <div className="px-inset overflow-x-auto p-2">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b-2 text-dim studio-divider">
                <tr>
                  <th className="py-2 pr-2">Ngày</th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  <th className="py-2 pr-2">Quests</th>
                  <th className="py-2 pr-2">Focus</th>
                  <th className="py-2 pr-2">XP</th>
                  <th className="py-2 pr-2">Mastery</th>
                  <th className="py-2">Phản tư</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 studio-divider">
                {dailySnapshots.slice(0, 14).map((s) => (
                  <tr key={s.dateKey} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-2 font-semibold text-main">
                      {s.dateKey}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-2">
                      {s.isRestDay ? (
                        <span className="inline-flex items-center gap-1 rounded-none border-2 border-[var(--border-ink)] bg-[#3267a8] px-1.5 py-0.5 font-sans text-[11px] font-semibold text-white">
                          <PxMoon size={11} color="#ffffff" /> Nghỉ chủ động
                        </span>
                      ) : s.questsCompleted > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-none border-2 border-[var(--border-ink)] bg-[#2e8b57] px-1.5 py-0.5 font-sans text-[11px] font-semibold text-white">
                          <PxFlame size={11} /> Thực chiến
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-sans text-[11px] text-dim">
                          Chưa hoàn thành
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-sub">{s.questsCompleted}</td>
                    <td className="py-2 pr-2 text-sub">{s.focusMinutes}p</td>
                    <td className="py-2 pr-2 font-bold text-[var(--px-green-text)]">
                      +{s.xpEarned}
                    </td>
                    <td className="py-2 pr-2 font-bold text-[var(--px-gold-text)]">
                      +{s.masteryEarned}
                    </td>
                    <td className="min-w-[160px] py-2 font-sans text-xs text-sub">
                      {s.reflectionNote?.trim() ? (
                        <span className="italic text-main">
                          &ldquo;{s.reflectionNote}&rdquo;
                        </span>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
