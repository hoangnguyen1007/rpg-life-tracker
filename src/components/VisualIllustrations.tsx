import React from 'react';
import type { DayScheduleAnalysis, HunterRank } from '../types/system';

const RANK_PALETTE: Record<
  HunterRank,
  { primary: string; highlight: string; badge: string }
> = {
  'E-Rank': {
    primary: '#5a5370',
    highlight: '#9e96b8',
    badge: 'rounded-none border-2 border-[var(--border-ink)] bg-[#5a5370] text-white',
  },
  'D-Rank': {
    primary: '#2e8b57',
    highlight: '#52c484',
    badge: 'rounded-none border-2 border-[var(--border-ink)] bg-[#2e8b57] text-white',
  },
  'C-Rank': {
    primary: '#3267a8',
    highlight: '#74ace8',
    badge: 'rounded-none border-2 border-[var(--border-ink)] bg-[#3267a8] text-white',
  },
  'B-Rank': {
    primary: '#485696',
    highlight: '#8998d6',
    badge: 'rounded-none border-2 border-[var(--border-ink)] bg-[#485696] text-white',
  },
  'A-Rank': {
    primary: '#73499e',
    highlight: '#b792e0',
    badge: 'rounded-none border-2 border-[var(--border-ink)] bg-[#73499e] text-white',
  },
  'S-Rank': {
    primary: '#c99330',
    highlight: '#f0c46c',
    badge: 'rounded-none border-2 border-[var(--border-ink)] bg-[#c99330] text-[#140e04]',
  },
  'National Level': {
    primary: '#b83a4b',
    highlight: '#e86b7a',
    badge: 'rounded-none border-2 border-[var(--border-ink)] bg-[#b83a4b] text-white',
  },
};

export function getRankBadgeClass(rank: HunterRank): string {
  return RANK_PALETTE[rank]?.badge || RANK_PALETTE['E-Rank'].badge;
}

/**
 * Crisp 16-Bit Pixel Hunter Crest & Character Portrait (ZERO gradients / blur)
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
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      className="pixel-art shrink-0"
      aria-label="Hunter Avatar"
    >
      {/* Square 16-bit Crest Frame */}
      <rect x="0" y="0" width="32" height="32" fill="#09070f" />
      <rect x="2" y="2" width="28" height="28" fill="#181523" />
      <rect x="2" y="2" width="28" height="2" fill={palette.primary} />
      <rect x="2" y="28" width="28" height="2" fill={palette.primary} />
      <rect x="2" y="4" width="2" height="24" fill={palette.primary} />
      <rect x="28" y="4" width="2" height="24" fill={palette.primary} />
      {/* Corner Gold Rivets */}
      <rect x="4" y="4" width="2" height="2" fill="#c99330" />
      <rect x="26" y="4" width="2" height="2" fill="#c99330" />
      <rect x="4" y="26" width="2" height="2" fill="#c99330" />
      <rect x="26" y="26" width="2" height="2" fill="#c99330" />

      {/* Pixel Crown for Level >= 3 */}
      {level >= 3 && (
        <g>
          <rect x="11" y="5" width="2" height="3" fill="#c99330" />
          <rect x="15" y="4" width="2" height="4" fill="#f0c46c" />
          <rect x="19" y="5" width="2" height="3" fill="#c99330" />
          <rect x="11" y="7" width="10" height="2" fill="#c99330" />
        </g>
      )}

      {/* Pixel Hair & Head */}
      <rect x="11" y="9" width="10" height="3" fill="#09070f" />
      <rect x="10" y="11" width="12" height="6" fill="#2b263d" />
      <rect x="12" y="12" width="8" height="5" fill="#e6c8a8" />
      {/* Glowing Pixel Eyes (flat solid highlight, zero blur) */}
      <rect x="13" y="14" width="2" height="2" fill={palette.highlight} />
      <rect x="17" y="14" width="2" height="2" fill={palette.highlight} />

      {/* Pixel Mantle & Cloak Collar */}
      <rect x="8" y="18" width="16" height="10" fill={palette.primary} />
      <rect x="10" y="18" width="12" height="3" fill={palette.highlight} />
      <rect x="14" y="21" width="4" height="7" fill="#100e18" />
      <rect x="15" y="22" width="2" height="2" fill="#c99330" />
    </svg>
  );
};

/**
 * Crisp 16-Bit Pixel Banner Illustration for Bosses & Goals
 */
export const BossBannerIllustration: React.FC<{
  title: string;
  variant?: 'boss' | 'ielts' | 'tech' | 'health' | 'research';
}> = ({ title, variant }) => {
  const lower = title.toLowerCase();
  const mode =
    variant ||
    (lower.includes('ielts') ||
    lower.includes('language') ||
    lower.includes('speaking') ||
    lower.includes('tiếng anh')
      ? 'ielts'
      : lower.includes('swe') ||
        lower.includes('code') ||
        lower.includes('software') ||
        lower.includes('engineer') ||
        lower.includes('chuyên môn')
      ? 'tech'
      : lower.includes('research') || lower.includes('paper') || lower.includes('nghiên cứu')
      ? 'research'
      : lower.includes('sức khỏe') ||
        lower.includes('vitality') ||
        lower.includes('gym') ||
        lower.includes('thể chất')
      ? 'health'
      : 'boss');

  const colors = {
    ielts: { bg: '#1d2b44', border: '#3267a8', accent: '#74ace8', trim: '#c99330' },
    tech: { bg: '#162922', border: '#2e8b57', accent: '#52c484', trim: '#c99330' },
    research: { bg: '#261b36', border: '#73499e', accent: '#b792e0', trim: '#c99330' },
    health: { bg: '#182b22', border: '#2e8b57', accent: '#52c484', trim: '#b83a4b' },
    boss: { bg: '#2e161d', border: '#b83a4b', accent: '#e86b7a', trim: '#c99330' },
  }[mode];

  return (
    <svg
      viewBox="0 0 120 40"
      shapeRendering="crispEdges"
      className="pixel-art block h-20 w-full rounded-none border-2 border-[var(--border-ink)] object-cover"
      aria-hidden="true"
    >
      {/* Flat 16-Bit Stone Banner Backdrop */}
      <rect x="0" y="0" width="120" height="40" fill={colors.bg} />
      {/* Top & Bottom Pixel Trim Rails */}
      <rect x="0" y="0" width="120" height="2" fill={colors.border} />
      <rect x="0" y="38" width="120" height="2" fill={colors.border} />
      {/* Subtle 16-bit Checker Bricks Right Side */}
      <rect x="86" y="6" width="10" height="6" fill={colors.border} opacity="0.32" />
      <rect x="100" y="6" width="12" height="6" fill={colors.border} opacity="0.22" />
      <rect x="92" y="16" width="12" height="6" fill={colors.border} opacity="0.28" />
      <rect x="106" y="16" width="8" height="6" fill={colors.border} opacity="0.18" />
      <rect x="88" y="26" width="14" height="6" fill={colors.border} opacity="0.24" />
      {/* Corner Gold Rivets */}
      <rect x="3" y="4" width="2" height="2" fill={colors.trim} />
      <rect x="115" y="4" width="2" height="2" fill={colors.trim} />
      <rect x="3" y="34" width="2" height="2" fill={colors.trim} />
      <rect x="115" y="34" width="2" height="2" fill={colors.trim} />

      {/* Topic Pixel Emblem */}
      {mode === 'ielts' && (
        <g>
          {/* Pixel Tome & Quill */}
          <rect x="12" y="10" width="18" height="20" fill={colors.border} />
          <rect x="14" y="12" width="14" height="16" fill="#f3ead8" />
          <rect x="16" y="15" width="10" height="2" fill={colors.bg} />
          <rect x="16" y="19" width="8" height="2" fill={colors.bg} />
          <rect x="16" y="23" width="6" height="2" fill={colors.trim} />
          <rect x="36" y="14" width="14" height="12" fill={colors.accent} opacity="0.35" />
          <rect x="38" y="17" width="10" height="2" fill={colors.accent} />
          <rect x="38" y="21" width="6" height="2" fill={colors.accent} />
        </g>
      )}

      {mode === 'tech' && (
        <g>
          {/* Pixel Terminal Monitor */}
          <rect x="12" y="9" width="26" height="20" fill={colors.border} />
          <rect x="14" y="11" width="22" height="14" fill="#09070f" />
          <rect x="16" y="14" width="2" height="2" fill={colors.accent} />
          <rect x="18" y="16" width="2" height="2" fill={colors.accent} />
          <rect x="16" y="18" width="2" height="2" fill={colors.accent} />
          <rect x="22" y="18" width="8" height="2" fill={colors.trim} />
          <rect x="20" y="29" width="10" height="2" fill={colors.accent} />
          <rect x="44" y="14" width="6" height="6" fill={colors.accent} opacity="0.45" />
          <rect x="52" y="20" width="6" height="6" fill={colors.trim} opacity="0.65" />
        </g>
      )}

      {mode === 'health' && (
        <g>
          {/* Pixel Heart + Vitality Pulse */}
          <rect x="14" y="12" width="4" height="2" fill="#b83a4b" />
          <rect x="20" y="12" width="4" height="2" fill="#b83a4b" />
          <rect x="12" y="14" width="14" height="6" fill="#b83a4b" />
          <rect x="14" y="14" width="2" height="2" fill="#e86b7a" />
          <rect x="14" y="20" width="10" height="3" fill="#b83a4b" />
          <rect x="16" y="23" width="6" height="3" fill="#8c2030" />
          <rect x="18" y="26" width="2" height="2" fill="#8c2030" />
          <rect x="32" y="20" width="10" height="2" fill={colors.accent} />
          <rect x="42" y="14" width="2" height="8" fill={colors.accent} />
          <rect x="44" y="14" width="2" height="14" fill={colors.accent} />
          <rect x="46" y="20" width="12" height="2" fill={colors.accent} />
        </g>
      )}

      {(mode === 'boss' || mode === 'research') && (
        <g>
          {/* Pixel Shield Crest & Crossed Emblem */}
          <rect x="14" y="9" width="16" height="4" fill={colors.border} />
          <rect x="14" y="13" width="16" height="10" fill={colors.border} />
          <rect x="16" y="11" width="12" height="12" fill={colors.accent} opacity="0.3" />
          <rect x="21" y="12" width="2" height="12" fill={colors.trim} />
          <rect x="17" y="16" width="10" height="2" fill={colors.trim} />
          <rect x="16" y="23" width="12" height="3" fill={colors.border} />
          <rect x="19" y="26" width="6" height="3" fill={colors.border} />
          <rect x="21" y="29" width="2" height="2" fill={colors.border} />
          <rect x="38" y="15" width="18" height="2" fill={colors.accent} opacity="0.6" />
          <rect x="38" y="21" width="12" height="2" fill={colors.trim} opacity="0.7" />
        </g>
      )}
    </svg>
  );
};

/**
 * 16-Bit Pixel Shadow Companion Sprite (ZERO gradients / blur)
 */
export const ShadowIllustration: React.FC<{ name: string }> = ({ name }) => {
  const initial = name.charAt(0).toUpperCase();
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="pixel-art shrink-0 rounded-none border-2 border-[var(--border-ink)]"
    >
      <rect x="0" y="0" width="16" height="16" fill="#181523" />
      <rect x="5" y="2" width="6" height="2" fill="#73499e" />
      <rect x="4" y="4" width="8" height="5" fill="#4f3070" />
      <rect x="5" y="5" width="2" height="2" fill="#74ace8" />
      <rect x="9" y="5" width="2" height="2" fill="#74ace8" />
      <rect x="3" y="9" width="10" height="5" fill="#73499e" />
      <rect x="4" y="14" width="2" height="2" fill="#4f3070" />
      <rect x="7" y="14" width="2" height="2" fill="#4f3070" />
      <rect x="10" y="14" width="2" height="2" fill="#4f3070" />
      <text
        x="13"
        y="4.5"
        textAnchor="middle"
        fill="#f0c46c"
        fontSize="4"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        {initial}
      </text>
    </svg>
  );
};

/**
 * 24-Hour Time Allocation Retro 16-Bit Ring Chart (Sleep vs Busy vs Rest vs Free)
 * Flat solid retro palette, crisp high contrast in both Dark & Light themes.
 */
export const DayAllocationDonut: React.FC<{ analysis: DayScheduleAnalysis }> = ({
  analysis,
}) => {
  const sleep = analysis.totalSleepMinutes;
  const busy = analysis.totalBusyMinutes;
  const rest = analysis.totalRestBufferMinutes;
  const free = analysis.totalFreeMinutes;
  const total = Math.max(1, sleep + busy + rest + free);

  const segments = [
    { label: 'Ngủ & Hồi phục', mins: sleep, color: '#73499e' },
    { label: 'Lịch cố định (Học tập / Công việc)', mins: busy, color: '#b83a4b' },
    { label: 'Nghỉ đệm', mins: rest, color: '#c99330' },
    { label: 'Thời gian rảnh', mins: free, color: '#2e8b57' },
  ];

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="px-inset relative h-28 w-28 shrink-0 p-1">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--border-hairline)"
            strokeWidth="12"
          />
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
          {/* Inner & outer crisp ink rings */}
          <circle
            cx="50"
            cy="50"
            r={radius - 6}
            fill="none"
            stroke="var(--border-ink)"
            strokeWidth="1.5"
          />
          <circle
            cx="50"
            cy="50"
            r={radius + 6}
            fill="none"
            stroke="var(--border-ink)"
            strokeWidth="1.5"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-pixel text-xs font-bold text-main">
            {(free / 60).toFixed(1)}h
          </span>
          <span className="font-mono text-[10px] text-dim">Rảnh</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-none border border-[var(--border-ink)]"
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
 * 7-Day Weekly Workload & Free-Time Crisp 16-Bit Stacked Bar Chart
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
            type="button"
            onClick={() => onSelectDow(day.dayOfWeek)}
            className={`flex flex-col items-center rounded-none border-2 p-2 ${
              active
                ? 'border-[var(--px-gold)] bg-[var(--accent-soft)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className="flex h-24 w-6 flex-col-reverse overflow-hidden rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)]">
              <div
                style={{
                  height: `${(sleepH / 24) * 100}%`,
                  backgroundColor: '#73499e',
                }}
                title={`Ngủ: ${sleepH.toFixed(1)}h`}
              />
              <div
                style={{
                  height: `${(busyH / 24) * 100}%`,
                  backgroundColor: '#b83a4b',
                }}
                title={`Lịch học/làm: ${busyH.toFixed(1)}h`}
              />
              <div
                style={{
                  height: `${(freeH / 24) * 100}%`,
                  backgroundColor: '#2e8b57',
                }}
                title={`Rảnh: ${freeH.toFixed(1)}h`}
              />
            </div>
            <span
              className={`mt-1.5 font-mono text-xs font-bold ${
                active ? 'text-[var(--px-gold-text)]' : 'text-main'
              }`}
            >
              {short}
            </span>
            <span className="font-mono text-[10px] font-bold text-[var(--px-green-text)]">
              {freeH.toFixed(1)}h
            </span>
          </button>
        );
      })}
    </div>
  );
};
