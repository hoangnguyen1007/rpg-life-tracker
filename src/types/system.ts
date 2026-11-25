export type * from '../../server/types.ts';

export type RaidDifficultyTier = 'B' | 'A' | 'S';

export type RaidBossArchetype =
  | 'chronos_lich'
  | 'sloth_behemoth'
  | 'siren_of_feeds'
  | 'obsidian_dragon'
  | 'phantom_architect'
  | 'iron_golem_king'
  | 'void_hydra'
  | 'eclipse_monarch';

export type RaidWeaknessCategory = 'deep_work' | 'study' | 'quests';

export type RaidChestId = 'm75' | 'm50' | 'm25' | 'victory' | 'overkill';

export interface RaidChest {
  id: RaidChestId;
  label: string;
  hpThresholdPct: number;
  gold: number;
  runestones: number;
  sp: number;
  dropsLootItem?: boolean;
  unlocked: boolean;
  claimed: boolean;
  claimedAt?: string;
  lootItemName?: string;
}

export interface RaidCombatEvent {
  id: string;
  timestamp: string;
  dateKey: string;
  kind: 'deep_work' | 'study' | 'quest' | 'dark_regen' | 'overkill' | 'boss_strike' | 'system';
  label: string;
  amount: number;
  isCrit?: boolean;
  multiplier?: number;
  detail?: string;
}

export interface WeeklyRaidBoss {
  id: string;
  weekKey: string;
  weekStartDate: string;
  weekEndDate: string;
  archetype: RaidBossArchetype;
  name: string;
  title: string;
  lore: string;
  taunt: string;
  generatedBy: 'ai' | 'local';
  difficultyTier: RaidDifficultyTier;
  baseMaxHp: number;
  maxHp: number;
  currentHp: number;
  totalDamageDealt: number;
  overkillDamage: number;
  weaknessCategory: RaidWeaknessCategory;
  weaknessLabel: string;
  weaknessMultiplier: number;
  rewardTitle: string;
  chests: RaidChest[];
  combatLog: RaidCombatEvent[];
  appliedDeepWorkMinutes: number;
  appliedStudyMinutes: number;
  appliedQuestIds: string[];
  regenAppliedDates: string[];
  status: 'active' | 'defeated' | 'failed';
  defeatedAt?: string;
  settledAt?: string;
  penaltySummary?: { hpLost: number; goldLost: number; died: boolean };
  aiRegenCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyRaidSummary {
  weekKey: string;
  weekStartDate: string;
  weekEndDate: string;
  bossName: string;
  archetype: RaidBossArchetype;
  difficultyTier: RaidDifficultyTier;
  status: 'defeated' | 'failed';
  maxHp: number;
  totalDamageDealt: number;
  overkillDamage: number;
  chestsClaimed: number;
  penaltySummary?: { hpLost: number; goldLost: number; died: boolean };
}

export interface WeeklyRaidPayload {
  raid: WeeklyRaidBoss;
  history: WeeklyRaidSummary[];
  todayDistractionMinutes: number;
  distractionBudgetMinutes: number;
  bossDamageBonusPct: number;
  focusScoreToday: number;
  streakDays: number;
  secondsUntilReset: number;
  canChangeDifficulty: boolean;
  canRegenerateAi: boolean;
  justSettledPenalty?: {
    bossName: string;
    weekKey: string;
    hpLost: number;
    goldLost: number;
    died: boolean;
  } | null;
}
