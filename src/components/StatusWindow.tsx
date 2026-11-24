import React, { useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  GitBranch,
  History,
  MessageSquareText,
  Moon,
  TrendingUp,
} from 'lucide-react';
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

const STAT_META: { key: AttributeKey; label: string; desc: string; color: string }[] = [
  { key: 'INT', label: 'Intelligence', desc: 'Tư duy hệ thống, Phân tích & Chuyên môn', color: '#f59e0b' },
  { key: 'PER', label: 'Perception', desc: 'Ngoại ngữ, Nghiên cứu & Tổng hợp tri thức', color: '#06b6d4' },
  { key: 'AGI', label: 'Agility', desc: 'Tốc độ Deep Work & Timeboxing', color: '#8b5cf6' },
  { key: 'STR', label: 'Strength', desc: 'Thể lực & Sức mạnh cơ bắp', color: '#f97316' },
  { key: 'VIT', label: 'Vitality', desc: 'Giấc ngủ, Phục hồi & Chống kiệt sức', color: '#10b981' },
  { key: 'CHA', label: 'Charisma', desc: 'Giao tiếp, Thuyết phục & Kỹ năng mềm', color: '#f43f5e' },
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
      x: centerX + cosA * r,
      y: centerY + sinA * r,
      lx: centerX + cosA * (maxRadius + 16),
      ly: centerY + sinA * (maxRadius + 18),
      ax: centerX + cosA * maxRadius,
      ay: centerY + sinA * maxRadius,
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
      {/* Top Hero & 4 Discipline KPI Blocks */}
      <section className="studio-surface p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[2px] border-2 border-amber-500/50 studio-subtle">
              <PixelHeroSprite
                avatarStyle={player.profile.avatarStyle}
                rank={player.rank}
                size={64}
                className="anim-hero-idle"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-pixel rounded-[2px] border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {player.rank}
                </span>
                <span className="text-xs text-dim">{player.hunterClass}</span>
              </div>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-main">
                {player.profile.name}
              </h2>
              <p className="text-xs text-sub">
                Danh hiệu: <strong className="text-amber-400">{player.activeTitle}</strong> ·{' '}
                {player.skillPoints ?? 0} SP · {player.gold} Gold · {player.runestones} 💎
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[440px]">
            <div className="rounded-[2px] border-2 p-3.5 studio-subtle studio-divider">
              <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                <span>Cấp Độ (Lv.{player.level})</span>
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="mt-1 font-mono text-base font-bold text-main">
                {player.currentXp} / {player.xpToNextLevel} XP
              </p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-[2px] border studio-divider bg-[var(--bg-surface)]">
                <div className="h-full bg-cyan-500" style={{ width: `${xpPct}%` }} />
              </div>
            </div>

            <div className="rounded-[2px] border-2 p-3.5 studio-subtle studio-divider">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span>Thực Lực ({player.rank})</span>
                <Crown className="h-4 w-4" />
              </div>
              <p className="mt-1 font-mono text-base font-bold text-main">
                {player.masteryScore}{' '}
                <span className="text-xs font-normal text-dim">
                  {nextRank ? `/ ${nextRank.min} (${nextRank.rank})` : 'MAX'}
                </span>
              </p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-[2px] border studio-divider bg-[var(--bg-surface)]">
                <div className="h-full bg-amber-500" style={{ width: `${masteryPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Visual KPI Blocks */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t-2 pt-4 lg:grid-cols-4 studio-divider">
          <div className="flex items-center gap-3 rounded-[2px] border-2 px-3.5 py-2.5 studio-subtle studio-divider">
            <Flame className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">Chuỗi Kỷ Luật</div>
              <div className="font-mono text-sm font-extrabold text-main">{player.streakDays} ngày</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[2px] border-2 px-3.5 py-2.5 studio-subtle studio-divider">
            <GitBranch className="h-5 w-5 shrink-0 text-violet-400" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">Kĩ Năng Đã Nâng</div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-sm font-extrabold text-main">
                <span>{growthBonuses?.totalSkillLevels ?? 0} cấp</span>
                {(growthBonuses?.totalAscensions ?? 0) > 0 && (
                  <span className="rounded-[2px] border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                    {growthBonuses!.totalAscensions} ∞
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[2px] border-2 px-3.5 py-2.5 studio-subtle studio-divider">
            <Clock className="h-5 w-5 shrink-0 text-cyan-400" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">Tổng Giờ Focus</div>
              <div className="font-mono text-sm font-extrabold text-main">
                {totalFocusHours}h{' '}
                <span className="text-[11px] font-normal text-dim">
                  ({todayCompleted}/{todayQuests.length} nay)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[2px] border-2 px-3.5 py-2.5 studio-subtle studio-divider">
            <div className="flex shrink-0 items-center gap-1">
              <PixelCheckpointCrystal size={20} />
              <PixelTombstone size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase text-dim">Checkpoint</div>
              <div className="truncate font-mono text-xs font-extrabold text-main">
                🚩 Ch.{cp?.chapterNumber ?? 1}-{cp?.stageNumber ?? 1}{' '}
                <span className="font-normal text-dim">({player.deathCount ?? 0} lần gục)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NEW Visual Growth Charts Row: 14-Day SVG Chart + 28-Day Discipline Heatmap */}
      <section className="studio-surface overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Biểu Đồ Tăng Trưởng 14 Ngày (Pixel SVG Dual-Metric Chart) */}
          <div className="p-5 lg:col-span-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-extrabold text-main">
                  Biểu Đồ Tăng Trưởng 14 Ngày
                </h3>
                <p className="text-[11px] text-dim">
                  Cột vàng: XP kiếm được · Cột xanh: Phút tập trung thực tế
                </p>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-sub">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 bg-amber-400" /> XP
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 bg-cyan-400" /> Focus (phút)
                </span>
              </div>
            </div>

            <div className="rounded-[2px] border-2 p-3 studio-subtle studio-divider">
              <svg viewBox="0 0 560 156" className="w-full" role="img" aria-label="14-day XP and Focus growth chart">
                {/* Horizontal pixel gridlines */}
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
                <line x1="8" y1="126" x2="552" y2="126" stroke="var(--border-strong)" strokeWidth="2" />

                {chart14Days.map((day, idx) => {
                  const slotW = 544 / 14;
                  const baseX = 8 + idx * slotW;
                  const xpH = day.xpEarned > 0 ? Math.max(6, Math.round((day.xpEarned / max14Xp) * 100)) : 3;
                  const focusH =
                    day.focusMinutes > 0
                      ? Math.max(6, Math.round((day.focusMinutes / max14Focus) * 100))
                      : 3;

                  return (
                    <g key={day.dateKey}>
                      <title>
                        {day.dateKey}: +{day.xpEarned} XP · {day.focusMinutes} phút focus
                      </title>
                      {/* Amber XP Bar */}
                      <rect
                        x={baseX + 5}
                        y={126 - xpH}
                        width={12}
                        height={xpH}
                        fill={day.xpEarned > 0 ? '#f59e0b' : 'var(--border-strong)'}
                        opacity={day.xpEarned > 0 ? 1 : 0.45}
                      />
                      {/* Cyan Focus Bar */}
                      <rect
                        x={baseX + 19}
                        y={126 - focusH}
                        width={12}
                        height={focusH}
                        fill={day.focusMinutes > 0 ? '#06b6d4' : 'var(--border-hairline)'}
                        opacity={day.focusMinutes > 0 ? 0.9 : 0.45}
                      />
                      {/* Date Label (every 2 days + Today) */}
                      {(idx % 2 === 0 || day.isToday) && (
                        <text
                          x={baseX + slotW / 2}
                          y="144"
                          textAnchor="middle"
                          className={`fill-current font-mono text-[9px] ${
                            day.isToday ? 'font-bold text-amber-400' : 'text-dim'
                          }`}
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
              <span className="rounded-[2px] border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                {consistency28Pct}%
              </span>
            </div>

            <div className="rounded-[2px] border-2 p-3 studio-subtle studio-divider">
              <div className="grid grid-cols-7 gap-1.5">
                {heatmap28Days.map((cell) => {
                  let cls = 'studio-divider bg-[var(--bg-surface)] text-dim';
                  if (cell.isRestDay) {
                    cls = 'border-teal-500/70 bg-teal-500/20 text-teal-300';
                  } else if (cell.questsCompleted >= 5) {
                    cls = 'border-amber-400 bg-amber-500/35 text-amber-200';
                  } else if (cell.questsCompleted >= 3) {
                    cls = 'border-emerald-500/80 bg-emerald-500/35 text-emerald-200';
                  } else if (cell.questsCompleted >= 1) {
                    cls = 'border-emerald-700/80 bg-emerald-900/50 text-emerald-300';
                  }

                  return (
                    <div
                      key={cell.dateKey}
                      title={`${cell.dateKey}: ${
                        cell.isRestDay
                          ? 'Grace Day (Nghỉ chủ động)'
                          : `${cell.questsCompleted} nhiệm vụ · ${cell.focusMinutes}p focus`
                      }`}
                      className={`flex h-9 flex-col items-center justify-center rounded-[2px] border-2 font-mono text-[9px] leading-none ${cls} ${
                        cell.isToday ? 'ring-1 ring-amber-400' : ''
                      }`}
                    >
                      <span className="font-bold">{cell.dateKey.slice(8)}</span>
                      <span className="mt-0.5 text-[8px] opacity-85">
                        {cell.isRestDay ? 'REST' : cell.questsCompleted > 0 ? `${cell.questsCompleted}` : '·'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 font-mono text-[10px] text-dim studio-divider">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 border border-slate-600 bg-[var(--bg-surface)]" /> 0
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 bg-teal-500/50" /> Grace
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 bg-emerald-800" /> 1–2
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 bg-emerald-500" /> 3–4
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 bg-amber-400" /> 5+
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6-Axis Hero Balance Section & Passive Multipliers */}
      <section className="studio-surface overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="p-5 lg:col-span-7">
            <h3 className="mb-3 font-display text-base font-extrabold text-main">
              6 Chỉ Số Anh Hùng
            </h3>
            <div className="divide-y-2 studio-divider">
              {STAT_META.map((stat) => {
                const val = player.stats[stat.key] || 0;
                const barPct = Math.min(100, Math.round((val / maxStatValue) * 100));
                return (
                  <div key={stat.key} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-pixel text-[10px] font-bold" style={{ color: stat.color }}>
                          {stat.key}
                        </span>{' '}
                        <span className="text-xs font-bold text-main">{stat.label}</span>
                        <span className="ml-2 text-xs text-dim">— {stat.desc}</span>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold text-main">{val}</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-[2px] border studio-divider studio-subtle">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${barPct}%`, backgroundColor: stat.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Skill Growth Passive Multipliers */}
            {growthBonuses && (
              <div className="mt-4 border-t-2 pt-3.5 studio-divider">
                <p className="mb-2 text-xs font-bold text-sub">Hệ Số Bổ Trợ Từ Cây Kĩ Năng:</p>
                <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                  <span className="rounded-[2px] border px-2 py-1 text-indigo-400 studio-subtle studio-divider">
                    +{growthBonuses.xpBonusPct}% XP
                  </span>
                  <span className="rounded-[2px] border px-2 py-1 text-amber-400 studio-subtle studio-divider">
                    +{growthBonuses.goldBonusPct}% Gold
                  </span>
                  <span className="rounded-[2px] border px-2 py-1 text-cyan-400 studio-subtle studio-divider">
                    +{growthBonuses.masteryBonusPct}% Mastery
                  </span>
                  <span className="rounded-[2px] border px-2 py-1 text-rose-400 studio-subtle studio-divider">
                    Max {growthBonuses.maxHearts} ❤️
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 border-t-2 pt-3.5 studio-divider">
              <p className="mb-2 text-xs font-bold text-sub">Danh hiệu đã mở khóa (bấm để trang bị):</p>
              <div className="flex flex-wrap gap-2">
                {player.unlockedTitles.map((t) => {
                  const active = t === player.activeTitle;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onSelectTitle(t)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold ${
                        active ? 'btn-primary' : 'btn-secondary'
                      }`}
                    >
                      {active && <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span>{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between border-t-2 p-5 lg:col-span-5 lg:border-l-2 lg:border-t-0 studio-divider">
            <div className="w-full">
              <h3 className="font-display text-base font-extrabold text-main">Biểu Đồ Cân Bằng 6 Trục</h3>
              <p className="text-xs text-dim">Phản ánh phát triển toàn diện trí tuệ, thể lực và ảnh hưởng</p>
            </div>

            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="my-2 w-full max-w-[340px]">
              {[0.25, 0.5, 0.75, 1].map((scale) => {
                const ringPts = STAT_META.map((_, idx) => {
                  const angle = (Math.PI * 2 * idx) / STAT_META.length - Math.PI / 2;
                  const r = maxRadius * scale;
                  return `${centerX + Math.cos(angle) * r},${centerY + Math.sin(angle) * r}`;
                }).join(' ');
                return (
                  <polygon
                    key={scale}
                    points={ringPts}
                    fill="none"
                    stroke="var(--border-strong)"
                    strokeWidth="1"
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
                fill="rgba(245, 158, 11, 0.2)"
                stroke="#f59e0b"
                strokeWidth="2.5"
              />
              {points.map((p) => (
                <g key={p.key}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill={p.color} stroke="#0b0e16" strokeWidth="1.5" />
                  <text
                    x={p.lx}
                    y={p.ly}
                    textAnchor={p.textAnchor}
                    dominantBaseline="middle"
                    className="fill-current font-mono text-[11px] font-bold text-main"
                  >
                    {p.key} ({p.value})
                  </text>
                </g>
              ))}
            </svg>

            <div className="w-full border-t-2 pt-3 studio-divider">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-main">
                <Award className="h-4 w-4 text-amber-400" />
                <span>Thành Tựu ({player.achievements.length})</span>
              </div>
              <div className="space-y-1.5 text-xs text-sub">
                {player.achievements.map((ach) => (
                  <div key={ach.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium text-main">{ach.title}</span>
                    <span className="font-pixel text-[9px] text-amber-400">{ach.rarity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Reflections & Recent Snapshots Ledger */}
      <section className="studio-surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-base font-extrabold text-main">
              Nhật Ký Rèn Luyện &amp; Phản Tư Từng Ngày
            </h3>
          </div>
          <span className="inline-flex items-center gap-1 font-mono text-xs text-dim">
            <MessageSquareText className="h-3.5 w-3.5" />
            {dailySnapshots.filter((s) => Boolean(s.reflectionNote?.trim())).length} phản tư
          </span>
        </div>

        {dailySnapshots.length === 0 ? (
          <p className="text-xs text-dim">
            Hoàn thành nhiệm vụ hoặc ghi nhật ký phản tư để bắt đầu lưu lịch sử theo ngày.
          </p>
        ) : (
          <div className="overflow-x-auto">
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
                    <td className="whitespace-nowrap py-2 pr-2 font-semibold text-main">{s.dateKey}</td>
                    <td className="whitespace-nowrap py-2 pr-2">
                      {s.isRestDay ? (
                        <span className="inline-flex items-center gap-1 rounded-[2px] border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-sky-300">
                          <Moon className="h-3 w-3" /> Nghỉ chủ động
                        </span>
                      ) : s.questsCompleted > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-[2px] border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-emerald-300">
                          <Flame className="h-3 w-3" /> Thực chiến
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-[2px] border px-1.5 py-0.5 font-sans text-[11px] text-dim studio-divider">
                          Chưa hoàn thành
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-sub">{s.questsCompleted}</td>
                    <td className="py-2 pr-2 text-sub">{s.focusMinutes}p</td>
                    <td className="py-2 pr-2 text-emerald-400">+{s.xpEarned}</td>
                    <td className="py-2 pr-2 text-amber-400">+{s.masteryEarned}</td>
                    <td className="min-w-[160px] py-2 font-sans text-xs text-sub">
                      {s.reflectionNote?.trim() ? (
                        <span className="italic text-main">&ldquo;{s.reflectionNote}&rdquo;</span>
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
