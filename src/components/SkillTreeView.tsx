import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Compass,
  Crown,
  Flame,
  Gem,
  Heart,
  Infinity as InfinityIcon,
  Lock,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Unlock,
  Users,
  Zap,
} from 'lucide-react';
import type {
  PlayerGrowthBonuses,
  PlayerState,
  SkillBranchId,
  SkillNode,
} from '../types/system';

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
    accentText: string;
    borderActive: string;
    bgSoft: string;
    lineColor: string;
    badgeCls: string;
  }
> = {
  intellect: {
    code: 'INT',
    title: 'Trí Tuệ & Hệ Thống',
    subtitle: 'Tư duy nguyên lý, phân tích & kiến trúc chiến lược',
    stat: 'INT',
    accentText: 'text-amber-400',
    borderActive: 'border-amber-500',
    bgSoft: 'bg-amber-500/10',
    lineColor: '#f59e0b',
    badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  knowledge: {
    code: 'PER',
    title: 'Tri Thức & Học Sâu',
    subtitle: 'Active Recall, Spaced Repetition & tổng hợp liên ngành',
    stat: 'PER',
    accentText: 'text-cyan-400',
    borderActive: 'border-cyan-500',
    bgSoft: 'bg-cyan-500/10',
    lineColor: '#06b6d4',
    badgeCls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  },
  execution: {
    code: 'AGI',
    title: 'Kỷ Luật & Thực Thi',
    subtitle: 'Khởi động 2p, Timeboxing, Nếu-Thì & Ultradian Flow',
    stat: 'AGI',
    accentText: 'text-violet-400',
    borderActive: 'border-violet-500',
    bgSoft: 'bg-violet-500/10',
    lineColor: '#8b5cf6',
    badgeCls: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  },
  vitality: {
    code: 'STR/VIT',
    title: 'Thể Lực & Sinh Lực',
    subtitle: 'Giấc ngủ, tải trọng tăng tiến, NSDR & thêm Trái Tim',
    stat: 'VIT',
    accentText: 'text-emerald-400',
    borderActive: 'border-emerald-500',
    bgSoft: 'bg-emerald-500/10',
    lineColor: '#10b981',
    badgeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  },
  influence: {
    code: 'CHA',
    title: 'Giao Tiếp & Di Sản',
    subtitle: 'Diễn đạt, lắng nghe, thuyết phục & kiến tạo giá trị',
    stat: 'CHA',
    accentText: 'text-rose-400',
    borderActive: 'border-rose-500',
    bgSoft: 'bg-rose-500/10',
    lineColor: '#f43f5e',
    badgeCls: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  },
};

function renderSkillIcon(icon?: string, branchId?: SkillBranchId, className = 'h-4 w-4') {
  switch (icon) {
    case 'brain':
      return <Brain className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'zap':
    case 'bolt':
      return <Zap className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'activity':
      return <Activity className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'award':
      return <Award className={className} />;
    default:
      if (branchId === 'intellect') return <Brain className={className} />;
      if (branchId === 'knowledge') return <BookOpen className={className} />;
      if (branchId === 'execution') return <Zap className={className} />;
      if (branchId === 'vitality') return <Heart className={className} />;
      if (branchId === 'influence') return <Users className={className} />;
      return <Sparkles className={className} />;
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

    let frameCls = 'border-slate-700/80 studio-subtle opacity-65 hover:opacity-95';
    if (isAscended) {
      frameCls = 'border-amber-400 bg-amber-500/15';
    } else if (isUnlocked) {
      frameCls = `${meta.borderActive} ${meta.bgSoft}`;
    } else if (canUnlockNow) {
      frameCls = 'border-amber-400 bg-amber-500/10';
    }

    return (
      <button
        key={skill.id}
        type="button"
        onClick={() => {
          setSelectedId(skill.id);
          setErrorMsg(null);
        }}
        className={`relative flex w-full flex-col items-center rounded-[2px] border-2 text-center transition ${
          compact ? 'px-1.5 py-2' : 'px-3 py-3'
        } ${frameCls} ${
          isSelected
            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[var(--bg-canvas)]'
            : ''
        } ${canUnlockNow || canAscendNow ? 'shadow-[0_0_0_1px_rgba(251,191,36,0.45)]' : ''}`}
      >
        {/* Top-Right Status Badge */}
        <span
          className={`font-pixel absolute -top-2 right-1 rounded-[2px] border px-1 py-0.5 text-[8px] font-bold leading-none ${
            isAscended
              ? 'border-amber-300 bg-amber-400 text-[#180f03]'
              : canAscendNow
                ? 'border-amber-300 bg-amber-500 text-[#180f03] animate-pulse'
                : isUnlocked
                  ? meta.badgeCls
                  : canUnlockNow
                    ? 'border-amber-400 bg-amber-500 text-[#180f03] animate-pulse'
                    : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          {!isUnlocked
            ? `LOCK · ${spCost}SP`
            : isAscended
              ? `B${ascTier} · ∞`
              : `LV.${skill.masteryTier}/${rankCap}`}
        </span>

        {/* Square Pixel Medallion */}
        <div
          className={`mt-1 flex items-center justify-center rounded-[2px] border-2 ${
            compact ? 'h-8 w-8' : 'h-10 w-10'
          } ${
            isAscended
              ? 'border-amber-300 bg-amber-400/20 text-amber-300'
              : isUnlocked
                ? `${meta.borderActive} ${meta.accentText} bg-[var(--bg-surface)]`
                : canUnlockNow
                  ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                  : 'border-slate-700 bg-[var(--bg-subtle)] text-dim'
          }`}
        >
          {!isUnlocked && !canUnlockNow ? (
            <Lock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          ) : (
            renderSkillIcon(skill.icon, branchId, compact ? 'h-4 w-4' : 'h-5 w-5')
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
        <div className={`mt-1 flex flex-wrap items-center justify-center gap-1 font-mono ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          <span className="rounded-[2px] border border-amber-500/40 bg-amber-500/15 px-1 py-0.2 font-bold text-amber-400">
            ⚡ {skill.powerRating || 0}
          </span>
          <span className="text-dim">{skill.tasksContributedCount || 0} task</span>
        </div>

        {/* Bottom Micro Cue */}
        <div className={`mt-1 font-mono ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          {!isUnlocked ? (
            canUnlockNow ? (
              <span className="font-bold text-amber-400">Mở ngay ({spCost} SP)</span>
            ) : !prereqOk ? (
              <span className="text-dim">Khóa nhánh</span>
            ) : (
              <span className="text-dim">{spCost} SP</span>
            )
          ) : atCap ? (
            <span className="font-bold text-amber-400">
              {canAscendNow ? `Phá GH (${spCost} SP)` : `LV.${skill.masteryTier}/${rankCap} · Bậc ${ascTier} ∞`}
            </span>
          ) : (
            <span className={canUpgradeNow ? 'font-bold text-emerald-400' : 'text-dim'}>
              LV.{skill.masteryTier}/${rankCap} · Bậc ${ascTier} ∞ · ${cost.gold}G
              {cost.runestones > 0 ? `+${cost.runestones}💎` : ''}
            </span>
          )}
        </div>

        {/* Slim Cyan Practice XP Mini-Bar */}
        <div className="mt-1.5 w-full">
          <div className="h-1 w-full overflow-hidden rounded-[1px] bg-slate-800/80">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(((skill.practiceXp || 0) / Math.max(1, skill.xpPerTier || 100)) * 100)
                )}%`,
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
      if ((child?.ascensionTier ?? 0) >= 2) return '#fbbf24';
      return active ? meta.lineColor : '#475569';
    };

    const svgH = compact ? 'h-5' : 'h-7';

    return (
      <div
        key={branchId}
        className={`flex flex-col border-2 studio-divider bg-[var(--bg-surface)] ${
          compact ? 'p-2.5' : 'p-4'
        }`}
      >
        <div className="mb-2.5 border-b-2 pb-2 text-center studio-divider">
          <div className="flex items-center justify-center gap-1.5">
            <span className={`font-pixel text-[9px] font-bold ${meta.accentText}`}>
              [{meta.code}]
            </span>
            <h3 className={`font-display font-extrabold text-main ${compact ? 'text-xs' : 'text-sm'}`}>
              {meta.title}
            </h3>
          </div>
          {!compact && <p className="mt-0.5 text-[11px] text-dim">{meta.subtitle}</p>}
        </div>

        {/* Tier 1 */}
        <div className={compact ? 'mx-auto w-[72%]' : 'mx-auto w-[46%]'}>
          {t1 && renderNodeMedallion(t1, branchId, compact)}
        </div>

        {/* T1 -> T2L / T2R Orthogonal Pixel Fork */}
        <svg viewBox="0 0 200 28" className={`${svgH} w-full overflow-visible`} aria-hidden="true">
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
        <svg viewBox="0 0 200 28" className={`${svgH} w-full overflow-visible`} aria-hidden="true">
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
        <div className={compact ? 'mx-auto w-[76%]' : 'mx-auto w-[48%]'}>
          {t3 && renderNodeMedallion(t3, branchId, compact)}
        </div>

        {/* T3 -> T4 Vertical Line */}
        <svg viewBox="0 0 200 24" className={`${compact ? 'h-4' : 'h-6'} w-full overflow-visible`} aria-hidden="true">
          <path
            d="M 100 0 L 100 24"
            fill="none"
            stroke={strokeFor(t3On, t4)}
            strokeWidth={t3On ? 3 : 2}
            strokeDasharray={t3On ? undefined : '4 4'}
          />
        </svg>

        {/* Tier 4 */}
        <div className={compact ? 'mx-auto w-[78%]' : 'mx-auto w-[50%]'}>
          {t4 && renderNodeMedallion(t4, branchId, compact)}
        </div>

        {/* T4 -> T5 Infinite Apex Vertical Line */}
        <svg viewBox="0 0 200 24" className={`${compact ? 'h-4' : 'h-6'} w-full overflow-visible`} aria-hidden="true">
          <path
            d="M 100 0 L 100 24"
            fill="none"
            stroke={strokeFor(t4On, t5)}
            strokeWidth={t4On ? 3 : 2}
            strokeDasharray={t4On ? undefined : '4 4'}
          />
        </svg>

        {/* Tier 5 Infinite Apex */}
        <div className={compact ? 'mx-auto w-[84%]' : 'mx-auto w-[54%]'}>
          {t5 && renderNodeMedallion(t5, branchId, compact)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Flush Top Growth Summary Strip */}
      <section className="studio-surface p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-extrabold text-main sm:text-lg">
                Cây Kĩ Năng Phát Triển Bản Thân (5 Nhánh × 5 Tầng · Phá Giới Hạn ∞)
              </h2>
              <span className="font-pixel rounded-[2px] border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                {growthBonuses.totalUnlockedNodes}/{treeSkills.length} MỞ · LV.{growthBonuses.totalSkillLevels} · {growthBonuses.totalAscensions} ∞
              </span>
            </div>
            <p className="mt-1 text-xs text-sub">
              <strong className="text-amber-400">Bước 1 (SP):</strong> Mở khóa từng nút (Lv.1–5) &amp; Phá Giới Hạn (+5 cấp vô tận) →{' '}
              <strong className="text-emerald-400">Bước 2 (Gold / 💎):</strong> Nâng cấp thực lực thụ động.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-[2px] border-2 border-amber-500/50 bg-amber-500/10 px-3 py-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <div className="leading-tight">
                <div className="font-pixel text-xs font-bold text-amber-400">{sp} SP</div>
                <div className="font-mono text-[10px] text-dim">
                  Tổng: {player.totalSkillPointsEarned ?? sp} SP
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-[2px] border-2 px-3 py-1.5 studio-subtle studio-divider">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="font-mono text-xs font-bold text-main">{player.gold} G</span>
              <span className="text-dim">·</span>
              <Gem className="h-4 w-4 text-cyan-400" />
              <span className="font-mono text-xs font-bold text-main">{player.runestones}</span>
            </div>

            {hasAnyInvested && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction(onRespecSkills)}
                className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs"
                title="Hoàn trả 100% SP (gồm cả Phá Giới Hạn), Gold & Runestones"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Tẩy Cây Kĩ Năng</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Passive Growth Bonuses Ledger */}
        <div className="mt-3.5 grid grid-cols-2 gap-1.5 border-t-2 pt-3 sm:grid-cols-4 lg:grid-cols-7 studio-divider">
          {[
            { label: '+XP', val: `+${growthBonuses.xpBonusPct}%`, cls: 'text-indigo-400' },
            { label: '+GOLD', val: `+${growthBonuses.goldBonusPct}%`, cls: 'text-amber-400' },
            { label: '+MASTERY', val: `+${growthBonuses.masteryBonusPct}%`, cls: 'text-cyan-400' },
            { label: '+FOCUS', val: `+${growthBonuses.focusBonusPct}%`, cls: 'text-violet-400' },
            { label: '-FATIGUE', val: `-${growthBonuses.fatigueReductionPct}%`, cls: 'text-emerald-400' },
            { label: '+BOSS', val: `+${growthBonuses.bossDamageBonusPct}%`, cls: 'text-rose-400' },
            { label: 'MAX HEARTS', val: `${growthBonuses.maxHearts} ❤️`, cls: 'text-rose-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[2px] border px-2 py-1.5 text-center studio-subtle studio-divider"
            >
              <div className={`font-pixel text-[9px] font-bold ${stat.cls}`}>{stat.label}</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-main">{stat.val}</div>
            </div>
          ))}
        </div>

        {/* Branch View Selector Strip */}
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-t-2 pt-3 studio-divider">
          <button
            type="button"
            onClick={() => setBranchView('all')}
            className={`px-3 py-1.5 text-xs ${
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
                className={`px-3 py-1.5 text-xs ${
                  branchView === bId ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {m.title}
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Unified Frame: Blueprint (Left 8 cols) + Flush Inspector (Right 4 cols) */}
      <section className="studio-surface overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12">
          {/* Interactive 2D Pixel Skill Graph Blueprint */}
          <div
            className="overflow-x-auto p-3 sm:p-4 xl:col-span-8"
            style={{
              backgroundImage:
                'radial-gradient(var(--tile-dot) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          >
            {branchView === 'all' ? (
              <div className="grid min-w-[980px] grid-cols-5 gap-3">
                {BRANCH_ORDER.map((bId) => renderBranchTree(bId, true))}
              </div>
            ) : (
              <div>{renderBranchTree(branchView, false)}</div>
            )}
          </div>

          {/* Flush Right Inspector Pane */}
          <aside className="border-t-2 p-4 sm:p-5 xl:col-span-4 xl:border-l-2 xl:border-t-0 studio-divider">
            {selectedSkill ? (() => {
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

              return (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[2px] border-2 ${meta.borderActive} ${meta.bgSoft} ${meta.accentText}`}
                    >
                      {renderSkillIcon(selectedSkill.icon, branchId, 'h-5 w-5')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`font-pixel rounded-[2px] border px-1.5 py-0.5 text-[9px] font-bold uppercase ${meta.badgeCls}`}
                        >
                          Tầng {selectedSkill.tier || 1} · {selectedSkill.primaryStat}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-amber-400">
                          Lv.{selectedSkill.masteryTier}/{rankCap}
                        </span>
                        {selectedSkill.isInfiniteApex && (
                          <span className="inline-flex items-center gap-0.5 rounded-[2px] border border-amber-400/50 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                            <InfinityIcon className="h-3 w-3" /> APEX
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-display text-base font-extrabold text-main">
                        {selectedSkill.name}
                      </h3>
                      <div className="mt-0.5 font-mono text-[11px] text-sub">
                        {meta.title} · <strong className="text-amber-400">{ascensionLabel}</strong>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-sub">{selectedSkill.description}</p>

                  {/* Personal Growth Benefit Ledger */}
                  <div className="rounded-[2px] border-2 p-3 studio-subtle studio-divider">
                    <div className="font-pixel text-[9px] font-bold uppercase tracking-wider text-amber-400">
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

                  {/* Infinite Skill Power & Practice XP Block */}
                  <div className="space-y-2 rounded-[2px] border-2 border-cyan-500/40 bg-cyan-500/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-pixel text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                        Sức Mạnh Kĩ Năng (Scale Vô Hạn)
                      </span>
                      <span className="font-mono text-xs font-extrabold text-amber-400">
                        ⚡ {selectedSkill.powerRating || 0} Power
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                      <div className="rounded-[2px] border px-2 py-1 studio-subtle studio-divider">
                        <div className="text-dim">Tổng XP</div>
                        <div className="font-bold text-main">{selectedSkill.totalPracticeXp || 0} XP</div>
                      </div>
                      <div className="rounded-[2px] border px-2 py-1 studio-subtle studio-divider">
                        <div className="text-dim">Thời gian</div>
                        <div className="font-bold text-main">{selectedSkill.totalPracticeMinutes || 0} phút</div>
                      </div>
                      <div className="rounded-[2px] border px-2 py-1 studio-subtle studio-divider">
                        <div className="text-dim">Đóng góp</div>
                        <div className="font-bold text-main">{selectedSkill.tasksContributedCount || 0} task</div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between font-mono text-[10px]">
                        <span className="text-cyan-400">Tiến độ +1 Bonus SP</span>
                        <span className="font-bold text-main">
                          {selectedSkill.practiceXp || 0} / {selectedSkill.xpPerTier || 100} XP
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-[2px] border studio-divider bg-[var(--bg-surface)]">
                        <div
                          className="h-full bg-cyan-400 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((selectedSkill.practiceXp || 0) /
                                  Math.max(1, selectedSkill.xpPerTier || 100)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recent Small-Task Contributions */}
                  <div className="rounded-[2px] border-2 p-3 studio-subtle studio-divider">
                    <div className="mb-1.5 font-display text-xs font-extrabold text-main">
                      Các Task Nhỏ Đóng Góp Gần Đây
                    </div>
                    {selectedSkill.recentContributions && selectedSkill.recentContributions.length > 0 ? (
                      <div className="divide-y studio-divider">
                        {selectedSkill.recentContributions.map((rc, idx) => (
                          <div key={`${rc.dateKey}-${idx}`} className="flex items-center justify-between gap-2 py-1 font-mono text-[10px]">
                            <span className="min-w-0 flex-1 truncate text-sub">
                              {rc.dateKey} · <strong className="font-sans text-main">{rc.title}</strong>
                            </span>
                            <span className="shrink-0 text-cyan-400">
                              {rc.minutes}p · +{rc.xpAdded} XP
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-dim">
                        Hoàn thành các task hằng ngày liên quan đến nhánh này để tự động tích lũy Sức Mạnh &amp; nhận Bonus SP!
                      </p>
                    )}
                  </div>

                  {/* Prerequisite Check */}
                  {selectedSkill.prerequisiteIds.length > 0 && (
                    <div
                      className={`flex items-center gap-2 rounded-[2px] border-2 px-3 py-2 text-xs ${
                        prereqOk
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {prereqOk ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <Lock className="h-4 w-4 shrink-0" />
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
                      className={`rounded-[2px] border-2 p-3 ${
                        !isUnlocked
                          ? canUnlock
                            ? 'border-amber-400 bg-amber-500/10'
                            : 'studio-subtle studio-divider'
                          : atCap
                            ? canAscend
                              ? 'border-amber-400 bg-amber-500/10'
                              : 'border-amber-500/40 bg-amber-500/5'
                            : 'border-emerald-500/45 bg-emerald-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-main">
                          {isUnlocked ? (
                            <Unlock className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Lock className="h-4 w-4 text-amber-400" />
                          )}
                          Bước 1 (SP): {isUnlocked && atCap ? 'Phá Giới Hạn Vô Cực' : 'Mở Khóa Nâng Cấp'}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-amber-400">
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
                          className="btn-primary mt-2.5 flex w-full items-center justify-center gap-1.5 py-2 text-xs"
                        >
                          <Sparkles className="h-4 w-4" />
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
                          className="btn-arcane mt-2.5 flex w-full items-center justify-center gap-1.5 py-2 text-xs"
                        >
                          <InfinityIcon className="h-4 w-4" />
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
                      className={`rounded-[2px] border-2 p-3 ${
                        !isUnlocked
                          ? 'opacity-60 studio-subtle studio-divider'
                          : atCap
                            ? 'border-amber-400/50 bg-amber-500/10'
                            : 'border-cyan-500/50 bg-cyan-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-main">
                          <Coins className="h-4 w-4 text-amber-400" />
                          Bước 2 (Tiền tệ): Nâng Cấp Thực Lực
                        </span>
                        <span className="font-mono text-xs text-amber-400">
                          {atCap
                            ? `ĐẠT TRẦN LV.${rankCap}`
                            : `${cost.gold} G${cost.runestones > 0 ? ` · ${cost.runestones} 💎` : ''}`}
                        </span>
                      </div>

                      {isUnlocked && atCap ? (
                        <div className="mt-2 rounded-[2px] border border-amber-400/40 bg-amber-500/10 px-2.5 py-2 text-center text-[11px] font-semibold text-amber-300">
                          Đã chạm ngưỡng Lv.{rankCap} — dùng SP ở Bước 1 để mở khóa +5 cấp tiếp theo!
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canUpgrade || busy}
                          onClick={() => handleAction(() => onUpgradeSkill(selectedSkill.id))}
                          className="btn-emerald mt-2.5 flex w-full items-center justify-center gap-1.5 py-2 text-xs"
                        >
                          <Zap className="h-4 w-4" />
                          <span>
                            {!isUnlocked
                              ? 'Hãy Mở Khóa ở Bước 1 trước'
                              : player.gold < cost.gold
                                ? `Thiếu ${cost.gold - player.gold} Gold`
                                : player.runestones < cost.runestones
                                  ? `Thiếu ${cost.runestones - player.runestones} Runestones`
                                  : `Nâng Cấp Lv.${selectedSkill.masteryTier + 1} (-${cost.gold} G${
                                      cost.runestones > 0 ? ` · -${cost.runestones} 💎` : ''
                                    })`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {errorMsg && (
                    <p className="rounded-[2px] border-2 border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                      {errorMsg}
                    </p>
                  )}

                  <div className="rounded-[2px] border px-3 py-2 text-[11px] text-dim studio-subtle studio-divider">
                    <strong>Nguồn SP thực tế:</strong> Hoàn thành Quest (+1/+2 SP), Lên Cấp (+2 SP), Vượt ải Boss (+2/+4 SP).
                  </div>
                </div>
              );
            })() : null}
          </aside>
        </div>
      </section>

      {/* Collapsible Custom Goal Skills Footer Table */}
      {customSkills.length > 0 && onVerifyCustomSkill && (
        <section className="studio-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCustomSkills((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="font-display text-sm font-bold text-main">
                Kỹ Năng Mục Tiêu Cá Nhân ({customSkills.length})
              </span>
            </div>
            {showCustomSkills ? (
              <ChevronUp className="h-4 w-4 text-dim" />
            ) : (
              <ChevronDown className="h-4 w-4 text-dim" />
            )}
          </button>

          {showCustomSkills && (
            <div className="divide-y-2 border-t-2 studio-divider">
              {customSkills.map((sk) => {
                const open = verifyingId === sk.id;
                return (
                  <div key={sk.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-main">{sk.name}</span>
                        <span className="font-mono rounded-[2px] border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
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
                            className="flex-1 px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await onVerifyCustomSkill(sk.id, proofText);
                              setVerifyingId(null);
                              setProofText('');
                            }}
                            className="btn-primary px-3 py-1 text-xs"
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
                        className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
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
