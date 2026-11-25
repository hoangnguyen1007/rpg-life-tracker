export type HunterRank =
  | 'E-Rank'
  | 'D-Rank'
  | 'C-Rank'
  | 'B-Rank'
  | 'A-Rank'
  | 'S-Rank'
  | 'National Level';

export type AttributeKey = 'INT' | 'PER' | 'STR' | 'VIT' | 'AGI' | 'CHA';

export type StatMap = Record<AttributeKey, number>;

export type QuestType =
  | 'daily'
  | 'main'
  | 'side'
  | 'hidden'
  | 'emergency'
  | 'recovery';

export type QuestRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export type AgentRole =
  | 'STRATEGIST'
  | 'CHRONOS'
  | 'SCHOLAR'
  | 'CAREER'
  | 'VITALITY'
  | 'ARCHITECT';

export type QuestStatus = 'pending' | 'completed' | 'rejected' | 'skipped';

export type TimetableBlockType =
  | 'sleep'
  | 'class_work'
  | 'commute_meal'
  | 'fixed_habit'
  | 'rest_buffer'
  | 'adhoc_event';

export type RejectionReason =
  | 'too_hard'
  | 'no_time'
  | 'low_energy'
  | 'not_relevant';

export type AIPersona = 'strict_system' | 'strategic_mentor' | 'supportive_coach';

export type HeroAvatarStyle =
  | 'shadow_monarch'
  | 'arcane_scholar'
  | 'cyber_blade'
  | 'iron_paladin'
  | 'ranger_scout'
  | 'alchemist_sage';

export interface PlayerProfile {
  name: string;
  currentRole: string;
  bio: string;
  interests: string[];
  strengths: string[];
  weaknesses: string[];
  targetSkills: string[];
  learningStyle: string;
  peakHours?: string;
  personalRules?: string;
  customSystemPrompt?: string;
  aiPersona?: AIPersona;
  avatarStyle?: HeroAvatarStyle;
}

export interface CheckpointRecord {
  id: string;
  label: string;
  chapterId: string;
  chapterNumber: number;
  stageNumber: number;
  savedAt: string;
  levelAtCheckpoint: number;
}

export interface DeathReport {
  id: string;
  occurredAt: string;
  causeSummary: string;
  missedQuests: Array<{ title: string; type: QuestType; hpDamage: number }>;
  totalHpDamage: number;
  goldLost: number;
  xpLost: number;
  levelDropped: boolean;
  respawnedAtCheckpoint: string;
  respawnHp: number;
}

export interface DaySettlementReport {
  settledDateKeys: string[];
  missedQuests: Array<{
    id: string;
    title: string;
    type: QuestType;
    rank: QuestRank;
    hpDamage: number;
  }>;
  totalHpDamage: number;
  mitigatedByShieldPct: number;
  protectedByGraceDay: boolean;
  died: boolean;
  deathReport?: DeathReport;
}

export interface PlayerState {
  id: string;
  isOnboarded: boolean;
  profile: PlayerProfile;
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  masteryScore: number;
  rank: HunterRank;
  hunterClass: string;
  activeTitle: string;
  unlockedTitles: string[];
  stats: StatMap;
  // Personal Growth Vitals (Pixel Hearts & Skill Points)
  hp: number;
  maxHp: number;
  skillPoints: number;
  totalSkillPointsEarned: number;
  deathCount: number;
  currentCheckpoint: CheckpointRecord;
  lastDeathReport: DeathReport | null;
  lastSettledDate: string;
  energyLevel: number; // 100 Peak, 75 Normal, 45 Low, 20 Exhausted
  fatigue: number; // 0 - 100
  streakDays: number;
  gold: number;
  runestones: number;
  activeBuffs: string[];
  equippedArtifactIds: string[];
  plannedRestMode?: boolean;
  penaltyActive: boolean;
  lastCheckinDate: string;
  achievements: Achievement[];
}

export interface ChapterStageNode {
  id: string;
  stageNumber: number;
  code: string;
  kind: 'minion_wave' | 'mini_boss' | 'chapter_boss';
  title: string;
  subtitle: string;
  lore: string;
  archetype: MonsterArchetype;
  minionName?: string;
  minionCountRequired?: number;
  minionProgress?: number;
  bossId?: string;
  isCheckpoint?: boolean;
  rewardGold: number;
  rewardSp: number;
  rewardXp: number;
  unlocked: boolean;
  completed: boolean;
}

export interface StoryChapter {
  id: string;
  chapterNumber: number;
  arcLabel: string;
  title: string;
  subtitle: string;
  lore: string;
  realLifeObjective: string;
  targetRank: HunterRank;
  themeArchetype?: MonsterArchetype;
  stages: ChapterStageNode[];
  miniBossIds: string[];
  chapterBossId: string;
  bossIds: string[];
  gateCondition: string;
  rewardSummary: string;
  unlocked: boolean;
  completed: boolean;
}

export type ShopItemCategory = 'artifact' | 'consumable' | 'real_reward';
export type ItemRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
export type EquipmentSlot = 'weapon' | 'armor' | 'helm' | 'accessory' | 'tome' | 'boots';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: ShopItemCategory;
  currency: 'gold' | 'runestones';
  price: number;
  effectCode: string;
  effectLabel: string;
  rarity?: ItemRarity;
  slot?: EquipmentSlot;
  iconKey?: string;
  statFocus?: AttributeKey;
  lore?: string;
  isCustom?: boolean;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  description: string;
  category: ShopItemCategory;
  effectCode: string;
  effectLabel: string;
  rarity?: ItemRarity;
  slot?: EquipmentSlot;
  iconKey?: string;
  statFocus?: AttributeKey;
  quantity: number;
  equipped: boolean;
  acquiredAt: string;
}

export interface DailyProgressSnapshot {
  dateKey: string;
  questsCompleted: number;
  focusMinutes: number;
  xpEarned: number;
  masteryEarned: number;
  energyLevel: number;
  reflectionNote?: string;
  isRestDay?: boolean;
}

export type AuditActionType =
  | 'QUEST_COMPLETED'
  | 'QUEST_FAILED_DAMAGE'
  | 'DAY_SETTLED'
  | 'PLAYER_DEATH_CHECKPOINT'
  | 'STAGE_CLEARED'
  | 'BOSS_STRIKE'
  | 'MINI_BOSS_DEFEATED'
  | 'CHAPTER_BOSS_UNLOCKED'
  | 'CHAPTER_COMPLETED'
  | 'CHAPTER_UNLOCKED'
  | 'SKILL_VERIFIED'
  | 'SKILL_UNLOCKED'
  | 'SKILL_UPGRADED'
  | 'SKILL_ASCENDED'
  | 'SKILL_RESPEC'
  | 'SHOP_PURCHASE'
  | 'ITEM_USED'
  | 'SYSTEM_BACKUP'
  | 'SYSTEM_RESET';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actionType: AuditActionType;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface StorageInfoPayload {
  dbPath: string;
  fileSizeBytes: number;
  walSizeBytes: number;
  journalMode: string;
  synchronousMode: string;
  foreignKeysEnabled: boolean;
  integrityOk: boolean;
  lastBackupAt?: string;
  lastSavedAt?: string;
  timezone: string;
  backupCount: number;
  tableCounts: {
    goals: number;
    timetableBlocks: number;
    quests: number;
    bosses: number;
    chapters: number;
    skills: number;
    shadows: number;
    memoryLogs: number;
    dailySnapshots: number;
    auditLogs: number;
  };
}

export type SystemResetMode = 'progress' | 'clean' | 'sample';
export type ChatContextScope = 'general' | 'timetable' | 'goals' | 'skills' | 'review';

export interface SuggestedQuestItem {
  title: string;
  description: string;
  type: QuestType;
  rank: QuestRank;
  durationMinutes: number;
  learningMethod: string;
  primaryStat: AttributeKey;
}

export interface AIChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedQuests?: SuggestedQuestItem[];
  modelUsed?: string;
  createdAt: string;
}

export interface AIChatThread {
  id: string;
  title: string;
  contextScope: ChatContextScope;
  createdAt: string;
  updatedAt: string;
  messages: AIChatMessage[];
}

export interface AIConsultRequest {
  prompt: string;
  threadId?: string;
  contextScope?: ChatContextScope;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface AIConsultResponse {
  reply: string;
  mode: 'LIVE_LLM' | 'SMART_HEURISTIC';
  modelUsed: string;
  threadId?: string;
  thread?: AIChatThread;
  threads?: AIChatThread[];
  suggestedQuests?: SuggestedQuestItem[];
  suggestedBlocks?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    title: string;
    type: TimetableBlockType;
  }>;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

export interface Goal {
  id: string;
  rawInput: string;
  title: string;
  category:
    | 'Engineering & Tech'
    | 'Language & IELTS'
    | 'Career & Internship'
    | 'Research & Academic'
    | 'Health & Vitality'
    | 'Personal Mastery';
  horizon: 'short_term' | 'long_term';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  deadline: string;
  targetMetric: string;
  recommendedMethod: string;
  subMilestones: string[];
  missingSkills: string[];
  woopObstacle?: string;
  ifThenPlan?: string;
  progress: number; // 0-100
  createdAt: string;
}

export interface TimetableBlock {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday ... 6 = Saturday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  type: TimetableBlockType;
  energyCost: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  isRecurring: boolean;
  notes?: string;
}

export interface FreeWindow {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  windowQuality: 'DEEP_WORK_PRIME' | 'STANDARD_FOCUS' | 'MICRO_SPRINT';
}

export interface DayScheduleAnalysis {
  dayOfWeek: number;
  dayLabel: string;
  totalSleepMinutes: number;
  totalBusyMinutes: number;
  totalRestBufferMinutes: number;
  totalFreeMinutes: number;
  recommendedQuestMinutes: number;
  reservedBreathingMinutes: number;
  overloadRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  isFreeDayExpansion: boolean;
  freeWindows: FreeWindow[];
  blocks: TimetableBlock[];
}

export interface QuestSubtask {
  id: string;
  label: string;
  done: boolean;
}

export interface Quest {
  id: string;
  dateKey: string; // YYYY-MM-DD
  type: QuestType;
  rank: QuestRank;
  title: string;
  description: string;
  learningMethod: string;
  reasoning: string;
  agentSource: AgentRole;
  goalId?: string;
  bossId?: string;
  skillId?: string;
  scheduledSlot: string; // e.g. "19:30 - 20:30" or "Flexible"
  durationMinutes: number;
  xpReward: number;
  masteryReward: number;
  goldReward: number;
  statRewards: Partial<StatMap>;
  subtasks: QuestSubtask[];
  status: QuestStatus;
  requiresProof: boolean;
  scientificProtocol?: string;
  ifThenTrigger?: string;
  microStartDone?: boolean;
  proofNote?: string;
  rejectionReason?: RejectionReason;
  createdAt: string;
  completedAt?: string;
  startedAt?: string;
  pausedAccumulatedSeconds?: number;
  isPaused?: boolean;
  actualDurationMinutes?: number;
  actualStartTime?: string;
  actualEndTime?: string;
  linkedBlockId?: string;
  verifiedFocusSeconds?: number;
  distractionSeconds?: number;
  focusIntegrityPct?: number;
}

export interface TaskDraftAnalysis {
  mode: 'LIVE_LLM' | 'SMART_HEURISTIC';
  suggestedTitle: string;
  type: QuestType;
  rank: QuestRank;
  durationMinutes: number;
  primaryStat: AttributeKey;
  secondaryStat?: AttributeKey;
  statRewards: Partial<StatMap>;
  statReason: string;
  skillId?: string;
  skillName?: string;
  xpReward: number;
  goldReward: number;
  masteryReward: number;
  spReward: number;
  scheduledSlot: string;
  requiresProof: boolean;
}

export interface AIDayPlanResult {
  mode: 'LIVE_LLM' | 'SMART_HEURISTIC';
  dayOfWeek: number;
  dayLabel: string;
  summary: string;
  addedBlocks: TimetableBlock[];
  addedQuests: Quest[];
  state: SystemStatePayload;
}

export type BossRole = 'mini_boss' | 'chapter_boss' | 'custom_boss';

export interface BossStage {
  id: string;
  title: string;
  description: string;
  hpDamage: number;
  completed: boolean;
  proofText?: string;
  verificationHint: string;
}

export interface BossMission {
  id: string;
  title: string;
  subtitle: string;
  rank: QuestRank;
  goalId?: string;
  chapterId?: string;
  bossRole: BossRole;
  orderIndex: number;
  unlocked: boolean;
  gateLabel: string;
  archetype?: MonsterArchetype;
  maxHp: number;
  currentHp: number;
  deadline?: string;
  stages: BossStage[];
  rewardTitle: string;
  rewardMastery: number;
  rewardGold?: number;
  rewardRunestones?: number;
  rewardShadowName: string;
  defeated: boolean;
}

export type SkillBranchId = 'intellect' | 'knowledge' | 'execution' | 'vitality' | 'influence';

export type SkillEffectCode =
  | 'XP_GAIN'
  | 'GOLD_GAIN'
  | 'MASTERY_GAIN'
  | 'FOCUS_BONUS'
  | 'FATIGUE_SHIELD'
  | 'MAX_HEARTS'
  | 'BOSS_PROGRESS'
  | 'RECOVERY_BOOST'
  | 'STAT_SURGE'
  | 'OMNI_GROWTH'
  | 'CUSTOM_MASTERY';

export interface SkillNode {
  id: string;
  name: string;
  branch: string;
  treeBranch?: SkillBranchId;
  tier?: number; // 1..5 vertical layer
  slot?: 'center' | 'left' | 'right';
  icon?: string;
  description: string;
  effectSummary?: string;
  effectCode?: SkillEffectCode;
  isInfiniteApex?: boolean;
  ascensionTier?: number;
  unlockedRankCap?: number;
  minPrereqLevel?: number;
  // Dual-Gate Infinite Skill Tree: SP unlocks/ascends -> Gold & Runestones upgrade ranks
  unlocked?: boolean;
  unlockSpCost?: number;
  baseGoldCost?: number;
  baseRunestoneCost?: number;
  requireAnyPrerequisite?: boolean;
  practiceXp: number;
  xpPerTier: number;
  totalPracticeXp?: number;
  totalPracticeMinutes?: number;
  tasksContributedCount?: number;
  powerRating?: number;
  recentContributions?: Array<{
    dateKey: string;
    title: string;
    minutes: number;
    xpAdded: number;
  }>;
  masteryTier: number; // 0 = not yet upgraded, 1..unlockedRankCap = current skill level
  maxTier: number;
  verificationCriteria: string;
  prerequisiteIds: string[];
  primaryStat: AttributeKey;
}

export type MonsterArchetype =
  | 'slime'
  | 'bat'
  | 'goblin'
  | 'skeleton'
  | 'wraith'
  | 'golem'
  | 'spider'
  | 'sentinel'
  | 'wolf'
  | 'orc'
  | 'ice_bear'
  | 'mage'
  | 'ant_king'
  | 'demon_lord'
  | 'architect'
  | 'dragon';

export interface PlayerGrowthBonuses {
  xpBonusPct: number;
  goldBonusPct: number;
  masteryBonusPct: number;
  focusBonusPct: number;
  fatigueReductionPct: number;
  bossDamageBonusPct: number;
  recoveryBonusPct: number;
  maxHearts: number;
  totalSkillLevels: number;
  totalUnlockedNodes: number;
  totalAscensions: number;
}

export interface ShadowSoldier {
  id: string;
  name: string;
  title: string;
  rank: QuestRank;
  originBoss: string;
  passiveBuff: string;
  statBonus: Partial<StatMap>;
  routineTitle: string;
  routineDescription: string;
  routineDurationMinutes: number;
  summonCount: number;
  extractedAt: string;
}

export interface AgentMemoryLog {
  id: string;
  timestamp: string;
  agent: AgentRole;
  eventType:
    | 'ORCHESTRATION'
    | 'GOAL_ANALYSIS'
    | 'QUEST_COMPLETED'
    | 'QUEST_REJECTED'
    | 'VITALITY_OVERRIDE'
    | 'BOSS_VERIFIED';
  summary: string;
  insight: string;
}

export interface AISettings {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  useLiveLlm: boolean;
}

export interface CouncilDeliberation {
  dateKey: string;
  generatedAt: string;
  mode: 'LIVE_LLM' | 'SMART_HEURISTIC';
  modelUsed: string;
  agentNotes: {
    agent: AgentRole;
    message: string;
  }[];
  systemDirective: string;
}

export interface SystemStatePayload {
  player: PlayerState;
  goals: Goal[];
  timetable: TimetableBlock[];
  todayAnalysis: DayScheduleAnalysis;
  weeklyAnalysis: DayScheduleAnalysis[];
  quests: Quest[];
  bosses: BossMission[];
  chapters: StoryChapter[];
  shopItems: ShopItem[];
  inventory: InventoryItem[];
  skills: SkillNode[];
  shadows: ShadowSoldier[];
  memoryLogs: AgentMemoryLog[];
  dailySnapshots: DailyProgressSnapshot[];
  auditLogs: AuditLogEntry[];
  storageInfo: StorageInfoPayload;
  aiSettings: AISettings;
  lastDeliberation: CouncilDeliberation | null;
  growthBonuses: PlayerGrowthBonuses;
  chatThreads: AIChatThread[];
  assistantSummary?: {
    trackerRunning: boolean;
    focusScore: number;
    deepWorkMinutes: number;
    unreadNudges: number;
    currentCategory?: ActivityCategory;
  };
}

export type ActivityCategory =
  | 'deep_work'
  | 'study_research'
  | 'communication'
  | 'distraction'
  | 'other'
  | 'idle';

export interface ActivityRule {
  id: string;
  keyword: string; // lowercase substring matched against processName or windowTitle
  category: Exclude<ActivityCategory, 'idle'>;
  stat?: AttributeKey;
}

export interface ActivityLogEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD (Asia/Ho_Chi_Minh)
  processName: string;
  windowTitle: string;
  category: ActivityCategory;
  durationSeconds: number;
  startedAt: string;
  endedAt: string;
  creditedToSkill?: boolean;
}

export interface AssistantNudge {
  id: string;
  dateKey: string;
  kind:
    | 'morning_briefing'
    | 'upcoming_block'
    | 'distraction_guard'
    | 'ultradian_break'
    | 'evening_winddown'
    | 'system';
  title: string;
  message: string;
  createdAt: string;
  dismissed: boolean;
  toastSent?: boolean;
}

export interface AssistantSettings {
  trackerEnabled: boolean;
  pollIntervalSeconds: number; // default 10
  idleThresholdSeconds: number; // default 180 (3 min)
  windowsToastEnabled: boolean;
  distractionGuardEnabled: boolean;
  distractionThresholdMinutes: number; // default 3
  distractionCooldownMinutes: number; // default 15
  upcomingBlockReminderEnabled: boolean;
  upcomingReminderLeadMinutes: number; // default 5
  ultradianBreakEnabled: boolean;
  ultradianBreakMinutes: number; // default 80
  eveningWinddownEnabled: boolean;
  eveningWinddownTime: string; // default '22:30'
  quietHoursStart: string; // default '23:30'
  quietHoursEnd: string; // default '07:00'
  autoCreditSkillXp: boolean;
  customRules: ActivityRule[];
  autoPauseQuestOnIdle?: boolean; // default true
  distractionBudgetMinutes?: number; // default 45
  dailyFocusGoalMinutes?: number; // default 180 (3h/day)
  hudVisibleOnStart?: boolean; // default true
  dndUntil?: string | null; // ISO timestamp; blocks non-critical toasts when > now
  backupEnabled?: boolean; // default true
  backupDir?: string; // default '' -> data/backups/
  backupRetentionDays?: number; // default 14
  lanAccessEnabled?: boolean; // default false
  lanPairToken?: string; // 32-char random hex secret
  lanPairPin?: string; // 6-digit numeric PIN for easy phone pairing
}

export interface StartupStatusPayload {
  platform: string;
  isWindows: boolean;
  startupInstalled: boolean;
  startupScriptPath: string;
  desktopShortcutInstalled: boolean;
  desktopShortcutPath: string;
  traySupported: boolean;
  daemonRunning: boolean;
  serverUrl: string;
}

export interface DailyActivitySummary {
  dateKey: string;
  deepWorkMinutes: number;
  studyMinutes: number;
  communicationMinutes: number;
  distractionMinutes: number;
  otherMinutes: number;
  idleMinutes: number;
  totalActiveMinutes: number;
  focusScore: number; // 0..100
  uncreditedFocusMinutes: number;
  currentApp?: {
    processName: string;
    windowTitle: string;
    category: ActivityCategory;
    since: string;
  } | null;
  topApps: Array<{
    processName: string;
    category: ActivityCategory;
    minutes: number;
  }>;
  recentLogs: ActivityLogEntry[];
  hourlyBreakdown?: Array<{
    hour: number; // 6..23
    deepWorkMins: number;
    studyMins: number;
    commMins: number;
    distractionMins: number;
    otherMins: number;
    dominantCategory: ActivityCategory | 'none';
  }>;
  peakFocusHour?: string | null; // e.g. "09:00–10:00"
  distractionBudgetMinutes?: number;
  suggestedFocusSession?: {
    minutes: number;
    topApp: string;
    dominantCategory: 'deep_work' | 'study_research';
    suggestedTitle: string;
    primaryStat: AttributeKey;
    skillName?: string;
  } | null;
}

export interface MorningBriefingPayload {
  dateKey: string;
  dayLabel: string;
  greeting: string;
  fixedBlocksCount: number;
  freeHours: number;
  bestDeepWorkWindow: string | null;
  pendingQuestsCount: number;
  activeChapterLabel: string;
  suggestedAction: string;
}

export interface AssistantOverviewPayload {
  settings: AssistantSettings;
  startup: StartupStatusPayload;
  activity: DailyActivitySummary;
  briefing: MorningBriefingPayload;
  nudges: AssistantNudge[];
  trackerRunning: boolean;
  distractionAlertLevel?: 'none' | 'soft_hud' | 'toast';
  distractionStreakSeconds?: number;
  dndActive?: boolean;
  dndUntil?: string | null;
  externalTrackerActive?: boolean;
}

export type WeeklyGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface HeatmapDayCell {
  dateKey: string; // YYYY-MM-DD
  focusMinutes: number;
  distractionMinutes: number;
  questsCompleted: number;
  focusScore: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface DailyFocusTrendPoint {
  dateKey: string;
  label: string; // e.g. "25/11"
  deepWorkMinutes: number;
  studyMinutes: number;
  distractionMinutes: number;
  questsCompleted: number;
  focusScore: number;
}

export interface AppUsageRankItem {
  processName: string;
  category: ActivityCategory;
  minutes: number;
}

export interface StatGrowthBalanceItem {
  stat: AttributeKey;
  currentValue: number;
  sharePct: number;
  status: 'strong' | 'balanced' | 'lagging';
}

export interface LongTermAnalyticsPayload {
  range: '7d' | '30d';
  startDate: string;
  endDate: string;
  totalFocusMinutes: number;
  totalDeepWorkMinutes: number;
  totalStudyMinutes: number;
  totalDistractionMinutes: number;
  avgFocusScore: number;
  questsCompleted: number;
  questsTotal: number;
  completionRatePct: number;
  empiricalPeakHour: string | null; // e.g. "09:00–10:00"
  grade: WeeklyGrade;
  heatmap30d: HeatmapDayCell[];
  dailyTrend: DailyFocusTrendPoint[];
  topHelpfulApps: AppUsageRankItem[];
  topDrainingApps: AppUsageRankItem[];
  statBalance: StatGrowthBalanceItem[];
  weakestStats: AttributeKey[];
}

export interface WeeklyReviewDiagnosis {
  headline: string;
  strengths: string[];
  bottlenecks: string[];
  nextWeekTopPriority: string;
  recommendedFocusWindow: string;
  mode: 'llm' | 'heuristic';
}

export interface WeeklyReviewRecord {
  id: string;
  weekStart: string;
  weekEnd: string;
  grade: WeeklyGrade;
  metrics: {
    totalFocusMinutes: number;
    totalDistractionMinutes: number;
    avgFocusScore: number;
    questsCompleted: number;
    completionRatePct: number;
    empiricalPeakHour: string | null;
  };
  diagnosis: WeeklyReviewDiagnosis;
  createdAt: string;
}

export interface WeeklyBlueprintBlockDraft {
  id: string;
  dayOfWeek: number; // 0..6 (0=Sun, 1=Mon..6=Sat)
  dayLabel: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  title: string;
  type: TimetableBlockType;
  energyCost: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  primaryStat: AttributeKey;
  goalId?: string;
  skillId?: string;
  reason: string;
  selected: boolean;
}

export interface WeeklyBlueprintDraft {
  generatedAt: string;
  mode: 'llm' | 'heuristic';
  empiricalPeakHour: string | null;
  weakestStats: AttributeKey[];
  summary: string;
  blocks: WeeklyBlueprintBlockDraft[];
}

export interface BackupFileEntry {
  filename: string;
  fullPath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupStatusPayload {
  enabled: boolean;
  backupDir: string;
  resolvedDir: string;
  retentionDays: number;
  lastBackupAt: string | null;
  backups: BackupFileEntry[];
}

export interface LanAccessPayload {
  enabled: boolean;
  port: number;
  primaryIp: string | null;
  tailscaleIp: string | null;
  allAddresses: Array<{ label: string; ip: string; mobileUrl: string }>;
  mobileUrl: string | null;
  qrSvg: string | null;
  pairPin: string;
  pairToken: string;
}

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
  justSettledPenalty?: { bossName: string; weekKey: string; hpLost: number; goldLost: number; died: boolean } | null;
}
