import React from 'react';
import type { RaidBossArchetype } from '../types/system';

export interface RaidBossSpriteProps {
  archetype: RaidBossArchetype;
  size?: number;
  enraged?: boolean;
  defeated?: boolean;
  className?: string;
}

export interface PxTreasureChestProps {
  state: 'locked' | 'ready' | 'claimed';
  size?: number;
  isGrand?: boolean;
  className?: string;
}

interface BossPalette {
  ink: string;
  body: string;
  shade: string;
  trim: string;
  hi: string;
  accent: string;
  eye: string;
  core: string;
}

const ARCHETYPE_PALETTES: Record<RaidBossArchetype, Omit<BossPalette, 'ink'>> = {
  chronos_lich: {
    body: '#32527a',
    shade: '#1e324d',
    trim: '#c99330',
    hi: '#f0c46c',
    accent: '#74ace8',
    eye: '#74ace8',
    core: '#f5d57a',
  },
  sloth_behemoth: {
    body: '#38304d',
    shade: '#221c30',
    trim: '#6e658a',
    hi: '#a399c2',
    accent: '#73499e',
    eye: '#e6a23c',
    core: '#b792e0',
  },
  siren_of_feeds: {
    body: '#2a6b6e',
    shade: '#194345',
    trim: '#73499e',
    hi: '#74ace8',
    accent: '#52c484',
    eye: '#52c484',
    core: '#b792e0',
  },
  obsidian_dragon: {
    body: '#2b2438',
    shade: '#171221',
    trim: '#c99330',
    hi: '#f0c46c',
    accent: '#b83a4b',
    eye: '#f0c46c',
    core: '#d96426',
  },
  phantom_architect: {
    body: '#2d3b59',
    shade: '#1a2338',
    trim: '#c5bcd6',
    hi: '#f3ead8',
    accent: '#3b82c4',
    eye: '#74ace8',
    core: '#f0c46c',
  },
  iron_golem_king: {
    body: '#5a556b',
    shade: '#383445',
    trim: '#c99330',
    hi: '#9e97b3',
    accent: '#d96426',
    eye: '#f0c46c',
    core: '#e68a2e',
  },
  void_hydra: {
    body: '#4b2d6b',
    shade: '#2c1942',
    trim: '#2e8b57',
    hi: '#b792e0',
    accent: '#52c484',
    eye: '#f0c46c',
    core: '#52c484',
  },
  eclipse_monarch: {
    body: '#241e33',
    shade: '#120e1c',
    trim: '#c99330',
    hi: '#f5d57a',
    accent: '#b83a4b',
    eye: '#f0c46c',
    core: '#d94154',
  },
};

function getBossPalette(
  archetype: RaidBossArchetype,
  enraged: boolean,
  defeated: boolean
): BossPalette {
  const base = ARCHETYPE_PALETTES[archetype];
  if (defeated) {
    return {
      ink: '#09070f',
      body: '#423e54',
      shade: '#2a2738',
      trim: '#6a6482',
      hi: '#8b84a6',
      accent: '#544e6b',
      eye: '#948ca8',
      core: '#4c4761',
    };
  }
  if (enraged) {
    return {
      ink: '#09070f',
      body: base.body,
      shade: base.shade,
      trim: '#e6a23c',
      hi: '#f5d57a',
      accent: '#ff4d5a',
      eye: '#ff4d5a',
      core: '#ff4d5a',
    };
  }
  return {
    ink: '#09070f',
    ...base,
  };
}

const EnrageRageSparks: React.FC = () => (
  <>
    {/* Jagged 16-bit crimson & ember pixel sparks */}
    <rect x="2" y="8" width="2" height="3" fill="#ff4d5a" />
    <rect x="3" y="6" width="1" height="2" fill="#f0c46c" />
    <rect x="28" y="8" width="2" height="3" fill="#ff4d5a" />
    <rect x="28" y="6" width="1" height="2" fill="#f0c46c" />
    <rect x="4" y="21" width="2" height="2" fill="#d96426" />
    <rect x="26" y="21" width="2" height="2" fill="#d96426" />
    <rect x="14" y="1" width="1" height="2" fill="#ff4d5a" />
    <rect x="17" y="1" width="1" height="2" fill="#f0c46c" />
  </>
);

const DefeatedCrossEye: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <>
    <rect x={x} y={y} width="1" height="1" fill={color} />
    <rect x={x + 2} y={y} width="1" height="1" fill={color} />
    <rect x={x + 1} y={y + 1} width="1" height="1" fill={color} />
    <rect x={x} y={y + 2} width="1" height="1" fill={color} />
    <rect x={x + 2} y={y + 2} width="1" height="1" fill={color} />
  </>
);

export const RaidBossSprite: React.FC<RaidBossSpriteProps> = ({
  archetype,
  size = 96,
  enraged = false,
  defeated = false,
  className = '',
}) => {
  const p = getBossPalette(archetype, enraged && !defeated, defeated);
  const isEnraged = enraged && !defeated;
  const animClass = defeated ? 'opacity-75' : 'anim-monster-idle';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      className={`pixel-art shrink-0 ${animClass} ${className}`.trim()}
      aria-hidden="true"
    >
      {/* 1. CHRONOS LICH — Clockwork Lich with Floating Hourglass & Crown */}
      {archetype === 'chronos_lich' && (
        <>
          {/* Clockwork gear halo */}
          <rect x="11" y="2" width="10" height="1" fill={p.ink} />
          <rect x="12" y="3" width="8" height="2" fill={p.trim} />
          <rect x="13" y="2" width="2" height="2" fill={p.hi} />
          <rect x="17" y="2" width="2" height="2" fill={p.hi} />
          {defeated && <rect x="15" y="2" width="2" height="3" fill={p.ink} />}
          {/* Hood & Skull */}
          <rect x="10" y="5" width="12" height="10" fill={p.ink} />
          <rect x="11" y="6" width="10" height="8" fill={p.body} />
          <rect x="12" y="7" width="8" height="6" fill={p.shade} />
          <rect x="13" y="8" width="6" height="5" fill="#e5dcc5" />
          {defeated ? (
            <>
              <DefeatedCrossEye x={13} y={8} color={p.ink} />
              <DefeatedCrossEye x={17} y={8} color={p.ink} />
            </>
          ) : (
            <>
              <rect x="13" y="9" width="2" height="2" fill={p.eye} />
              <rect x="17" y="9" width="2" height="2" fill={p.eye} />
            </>
          )}
          <rect x="14" y="12" width="4" height="1" fill={p.ink} />
          {/* Robe & Pauldrons */}
          <rect x="7" y="15" width="18" height="13" fill={p.ink} />
          <rect x="8" y="16" width="16" height="11" fill={p.body} />
          <rect x="8" y="16" width="4" height="3" fill={p.trim} />
          <rect x="20" y="16" width="4" height="3" fill={p.trim} />
          <rect x="12" y="16" width="8" height="10" fill={p.shade} />
          {/* Chest clockwork core */}
          <rect x="14" y="18" width="4" height="4" fill={p.trim} />
          <rect x="15" y="19" width="2" height="2" fill={p.core} />
          <rect x="11" y="27" width="10" height="2" fill={p.trim} />
          {/* Floating Pixel Hourglass (Right) */}
          <rect x="24" y="10" width="6" height="11" fill={p.ink} />
          <rect x="25" y="11" width="4" height="1" fill={p.hi} />
          <rect x="25" y="12" width="4" height="2" fill={p.accent} />
          <rect x="26" y="14" width="2" height="2" fill={p.core} />
          <rect x="25" y="16" width="4" height="2" fill={p.hi} />
          <rect x="25" y="19" width="4" height="1" fill={p.hi} />
          {/* Floating Chronos Scepter (Left) */}
          <rect x="3" y="11" width="3" height="14" fill={p.ink} />
          <rect x="4" y="12" width="1" height="12" fill={p.trim} />
          <rect x="3" y="11" width="3" height="3" fill={p.core} />
        </>
      )}

      {/* 2. SLOTH BEHEMOTH — Horned Obsidian Slumber Behemoth with Heavy Chains */}
      {archetype === 'sloth_behemoth' && (
        <>
          {/* Curved Horns */}
          <rect x="5" y="4" width="4" height="4" fill={p.ink} />
          <rect x="6" y="5" width="3" height="3" fill={p.hi} />
          <rect x="23" y="4" width="4" height="4" fill={p.ink} />
          <rect x="23" y="5" width="3" height="3" fill={p.hi} />
          {/* Massive Hulking Silhouette */}
          <rect x="5" y="8" width="22" height="19" fill={p.ink} />
          <rect x="6" y="9" width="20" height="17" fill={p.body} />
          <rect x="7" y="10" width="18" height="5" fill={p.shade} />
          {/* Brow & Eyes */}
          <rect x="10" y="9" width="12" height="6" fill={p.body} />
          {defeated ? (
            <>
              <DefeatedCrossEye x={11} y={11} color={p.eye} />
              <DefeatedCrossEye x={18} y={11} color={p.eye} />
            </>
          ) : (
            <>
              <rect x="11" y="11" width="3" height="2" fill={p.eye} />
              <rect x="18" y="11" width="3" height="2" fill={p.eye} />
            </>
          )}
          {/* Heavy Iron Chains draped across chest */}
          <rect x="6" y="16" width="20" height="2" fill={p.trim} />
          <rect x="8" y="18" width="3" height="2" fill={p.hi} />
          <rect x="14" y="18" width="4" height="2" fill={p.hi} />
          <rect x="21" y="18" width="3" height="2" fill={p.hi} />
          {/* Slumber / Rage Core */}
          <rect x="13" y="20" width="6" height="4" fill={p.shade} />
          <rect x="14" y="21" width="4" height="2" fill={p.core} />
          {/* Claws / Shackles */}
          <rect x="3" y="17" width="4" height="9" fill={p.ink} />
          <rect x="4" y="18" width="2" height="7" fill={p.trim} />
          <rect x="25" y="17" width="4" height="9" fill={p.ink} />
          <rect x="26" y="18" width="2" height="7" fill={p.trim} />
          <rect x="7" y="26" width="6" height="3" fill={p.shade} />
          <rect x="19" y="26" width="6" height="3" fill={p.shade} />
        </>
      )}

      {/* 3. SIREN OF FEEDS — Cursed Pixel Siren with Glowing Scroll Runes */}
      {archetype === 'siren_of_feeds' && (
        <>
          {/* Crown & Flowing Fins */}
          <rect x="9" y="3" width="14" height="10" fill={p.ink} />
          <rect x="10" y="4" width="12" height="8" fill={p.body} />
          <rect x="14" y="2" width="4" height="3" fill={p.trim} />
          <rect x="15" y="3" width="2" height="2" fill={p.core} />
          {/* Face */}
          <rect x="12" y="7" width="8" height="6" fill="#c7d5e8" />
          {defeated ? (
            <>
              <DefeatedCrossEye x={12} y={8} color={p.ink} />
              <DefeatedCrossEye x={17} y={8} color={p.ink} />
            </>
          ) : (
            <>
              <rect x="13" y="9" width="2" height="2" fill={p.eye} />
              <rect x="17" y="9" width="2" height="2" fill={p.eye} />
            </>
          )}
          {/* Siren Mantle & Serpentine Tail */}
          <rect x="10" y="13" width="12" height="9" fill={p.ink} />
          <rect x="11" y="14" width="10" height="7" fill={p.shade} />
          <rect x="13" y="15" width="6" height="4" fill={p.accent} />
          <rect x="15" y="16" width="2" height="2" fill={p.core} />
          <rect x="8" y="22" width="14" height="6" fill={p.ink} />
          <rect x="9" y="23" width="12" height="4" fill={p.body} />
          <rect x="6" y="26" width="8" height="3" fill={p.trim} />
          {/* Floating Cursed Scroll Runes (Left & Right) */}
          <rect x="2" y="9" width="5" height="9" fill={p.ink} />
          <rect x="3" y="10" width="3" height="7" fill={p.hi} />
          <rect x="4" y="11" width="1" height="1" fill={p.core} />
          <rect x="4" y="13" width="1" height="2" fill={p.ink} />
          <rect x="25" y="11" width="5" height="9" fill={p.ink} />
          <rect x="26" y="12" width="3" height="7" fill={p.hi} />
          <rect x="27" y="13" width="1" height="2" fill={p.core} />
          <rect x="27" y="16" width="1" height="1" fill={p.ink} />
        </>
      )}

      {/* 4. OBSIDIAN DRAGON — Winged Dark Pixel Wyrm with Gold/Crimson Belly */}
      {archetype === 'obsidian_dragon' && (
        <>
          {/* Spread Bat Wings */}
          <rect x="1" y="6" width="9" height="11" fill={p.ink} />
          <rect x="2" y="7" width="7" height="8" fill={p.shade} />
          <rect x="3" y="8" width="2" height="5" fill={p.body} />
          <rect x="22" y="6" width="9" height="11" fill={p.ink} />
          <rect x="23" y="7" width="7" height="8" fill={p.shade} />
          <rect x="27" y="8" width="2" height="5" fill={p.body} />
          {/* Horned Dragon Head */}
          <rect x="11" y="2" width="2" height="4" fill={p.trim} />
          <rect x="19" y="2" width="2" height="4" fill={p.trim} />
          <rect x="10" y="5" width="12" height="9" fill={p.ink} />
          <rect x="11" y="6" width="10" height="7" fill={p.body} />
          {defeated ? (
            <>
              <DefeatedCrossEye x={12} y={7} color={p.eye} />
              <DefeatedCrossEye x={17} y={7} color={p.eye} />
            </>
          ) : (
            <>
              <rect x="12" y="8" width="2" height="2" fill={p.eye} />
              <rect x="18" y="8" width="2" height="2" fill={p.eye} />
            </>
          )}
          <rect x="13" y="11" width="6" height="2" fill={p.accent} />
          {/* Armored Wyrm Torso & Gold/Crimson Belly Scales */}
          <rect x="9" y="14" width="14" height="13" fill={p.ink} />
          <rect x="10" y="15" width="12" height="11" fill={p.body} />
          <rect x="13" y="15" width="6" height="2" fill={p.hi} />
          <rect x="13" y="18" width="6" height="2" fill={p.accent} />
          <rect x="13" y="21" width="6" height="2" fill={p.hi} />
          <rect x="14" y="24" width="4" height="2" fill={p.core} />
          {/* Claws & Tail */}
          <rect x="7" y="25" width="5" height="4" fill={p.shade} />
          <rect x="20" y="25" width="5" height="4" fill={p.shade} />
          <rect x="23" y="23" width="6" height="3" fill={p.trim} />
        </>
      )}

      {/* 5. PHANTOM ARCHITECT — Hooded Compass-Wraith with Floating Monoliths */}
      {archetype === 'phantom_architect' && (
        <>
          {/* Drafting Halo */}
          <rect x="11" y="2" width="10" height="2" fill={p.trim} />
          <rect x="15" y="1" width="2" height="3" fill={p.core} />
          {/* Tall Hooded Wraith Cowl */}
          <rect x="10" y="4" width="12" height="11" fill={p.ink} />
          <rect x="11" y="5" width="10" height="9" fill={p.body} />
          <rect x="13" y="7" width="6" height="6" fill={p.ink} />
          {defeated ? (
            <>
              <DefeatedCrossEye x={13} y={8} color={p.eye} />
              <DefeatedCrossEye x={17} y={8} color={p.eye} />
            </>
          ) : (
            <>
              <rect x="13" y="9" width="2" height="2" fill={p.eye} />
              <rect x="17" y="9" width="2" height="2" fill={p.eye} />
            </>
          )}
          {/* Geometric Mantle & Compass Core */}
          <rect x="9" y="15" width="14" height="12" fill={p.ink} />
          <rect x="10" y="16" width="12" height="10" fill={p.shade} />
          <rect x="15" y="17" width="2" height="6" fill={p.trim} />
          <rect x="13" y="19" width="6" height="2" fill={p.core} />
          <rect x="10" y="26" width="3" height="3" fill={p.body} />
          <rect x="15" y="26" width="2" height="3" fill={p.body} />
          <rect x="19" y="26" width="3" height="3" fill={p.body} />
          {/* Floating Geometric Monoliths */}
          <rect x="2" y="10" width="5" height="10" fill={p.ink} />
          <rect x="3" y="11" width="3" height="8" fill={p.accent} />
          <rect x="4" y="13" width="1" height="4" fill={p.hi} />
          <rect x="25" y="10" width="5" height="10" fill={p.ink} />
          <rect x="26" y="11" width="3" height="8" fill={p.accent} />
          <rect x="27" y="13" width="1" height="4" fill={p.hi} />
        </>
      )}

      {/* 6. IRON GOLEM KING — Crowned Stone-Iron Colossus with Molten Core */}
      {archetype === 'iron_golem_king' && (
        <>
          {/* Iron Crown */}
          <rect x="10" y="2" width="12" height="4" fill={p.ink} />
          <rect x="11" y="3" width="2" height="2" fill={p.trim} />
          <rect x="15" y="2" width="2" height="3" fill={p.hi} />
          <rect x="19" y="3" width="2" height="2" fill={p.trim} />
          {defeated && <rect x="14" y="2" width="2" height="3" fill={p.ink} />}
          {/* Stone Head */}
          <rect x="10" y="6" width="12" height="6" fill={p.ink} />
          <rect x="11" y="7" width="10" height="4" fill={p.body} />
          {defeated ? (
            <>
              <DefeatedCrossEye x={12} y={8} color={p.eye} />
              <DefeatedCrossEye x={17} y={8} color={p.eye} />
            </>
          ) : (
            <>
              <rect x="12" y="8" width="3" height="2" fill={p.eye} />
              <rect x="17" y="8" width="3" height="2" fill={p.eye} />
            </>
          )}
          {/* Broad Plated Shoulders & Molten Core Chest */}
          <rect x="3" y="12" width="26" height="11" fill={p.ink} />
          <rect x="4" y="13" width="24" height="9" fill={p.body} />
          <rect x="4" y="13" width="5" height="4" fill={p.trim} />
          <rect x="23" y="13" width="5" height="4" fill={p.trim} />
          <rect x="11" y="13" width="10" height="8" fill={p.shade} />
          {/* Cracked Molten Core */}
          <rect x="13" y="15" width="6" height="4" fill={p.accent} />
          <rect x="14" y="16" width="4" height="2" fill={p.core} />
          {/* Heavy Fists & Legs */}
          <rect x="2" y="22" width="6" height="6" fill={p.ink} />
          <rect x="3" y="23" width="4" height="4" fill={p.hi} />
          <rect x="24" y="22" width="6" height="6" fill={p.ink} />
          <rect x="25" y="23" width="4" height="4" fill={p.hi} />
          <rect x="9" y="23" width="5" height="6" fill={p.shade} />
          <rect x="18" y="23" width="5" height="6" fill={p.shade} />
        </>
      )}

      {/* 7. VOID HYDRA — Three-Headed Void Pixel Hydra */}
      {archetype === 'void_hydra' && (
        <>
          {/* Center Apex Head */}
          <rect x="12" y="2" width="8" height="7" fill={p.ink} />
          <rect x="13" y="3" width="6" height="5" fill={p.body} />
          <rect x="14" y="2" width="4" height="1" fill={p.trim} />
          {/* Left Head */}
          <rect x="2" y="6" width="8" height="7" fill={p.ink} />
          <rect x="3" y="7" width="6" height="5" fill={p.body} />
          <rect x="4" y="13" width="4" height="5" fill={p.shade} />
          {/* Right Head */}
          <rect x="22" y="6" width="8" height="7" fill={p.ink} />
          <rect x="23" y="7" width="6" height="5" fill={p.body} />
          <rect x="24" y="13" width="4" height="5" fill={p.shade} />
          {/* Eyes across 3 heads */}
          {defeated ? (
            <>
              <DefeatedCrossEye x={14} y={4} color={p.eye} />
              <DefeatedCrossEye x={4} y={8} color={p.eye} />
              <DefeatedCrossEye x={24} y={8} color={p.eye} />
            </>
          ) : (
            <>
              <rect x="14" y="5" width="1" height="2" fill={p.eye} />
              <rect x="17" y="5" width="1" height="2" fill={p.eye} />
              <rect x="4" y="9" width="2" height="1" fill={p.eye} />
              <rect x="7" y="9" width="1" height="1" fill={p.eye} />
              <rect x="24" y="9" width="1" height="1" fill={p.eye} />
              <rect x="26" y="9" width="2" height="1" fill={p.eye} />
            </>
          )}
          {/* Center Neck & Hydroid Scaled Body */}
          <rect x="14" y="9" width="4" height="6" fill={p.shade} />
          <rect x="7" y="15" width="18" height="13" fill={p.ink} />
          <rect x="8" y="16" width="16" height="11" fill={p.body} />
          <rect x="12" y="17" width="8" height="8" fill={p.trim} />
          <rect x="14" y="19" width="4" height="4" fill={p.core} />
          <rect x="8" y="26" width="5" height="3" fill={p.shade} />
          <rect x="19" y="26" width="5" height="3" fill={p.shade} />
        </>
      )}

      {/* 8. ECLIPSE MONARCH — Solar-Eclipse Armored Overlord with Twin Greatswords */}
      {archetype === 'eclipse_monarch' && (
        <>
          {/* Solar Eclipse Halo Ring behind Helm */}
          <rect x="10" y="1" width="12" height="2" fill={p.trim} />
          <rect x="8" y="3" width="2" height="6" fill={p.trim} />
          <rect x="22" y="3" width="2" height="6" fill={p.trim} />
          <rect x="11" y="2" width="10" height="2" fill={p.core} />
          {/* Armored Overlord Helm */}
          <rect x="11" y="4" width="10" height="10" fill={p.ink} />
          <rect x="12" y="5" width="8" height="8" fill={p.body} />
          <rect x="15" y="4" width="2" height="4" fill={p.hi} />
          {defeated ? (
            <>
              <DefeatedCrossEye x={12} y={7} color={p.eye} />
              <DefeatedCrossEye x={17} y={7} color={p.eye} />
            </>
          ) : (
            <>
              <rect x="13" y="8" width="2" height="2" fill={p.eye} />
              <rect x="17" y="8" width="2" height="2" fill={p.eye} />
            </>
          )}
          {/* Royal Cape & Heavy Armor */}
          <rect x="7" y="14" width="18" height="14" fill={p.ink} />
          <rect x="8" y="15" width="16" height="12" fill={p.shade} />
          <rect x="11" y="15" width="10" height="11" fill={p.body} />
          <rect x="8" y="15" width="4" height="3" fill={p.trim} />
          <rect x="20" y="15" width="4" height="3" fill={p.trim} />
          <rect x="14" y="17" width="4" height="5" fill={p.accent} />
          <rect x="15" y="18" width="2" height="3" fill={p.core} />
          {/* Twin Greatswords */}
          <rect x="2" y="5" width="3" height="20" fill={p.ink} />
          <rect x="3" y="6" width="1" height="14" fill={p.hi} />
          <rect x="1" y="20" width="5" height="2" fill={p.trim} />
          <rect x="3" y="22" width="1" height="3" fill={p.accent} />
          <rect x="27" y="5" width="3" height="20" fill={p.ink} />
          <rect x="28" y="6" width="1" height="14" fill={p.hi} />
          <rect x="26" y="20" width="5" height="2" fill={p.trim} />
          <rect x="28" y="22" width="1" height="3" fill={p.accent} />
        </>
      )}

      {isEnraged && <EnrageRageSparks />}
    </svg>
  );
};

export const PxTreasureChest: React.FC<PxTreasureChestProps> = ({
  state,
  size = 28,
  isGrand = false,
  className = '',
}) => {
  const trim =
    state === 'locked'
      ? isGrand
        ? '#9c7838'
        : '#5e5875'
      : state === 'claimed'
        ? '#7d6844'
        : '#f0c46c';
  const body =
    state === 'locked'
      ? isGrand
        ? '#451824'
        : '#2b263d'
      : state === 'claimed'
        ? '#4a3623'
        : isGrand
          ? '#9e2638'
          : '#8a5524';
  const hi = state === 'ready' ? '#fff2c2' : state === 'locked' ? '#7a7294' : '#a8844c';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`pixel-art shrink-0 ${className}`.trim()}
      aria-hidden="true"
    >
      {state === 'claimed' ? (
        <>
          {/* Open Lid */}
          <rect x="2" y="2" width="12" height="4" fill="#09070f" />
          <rect x="3" y="3" width="10" height="2" fill={body} />
          <rect x="3" y="3" width="10" height="1" fill={trim} />
          {/* Dark Empty Interior */}
          <rect x="2" y="6" width="12" height="3" fill="#09070f" />
          <rect x="3" y="7" width="10" height="2" fill="#100e18" />
          {/* Base */}
          <rect x="2" y="9" width="12" height="5" fill="#09070f" />
          <rect x="3" y="10" width="10" height="3" fill={body} />
          <rect x="7" y="9" width="2" height="2" fill={trim} />
        </>
      ) : (
        <>
          {/* Chest Silhouette */}
          <rect x="2" y={state === 'ready' ? 3 : 4} width="12" height="4" fill="#09070f" />
          <rect x="3" y={state === 'ready' ? 4 : 5} width="10" height="2" fill={body} />
          <rect x="3" y={state === 'ready' ? 4 : 5} width="10" height="1" fill={trim} />

          {state === 'ready' && (
            <>
              {/* Shimmering gold inside ajar lid */}
              <rect x="2" y="7" width="12" height="2" fill="#09070f" />
              <rect x="3" y="7" width="10" height="2" fill="#f0c46c" />
              <rect x="5" y="7" width="4" height="1" fill="#fff2c2" />
              {/* Sparkle glints */}
              <rect x="1" y="2" width="1" height="1" fill="#fff2c2" />
              <rect x="14" y="1" width="1" height="2" fill="#f0c46c" />
            </>
          )}

          {/* Chest Body & Rim */}
          <rect x="2" y={state === 'ready' ? 9 : 8} width="12" height={state === 'ready' ? 5 : 6} fill="#09070f" />
          <rect x="3" y={state === 'ready' ? 9 : 9} width="10" height="4" fill={body} />
          <rect x="3" y="9" width="10" height="1" fill={trim} />
          {/* Center Lock Clasp */}
          <rect x="6" y="7" width="4" height="4" fill="#09070f" />
          <rect x="7" y="8" width="2" height="2" fill={hi} />
        </>
      )}
    </svg>
  );
};
