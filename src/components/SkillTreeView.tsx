import React, { useMemo, useState } from 'react';
import type {
  PlayerGrowthBonuses,
  PlayerState,
  SkillBranchId,
  SkillNode,
} from '../types/system';
import {
  PixelRivets,
  PxBolt,
  PxBook,
  PxCheck,
  PxChevron,
  PxCoin,
  PxCrown,
  PxFlame,
  PxGem,
  PxLock,
  PxReset,
  PxShield,
  PxSkillTree,
  PxSparkle,
  PxStar,
  PxStatAgi,
  PxStatCha,
  PxStatInt,
  PxStatPer,
  PxStatVit,
  PxTarget,
} from './PixelIcons';

interface SkillTreeViewProps {
  player: PlayerState;
  skills: SkillNode[];
  growthBonuses: PlayerGrowthBonuses;
  onUnlockSkill: (skillId: string) => Promise<void>;
  onUpgradeSkill: (skillId: string) => Promise<void>;
  onRespecSkills: () => Promise<void>;
  onVerifyCustomSkill?: (skillId: string, proofNote: string) => Promise<void>;
}

const BRANCH_ORDER: SkillBranchId[] = [
  'intellect',
  'knowledge',
  'execution',
  'vitality',
  'influence',
];

const BRANCH_META: Record<
  SkillBranchId,
  {
    code: string;
    title: string;
    subtitle: string;
    stat: string;
    hex: string;
    fillVar: string;
    textVar: string;
    badgeText: string;
  }
> = {
  intellect: {
    code: 'INT',
    title: 'Trí Tuệ & Hệ Thống',
    subtitle: 'Tư duy nguyên lý, phân tích & kiến trúc chiến lược',
    stat: 'INT',
    hex: '#c99330',
    fillVar: 'var(--px-gold)',
    textVar: 'var(--px-gold-text)',
    badgeText: '#140e04',
  },
  knowledge: {
    code: 'PER',
    title: 'Tri Thức & Học Sâu',
    subtitle: 'Active Recall, Spaced Repetition & tổng hợp liên ngành',
    stat: 'PER',
    hex: '#3267a8',
    fillVar: 'var(--px-blue)',
    textVar: 'var(--px-blue-text)',
    badgeText: '#ffffff',
  },
  execution: {
    code: 'AGI',
    title: 'Kỷ Luật & Thực Thi',
    subtitle: 'Khởi động 2p, Timeboxing, Nếu-Thì & Ultradian Flow',
    stat: 'AGI',
    hex: '#73499e',
    fillVar: 'var(--px-plum)',
    textVar: 'var(--px-plum-text)',
    badgeText: '#ffffff',
  },
  vitality: {
    code: 'STR/VIT',
    title: 'Thể Lực & Sinh Lực',
    subtitle: 'Giấc ngủ, tải trọng tăng tiến, NSDR & thêm Trái Tim',
    stat: 'VIT',
    hex: '#2e8b57',
    fillVar: 'var(--px-green)',
    textVar: 'var(--px-green-text)',
    badgeText: '#ffffff',
  },
  influence: {
    code: 'CHA',
    title: 'Giao Tiếp & Di Sản',
    subtitle: 'Diễn đạt, lắng nghe, thuyết phục & kiến tạo giá trị',
    stat: 'CHA',
    hex: '#b83a4b',
    fillVar: 'var(--px-red)',
    textVar: 'var(--px-red-text)',
    badgeText: '#ffffff',
  },
};

function renderSkillIcon(
  icon?: string,
  branchId?: SkillBranchId,
  size = 18,
  color = 'currentColor'
) {
  switch (icon) {
    case 'brain':
      return <PxStatInt size={size} />;
    case 'compass':
      return <PxStatPer size={size} color="var(--px-blue-text)" />;
    case 'book':
      return <PxBook size={size} color={color} />;
    case 'zap':
    case 'bolt':
      return <PxBolt size={size} color={color} />;
    case 'flame':
      return <PxFlame size={size} />;
    case 'heart':
      return <PxStatVit size={size} />;
    case 'shield':
      return <PxShield size={size} color={color} />;
    case 'activity':
      return <PxStatAgi size={size} color="var(--px-green-text)" />;
    case 'users':
      return <PxStatCha size={size} color="var(--px-plum-text)" />;
    case 'target':
      return <PxTarget size={size} color="var(--px-green-text)" />;
    case 'crown':
      return <PxCrown size={size} />;
    case 'award':
      return <PxStar size={size} color="var(--px-gold)" />;
    default:
      if (branchId === 'intellect') return <PxStatInt size={size} />;
      if (branchId === 'knowledge') return <PxBook size={size} color={color} />;
      if (branchId === 'execution') return <PxBolt size={size} color={color} />;
      if (branchId === 'vitality') return <PxStatVit size={size} />;
      if (branchId === 'influence') return <PxStatCha size={size} color="var(--px-plum-text)" />;
      return <PxSparkle size={size} color="var(--px-gold)" />;
  }
}

function toRoman(num: number): string {
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rem = Math.max(1, num);
  let out = '';
  for (const [val, sym] of table) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

function computeUnlockOrAscendSpCost(skill: SkillNode): number {
  if (!skill.unlocked) return skill.unlockSpCost ?? 1;
  return (skill.unlockSpCost ?? 1) + (skill.ascensionTier ?? 1);
}

function computeSkillUpgradeCost(skill: SkillNode): { gold: number; runestones: number } {
  const lv = skill.masteryTier || 0;
  const gold = Math.round((skill.baseGoldCost ?? 60) * Math.pow(1.24, lv));
  const runestones =
    (skill.tier ?? 1) >= 3 || lv >= 5
      ? Math.max(1, Math.round((skill.baseRunestoneCost ?? 1) + Math.floor(lv / 3)))
      : skill.baseRunestoneCost ?? 0;
  return { gold, runestones };
}

function areSkillPrerequisitesMet(
  skill: SkillNode,
  skillMap: Map<string, SkillNode>
): boolean {
  if (!skill.prerequisiteIds || skill.prerequisiteIds.length === 0) return true;
  const minLv = skill.minPrereqLevel ?? 1;
  if (skill.requireAnyPrerequisite) {
    return skill.prerequisiteIds.some((id) => (skillMap.get(id)?.masteryTier ?? 0) >= minLv);
  }
  return skill.prerequisiteIds.every((id) => (skillMap.get(id)?.masteryTier ?? 0) >= minLv);
}

export const SkillTreeView: React.FC<SkillTreeViewProps> = ({
  player,
  skills,
  growthBonuses,
  onUnlockSkill,
  onUpgradeSkill,
  onRespecSkills,
  onVerifyCustomSkill,
}) => {
  const treeSkills = useMemo(() => skills.filter((s) => Boolean(s.treeBranch)), [skills]);
  const customSkills = useMemo(() => skills.filter((s) => !s.treeBranch), [skills]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const [branchView, setBranchView] = useState<'all' | SkillBranchId>('all');
  const [selectedId, setSelectedId] = useState<string>(
    () => treeSkills.find((s) => s.id === 'sk-int-1')?.id || treeSkills[0]?.id || ''
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCustomSkills, setShowCustomSkills] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [proofText, setProofText] = useState('');

  const selectedSkill =
    treeSkills.find((s) => s.id === selectedId) || treeSkills[0] || null;

  const hasAnyInvested = treeSkills.some(
    (s) => s.unlocked || s.masteryTier > 0 || (s.ascensionTier ?? 0) > 0
  );
  const sp = player.skillPoints ?? 0;

  const handleAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await fn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const renderNodeMedallion = (skill: SkillNode, branchId: SkillBranchId, compact: boolean) => {
    const meta = BRANCH_META[branchId];
    const prereqOk = areSkillPrerequisitesMet(skill, skillMap);
    const isUnlocked = Boolean(skill.unlocked);
    const rankCap = skill.unlockedRankCap ?? skill.maxTier ?? 5;
    const ascTier = skill.ascensionTier ?? (isUnlocked ? 1 : 0);
    const atCap = isUnlocked && skill.masteryTier >= rankCap;
    const spCost = computeUnlockOrAscendSpCost(skill);
    const canUnlockNow = !isUnlocked && prereqOk && sp >= spCost;
    const canAscendNow = atCap && sp >= spCost;
    const cost = computeSkillUpgradeCost(skill);
    const canUpgradeNow =
      isUnlocked &&
      !atCap &&
      player.gold >= cost.gold &&
      player.runestones >= cost.runestones;
    const isSelected = selectedSkill?.id === skill.id;
    const isAscended = ascTier >= 2;

    const stripeColor = isAscended || canUnlockNow || canAscendNow
      ? 'var(--px-gold)'
      : isUnlocked
        ? meta.fillVar
        : 'var(--border-strong)';

    const plaqueBg = isUnlocked || canUnlockNow ? 'var(--bg-surface-2)' : 'var(--bg-subtle)';
    const plaqueShadow = isAscended
      ? 'inset 2px 2px 0 var(--px-gold), inset -2px -2px 0 var(--border-bevel-lo), 2px 2px 0 rgba(0,0,0,0.4)'
      : isUnlocked || canUnlockNow
        ? 'inset 2px 2px 0 var(--border-bevel-hi), inset -2px -2px 0 var(--border-bevel-lo), 2px 2px 0 rgba(0,0,0,0.32)'
        : 'inset 2px 2px 0 var(--border-bevel-lo), inset -1px -1px 0 var(--border-bevel-hi)';

    const practicePct = Math.min(
      100,
      Math.round(((skill.practiceXp || 0) / Math.max(1, skill.xpPerTier || 100)) * 100)
    );

    return (
      <button
        key={skill.id}
        type="button"
        onClick={() => {
          setSelectedId(skill.id);
          setErrorMsg(null);
        }}
        className={`relative flex w-full flex-col items-center rounded-none border-2 border-[var(--border-ink)] text-center transition-transform active:translate-y-[1px] ${
          compact ? 'px-1.5 pb-2 pt-3' : 'px-3 pb-3 pt-4'
        } ${!isUnlocked && !canUnlockNow ? 'opacity-75 hover:opacity-100' : 'hover:brightness-105'}`}
        style={{
          backgroundColor: plaqueBg,
          boxShadow: plaqueShadow,
          outline: isSelected ? '2px solid var(--px-rivet)' : undefined,
          outlineOffset: isSelected ? '2px' : undefined,
        }}
      >
        {/* Flat 3px Retro Branch / Ascension Top Strip */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-0 h-[3px]"
          style={{ backgroundColor: stripeColor }}
        />

        {/* Top-Right 16-Bit Status Stamp */}
        <span
          className="font-pixel absolute -top-2.5 right-1 rounded-none border-2 border-[var(--border-ink)] px-1 py-0.5 text-[8px] font-bold leading-none"
          style={
            isAscended || canAscendNow || canUnlockNow
              ? { backgroundColor: 'var(--px-gold)', color: '#140e04' }
              : isUnlocked
                ? { backgroundColor: meta.fillVar, color: meta.badgeText }
                : { backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }
          }
        >
          {!isUnlocked
            ? canUnlockNow
              ? `MỞ · ${spCost}SP`
              : `LOCK · ${spCost}SP`
            : isAscended
              ? `B${ascTier} · ∞`
              : `LV.${skill.masteryTier}/${rankCap}`}
        </span>

        {/* Square Recessed Pixel Medallion */}
        <div
          className={`px-inset mt-0.5 flex items-center justify-center rounded-none ${
            compact ? 'h-8 w-8' : 'h-10 w-10'
          }`}
          style={{
            boxShadow: isAscended
              ? 'inset 0 0 0 2px var(--px-gold)'
              : isUnlocked
                ? `inset 0 0 0 2px ${meta.hex}`
                : canUnlockNow
                  ? 'inset 0 0 0 2px var(--px-gold)'
                  : undefined,
            color: isAscended || canUnlockNow
              ? 'var(--px-gold-text)'
              : isUnlocked
                ? meta.textVar
                : 'var(--text-muted)',
          }}
        >
          {!isUnlocked && !canUnlockNow ? (
            <PxLock size={compact ? 14 : 16} color="var(--text-muted)" />
          ) : (
            renderSkillIcon(
              skill.icon,
              branchId,
              compact ? 16 : 20,
              isAscended || canUnlockNow ? 'var(--px-gold-text)' : meta.textVar
            )
          )}
        </div>

        {/* Title */}
        <div
          className={`mt-1.5 line-clamp-2 font-bold leading-tight text-main ${
            compact ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {skill.name}
        </div>

        {/* Power Rating & Small-Task Contributions */}
        <div
          className={`mt-1 flex flex-wrap items-center justify-center gap-1 font-mono ${
            compact ? 'text-[9px]' : 'text-[10px]'
          }`}
        >
          <span className="px-inset inline-flex items-center gap-0.5 rounded-none px-1 py-0.5 font-bold text-[var(--px-gold-text)]">
            <PxBolt size={10} color="var(--px-gold)" />
            {skill.powerRating || 0}
          </span>
          <span className="text-dim">{skill.tasksContributedCount || 0} task</span>
        </div>

        {/* Bottom Micro Cue */}
        <div className={`mt-1 font-mono ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {!isUnlocked ? (
            canUnlockNow ? (
              <span className="font-bold text-[var(--px-gold-text)]">Mở ngay ({spCost} SP)</span>
            ) : !prereqOk ? (
              <span className="text-dim">Khóa nhánh</span>
            ) : (
              <span className="text-dim">{spCost} SP</span>
            )
          ) : atCap ? (
            <span className="font-bold text-[var(--px-gold-text)]">
              {canAscendNow
                ? `Phá GH (${spCost} SP)`
                : `LV.${skill.masteryTier}/${rankCap} · Bậc ${ascTier} ∞`}
            </span>
          ) : (
            <span
              className={`inline-flex items-center justify-center gap-0.5 ${
                canUpgradeNow ? 'font-bold text-[var(--px-green-text)]' : 'text-dim'
              }`}
            >
              <span>
                LV.{skill.masteryTier}/{rankCap} · {cost.gold}G
              </span>
              {cost.runestones > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  +{cost.runestones}
                  <PxGem size={10} />
                </span>
              )}
            </span>
          )}
        </div>

        {/* 16-Bit Segmented Mastery Practice Bar */}
        <div className="mt-1.5 w-full">
          <div className="rpg-bar-track h-2 w-full rounded-none">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${practicePct}%`,
                backgroundColor: isAscended ? 'var(--px-gold)' : meta.fillVar,
              }}
            />
          </div>
        </div>
      </button>
    );
  };

  const renderBranchTree = (branchId: SkillBranchId, compact: boolean) => {
    const meta = BRANCH_META[branchId];
    const bSkills = treeSkills.filter((s) => s.treeBranch === branchId);
    const t1 = bSkills.find((s) => s.tier === 1);
    const t2l = bSkills.find((s) => s.tier === 2 && s.slot === 'left');
    const t2r = bSkills.find((s) => s.tier === 2 && s.slot === 'right');
    const t3 = bSkills.find((s) => s.tier === 3);
    const t4 = bSkills.find((s) => s.tier === 4);
    const t5 = bSkills.find((s) => s.tier === 5);

    const t1On = (t1?.masteryTier ?? 0) >= 1;
    const t2lOn = (t2l?.masteryTier ?? 0) >= 1;
    const t2rOn = (t2r?.masteryTier ?? 0) >= 1;
    const t3On = (t3?.masteryTier ?? 0) >= (t4?.minPrereqLevel ?? 2);
    const t4On = (t4?.masteryTier ?? 0) >= (t5?.minPrereqLevel ?? 3);

    const strokeFor = (active: boolean, child?: SkillNode) => {
      if ((child?.ascensionTier ?? 0) >= 2) return '#c99330';
      return active ? meta.hex : 'var(--border-strong)';
    };

    const svgH = compact ? 'h-5' : 'h-7';

    return (
      <div
        key={branchId}
        className={`relative flex flex-col rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] ${
          compact ? 'p-2.5 pt-3.5' : 'p-4 pt-5'
        }`}
        style={{
          boxShadow:
            'inset 2px 2px 0 var(--border-bevel-hi), inset -2px -2px 0 var(--border-bevel-lo)',
        }}
      >
        {/* Top Retro Branch Header Strip */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-0 h-[4px]"
          style={{ backgroundColor: meta.fillVar }}
        />

        <div className="mb-3 border-b-2 pb-2 text-center studio-divider">
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="font-pixel rounded-none border border-[var(--border-ink)] px-1.5 py-0.5 text-[8px] font-bold"
              style={{ backgroundColor: meta.fillVar, color: meta.badgeText }}
            >
              {meta.code}
            </span>
            <h3 className={`font-display font-extrabold text-main ${compact ? 'text-xs' : 'text-sm'}`}>
              {meta.title}
            </h3>
          </div>
          {!compact && <p className="mt-1 text-[11px] text-dim">{meta.subtitle}</p>}
        </div>

        {/* Tier 1 */}
        <div className={compact ? 'mx-auto w-[78%]' : 'mx-auto w-[46%]'}>
          {t1 && renderNodeMedallion(t1, branchId, compact)}
        </div>

        {/* T1 -> T2L / T2R Orthogonal Pixel Fork */}
        <svg
          viewBox="0 0 200 28"
          shapeRendering="crispEdges"
          className={`${svgH} w-full overflow-visible`}
          aria-hidden="true"
        >
          <path
            d="M 100 0 L 100 12 L 50 12 L 50 28"
            fill="none"
            stroke={strokeFor(t1On, t2l)}
            strokeWidth={t1On ? 3 : 2}
            strokeDasharray={t1On ? undefined : '4 4'}
          />
          <path
            d="M 100 0 L 100 12 L 150 12 L 150 28"
            fill="none"
            stroke={strokeFor(t1On, t2r)}
            strokeWidth={t1On ? 3 : 2}
            strokeDasharray={t1On ? undefined : '4 4'}
          />
        </svg>

        {/* Tier 2 Fork */}
        <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'mx-auto w-[86%] gap-4'}`}>
          <div>{t2l && renderNodeMedallion(t2l, branchId, compact)}</div>
          <div>{t2r && renderNodeMedallion(t2r, branchId, compact)}</div>
        </div>

        {/* T2L / T2R -> T3 Orthogonal Merge */}
        <svg
          viewBox="0 0 200 28"
          shapeRendering="crispEdges"
          className={`${svgH} w-full overflow-visible`}
          aria-hidden="true"
        >
          <path
            d="M 50 0 L 50 14 L 100 14 L 100 28"
            fill="none"
            stroke={strokeFor(t2lOn, t3)}
            strokeWidth={t2lOn ? 3 : 2}
            strokeDasharray={t2lOn ? undefined : '4 4'}
          />
          <path
            d="M 150 0 L 150 14 L 100 14 L 100 28"
            fill="none"
            stroke={strokeFor(t2rOn, t3)}
            strokeWidth={t2rOn ? 3 : 2}
            strokeDasharray={t2rOn ? undefined : '4 4'}
          />
        </svg>

        {/* Tier 3 */}
        <div className={compact ? 'mx-auto w-[80%]' : 'mx-auto w-[48%]'}>
          {t3 && renderNodeMedallion(t3, branchId, compact)}
        </div>

        {/* T3 -> T4 Vertical Line */}
        <svg
          viewBox="0 0 200 24"
          shapeRendering="crispEdges"
          className={`${compact ? 'h-4' : 'h-6'} w-full overflow-visible`}
          aria-hidden="true"
        >
          <path
            d="M 100 0 L 100 24"
            fill="none"
            stroke={strokeFor(t3On, t4)}
            strokeWidth={t3On ? 3 : 2}
            strokeDasharray={t3On ? undefined : '4 4'}
          />
        </svg>

        {/* Tier 4 */}
        <div className={compact ? 'mx-auto w-[82%]' : 'mx-auto w-[50%]'}>
          {t4 && renderNodeMedallion(t4, branchId, compact)}
        </div>

        {/* T4 -> T5 Infinite Apex Vertical Line */}
        <svg
          viewBox="0 0 200 24"
          shapeRendering="crispEdges"
          className={`${compact ? 'h-4' : 'h-6'} w-full overflow-visible`}
          aria-hidden="true"
        >
          <path
            d="M 100 0 L 100 24"
            fill="none"
            stroke={strokeFor(t4On, t5)}
            strokeWidth={t4On ? 3 : 2}
            strokeDasharray={t4On ? undefined : '4 4'}
          />
        </svg>

        {/* Tier 5 Infinite Apex */}
        <div className={compact ? 'mx-auto w-[86%]' : 'mx-auto w-[54%]'}>
          {t5 && renderNodeMedallion(t5, branchId, compact)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 16-Bit Summary Header Plaque */}
      <section className="studio-surface relative rounded-none p-4 sm:p-5">
        <PixelRivets />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-inset flex h-8 w-8 items-center justify-center rounded-none text-[var(--px-gold-text)]">
                <PxSkillTree size={18} color="var(--px-gold-text)" />
              </div>
              <h2 className="font-display text-base font-extrabold text-main sm:text-lg">
                Cây Kĩ Năng Phát Triển Bản Thân (5 Nhánh × 5 Tầng · Phá Giới Hạn ∞)
              </h2>
              <span
                className="font-pixel rounded-none border-2 border-[var(--border-ink)] px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: 'var(--px-gold)', color: '#140e04' }}
              >
                {growthBonuses.totalUnlockedNodes}/{treeSkills.length} MỞ · LV.
                {growthBonuses.totalSkillLevels} · {growthBonuses.totalAscensions} ∞
              </span>
            </div>
            <p className="mt-1.5 text-xs text-sub">
              <strong className="text-[var(--px-gold-text)]">Bước 1 (SP):</strong> Mở khóa từng nút
              (Lv.1–5) &amp; Phá Giới Hạn (+5 cấp vô tận) →{' '}
              <strong className="text-[var(--px-green-text)]">Bước 2 (Gold / Runestones):</strong>{' '}
              Nâng cấp thực lực thụ động.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-inset flex items-center gap-2 rounded-none px-3 py-1.5">
              <PxSparkle size={16} color="var(--px-gold)" />
              <div className="leading-tight">
                <div className="font-pixel text-xs font-bold text-[var(--px-gold-text)]">
                  {sp} SP
                </div>
                <div className="font-mono text-[10px] text-dim">
                  Tổng: {player.totalSkillPointsEarned ?? sp} SP
                </div>
              </div>
            </div>

            <div className="px-inset flex items-center gap-2 rounded-none px-3 py-1.5">
              <PxCoin size={15} />
              <span className="font-mono text-xs font-bold text-[var(--px-gold-text)]">
                {player.gold.toLocaleString()} G
              </span>
              <span className="text-dim">·</span>
              <PxGem size={15} />
              <span className="font-mono text-xs font-bold text-[var(--px-blue-text)]">
                {player.runestones.toLocaleString()}
              </span>
            </div>

            {hasAnyInvested && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction(onRespecSkills)}
                className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-2 text-xs"
                title="Hoàn trả 100% SP (gồm cả Phá Giới Hạn), Gold & Runestones"
              >
                <PxReset size={14} />
                <span>Tẩy Cây Kĩ Năng</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Passive Growth Bonuses Ledger */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 border-t-2 pt-3 sm:grid-cols-4 lg:grid-cols-7 studio-divider">
          {[
            { label: '+XP', val: `+${growthBonuses.xpBonusPct}%`, colorVar: 'var(--px-blue-text)' },
            {
              label: '+GOLD',
              val: `+${growthBonuses.goldBonusPct}%`,
              colorVar: 'var(--px-gold-text)',
            },
            {
              label: '+MASTERY',
              val: `+${growthBonuses.masteryBonusPct}%`,
              colorVar: 'var(--px-blue-text)',
            },
            {
              label: '+FOCUS',
              val: `+${growthBonuses.focusBonusPct}%`,
              colorVar: 'var(--px-plum-text)',
            },
            {
              label: '-FATIGUE',
              val: `-${growthBonuses.fatigueReductionPct}%`,
              colorVar: 'var(--px-green-text)',
            },
            {
              label: '+BOSS',
              val: `+${growthBonuses.bossDamageBonusPct}%`,
              colorVar: 'var(--px-red-text)',
            },
            {
              label: 'MAX HEARTS',
              val: `${growthBonuses.maxHearts}`,
              colorVar: 'var(--px-red-text)',
              heart: true,
            },
          ].map((stat) => (
            <div key={stat.label} className="px-inset rounded-none px-2 py-1.5 text-center">
              <div
                className="font-pixel text-[9px] font-bold"
                style={{ color: stat.colorVar }}
              >
                {stat.label}
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1 font-mono text-xs font-bold text-main">
                <span>{stat.val}</span>
                {stat.heart && <PxStatVit size={12} />}
              </div>
            </div>
          ))}
        </div>

        {/* Branch View Selector Strip */}
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-t-2 pt-3 studio-divider">
          <button
            type="button"
            onClick={() => setBranchView('all')}
            className={`rounded-none px-3 py-1.5 text-xs ${
              branchView === 'all' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            Rộng (Full 5 Nhánh · 30 Nút)
          </button>
          {BRANCH_ORDER.map((bId) => {
            const m = BRANCH_META[bId];
            return (
              <button
                key={bId}
                type="button"
                onClick={() => {
                  setBranchView(bId);
                  const firstInBranch = treeSkills.find((s) => s.treeBranch === bId);
                  if (firstInBranch) setSelectedId(firstInBranch.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs ${
                  branchView === bId ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 border border-[var(--border-ink)]"
                  style={{ backgroundColor: m.fillVar }}
                />
                <span>{m.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Unified Frame: Blueprint (Left 8 cols) + Flush Inspector (Right 4 cols) */}
      <section className="studio-surface relative overflow-hidden rounded-none">
        <PixelRivets />
        <div className="grid grid-cols-1 xl:grid-cols-12">
          {/* Interactive 2D Pixel Skill Graph Blueprint */}
          <div className="overflow-x-auto bg-[var(--bg-subtle)] p-3 sm:p-4 xl:col-span-8">
            {branchView === 'all' ? (
              <div className="grid min-w-[980px] grid-cols-5 gap-3">
                {BRANCH_ORDER.map((bId) => renderBranchTree(bId, true))}
              </div>
            ) : (
              <div>{renderBranchTree(branchView, false)}</div>
            )}
          </div>

          {/* Flush Right Inspector Pane */}
          <aside className="relative border-t-2 bg-[var(--bg-surface)] p-4 sm:p-5 xl:col-span-4 xl:border-l-2 xl:border-t-0 studio-divider">
            <PixelRivets />
            {selectedSkill
              ? (() => {
                  const branchId: SkillBranchId =
                    (selectedSkill.treeBranch as SkillBranchId) || 'intellect';
                  const meta = BRANCH_META[branchId] || BRANCH_META.intellect;
                  const prereqOk = areSkillPrerequisitesMet(selectedSkill, skillMap);
                  const isUnlocked = Boolean(selectedSkill.unlocked);
                  const ascTier = selectedSkill.ascensionTier ?? (isUnlocked ? 1 : 0);
                  const rankCap = selectedSkill.unlockedRankCap ?? selectedSkill.maxTier ?? 5;
                  const atCap = isUnlocked && selectedSkill.masteryTier >= rankCap;
                  const spCost = computeUnlockOrAscendSpCost(selectedSkill);
                  const cost = computeSkillUpgradeCost(selectedSkill);
                  const canUnlock = !isUnlocked && prereqOk && sp >= spCost;
                  const canAscend = atCap && sp >= spCost;
                  const canUpgrade =
                    isUnlocked &&
                    !atCap &&
                    player.gold >= cost.gold &&
                    player.runestones >= cost.runestones;

                  const minPrereqLv = selectedSkill.minPrereqLevel ?? 1;
                  const prereqNames = selectedSkill.prerequisiteIds
                    .map((pid) => skillMap.get(pid)?.name || pid)
                    .join(selectedSkill.requireAnyPrerequisite ? ' HOẶC ' : ' VÀ ');

                  const ascensionLabel = !isUnlocked
                    ? 'Chưa mở'
                    : ascTier >= 2
                      ? `Bậc ${toRoman(ascTier)} — Vô Cực (${rankCap - 4}–${rankCap})`
                      : `Bậc I (1–${rankCap})`;

                  const statPerLevel = selectedSkill.masteryTier >= 5 ? 1 : 2;
                  const practicePct = Math.min(
                    100,
                    Math.round(
                      ((selectedSkill.practiceXp || 0) /
                        Math.max(1, selectedSkill.xpPerTier || 100)) *
                        100
                    )
                  );

                  return (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="px-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-none"
                          style={{
                            boxShadow: `inset 0 0 0 2px ${meta.hex}`,
                            color: meta.textVar,
                          }}
                        >
                          {renderSkillIcon(selectedSkill.icon, branchId, 22, meta.textVar)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="font-pixel rounded-none border border-[var(--border-ink)] px-1.5 py-0.5 text-[9px] font-bold uppercase"
                              style={{ backgroundColor: meta.fillVar, color: meta.badgeText }}
                            >
                              Tầng {selectedSkill.tier || 1} · {selectedSkill.primaryStat}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-[var(--px-gold-text)]">
                              Lv.{selectedSkill.masteryTier}/{rankCap}
                            </span>
                            {selectedSkill.isInfiniteApex && (
                              <span
                                className="inline-flex items-center gap-1 rounded-none border border-[var(--border-ink)] px-1.5 py-0.5 font-pixel text-[8px] font-bold"
                                style={{ backgroundColor: 'var(--px-gold)', color: '#140e04' }}
                              >
                                <PxStar size={10} color="#140e04" /> APEX ∞
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1 font-display text-base font-extrabold text-main">
                            {selectedSkill.name}
                          </h3>
                          <div className="mt-0.5 font-mono text-[11px] text-sub">
                            {meta.title} ·{' '}
                            <strong className="text-[var(--px-gold-text)]">{ascensionLabel}</strong>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-sub">
                        {selectedSkill.description}
                      </p>

                      {/* Personal Growth Benefit Ledger */}
                      <div className="px-inset rounded-none p-3">
                        <div className="font-pixel text-[9px] font-bold uppercase tracking-wider text-[var(--px-gold-text)]">
                          HIỆU ỨNG PHÁT TRIỂN THỰC TẾ
                        </div>
                        <p className="mt-1 text-xs font-semibold text-main">
                          {selectedSkill.effectSummary}
                        </p>
                        <p className="mt-1.5 font-mono text-[11px] text-dim">
                          Mỗi cấp: +{statPerLevel} {selectedSkill.primaryStat} · +25 Mastery
                          {selectedSkill.masteryTier > 0
                            ? ` (Hiện đã cộng: +${selectedSkill.masteryTier * 25} Mastery)`
                            : ''}
                        </p>
                      </div>

                      {/* Infinite Skill Power & Segmented Mastery Bar */}
                      <div
                        className="px-inset space-y-2.5 rounded-none p-3"
                        style={{ borderLeft: `4px solid ${meta.fillVar}` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-pixel text-[9px] font-bold uppercase tracking-wider text-[var(--px-blue-text)]">
                            Sức Mạnh Kĩ Năng (Scale Vô Hạn)
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-[var(--px-gold-text)]">
                            <PxBolt size={13} color="var(--px-gold)" />
                            {selectedSkill.powerRating || 0} Power
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                          <div className="rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-2 py-1">
                            <div className="text-dim">Tổng XP</div>
                            <div className="font-bold text-main">
                              {selectedSkill.totalPracticeXp || 0} XP
                            </div>
                          </div>
                          <div className="rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-2 py-1">
                            <div className="text-dim">Thời gian</div>
                            <div className="font-bold text-main">
                              {selectedSkill.totalPracticeMinutes || 0} phút
                            </div>
                          </div>
                          <div className="rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-2 py-1">
                            <div className="text-dim">Đóng góp</div>
                            <div className="font-bold text-main">
                              {selectedSkill.tasksContributedCount || 0} task
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 flex justify-between font-mono text-[10px]">
                            <span className="font-bold text-[var(--px-blue-text)]">
                              Tiến độ +1 Bonus SP
                            </span>
                            <span className="font-bold text-main">
                              {selectedSkill.practiceXp || 0} / {selectedSkill.xpPerTier || 100} XP
                            </span>
                          </div>
                          <div className="rpg-bar-track h-3 w-full rounded-none">
                            <div
                              className="h-full border-t border-white/25 transition-all duration-300"
                              style={{
                                width: `${practicePct}%`,
                                backgroundColor: meta.fillVar,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Recent Small-Task Contributions */}
                      <div className="px-inset rounded-none p-3">
                        <div className="mb-1.5 font-display text-xs font-extrabold text-main">
                          Các Task Nhỏ Đóng Góp Gần Đây
                        </div>
                        {selectedSkill.recentContributions &&
                        selectedSkill.recentContributions.length > 0 ? (
                          <div className="divide-y studio-divider">
                            {selectedSkill.recentContributions.map((rc, idx) => (
                              <div
                                key={`${rc.dateKey}-${idx}`}
                                className="flex items-center justify-between gap-2 py-1 font-mono text-[10px]"
                              >
                                <span className="min-w-0 flex-1 truncate text-sub">
                                  {rc.dateKey} ·{' '}
                                  <strong className="font-sans text-main">{rc.title}</strong>
                                </span>
                                <span className="shrink-0 font-bold text-[var(--px-blue-text)]">
                                  {rc.minutes}p · +{rc.xpAdded} XP
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-dim">
                            Hoàn thành các task hằng ngày liên quan đến nhánh này để tự động tích
                            lũy Sức Mạnh &amp; nhận Bonus SP!
                          </p>
                        )}
                      </div>

                      {/* Prerequisite Check */}
                      {selectedSkill.prerequisiteIds.length > 0 && (
                        <div
                          className="px-inset flex items-center gap-2 rounded-none px-3 py-2 text-xs"
                          style={{
                            borderLeft: `4px solid ${
                              prereqOk ? 'var(--px-green)' : 'var(--px-red)'
                            }`,
                            color: prereqOk ? 'var(--px-green-text)' : 'var(--px-red-text)',
                          }}
                        >
                          {prereqOk ? (
                            <PxCheck size={14} color="var(--px-green-text)" />
                          ) : (
                            <PxLock size={14} color="var(--px-red-text)" />
                          )}
                          <span>
                            Điều kiện nhánh: <strong>{prereqNames}</strong> (đạt Lv.{minPrereqLv}+)
                          </span>
                        </div>
                      )}

                      {/* Clear 2-Step Upgrade Console */}
                      <div className="space-y-3 border-t-2 pt-3 studio-divider">
                        {/* Bước 1 (SP) */}
                        <div
                          className="px-inset rounded-none p-3"
                          style={{
                            borderLeft: `4px solid ${
                              !isUnlocked
                                ? canUnlock
                                  ? 'var(--px-gold)'
                                  : 'var(--border-strong)'
                                : atCap
                                  ? 'var(--px-gold)'
                                  : 'var(--px-green)'
                            }`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-main">
                              {isUnlocked ? (
                                <PxCheck size={14} color="var(--px-green-text)" />
                              ) : (
                                <PxLock size={14} color="var(--px-gold-text)" />
                              )}
                              Bước 1 (SP):{' '}
                              {isUnlocked && atCap ? 'Phá Giới Hạn Vô Cực' : 'Mở Khóa Nâng Cấp'}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-[var(--px-gold-text)]">
                              {!isUnlocked
                                ? `${spCost} SP`
                                : atCap
                                  ? `${spCost} SP → Lv.${rankCap + 5}`
                                  : `ĐÃ MỞ (Lv.1–${rankCap})`}
                            </span>
                          </div>

                          {!isUnlocked && (
                            <button
                              type="button"
                              disabled={!canUnlock || busy}
                              onClick={() => handleAction(() => onUnlockSkill(selectedSkill.id))}
                              className="btn-primary mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-none py-2 text-xs"
                            >
                              <PxSparkle size={14} color="#140e04" />
                              <span>
                                {!prereqOk
                                  ? `Cần nhánh trên đạt Lv.${minPrereqLv}+`
                                  : sp < spCost
                                    ? `Thiếu ${spCost - sp} SP`
                                    : `Mở Khóa Nâng Cấp (-${spCost} SP)`}
                              </span>
                            </button>
                          )}

                          {isUnlocked && atCap && (
                            <button
                              type="button"
                              disabled={!canAscend || busy}
                              onClick={() => handleAction(() => onUnlockSkill(selectedSkill.id))}
                              className="btn-arcane mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-none py-2 text-xs"
                            >
                              <PxStar size={14} color="#ffffff" />
                              <span>
                                {sp < spCost
                                  ? `Cần thêm ${spCost - sp} SP để Phá Giới Hạn`
                                  : `Phá Giới Hạn Vô Cực (+5 Cấp -> Lv.${rankCap + 1}–${rankCap + 5} | -${spCost} SP)`}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Bước 2 (Tiền tệ) */}
                        <div
                          className={`px-inset rounded-none p-3 ${!isUnlocked ? 'opacity-65' : ''}`}
                          style={{
                            borderLeft: `4px solid ${
                              !isUnlocked
                                ? 'var(--border-strong)'
                                : atCap
                                  ? 'var(--px-gold)'
                                  : 'var(--px-green)'
                            }`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-main">
                              <PxCoin size={14} />
                              Bước 2 (Tiền tệ): Nâng Cấp Thực Lực
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--px-gold-text)]">
                              {atCap ? (
                                `ĐẠT TRẦN LV.${rankCap}`
                              ) : (
                                <>
                                  <span>{cost.gold} G</span>
                                  {cost.runestones > 0 && (
                                    <>
                                      <span>· {cost.runestones}</span>
                                      <PxGem size={12} />
                                    </>
                                  )}
                                </>
                              )}
                            </span>
                          </div>

                          {isUnlocked && atCap ? (
                            <div className="mt-2 rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-2.5 py-2 text-center text-[11px] font-semibold text-[var(--px-gold-text)]">
                              Đã chạm ngưỡng Lv.{rankCap} — dùng SP ở Bước 1 để mở khóa +5 cấp tiếp
                              theo!
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!canUpgrade || busy}
                              onClick={() => handleAction(() => onUpgradeSkill(selectedSkill.id))}
                              className="btn-emerald mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-none py-2 text-xs"
                            >
                              <PxBolt size={14} color="#ffffff" />
                              <span>
                                {!isUnlocked
                                  ? 'Hãy Mở Khóa ở Bước 1 trước'
                                  : player.gold < cost.gold
                                    ? `Thiếu ${cost.gold - player.gold} Gold`
                                    : player.runestones < cost.runestones
                                      ? `Thiếu ${cost.runestones - player.runestones} Runestones`
                                      : `Nâng Cấp Lv.${selectedSkill.masteryTier + 1} (-${cost.gold} G${
                                          cost.runestones > 0
                                            ? ` · -${cost.runestones} Runestones`
                                            : ''
                                        })`}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {errorMsg && (
                        <p
                          className="px-inset rounded-none px-3 py-2 text-xs font-semibold text-[var(--px-red-text)]"
                          style={{ borderLeft: '4px solid var(--px-red)' }}
                        >
                          {errorMsg}
                        </p>
                      )}

                      <div className="px-inset rounded-none px-3 py-2 text-[11px] text-dim">
                        <strong className="text-sub">Nguồn SP thực tế:</strong> Hoàn thành Quest
                        (+1/+2 SP), Lên Cấp (+2 SP), Vượt ải Boss (+2/+4 SP).
                      </div>
                    </div>
                  );
                })()
              : null}
          </aside>
        </div>
      </section>

      {/* Collapsible Custom Goal Skills Footer Table */}
      {customSkills.length > 0 && onVerifyCustomSkill && (
        <section className="studio-surface relative overflow-hidden rounded-none">
          <PixelRivets />
          <button
            type="button"
            onClick={() => setShowCustomSkills((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-[var(--bg-surface-2)]"
          >
            <div className="flex items-center gap-2">
              <PxShield size={16} color="var(--px-green-text)" />
              <span className="font-display text-sm font-bold text-main">
                Kỹ Năng Mục Tiêu Cá Nhân ({customSkills.length})
              </span>
            </div>
            <PxChevron dir={showCustomSkills ? 'up' : 'down'} size={14} color="var(--text-muted)" />
          </button>

          {showCustomSkills && (
            <div className="divide-y-2 border-t-2 studio-divider">
              {customSkills.map((sk) => {
                const open = verifyingId === sk.id;
                return (
                  <div
                    key={sk.id}
                    className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-main">{sk.name}</span>
                        <span className="px-inset rounded-none px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--px-gold-text)]">
                          Tier {sk.masteryTier}/{sk.maxTier} · {sk.primaryStat}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-sub">{sk.description}</p>
                      {open && (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input
                            value={proofText}
                            onChange={(e) => setProofText(e.target.value)}
                            placeholder="Mô tả kết quả thực tế..."
                            className="flex-1 rounded-none px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await onVerifyCustomSkill(sk.id, proofText);
                              setVerifyingId(null);
                              setProofText('');
                            }}
                            className="btn-primary rounded-none px-3 py-1 text-xs"
                          >
                            Xác nhận
                          </button>
                        </div>
                      )}
                    </div>

                    {sk.masteryTier < sk.maxTier && !open && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyingId(sk.id);
                          setProofText('');
                        }}
                        className="btn-secondary shrink-0 rounded-none px-3 py-1.5 text-xs"
                      >
                        Xác thực nâng Tier
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
