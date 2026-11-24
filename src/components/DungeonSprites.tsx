import React from 'react';
import type {
  BossMission,
  HeroAvatarStyle,
  HunterRank,
  MonsterArchetype,
  StoryChapter,
} from '../types/system';

export const HERO_AVATAR_CATALOG: Array<{
  id: HeroAvatarStyle;
  name: string;
  title: string;
  desc: string;
}> = [
  {
    id: 'shadow_monarch',
    name: 'Quân Vương Hắc Ảnh',
    title: 'Shadow Monarch',
    desc: 'Áo choàng bóng tối, giáp thẫm & song đoản kiếm ánh lam',
  },
  {
    id: 'arcane_scholar',
    name: 'Học Giả Bí Thuật',
    title: 'Arcane Scholar',
    desc: 'Mũ phù thủy viền vàng, cổ thư & quyền trượng tri thức',
  },
  {
    id: 'cyber_blade',
    name: 'Kiếm Sĩ Công Nghệ',
    title: 'Cyber Blade',
    desc: 'Kính visor quang học & thanh katana năng lượng sắc bén',
  },
  {
    id: 'iron_paladin',
    name: 'Hiệp Sĩ Thiết Giáp',
    title: 'Iron Paladin',
    desc: 'Giáp bạc hoàng kim, trường kiếm thánh & khiên bảo hộ',
  },
  {
    id: 'ranger_scout',
    name: 'Du Hiệp Trinh Sát',
    title: 'Ranger Scout',
    desc: 'Mũ trùm lục bảo, cung dài săn mồi & áo choàng gió',
  },
  {
    id: 'alchemist_sage',
    name: 'Hiền Giả Giả Kim',
    title: 'Alchemist Sage',
    desc: 'Áo choàng đỏ thẫm, lọ linh dược & trượng giả kim thuật',
  },
];

const HERO_RANK_COLORS: Record<HunterRank, { cloak: string; trim: string; blade: string }> = {
  'E-Rank': { cloak: '#475569', trim: '#94a3b8', blade: '#cbd5e1' },
  'D-Rank': { cloak: '#065f46', trim: '#34d399', blade: '#6ee7b7' },
  'C-Rank': { cloak: '#075985', trim: '#38bdf8', blade: '#7dd3fc' },
  'B-Rank': { cloak: '#3730a3', trim: '#818cf8', blade: '#a5b4fc' },
  'A-Rank': { cloak: '#5b21b6', trim: '#a78bfa', blade: '#c4b5fd' },
  'S-Rank': { cloak: '#92400e', trim: '#fbbf24', blade: '#fde68a' },
  'National Level': { cloak: '#881337', trim: '#fb7185', blade: '#fecdd3' },
};

export const PixelHeart: React.FC<{
  state: 'full' | 'half' | 'empty';
  size?: number;
  critical?: boolean;
}> = ({ state, size = 18, critical = false }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`pixel-art shrink-0 ${critical && state !== 'empty' ? 'anim-heart-crit' : ''}`}
      aria-hidden="true"
    >
      <path
        d="M3 2h3v1h1v1h2V3h1V2h3v1h1v1h1v4h-1v1h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4v-1H3V9H2V8H1V4h1V3h1V2z"
        fill="#1a0b12"
      />
      <path
        d="M3 3h3v1h1v1h2V4h1V3h3v1h1v4h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4V9H3V8H2V4h1V3z"
        fill="#33293a"
      />
      {state === 'full' && (
        <>
          <path
            d="M3 3h3v1h1v1h2V4h1V3h3v1h1v4h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4V9H3V8H2V4h1V3z"
            fill="#ef4444"
          />
          <path d="M13 6h1v2h-1v1h-1v1h-1v1h-1v1H9v1H7v-1h2v-1h1v-1h1V9h1V8h1V6z" fill="#b91c1c" />
          <rect x="3" y="4" width="2" height="1" fill="#fecaca" />
          <rect x="3" y="5" width="1" height="1" fill="#ffffff" />
        </>
      )}
      {state === 'half' && (
        <>
          <path
            d="M3 3h3v1h1v1h1v8H7v-1H6v-1H5v-1H4V9H3V8H2V4h1V3z"
            fill="#ef4444"
          />
          <rect x="3" y="4" width="2" height="1" fill="#fecaca" />
          <rect x="3" y="5" width="1" height="1" fill="#ffffff" />
        </>
      )}
    </svg>
  );
};

export const PixelHeroSprite: React.FC<{
  rank: HunterRank;
  size?: number;
  avatarStyle?: HeroAvatarStyle;
  mood?: 'healthy' | 'wounded' | 'critical';
  guarding?: boolean;
  className?: string;
}> = ({
  rank,
  size = 96,
  avatarStyle = 'shadow_monarch',
  mood = 'healthy',
  guarding = false,
  className = '',
}) => {
  const c = HERO_RANK_COLORS[rank] || HERO_RANK_COLORS['E-Rank'];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      className={`pixel-art anim-hero-idle ${className}`}
      aria-label={`Hero Sprite ${avatarStyle}`}
    >
      <ellipse cx="15" cy="29" rx="9" ry="2.2" fill="rgba(0,0,0,0.45)" />

      {/* 1. SHADOW MONARCH */}
      {avatarStyle === 'shadow_monarch' && (
        <g>
          <rect x="10" y="25" width="4" height="3" fill="#0f172a" />
          <rect x="16" y="25" width="4" height="3" fill="#0f172a" />
          <rect x="7" y="15" width="15" height="10" fill="#1e1b4b" />
          <rect x="6" y="18" width="3" height="8" fill="#312e81" />
          <rect x="10" y="15" width="10" height="9" fill="#0f172a" />
          <rect x="12" y="16" width="6" height="4" fill="#334155" />
          <rect x="14" y="21" width="2" height="2" fill="#818cf8" />
          {/* Spiky dark hair + head */}
          <rect x="10" y="6" width="10" height="9" fill="#0f172a" />
          <rect x="9" y="5" width="3" height="2" fill="#1e293b" />
          <rect x="13" y="4" width="4" height="2" fill="#312e81" />
          <rect x="18" y="5" width="3" height="2" fill="#1e293b" />
          <rect x="12" y="10" width="7" height="4" fill="#e2e8f0" />
          <rect x="13" y="11" width="2" height="2" fill="#38bdf8" />
          <rect x="17" y="11" width="2" height="2" fill="#38bdf8" />
          {/* Dual Shadow Daggers */}
          <rect x="22" y="16" width="2" height="4" fill="#475569" />
          <rect x="22" y="6" width="2" height="10" fill="#6366f1" />
          <rect x="23" y="7" width="1" height="8" fill="#e0e7ff" />
          <rect x="5" y="17" width="2" height="7" fill="#38bdf8" />
        </g>
      )}

      {/* 2. ARCANE SCHOLAR */}
      {avatarStyle === 'arcane_scholar' && (
        <g>
          <rect x="11" y="25" width="3" height="3" fill="#3b0764" />
          <rect x="16" y="25" width="3" height="3" fill="#3b0764" />
          {/* Flowing violet robe */}
          <rect x="8" y="15" width="14" height="11" fill="#4c1d95" />
          <rect x="11" y="16" width="8" height="9" fill="#6d28d9" />
          <rect x="14" y="16" width="2" height="9" fill="#f59e0b" />
          {/* Wizard Hat */}
          <rect x="7" y="9" width="16" height="2" fill="#3b0764" />
          <rect x="10" y="5" width="10" height="4" fill="#5b21b6" />
          <rect x="13" y="2" width="5" height="3" fill="#6d28d9" />
          <rect x="10" y="8" width="10" height="1" fill="#fbbf24" />
          {/* Face */}
          <rect x="11" y="11" width="8" height="4" fill="#fde68a" />
          <rect x="12" y="12" width="2" height="2" fill="#1e1b4b" />
          <rect x="16" y="12" width="2" height="2" fill="#1e1b4b" />
          {/* Arcane Staff + Tome */}
          <rect x="23" y="9" width="2" height="18" fill="#78350f" />
          <rect x="22" y="6" width="4" height="4" fill="#22d3ee" />
          <rect x="23" y="7" width="2" height="2" fill="#ffffff" />
          <rect x="6" y="17" width="4" height="5" fill="#92400e" />
          <rect x="7" y="18" width="2" height="3" fill="#fef3c7" />
        </g>
      )}

      {/* 3. CYBER BLADE */}
      {avatarStyle === 'cyber_blade' && (
        <g>
          <rect x="10" y="25" width="4" height="3" fill="#0f172a" />
          <rect x="16" y="25" width="4" height="3" fill="#0f172a" />
          {/* Tech Jacket */}
          <rect x="8" y="15" width="14" height="10" fill="#1e293b" />
          <rect x="10" y="16" width="10" height="7" fill="#0f172a" />
          <rect x="10" y="16" width="2" height="7" fill="#06b6d4" />
          <rect x="18" y="16" width="2" height="7" fill="#06b6d4" />
          {/* Helmet + Neon Visor */}
          <rect x="10" y="6" width="10" height="9" fill="#334155" />
          <rect x="11" y="9" width="9" height="3" fill="#0f172a" />
          <rect x="12" y="10" width="7" height="2" fill="#22d3ee" />
          <rect x="11" y="5" width="6" height="2" fill="#06b6d4" />
          {/* Neon Katana */}
          <rect x="22" y="17" width="2" height="4" fill="#1e293b" />
          <rect x="22" y="4" width="2" height="13" fill="#22d3ee" />
          <rect x="23" y="5" width="1" height="11" fill="#ecfeff" />
        </g>
      )}

      {/* 4. IRON PALADIN */}
      {avatarStyle === 'iron_paladin' && (
        <g>
          <rect x="10" y="25" width="4" height="3" fill="#475569" />
          <rect x="16" y="25" width="4" height="3" fill="#475569" />
          <rect x="8" y="15" width="14" height="10" fill="#94a3b8" />
          <rect x="10" y="15" width="10" height="8" fill="#cbd5e1" />
          <rect x="14" y="16" width="2" height="6" fill="#f59e0b" />
          <rect x="12" y="18" width="6" height="2" fill="#f59e0b" />
          {/* Great Helm + Gold Plume */}
          <rect x="10" y="6" width="10" height="9" fill="#94a3b8" />
          <rect x="12" y="3" width="6" height="3" fill="#f59e0b" />
          <rect x="11" y="9" width="8" height="3" fill="#0f172a" />
          <rect x="12" y="10" width="2" height="1" fill="#fbbf24" />
          <rect x="16" y="10" width="2" height="1" fill="#fbbf24" />
          {/* Kite Shield + Broadsword */}
          <rect x="5" y="15" width="5" height="8" fill="#475569" />
          <rect x="6" y="16" width="3" height="6" fill="#fbbf24" />
          <rect x="22" y="6" width="2" height="12" fill="#e2e8f0" />
          <rect x="21" y="17" width="4" height="2" fill="#f59e0b" />
        </g>
      )}

      {/* 5. RANGER SCOUT */}
      {avatarStyle === 'ranger_scout' && (
        <g>
          <rect x="10" y="25" width="4" height="3" fill="#78350f" />
          <rect x="16" y="25" width="4" height="3" fill="#78350f" />
          <rect x="7" y="15" width="14" height="10" fill="#065f46" />
          <rect x="10" y="16" width="10" height="8" fill="#047857" />
          <rect x="10" y="21" width="10" height="2" fill="#78350f" />
          {/* Forest Hood */}
          <rect x="9" y="5" width="12" height="10" fill="#064e3b" />
          <rect x="11" y="9" width="8" height="5" fill="#1e293b" />
          <rect x="12" y="11" width="2" height="1" fill="#34d399" />
          <rect x="16" y="11" width="2" height="1" fill="#34d399" />
          {/* Longbow */}
          <rect x="23" y="7" width="2" height="16" fill="#92400e" />
          <rect x="21" y="8" width="2" height="2" fill="#b45309" />
          <rect x="21" y="20" width="2" height="2" fill="#b45309" />
          <rect x="21" y="10" width="1" height="10" fill="#e2e8f0" />
        </g>
      )}

      {/* 6. ALCHEMIST SAGE */}
      {avatarStyle === 'alchemist_sage' && (
        <g>
          <rect x="10" y="25" width="4" height="3" fill="#451a03" />
          <rect x="16" y="25" width="4" height="3" fill="#451a03" />
          <rect x="8" y="15" width="14" height="11" fill="#881337" />
          <rect x="10" y="16" width="10" height="9" fill="#9f1239" />
          <rect x="11" y="20" width="8" height="2" fill="#fbbf24" />
          {/* Sage Head + Goggles */}
          <rect x="10" y="6" width="10" height="9" fill="#fde68a" />
          <rect x="10" y="5" width="10" height="3" fill="#e2e8f0" />
          <rect x="10" y="8" width="10" height="2" fill="#78350f" />
          <rect x="11" y="8" width="3" height="2" fill="#38bdf8" />
          <rect x="16" y="8" width="3" height="2" fill="#38bdf8" />
          <rect x="12" y="11" width="2" height="2" fill="#0f172a" />
          <rect x="16" y="11" width="2" height="2" fill="#0f172a" />
          {/* Potion Flask + Brass Staff */}
          <rect x="5" y="17" width="4" height="5" fill="#10b981" />
          <rect x="6" y="15" width="2" height="2" fill="#e2e8f0" />
          <rect x="23" y="8" width="2" height="18" fill="#b45309" />
          <rect x="22" y="6" width="4" height="3" fill="#fbbf24" />
        </g>
      )}

      {/* Mood Indicators when Wounded / Critical */}
      {mood === 'wounded' && (
        <g>
          <rect x="20" y="7" width="2" height="3" fill="#38bdf8" />
          <rect x="20" y="10" width="2" height="1" fill="#bae6fd" />
        </g>
      )}
      {mood === 'critical' && (
        <g>
          <rect x="20" y="5" width="2" height="4" fill="#ef4444" />
          <rect x="20" y="10" width="2" height="2" fill="#fca5a5" />
        </g>
      )}

      {guarding && (
        <rect x="23" y="8" width="3" height="16" fill={c.trim} opacity="0.6" />
      )}
    </svg>
  );
};

export const PixelMonsterSprite: React.FC<{
  archetype: MonsterArchetype;
  size?: number;
  isBoss?: boolean;
  isElite?: boolean;
  enraged?: boolean;
  className?: string;
}> = ({
  archetype,
  size = 96,
  isBoss = false,
  isElite = false,
  enraged = false,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      className={`pixel-art anim-monster-idle ${className}`}
      aria-label={`Monster ${archetype}`}
    >
      {(isBoss || isElite) && (
        <ellipse
          cx="16"
          cy="28.5"
          rx={isBoss ? 12 : 9.5}
          ry="2.6"
          fill={enraged ? 'rgba(239,68,68,0.45)' : isBoss ? 'rgba(244,63,94,0.35)' : 'rgba(245,158,11,0.35)'}
        />
      )}
      <ellipse cx="16" cy="28.5" rx="8.5" ry="2" fill="rgba(0,0,0,0.48)" />

      {isBoss && (
        <g>
          <rect x="11" y="2" width="2" height="3" fill="#f59e0b" />
          <rect x="15" y="1" width="2" height="4" fill="#fbbf24" />
          <rect x="19" y="2" width="2" height="3" fill="#f59e0b" />
          <rect x="11" y="4" width="10" height="2" fill="#d97706" />
          <rect x="15" y="4" width="2" height="1" fill="#ef4444" />
        </g>
      )}

      {/* 1. SLIME */}
      {archetype === 'slime' && (
        <g>
          <rect x="8" y="14" width="16" height="12" fill="#10b981" />
          <rect x="6" y="17" width="20" height="9" fill="#059669" />
          <rect x="10" y="12" width="12" height="3" fill="#34d399" />
          <rect x="9" y="15" width="3" height="2" fill="#a7f3d0" />
          <rect x="10" y="18" width="3" height="3" fill="#0f172a" />
          <rect x="18" y="18" width="3" height="3" fill="#0f172a" />
          <rect x="11" y="18" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="18" width="1" height="1" fill="#ffffff" />
          <rect x="13" y="23" width="6" height="1" fill="#064e3b" />
        </g>
      )}

      {/* 2. BAT */}
      {archetype === 'bat' && (
        <g>
          <rect x="2" y="11" width="8" height="4" fill="#581c87" />
          <rect x="4" y="15" width="6" height="3" fill="#3b0764" />
          <rect x="22" y="11" width="8" height="4" fill="#581c87" />
          <rect x="22" y="15" width="6" height="3" fill="#3b0764" />
          <rect x="11" y="10" width="10" height="11" fill="#7e22ce" />
          <rect x="11" y="7" width="2" height="3" fill="#581c87" />
          <rect x="19" y="7" width="2" height="3" fill="#581c87" />
          <rect x="13" y="13" width="2" height="2" fill="#facc15" />
          <rect x="17" y="13" width="2" height="2" fill="#facc15" />
          <rect x="14" y="17" width="1" height="2" fill="#ffffff" />
          <rect x="17" y="17" width="1" height="2" fill="#ffffff" />
        </g>
      )}

      {/* 3. GOBLIN */}
      {archetype === 'goblin' && (
        <g>
          <rect x="7" y="10" width="3" height="2" fill="#65a30d" />
          <rect x="22" y="10" width="3" height="2" fill="#65a30d" />
          <rect x="10" y="8" width="12" height="8" fill="#84cc16" />
          <rect x="12" y="11" width="2" height="2" fill="#ef4444" />
          <rect x="18" y="11" width="2" height="2" fill="#ef4444" />
          <rect x="13" y="14" width="6" height="1" fill="#1a2e05" />
          <rect x="10" y="16" width="12" height="9" fill="#78350f" />
          <rect x="11" y="25" width="3" height="3" fill="#4d7c0f" />
          <rect x="18" y="25" width="3" height="3" fill="#4d7c0f" />
          <rect x="6" y="15" width="2" height="7" fill="#cbd5e1" />
        </g>
      )}

      {/* 4. SKELETON */}
      {archetype === 'skeleton' && (
        <g>
          <rect x="11" y="7" width="10" height="8" fill="#e2e8f0" />
          <rect x="12" y="15" width="8" height="2" fill="#cbd5e1" />
          <rect x="12" y="10" width="3" height="3" fill="#0f172a" />
          <rect x="17" y="10" width="3" height="3" fill="#0f172a" />
          <rect x="13" y="11" width="1" height="1" fill="#f43f5e" />
          <rect x="18" y="11" width="1" height="1" fill="#f43f5e" />
          <rect x="11" y="18" width="10" height="1" fill="#cbd5e1" />
          <rect x="12" y="20" width="8" height="1" fill="#cbd5e1" />
          <rect x="15" y="17" width="2" height="8" fill="#e2e8f0" />
          <rect x="11" y="24" width="2" height="4" fill="#cbd5e1" />
          <rect x="19" y="24" width="2" height="4" fill="#cbd5e1" />
          <rect x="6" y="12" width="2" height="12" fill="#78350f" />
          <rect x="4" y="11" width="5" height="5" fill="#94a3b8" />
        </g>
      )}

      {/* 5. WRAITH */}
      {archetype === 'wraith' && (
        <g>
          <rect x="9" y="7" width="14" height="15" fill="#312e81" />
          <rect x="7" y="12" width="18" height="11" fill="#4338ca" />
          <rect x="8" y="23" width="3" height="4" fill="#312e81" />
          <rect x="14" y="23" width="4" height="5" fill="#4338ca" />
          <rect x="21" y="23" width="3" height="4" fill="#312e81" />
          <rect x="11" y="10" width="10" height="6" fill="#0f172a" />
          <rect x="12" y="12" width="3" height="2" fill="#22d3ee" />
          <rect x="17" y="12" width="3" height="2" fill="#22d3ee" />
        </g>
      )}

      {/* 6. GOLEM */}
      {archetype === 'golem' && (
        <g>
          <rect x="7" y="10" width="18" height="13" fill="#57534e" />
          <rect x="9" y="7" width="14" height="5" fill="#78716c" />
          <rect x="5" y="13" width="4" height="10" fill="#44403c" />
          <rect x="23" y="13" width="4" height="10" fill="#44403c" />
          <rect x="9" y="23" width="5" height="5" fill="#44403c" />
          <rect x="18" y="23" width="5" height="5" fill="#44403c" />
          <rect x="12" y="10" width="2" height="2" fill="#f97316" />
          <rect x="18" y="10" width="2" height="2" fill="#f97316" />
          <rect x="14" y="15" width="4" height="4" fill="#f59e0b" />
          <rect x="15" y="16" width="2" height="2" fill="#fef08a" />
        </g>
      )}

      {/* 7. SPIDER */}
      {archetype === 'spider' && (
        <g>
          <rect x="3" y="16" width="5" height="2" fill="#1e1b4b" />
          <rect x="3" y="18" width="2" height="5" fill="#1e1b4b" />
          <rect x="24" y="16" width="5" height="2" fill="#1e1b4b" />
          <rect x="27" y="18" width="2" height="5" fill="#1e1b4b" />
          <rect x="5" y="21" width="5" height="2" fill="#312e81" />
          <rect x="22" y="21" width="5" height="2" fill="#312e81" />
          <rect x="9" y="12" width="14" height="11" fill="#1e1b4b" />
          <rect x="11" y="14" width="10" height="7" fill="#312e81" />
          <rect x="11" y="17" width="2" height="2" fill="#ef4444" />
          <rect x="14" y="16" width="2" height="2" fill="#f43f5e" />
          <rect x="17" y="16" width="2" height="2" fill="#f43f5e" />
          <rect x="19" y="17" width="2" height="2" fill="#ef4444" />
        </g>
      )}

      {/* 8. SENTINEL */}
      {archetype === 'sentinel' && (
        <g>
          <rect x="8" y="13" width="16" height="14" fill="#7f1d1d" />
          <rect x="10" y="14" width="12" height="11" fill="#1e293b" />
          <rect x="11" y="15" width="10" height="4" fill="#334155" />
          <rect x="14" y="16" width="4" height="3" fill="#ef4444" />
          <rect x="10" y="6" width="12" height="8" fill="#0f172a" />
          <rect x="8" y="5" width="2" height="4" fill="#e2e8f0" />
          <rect x="22" y="5" width="2" height="4" fill="#e2e8f0" />
          <rect x="12" y="9" width="3" height="2" fill="#f43f5e" />
          <rect x="17" y="9" width="3" height="2" fill="#f43f5e" />
          <rect x="5" y="7" width="3" height="14" fill="#dc2626" />
          <rect x="11" y="25" width="4" height="3" fill="#0f172a" />
          <rect x="17" y="25" width="4" height="3" fill="#0f172a" />
        </g>
      )}

      {/* 9. WOLF (Steel-Fang Lycan) */}
      {archetype === 'wolf' && (
        <g>
          <rect x="8" y="15" width="14" height="8" fill="#475569" />
          <rect x="20" y="13" width="6" height="4" fill="#64748b" />
          <rect x="17" y="8" width="9" height="8" fill="#334155" />
          <rect x="18" y="5" width="2" height="3" fill="#475569" />
          <rect x="23" y="5" width="2" height="3" fill="#475569" />
          <rect x="24" y="12" width="4" height="3" fill="#64748b" />
          <rect x="21" y="10" width="2" height="2" fill="#f43f5e" />
          <rect x="25" y="14" width="1" height="2" fill="#ffffff" />
          <rect x="9" y="23" width="3" height="5" fill="#1e293b" />
          <rect x="18" y="23" width="3" height="5" fill="#1e293b" />
          <rect x="5" y="13" width="4" height="3" fill="#64748b" />
        </g>
      )}

      {/* 10. ORC (High Orc) */}
      {archetype === 'orc' && (
        <g>
          <rect x="7" y="13" width="18" height="12" fill="#991b1b" />
          <rect x="9" y="15" width="14" height="8" fill="#7f1d1d" />
          <rect x="10" y="6" width="12" height="8" fill="#b91c1c" />
          <rect x="12" y="9" width="2" height="2" fill="#fbbf24" />
          <rect x="18" y="9" width="2" height="2" fill="#fbbf24" />
          <rect x="11" y="12" width="2" height="2" fill="#fef3c7" />
          <rect x="19" y="12" width="2" height="2" fill="#fef3c7" />
          <rect x="4" y="10" width="3" height="13" fill="#78350f" />
          <rect x="3" y="7" width="6" height="5" fill="#94a3b8" />
          <rect x="10" y="25" width="4" height="3" fill="#450a0a" />
          <rect x="18" y="25" width="4" height="3" fill="#450a0a" />
        </g>
      )}

      {/* 11. ICE BEAR (Alpha Frost Bear) */}
      {archetype === 'ice_bear' && (
        <g>
          <rect x="7" y="11" width="18" height="14" fill="#bae6fd" />
          <rect x="9" y="6" width="14" height="8" fill="#e0f2fe" />
          <rect x="9" y="4" width="3" height="3" fill="#7dd3fc" />
          <rect x="20" y="4" width="3" height="3" fill="#7dd3fc" />
          <rect x="12" y="9" width="2" height="2" fill="#0284c7" />
          <rect x="18" y="9" width="2" height="2" fill="#0284c7" />
          <rect x="14" y="11" width="4" height="2" fill="#0c4a6e" />
          <rect x="8" y="25" width="5" height="3" fill="#7dd3fc" />
          <rect x="19" y="25" width="5" height="3" fill="#7dd3fc" />
          <rect x="5" y="15" width="3" height="6" fill="#38bdf8" />
          <rect x="24" y="15" width="3" height="6" fill="#38bdf8" />
        </g>
      )}

      {/* 12. MAGE (Kargalgan / Dark Sorcerer) */}
      {archetype === 'mage' && (
        <g>
          <rect x="9" y="13" width="14" height="14" fill="#581c87" />
          <rect x="11" y="15" width="10" height="11" fill="#3b0764" />
          <rect x="10" y="6" width="12" height="8" fill="#4c1d95" />
          <rect x="12" y="8" width="8" height="5" fill="#0f172a" />
          <rect x="13" y="10" width="2" height="2" fill="#f43f5e" />
          <rect x="17" y="10" width="2" height="2" fill="#f43f5e" />
          <rect x="24" y="7" width="2" height="19" fill="#451a03" />
          <rect x="23" y="4" width="4" height="4" fill="#e11d48" />
          <rect x="24" y="5" width="2" height="2" fill="#fda4af" />
        </g>
      )}

      {/* 13. ANT KING (Beru) */}
      {archetype === 'ant_king' && (
        <g>
          <rect x="5" y="9" width="5" height="9" fill="#312e81" />
          <rect x="22" y="9" width="5" height="9" fill="#312e81" />
          <rect x="10" y="13" width="12" height="12" fill="#1e1b4b" />
          <rect x="12" y="15" width="8" height="7" fill="#7f1d1d" />
          <rect x="10" y="5" width="12" height="8" fill="#0f172a" />
          <rect x="12" y="8" width="3" height="2" fill="#22d3ee" />
          <rect x="17" y="8" width="3" height="2" fill="#22d3ee" />
          <rect x="11" y="12" width="3" height="2" fill="#e2e8f0" />
          <rect x="18" y="12" width="3" height="2" fill="#e2e8f0" />
          <rect x="10" y="25" width="3" height="3" fill="#312e81" />
          <rect x="19" y="25" width="3" height="3" fill="#312e81" />
        </g>
      )}

      {/* 14. DEMON LORD (Baran) */}
      {archetype === 'demon_lord' && (
        <g>
          <rect x="6" y="4" width="3" height="5" fill="#cbd5e1" />
          <rect x="23" y="4" width="3" height="5" fill="#cbd5e1" />
          <rect x="9" y="7" width="14" height="8" fill="#1e293b" />
          <rect x="12" y="10" width="3" height="2" fill="#38bdf8" />
          <rect x="17" y="10" width="3" height="2" fill="#38bdf8" />
          <rect x="8" y="15" width="16" height="11" fill="#0f172a" />
          <rect x="11" y="16" width="10" height="7" fill="#4c1d95" />
          <rect x="14" y="17" width="4" height="4" fill="#a855f7" />
          <rect x="4" y="9" width="3" height="14" fill="#6366f1" />
          <rect x="10" y="26" width="4" height="3" fill="#0f172a" />
          <rect x="18" y="26" width="4" height="3" fill="#0f172a" />
        </g>
      )}

      {/* 15. ARCHITECT (Statue / System Keeper) */}
      {archetype === 'architect' && (
        <g>
          <rect x="4" y="8" width="4" height="12" fill="#64748b" />
          <rect x="24" y="8" width="4" height="12" fill="#64748b" />
          <rect x="9" y="6" width="14" height="20" fill="#475569" />
          <rect x="11" y="8" width="10" height="8" fill="#94a3b8" />
          <rect x="12" y="10" width="2" height="2" fill="#22d3ee" />
          <rect x="18" y="10" width="2" height="2" fill="#22d3ee" />
          <rect x="13" y="18" width="6" height="6" fill="#0f172a" />
          <rect x="14" y="19" width="4" height="4" fill="#38bdf8" />
          <rect x="9" y="26" width="14" height="3" fill="#334155" />
        </g>
      )}

      {/* 16. DRAGON (Antares) */}
      {archetype === 'dragon' && (
        <g>
          <rect x="2" y="8" width="8" height="8" fill="#7f1d1d" />
          <rect x="22" y="8" width="8" height="8" fill="#7f1d1d" />
          <rect x="9" y="13" width="14" height="12" fill="#991b1b" />
          <rect x="12" y="15" width="8" height="9" fill="#f59e0b" />
          <rect x="10" y="5" width="12" height="8" fill="#b91c1c" />
          <rect x="9" y="2" width="2" height="4" fill="#fbbf24" />
          <rect x="21" y="2" width="2" height="4" fill="#fbbf24" />
          <rect x="12" y="8" width="2" height="2" fill="#fef08a" />
          <rect x="18" y="8" width="2" height="2" fill="#fef08a" />
          <rect x="13" y="11" width="6" height="2" fill="#fb923c" />
          <rect x="10" y="25" width="4" height="3" fill="#7f1d1d" />
          <rect x="18" y="25" width="4" height="3" fill="#7f1d1d" />
        </g>
      )}
    </svg>
  );
};

export const PixelTorch: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className="pixel-art anim-torch shrink-0"
    aria-hidden="true"
  >
    <rect x="7" y="9" width="2" height="6" fill="#78350f" />
    <rect x="6" y="8" width="4" height="2" fill="#475569" />
    <rect x="6" y="4" width="4" height="4" fill="#f97316" />
    <rect x="7" y="2" width="2" height="3" fill="#facc15" />
    <rect x="7" y="5" width="2" height="2" fill="#fef08a" />
  </svg>
);

export const PixelCampfire: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className="pixel-art shrink-0"
    aria-hidden="true"
  >
    <rect x="3" y="12" width="10" height="2" fill="#78350f" />
    <rect x="5" y="11" width="6" height="2" fill="#92400e" />
    <rect x="5" y="6" width="6" height="5" fill="#ea580c" />
    <rect x="6" y="4" width="4" height="5" fill="#f59e0b" />
    <rect x="7" y="7" width="2" height="3" fill="#fef08a" />
  </svg>
);

export const PixelCheckpointCrystal: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className="pixel-art shrink-0"
    aria-hidden="true"
  >
    <rect x="4" y="12" width="8" height="3" fill="#475569" />
    <rect x="5" y="11" width="6" height="1" fill="#94a3b8" />
    <rect x="7" y="2" width="2" height="9" fill="#22d3ee" />
    <rect x="6" y="4" width="4" height="6" fill="#06b6d4" />
    <rect x="7" y="4" width="1" height="4" fill="#ecfeff" />
  </svg>
);

export const PixelTombstone: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className="pixel-art shrink-0"
    aria-hidden="true"
  >
    <rect x="3" y="13" width="10" height="2" fill="#334155" />
    <rect x="4" y="4" width="8" height="9" fill="#64748b" />
    <rect x="5" y="2" width="6" height="2" fill="#94a3b8" />
    <rect x="7" y="5" width="2" height="5" fill="#1e293b" />
    <rect x="6" y="6" width="4" height="2" fill="#1e293b" />
    <rect x="10" y="9" width="2" height="2" fill="#475569" />
  </svg>
);

export const PixelHourglass: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className="pixel-art shrink-0" aria-hidden="true">
    <rect x="3" y="2" width="10" height="2" fill="#b45309" />
    <rect x="3" y="12" width="10" height="2" fill="#b45309" />
    <rect x="5" y="4" width="6" height="3" fill="#bae6fd" />
    <rect x="6" y="7" width="4" height="2" fill="#f59e0b" />
    <rect x="5" y="9" width="6" height="3" fill="#fbbf24" />
  </svg>
);

export const PixelScroll: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className="pixel-art shrink-0" aria-hidden="true">
    <rect x="4" y="2" width="9" height="11" fill="#fef3c7" />
    <rect x="3" y="2" width="2" height="12" fill="#d97706" />
    <rect x="12" y="11" width="2" height="3" fill="#b45309" />
    <rect x="6" y="5" width="5" height="1" fill="#78350f" />
    <rect x="6" y="7" width="5" height="1" fill="#78350f" />
    <rect x="9" y="9" width="2" height="2" fill="#dc2626" />
  </svg>
);

export const PixelSwordIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className="pixel-art shrink-0" aria-hidden="true">
    <rect x="11" y="2" width="3" height="3" fill="#e2e8f0" />
    <rect x="9" y="4" width="3" height="3" fill="#cbd5e1" />
    <rect x="7" y="6" width="3" height="3" fill="#94a3b8" />
    <rect x="4" y="8" width="5" height="2" fill="#f59e0b" />
    <rect x="3" y="11" width="2" height="3" fill="#78350f" />
  </svg>
);

export const PixelMoonIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className="pixel-art shrink-0" aria-hidden="true">
    <rect x="5" y="2" width="5" height="2" fill="#fbbf24" />
    <rect x="3" y="4" width="4" height="8" fill="#f59e0b" />
    <rect x="5" y="12" width="5" height="2" fill="#fbbf24" />
    <rect x="11" y="4" width="2" height="2" fill="#fef08a" />
  </svg>
);

export const PixelCalendarIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className="pixel-art shrink-0" aria-hidden="true">
    <rect x="2" y="3" width="12" height="11" fill="#e2e8f0" />
    <rect x="2" y="3" width="12" height="3" fill="#dc2626" />
    <rect x="4" y="1" width="2" height="3" fill="#475569" />
    <rect x="10" y="1" width="2" height="3" fill="#475569" />
    <rect x="4" y="8" width="2" height="2" fill="#334155" />
    <rect x="7" y="8" width="2" height="2" fill="#334155" />
    <rect x="10" y="8" width="2" height="2" fill="#f59e0b" />
  </svg>
);

export const PixelMysterySprite: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    shapeRendering="crispEdges"
    className={`pixel-art shrink-0 ${className}`}
    aria-label="Locked Mystery"
  >
    <rect x="4" y="4" width="24" height="24" fill="#0f172a" />
    <rect x="5" y="5" width="22" height="22" fill="#1e293b" />
    <rect x="12" y="8" width="8" height="2" fill="#94a3b8" />
    <rect x="10" y="10" width="3" height="3" fill="#94a3b8" />
    <rect x="19" y="10" width="3" height="5" fill="#94a3b8" />
    <rect x="16" y="15" width="4" height="2" fill="#94a3b8" />
    <rect x="14" y="17" width="3" height="3" fill="#94a3b8" />
    <rect x="14" y="22" width="3" height="3" fill="#cbd5e1" />
  </svg>
);

export interface PixelDungeonDioramaProps {
  rank: HunterRank;
  avatarStyle?: HeroAvatarStyle;
  hp: number;
  maxHp: number;
  shadowsCount?: number;
  chapter?: StoryChapter | null;
  activeBoss?: BossMission | null;
  onOpenCampaign?: () => void;
}

export const PixelDungeonDiorama: React.FC<PixelDungeonDioramaProps> = ({
  rank,
  avatarStyle = 'shadow_monarch',
  hp,
  maxHp,
  shadowsCount = 0,
  chapter,
  activeBoss,
  onOpenCampaign,
}) => {
  const hpPct = Math.round((Math.max(0, hp) / Math.max(1, maxHp)) * 100);
  const mood: 'healthy' | 'wounded' | 'critical' =
    hpPct <= 25 ? 'critical' : hpPct <= 55 ? 'wounded' : 'healthy';

  // Strict Fog-of-War: ONLY show the currently unlocked uncompleted stage
  const stages = chapter?.stages || [];
  const activeStage = stages.find((s) => s.unlocked && !s.completed) || null;
  const isCompletedAll = Boolean(chapter?.completed && !activeStage);

  const isMinionStage = activeStage?.kind === 'minion_wave';
  const stageBoss =
    activeStage && !isMinionStage && activeBoss && activeBoss.unlocked && !activeBoss.defeated
      ? activeBoss
      : null;

  const targetArchetype: MonsterArchetype = isMinionStage
    ? activeStage.archetype
    : stageBoss?.archetype || activeStage?.archetype || 'slime';

  const targetLabel = isCompletedAll
    ? 'Đã hoàn tất Hành trình'
    : activeStage
      ? isMinionStage
        ? `Màn ${activeStage.code}: ${activeStage.minionName || activeStage.title} (${
            activeStage.minionProgress ?? 0
          }/${activeStage.minionCountRequired ?? 2} Quest)`
        : `Màn ${activeStage.code}: ${stageBoss ? stageBoss.title : activeStage.title}`
      : `Chương ${chapter?.chapterNumber ?? 1}`;

  const barCurrent = isMinionStage
    ? activeStage?.minionProgress ?? 0
    : stageBoss
      ? stageBoss.currentHp
      : 1;
  const barMax = isMinionStage
    ? Math.max(1, activeStage?.minionCountRequired ?? 2)
    : stageBoss
      ? Math.max(1, stageBoss.maxHp)
      : 1;
  const barPct = Math.min(100, Math.max(0, Math.round((barCurrent / barMax) * 100)));

  return (
    <section
      className="relative flex min-h-[56px] flex-col justify-between gap-2 overflow-hidden px-4 py-1.5 sm:flex-row sm:items-center sm:px-5"
      style={{
        background:
          'linear-gradient(180deg, #0f1422 0%, #151c30 70%, #0c101b 70%, #121828 100%)',
      }}
    >
      <span className="anim-ember pointer-events-none absolute bottom-3 left-12 h-1 w-1 bg-amber-400" />
      <span
        className="anim-ember pointer-events-none absolute bottom-3 right-24 h-1 w-1 bg-orange-400"
        style={{ animationDelay: '0.9s' }}
      />

      {/* Left: Torch + Hero + Shadow + Checkpoint Crystal + Current Stage */}
      <div className="relative z-10 flex items-center gap-2.5">
        <PixelTorch size={22} />
        <div className="flex items-end gap-1">
          {shadowsCount > 0 && (
            <div
              className="mb-1 flex h-6 w-6 items-center justify-center border border-indigo-400/40 bg-indigo-950/80 rounded-[2px]"
              title={`${shadowsCount} Shadow Soldier`}
            >
              <span className="font-pixel text-[9px] text-indigo-300">S{shadowsCount}</span>
            </div>
          )}
          <PixelHeroSprite rank={rank} avatarStyle={avatarStyle} mood={mood} size={40} />
          <PixelCheckpointCrystal size={16} />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-pixel border border-amber-400/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 rounded-[2px]">
              CH.{chapter?.chapterNumber ?? 1}
            </span>
            <p className="truncate font-display text-xs font-bold text-slate-100">
              {targetLabel}
            </p>
          </div>
          {isCompletedAll && (
            <p className="text-[11px] text-emerald-400">Đã hoàn tất Hành trình</p>
          )}
        </div>
      </div>

      {/* Right: Spoiler-free Progress + Monster + Link */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 sm:justify-end">
        {!isCompletedAll && activeStage && (
          <div className="flex items-center gap-2">
            <div className="rpg-bar-track h-2 w-24 border-slate-600 bg-[#0b0e18]">
              <div
                className={`h-full transition-all ${
                  isMinionStage
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                    : 'bg-gradient-to-r from-rose-700 to-rose-400'
                }`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] font-bold text-slate-200">
              {isMinionStage ? `${barCurrent}/${barMax}` : `${barCurrent}/${barMax} HP`}
            </span>
            <PixelMonsterSprite
              archetype={targetArchetype}
              size={40}
              isBoss={activeStage.kind === 'chapter_boss'}
              isElite={activeStage.kind === 'mini_boss'}
            />
          </div>
        )}

        <PixelTorch size={20} />
        {onOpenCampaign && (
          <button
            type="button"
            onClick={onOpenCampaign}
            className="btn-secondary px-2.5 py-1 text-xs font-bold text-amber-400"
          >
            Hành Trình →
          </button>
        )}
      </div>
    </section>
  );
};
