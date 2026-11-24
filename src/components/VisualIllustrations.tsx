import React from 'react';
import type { DayScheduleAnalysis, HunterRank } from '../types/system';

const RANK_PALETTE: Record<HunterRank, { primary: string; secondary: string; badge: string }> = {
  'E-Rank': { primary: '#64748b', secondary: '#94a3b8', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  'D-Rank': { primary: '#059669', secondary: '#34d399', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'C-Rank': { primary: '#0284c7', secondary: '#38bdf8', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  'B-Rank': { primary: '#4f46e5', secondary: '#818cf8', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'A-Rank': { primary: '#7c3aed', secondary: '#a78bfa', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  'S-Rank': { primary: '#d97706', secondary: '#fbbf24', badge: 'bg-amber-50 text-amber-800 border-amber-300' },
  'National Level': { primary: '#e11d48', secondary: '#fb7185', badge: 'bg-rose-50 text-rose-800 border-rose-300' },
};

export function getRankBadgeClass(rank: HunterRank): string {
  return RANK_PALETTE[rank]?.badge || RANK_PALETTE['E-Rank'].badge;
}

/**
 * Illustrated SVG Hunter Crest & Character Silhouette that evolves with Rank
 */
export const HunterAvatarIllustration: React.FC<{
  rank: HunterRank;
  level: number;
  size?: number;
}> = ({ rank, level, size = 64 }) => {
  const palette = RANK_PALETTE[rank] || RANK_PALETTE['E-Rank'];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="shrink-0"
      aria-label="Hunter Avatar"
    >
      <defs>
        <linearGradient id={`grad-${rank.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.primary} />
          <stop offset="100%" stopColor={palette.secondary} />
        </linearGradient>
      </defs>
      {/* Outer Crest Shield */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill={`url(#grad-${rank.replace(/\s/g, '')})`}
        fillOpacity="0.14"
        stroke={palette.primary}
        strokeWidth="2.5"
      />
      {/* Inner Geometric Mantle */}
      <path
        d="M24 78 C26 58, 36 52, 50 52 C64 52, 74 58, 76 78 Z"
        fill={palette.primary}
        fillOpacity="0.85"
      />
      {/* Cloak Collar */}
      <path
        d="M34 56 L50 68 L66 56 L62 49 L50 55 L38 49 Z"
        fill={palette.secondary}
      />
      {/* Head */}
      <circle cx="50" cy="36" r="14" fill="#1e293b" />
      {/* Hair Silhouette */}
      <path
        d="M35 35 C35 23, 44 19, 52 20 C61 20, 66 26, 65 35 C62 30, 56 28, 50 29 C43 28, 38 31, 35 35 Z"
        fill="#0f172a"
      />
      {/* Eyes */}
      <circle cx="45" cy="36" r="1.8" fill={palette.secondary} />
      <circle cx="55" cy="36" r="1.8" fill={palette.secondary} />
      {/* Rank Crown / Star for high ranks */}
      {level >= 3 && (
        <path
          d="M42 15 L46 10 L50 14 L54 10 L58 15 Z"
          fill={palette.primary}
        />
      )}
    </svg>
  );
};

/**
 * Topic-aware SVG Banner Illustration for Bosses & Goals
 */
export const BossBannerIllustration: React.FC<{
  title: string;
  variant?: 'boss' | 'ielts' | 'tech' | 'health' | 'research';
}> = ({ title, variant }) => {
  const lower = title.toLowerCase();
  const mode =
    variant ||
    (lower.includes('ielts') || lower.includes('language') || lower.includes('speaking')
      ? 'ielts'
      : lower.includes('swe') || lower.includes('code') || lower.includes('software') || lower.includes('engineer')
        ? 'tech'
        : lower.includes('research') || lower.includes('paper')
          ? 'research'
          : lower.includes('sức khỏe') || lower.includes('vitality') || lower.includes('gym')
            ? 'health'
            : 'boss');

  const colors = {
    ielts: { bg: '#eef2ff', stroke: '#4f46e5', accent: '#818cf8' },
    tech: { bg: '#f0f9ff', stroke: '#0284c7', accent: '#38bdf8' },
    research: { bg: '#f5f3ff', stroke: '#7c3aed', accent: '#a78bfa' },
    health: { bg: '#ecfdf5', stroke: '#059669', accent: '#34d399' },
    boss: { bg: '#fff1f2', stroke: '#e11d48', accent: '#fb7185' },
  }[mode];

  return (
    <svg viewBox="0 0 240 90" className="h-20 w-full rounded-lg object-cover" aria-hidden="true">
      <rect width="240" height="90" rx="8" fill={colors.bg} fillOpacity="0.16" />
      <circle cx="200" cy="45" r="36" fill={colors.accent} fillOpacity="0.2" />
      <circle cx="210" cy="25" r="18" fill={colors.stroke} fillOpacity="0.15" />
      {mode === 'ielts' && (
        <g stroke={colors.stroke} strokeWidth="2" fill="none">
          <rect x="24" y="22" width="46" height="34" rx="6" fill={colors.accent} fillOpacity="0.18" />
          <path d="M34 34 H60 M34 42 H52" strokeLinecap="round" />
          <path d="M84 52 C84 34, 112 34, 112 52" />
          <circle cx="98" cy="30" r="8" fill={colors.accent} fillOpacity="0.25" />
        </g>
      )}
      {mode === 'tech' && (
        <g stroke={colors.stroke} strokeWidth="2" fill="none">
          <rect x="22" y="20" width="64" height="46" rx="6" fill={colors.accent} fillOpacity="0.18" />
          <path d="M36 38 L44 44 L36 50 M50 50 H64" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="116" cy="43" r="14" strokeDasharray="4 3" />
        </g>
      )}
      {mode === 'health' && (
        <g stroke={colors.stroke} strokeWidth="2.5" fill="none">
          <path d="M22 48 H42 L50 26 L60 64 L70 40 L78 48 H104" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {(mode === 'boss' || mode === 'research') && (
        <g stroke={colors.stroke} strokeWidth="2" fill="none">
          <polygon points="52,18 76,34 68,64 36,64 28,34" fill={colors.accent} fillOpacity="0.2" />
          <path d="M52 28 V54 M39 41 H65" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
};

/**
 * Shadow Companion Vector Art
 */
export const ShadowIllustration: React.FC<{ name: string }> = ({ name }) => {
  const initial = name.charAt(0).toUpperCase();
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#4f46e5" fillOpacity="0.12" />
      <path d="M16 54 C18 36, 46 36, 48 54 Z" fill="#4338ca" fillOpacity="0.85" />
      <circle cx="32" cy="24" r="11" fill="#312e81" />
      <path d="M25 22 L30 25 M39 22 L34 25" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
      <text x="52" y="18" textAnchor="middle" className="fill-indigo-500 font-mono text-[10px] font-bold">
        {initial}
      </text>
    </svg>
  );
};

/**
 * 24-Hour Time Allocation Donut Chart (Sleep vs Classes/Work vs Free Time)
 */
export const DayAllocationDonut: React.FC<{ analysis: DayScheduleAnalysis }> = ({ analysis }) => {
  const sleep = analysis.totalSleepMinutes;
  const busy = analysis.totalBusyMinutes;
  const rest = analysis.totalRestBufferMinutes;
  const free = analysis.totalFreeMinutes;
  const total = Math.max(1, sleep + busy + rest + free);

  const segments = [
    { label: 'Ngủ & Hồi phục', mins: sleep, color: '#6366f1' },
    { label: 'Lịch cố định (Học tập / Công việc)', mins: busy, color: '#f43f5e' },
    { label: 'Nghỉ đệm', mins: rest, color: '#f59e0b' },
    { label: 'Thời gian rảnh', mins: free, color: '#10b981' },
  ];

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-hairline)" strokeWidth="12" />
          {segments.map((seg) => {
            const pct = seg.mins / total;
            const dash = pct * circumference;
            const el = (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-sm font-bold text-main">
            {(free / 60).toFixed(1)}h
          </span>
          <span className="text-[10px] text-dim">Rảnh</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <div>
              <div className="font-medium text-main">{seg.label}</div>
              <div className="font-mono text-[11px] text-dim">
                {(seg.mins / 60).toFixed(1)}h
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 7-Day Weekly Workload & Free-Time Visual Stacked Bar Chart
 */
export const WeeklyBalanceChart: React.FC<{
  weeklyAnalysis: DayScheduleAnalysis[];
  selectedDow: number;
  onSelectDow: (dow: number) => void;
}> = ({ weeklyAnalysis, selectedDow, onSelectDow }) => {
  return (
    <div className="grid grid-cols-7 items-end gap-2 pt-2">
      {weeklyAnalysis.map((day) => {
        const sleepH = day.totalSleepMinutes / 60;
        const busyH = day.totalBusyMinutes / 60;
        const freeH = day.totalFreeMinutes / 60;
        const short = day.dayLabel.split('(')[1]?.replace(')', '') || day.dayLabel;
        const active = day.dayOfWeek === selectedDow;

        return (
          <button
            key={day.dayOfWeek}
            onClick={() => onSelectDow(day.dayOfWeek)}
            className={`flex flex-col items-center rounded-lg p-2 transition ${
              active
                ? 'bg-indigo-500/10 ring-1 ring-indigo-500'
                : 'hover:bg-slate-500/10'
            }`}
          >
            <div className="flex h-24 w-6 flex-col-reverse overflow-hidden rounded-md bg-slate-200/40 dark:bg-slate-800">
              <div
                style={{ height: `${(sleepH / 24) * 100}%` }}
                className="bg-indigo-400"
                title={`Ngủ: ${sleepH.toFixed(1)}h`}
              />
              <div
                style={{ height: `${(busyH / 24) * 100}%` }}
                className="bg-rose-500"
                title={`Lịch học/làm: ${busyH.toFixed(1)}h`}
              />
              <div
                style={{ height: `${(freeH / 24) * 100}%` }}
                className="bg-emerald-500"
                title={`Rảnh: ${freeH.toFixed(1)}h`}
              />
            </div>
            <span className="mt-1.5 font-mono text-xs font-semibold text-main">{short}</span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
              {freeH.toFixed(1)}h
            </span>
          </button>
        );
      })}
    </div>
  );
};
