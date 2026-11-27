import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  AssistantOverviewPayload,
  AttributeKey,
  CoreHabit,
  DayScheduleAnalysis,
  DisciplineSettings,
  Goal,
  HabitCompletionKind,
  HabitFrequency,
  HabitTimeOfDay,
  KnowledgeNote,
  LocalIntelligencePayload,
  PlayerState,
  Quest,
  QuestRank,
  QuestSubtask,
  QuestType,
  RecallRating,
  RejectionReason,
  SkillNode,
  StatMap,
  TaskDraftAnalysis,
  WeeklyRaidPayload,
} from '../types/system';
import { systemApi } from '../utils/api';
import { soundEngine } from '../utils/soundEngine';
import { getVnTodayKey } from '../utils/timeVn';
import { QUEST_COMPOSER_DRAFT_KEY } from './FloatingHudPage';
import {
  PxBolt,
  PxBook,
  PxCalendar,
  PxCheck,
  PxChevron,
  PxClock,
  PxClose,
  PxCoffee,
  PxEdit,
  PxFlame,
  PxGear,
  PxPause,
  PxPlay,
  PxPlus,
  PxRefresh,
  PxSearch,
  PxShield,
  PxSparkle,
  PxSword,
  PxTarget,
  PxTrash,
  PxWarn,
} from './PixelIcons';
import { PxTreasureChest, RaidBossSprite } from './RaidBossSprites';

const ENERGY_STEPS = [
  { val: 100, label: 'Sung sức', color: 'var(--px-green-text)' },
  { val: 75, label: 'Ổn định', color: 'var(--px-blue-text)' },
  { val: 45, label: 'Hơi mệt', color: 'var(--px-gold-text)' },
  { val: 20, label: 'Cạn pin', color: 'var(--px-red-text)' },
];

const TIME_OF_DAY_META: Record<HabitTimeOfDay, string> = {
  morning: 'Sáng',
  anytime: 'Trong ngày',
  evening: 'Tối',
};

const FREQ_LABELS: Record<HabitFrequency, string> = {
  daily: 'Hàng ngày',
  weekdays: 'Thứ 2 – Thứ 6',
  weekends: 'Cuối tuần',
  custom_days: 'Chọn thứ',
  times_per_week: 'Số buổi / tuần',
};

const DOW_CHIPS = [
  { dow: 1, label: 'T2' },
  { dow: 2, label: 'T3' },
  { dow: 3, label: 'T4' },
  { dow: 4, label: 'T5' },
  { dow: 5, label: 'T6' },
  { dow: 6, label: 'T7' },
  { dow: 0, label: 'CN' },
];

const MODE_LABELS: Record<string, { label: string; cls: string }> = {
  iron: { label: 'Kỷ luật thép', cls: 'text-[var(--px-red-text)]' },
  balanced: { label: 'Cân bằng', cls: 'text-[var(--px-gold-text)]' },
  sustainable: { label: 'Bền bỉ', cls: 'text-[var(--px-green-text)]' },
};

const TYPE_META: Record<
  QuestType,
  { label: string; badgeCls: string; hpPenalty: number }
> = {
  main: {
    label: 'Main ★',
    badgeCls: 'border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]',
    hpPenalty: 18,
  },
  daily: {
    label: 'Daily',
    badgeCls: 'border-[var(--px-blue)] bg-[var(--bg-surface-2)] text-[var(--px-blue-text)]',
    hpPenalty: 12,
  },
  side: {
    label: 'Side',
    badgeCls: 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]',
    hpPenalty: 8,
  },
  recovery: {
    label: 'Hồi phục',
    badgeCls: 'border-[var(--px-green)] bg-[var(--bg-subtle)] text-[var(--px-green-text)]',
    hpPenalty: 0,
  },
  emergency: {
    label: 'Khẩn cấp',
    badgeCls: 'border-[var(--px-red)] bg-[var(--bg-surface-2)] text-[var(--px-red-text)]',
    hpPenalty: 18,
  },
  hidden: {
    label: 'Hidden',
    badgeCls: 'border-[var(--px-plum)] bg-[var(--bg-surface-2)] text-[var(--px-plum-text)]',
    hpPenalty: 0,
  },
};

const STAT_META: Record<AttributeKey, { label: string; short: string }> = {
  INT: { label: 'INT · Tư duy & Code', short: 'INT' },
  PER: { label: 'PER · Đọc & Học sâu', short: 'PER' },
  AGI: { label: 'AGI · Thực thi & Kỷ luật', short: 'AGI' },
  STR: { label: 'STR · Thể chất & Sức bền', short: 'STR' },
  VIT: { label: 'VIT · Giấc ngủ & Hồi phục', short: 'VIT' },
  CHA: { label: 'CHA · Giao tiếp & Ảnh hưởng', short: 'CHA' },
};

interface ScientificProtocolTemplate {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  learningMethod: string;
  primaryStat: AttributeKey;
  type: QuestType;
  rank: QuestRank;
  researcherTag: string;
}

const SCIENTIFIC_PROTOCOLS: ScientificProtocolTemplate[] = [
  {
    id: 'huberman-ultradian-90',
    title: 'Huberman 90m Ultradian Deep Work',
    description:
      'Làm việc sâu trọn 1 chu kỳ siêu ngày 90 phút không thông báo, dành 5 phút đầu vượt qua sức ỳ để vào trạng thái tập trung đường hầm.',
    durationMinutes: 90,
    learningMethod: 'Andrew Huberman 90m Ultradian Cycle + Tunnel Vision Focus',
    primaryStat: 'INT',
    type: 'main',
    rank: 'B',
    researcherTag: 'Huberman Lab · 90p · INT',
  },
  {
    id: 'dunlosky-active-recall',
    title: 'Dunlosky Active Recall & Blurting',
    description:
      'Đóng toàn bộ tài liệu, tự viết hoặc trình bày lại toàn bộ ý chính từ trí nhớ rồi đối chiếu để phát hiện và vá lỗ hổng.',
    durationMinutes: 25,
    learningMethod: 'John Dunlosky (2013) Practice Testing / Retrieval Practice',
    primaryStat: 'PER',
    type: 'daily',
    rank: 'C',
    researcherTag: 'Dunlosky 2013 · 25p · PER',
  },
  {
    id: 'ericsson-deliberate-practice',
    title: 'Ericsson Deliberate Practice Drill',
    description:
      'Tách riêng điểm yếu cụ thể ngay sát ngưỡng năng lực hiện tại, luyện lặp lại có phản hồi tức thì và chỉnh lỗi có chủ đích.',
    durationMinutes: 45,
    learningMethod: 'Anders Ericsson Deliberate Practice Framework',
    primaryStat: 'INT',
    type: 'main',
    rank: 'B',
    researcherTag: 'Ericsson · 45p · INT',
  },
  {
    id: 'huberman-nsdr-15',
    title: 'Huberman 15m NSDR / Yoga Nidra Consolidation',
    description:
      'Nghỉ sâu không ngủ (Non-Sleep Deep Rest) 15 phút sau phiên học cường độ cao để phục hồi dopamine và củng cố trí nhớ dài hạn.',
    durationMinutes: 15,
    learningMethod: 'Andrew Huberman NSDR / Non-Sleep Deep Rest Memory Consolidation',
    primaryStat: 'VIT',
    type: 'recovery',
    rank: 'D',
    researcherTag: 'Huberman NSDR · 15p · VIT',
  },
  {
    id: 'oakley-diffused-walk',
    title: 'Oakley Diffused Mode Walk & Synthesis',
    description:
      'Đi bộ thả lỏng không màn hình 25 phút sau phiên Focused để não chuyển sang Diffused Mode và tự kết nối các mảnh kiến thức.',
    durationMinutes: 25,
    learningMethod: 'Barbara Oakley Focused vs. Diffused Mode Neural Switching',
    primaryStat: 'PER',
    type: 'side',
    rank: 'D',
    researcherTag: 'Oakley · 25p · PER',
  },
  {
    id: 'walker-digital-sunset',
    title: 'Walker Digital Sunset & Sleep Anchor',
    description:
      'Ngắt màn hình ánh sáng xanh trước giờ ngủ 20 phút, hạ ánh sáng và giữ giờ ngủ cố định để bảo vệ giấc ngủ sâu & REM.',
    durationMinutes: 20,
    learningMethod: 'Matthew Walker Sleep Architecture & Circadian Anchoring',
    primaryStat: 'VIT',
    type: 'recovery',
    rank: 'D',
    researcherTag: 'Matthew Walker · 20p · VIT',
  },
];

function getQuestElapsedSeconds(q: Quest, nowMs: number): number {
  const base = q.pausedAccumulatedSeconds ?? 0;
  if (q.startedAt && !q.isPaused) {
    const parsed = Date.parse(q.startedAt);
    if (!Number.isNaN(parsed)) {
      return base + Math.max(0, Math.floor((nowMs - parsed) / 1000));
    }
  }
  return base;
}

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseSlotStartMinutes(slot?: string): number {
  if (!slot) return 9999;
  const m = slot.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface TodayFocusCockpitProps {
  player: PlayerState;
  todayAnalysis: DayScheduleAnalysis;
  quests: Quest[];
  goals: Goal[];
  skills: SkillNode[];
  habits: CoreHabit[];
  knowledgeNotes: KnowledgeNote[];
  disciplineSettings: DisciplineSettings;
  localIntelligence: LocalIntelligencePayload | null;
  assistantOverview: AssistantOverviewPayload | null;
  weeklyRaid?: WeeklyRaidPayload | null;
  eveningCloseoutBadge: boolean;
  alreadyClosedToday: boolean;
  onCheckinEnergy: (energy: number) => Promise<void>;
  onToggleMvd: (active: boolean) => Promise<void>;
  onTogglePlannedRest?: (active: boolean) => Promise<unknown>;
  onOrchestrate: (focusNote: string) => Promise<void>;
  onOpenCloseout: () => Promise<void>;
  onCreateCustomQuest: (payload: {
    title: string;
    description?: string;
    type?: QuestType;
    rank?: QuestRank;
    durationMinutes?: number;
    scheduledSlot?: string;
    learningMethod?: string;
    primaryStat?: AttributeKey;
    secondaryStat?: AttributeKey;
    skillId?: string;
    goalId?: string;
    statRewards?: Partial<StatMap>;
    requiresProof?: boolean;
    ifThenTrigger?: string;
    scientificProtocol?: string;
    subtasks?: Array<{ id?: string; label: string; done?: boolean } | string>;
    syncToTimetable?: boolean;
  }) => Promise<void>;
  onStartQuest: (questId: string) => Promise<void>;
  onPauseQuest: (questId: string) => Promise<void>;
  onCompleteQuest: (questId: string, proofNote?: string) => Promise<void>;
  onReopenQuest?: (questId: string) => Promise<void>;
  onDeleteQuest: (questId: string) => Promise<void>;
  onToggleSubtask: (questId: string, subtaskId: string) => Promise<void>;
  onUpdateQuest: (
    questId: string,
    updates: Partial<Quest> & {
      primaryStat?: AttributeKey;
      secondaryStat?: AttributeKey;
      syncToTimetable?: boolean;
    }
  ) => Promise<void>;
  onRejectQuest: (questId: string, reason: RejectionReason) => Promise<void>;
  onFailQuest: (questId: string) => Promise<void>;
  onMicroStartQuest: (questId: string) => Promise<unknown>;
  onEnterDungeon: (quest: Quest) => void;
  onQuickStartFocus: (durationMinutes: number, title?: string) => Promise<void>;
  onConvertFocusToQuest: (payload: {
    mode: 'complete_new' | 'credit_pending';
    title?: string;
    questId?: string;
    primaryStat?: AttributeKey;
  }) => Promise<void>;
  onCreateHabit: (payload: {
    title: string;
    timeOfDay: HabitTimeOfDay;
    frequency: HabitFrequency;
    customDays?: number[];
    targetPerWeek?: number;
    standardSpec: string;
    minimumSpec: string;
    durationMinutes?: number;
    primaryStat?: AttributeKey;
    goalId?: string;
    skillId?: string;
  }) => Promise<void>;
  onUpdateHabit?: (habitId: string, patch: Partial<CoreHabit>) => Promise<void>;
  onSeedStarterHabits: () => Promise<void>;
  onCheckinHabit: (habitId: string, kind: HabitCompletionKind | 'undo') => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  onReviewKnowledge: (noteId: string, rating: RecallRating) => Promise<void>;
  onOpenGrowthTab: () => void;
  onOpenTimetableTab?: () => void;
  onOpenRaidArena?: () => void;
}

export const TodayFocusCockpit: React.FC<TodayFocusCockpitProps> = ({
  player,
  todayAnalysis,
  quests,
  goals,
  skills,
  habits,
  knowledgeNotes,
  disciplineSettings,
  localIntelligence,
  assistantOverview,
  weeklyRaid,
  eveningCloseoutBadge,
  alreadyClosedToday,
  onCheckinEnergy,
  onToggleMvd,
  onTogglePlannedRest,
  onOrchestrate,
  onOpenCloseout,
  onCreateCustomQuest,
  onStartQuest,
  onPauseQuest,
  onCompleteQuest,
  onReopenQuest,
  onDeleteQuest,
  onToggleSubtask,
  onUpdateQuest,
  onRejectQuest,
  onFailQuest,
  onMicroStartQuest,
  onEnterDungeon,
  onQuickStartFocus,
  onConvertFocusToQuest,
  onCreateHabit,
  onUpdateHabit,
  onSeedStarterHabits,
  onCheckinHabit,
  onDeleteHabit,
  onReviewKnowledge,
  onOpenGrowthTab,
  onOpenTimetableTab,
  onOpenRaidArena,
}) => {
  const todayKey = getVnTodayKey();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [energyMenuOpen, setEnergyMenuOpen] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [showOrchestrateNote, setShowOrchestrateNote] = useState(false);
  const [orchestrateNote, setOrchestrateNote] = useState('');
  const [togglingMvd, setTogglingMvd] = useState(false);
  const [togglingRest, setTogglingRest] = useState(false);
  const [convertingFocus, setConvertingFocus] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ==================== HABITS CREATE & EDIT STATE ====================
  const [habitFilter, setHabitFilter] = useState<'all' | HabitTimeOfDay>('all');
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habTitle, setHabTitle] = useState('');
  const [habTime, setHabTime] = useState<HabitTimeOfDay>('morning');
  const [habFreq, setHabFreq] = useState<HabitFrequency>('daily');
  const [habDays, setHabDays] = useState<number[]>([1, 3, 5]);
  const [habTargetWeek, setHabTargetWeek] = useState(3);
  const [habDuration, setHabDuration] = useState(20);
  const [habStandard, setHabStandard] = useState('');
  const [habMinimum, setHabMinimum] = useState('');
  const [habStat, setHabStat] = useState<AttributeKey>('AGI');
  const [habGoalId, setHabGoalId] = useState('');
  const [habSkillId, setHabSkillId] = useState('');
  const [savingHabit, setSavingHabit] = useState(false);

  // ==================== SPACED RECALL STATE ====================
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [reviewingNoteId, setReviewingNoteId] = useState<string | null>(null);

  // ==================== UNIFIED QUEST COMPOSER STATE ====================
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDur, setQuickDur] = useState<number>(25);
  const [quickType, setQuickType] = useState<QuestType>('daily');
  const [quickRank, setQuickRank] = useState<QuestRank | 'AUTO'>('AUTO');
  const [quickStat, setQuickStat] = useState<AttributeKey | 'AUTO'>('AUTO');
  const [quickGoalId, setQuickGoalId] = useState<string>('');
  const [quickSkillId, setQuickSkillId] = useState<string>('');
  const [quickSlot, setQuickSlot] = useState<string>('Flexible');
  const [quickSyncCalendar, setQuickSyncCalendar] = useState<boolean>(false);
  const [quickDesc, setQuickDesc] = useState<string>('');
  const [quickIfThen, setQuickIfThen] = useState<string>('');
  const [quickRequireProof, setQuickRequireProof] = useState<boolean>(false);
  const [quickSubtasks, setQuickSubtasks] = useState<string[]>([]);
  const [newSubtaskDraft, setNewSubtaskDraft] = useState<string>('');
  const [showAdvancedComposer, setShowAdvancedComposer] = useState<boolean>(false);
  const [showProtocolsDrawer, setShowProtocolsDrawer] = useState<boolean>(false);
  const [creatingProtocolId, setCreatingProtocolId] = useState<string | null>(null);
  const [quickAdding, setQuickAdding] = useState(false);
  const [analyzingDraft, setAnalyzingDraft] = useState(false);
  const [draftAnalysis, setDraftAnalysis] = useState<TaskDraftAnalysis | null>(null);

  // ==================== QUEST MANAGEMENT & INLINE EDITOR STATE ====================
  const [questTab, setQuestTab] = useState<'pending' | 'completed' | 'all'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | QuestType>('all');
  const [goalFilter, setGoalFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'priority' | 'slot' | 'duration' | 'xp'>('priority');
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  const [proofQuestId, setProofQuestId] = useState<string | null>(null);
  const [proofText, setProofText] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Full Inline Quest Editor
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState<QuestType>('daily');
  const [editRank, setEditRank] = useState<QuestRank>('C');
  const [editDur, setEditDur] = useState<number>(25);
  const [editStat, setEditStat] = useState<AttributeKey>('INT');
  const [editSlot, setEditSlot] = useState('');
  const [editSyncCalendar, setEditSyncCalendar] = useState(false);
  const [editGoalId, setEditGoalId] = useState('');
  const [editSkillId, setEditSkillId] = useState('');
  const [editIfThen, setEditIfThen] = useState('');
  const [editRequireProof, setEditRequireProof] = useState(false);
  const [editSubtasks, setEditSubtasks] = useState<QuestSubtask[]>([]);
  const [editNewSubtask, setEditNewSubtask] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const energyRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const composerSectionRef = useRef<HTMLElement | null>(null);

  // Restore any draft sent from Mini HUD ("Mở trình quản lý đầy đủ ↗")
  useEffect(() => {
    const consumeDraft = () => {
      try {
        const raw = window.localStorage.getItem(QUEST_COMPOSER_DRAFT_KEY);
        if (!raw) return;
        window.localStorage.removeItem(QUEST_COMPOSER_DRAFT_KEY);
        const parsed = JSON.parse(raw) as {
          title?: string;
          durationMinutes?: number;
          type?: QuestType;
          primaryStat?: AttributeKey;
          syncToTimetable?: boolean;
          goalId?: string;
          scheduledSlot?: string;
          openAdvanced?: boolean;
        };
        if (parsed.title) setQuickTitle(parsed.title);
        if (typeof parsed.durationMinutes === 'number') setQuickDur(parsed.durationMinutes);
        if (parsed.type) setQuickType(parsed.type);
        if (parsed.primaryStat) setQuickStat(parsed.primaryStat);
        if (typeof parsed.syncToTimetable === 'boolean') setQuickSyncCalendar(parsed.syncToTimetable);
        if (parsed.goalId) setQuickGoalId(parsed.goalId);
        if (parsed.scheduledSlot) setQuickSlot(parsed.scheduledSlot);
        if (parsed.openAdvanced) setShowAdvancedComposer(true);
        setTimeout(() => {
          composerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          composerInputRef.current?.focus();
        }, 80);
      } catch {
        // Ignore parse error
      }
    };
    consumeDraft();
    window.addEventListener('focus', consumeDraft);
    return () => window.removeEventListener('focus', consumeDraft);
  }, []);

  const todayQuests = useMemo(
    () => quests.filter((q) => q.dateKey === todayKey || q.status === 'pending'),
    [quests, todayKey]
  );
  const pendingQuests = useMemo(
    () => todayQuests.filter((q) => q.status === 'pending'),
    [todayQuests]
  );
  const completedQuests = useMemo(
    () => todayQuests.filter((q) => q.status === 'completed' && q.dateKey === todayKey),
    [todayQuests, todayKey]
  );

  const filteredQuests = useMemo(() => {
    const base =
      questTab === 'pending'
        ? pendingQuests
        : questTab === 'completed'
          ? completedQuests
          : todayQuests;

    const q = searchQuery.trim().toLowerCase();
    const filtered = base.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (goalFilter !== 'all' && item.goalId !== goalFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.scheduledSlot || '').toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const aRun = a.startedAt && !a.isPaused ? 1 : 0;
      const bRun = b.startedAt && !b.isPaused ? 1 : 0;
      if (aRun !== bRun) return bRun - aRun;

      if (sortBy === 'slot') {
        return parseSlotStartMinutes(a.scheduledSlot) - parseSlotStartMinutes(b.scheduledSlot);
      }
      if (sortBy === 'duration') {
        return b.durationMinutes - a.durationMinutes;
      }
      if (sortBy === 'xp') {
        return b.xpReward - a.xpReward;
      }
      // Default: priority (Main/Emergency first, then time slot)
      const weight = (t: QuestType) =>
        t === 'main' ? 4 : t === 'emergency' ? 3 : t === 'daily' ? 2 : 1;
      const diffW = weight(b.type) - weight(a.type);
      if (diffW !== 0) return diffW;
      return parseSlotStartMinutes(a.scheduledSlot) - parseSlotStartMinutes(b.scheduledSlot);
    });
  }, [questTab, pendingQuests, completedQuests, todayQuests, searchQuery, typeFilter, goalFilter, sortBy]);

  const activeSession = useMemo(
    () =>
      pendingQuests.find((q) => q.startedAt && !q.isPaused) ||
      pendingQuests.find((q) => q.isPaused || (q.pausedAccumulatedSeconds ?? 0) > 0) ||
      null,
    [pendingQuests]
  );

  useEffect(() => {
    if (!activeSession || activeSession.isPaused) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeSession]);

  useEffect(() => {
    if (!energyMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (energyRef.current && !energyRef.current.contains(e.target as Node)) {
        setEnergyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [energyMenuOpen]);

  const dueHabits = useMemo(() => habits.filter((h) => h.dueToday !== false), [habits]);
  const visibleHabits = useMemo(
    () =>
      habitFilter === 'all'
        ? habits
        : habits.filter((h) => h.timeOfDay === habitFilter),
    [habits, habitFilter]
  );
  const completedHabitsCount = dueHabits.filter((h) => Boolean(h.completedToday)).length;

  const dueRecallNotes = useMemo(
    () =>
      knowledgeNotes.filter(
        (n) => n.recallEnabled && n.nextReviewDate && n.nextReviewDate <= todayKey
      ),
    [knowledgeNotes, todayKey]
  );
  const currentRecallNote = dueRecallNotes[0] || null;

  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const skillMap = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  const focusTotalMins =
    (assistantOverview?.activity.deepWorkMinutes ?? 0) +
    (assistantOverview?.activity.studyMinutes ?? 0);
  const focusGoalMins = disciplineSettings.dailyFocusGoalMinutes || 180;
  const focusGoalPct = Math.min(100, Math.round((focusTotalMins / Math.max(30, focusGoalMins)) * 100));

  const mvdActive = Boolean(disciplineSettings.minimumViableDayActive);
  const modeInfo = MODE_LABELS[disciplineSettings.mode] || MODE_LABELS.balanced;
  const energyMeta =
    ENERGY_STEPS.find((e) => player.energyLevel >= e.val - 12) || ENERGY_STEPS[1];

  const resetComposer = () => {
    setQuickTitle('');
    setQuickDesc('');
    setQuickIfThen('');
    setQuickSubtasks([]);
    setNewSubtaskDraft('');
    setDraftAnalysis(null);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || quickAdding) return;
    setQuickAdding(true);
    try {
      await onCreateCustomQuest({
        title: quickTitle.trim(),
        description: quickDesc.trim() || undefined,
        durationMinutes: quickDur,
        type: quickType,
        rank: quickRank === 'AUTO' ? undefined : quickRank,
        primaryStat: quickStat === 'AUTO' ? undefined : quickStat,
        goalId: quickGoalId || undefined,
        skillId: quickSkillId || undefined,
        scheduledSlot: quickSlot.trim() || 'Flexible',
        syncToTimetable: quickSyncCalendar,
        requiresProof: quickRequireProof,
        ifThenTrigger: quickIfThen.trim() || undefined,
        subtasks: quickSubtasks.length > 0 ? quickSubtasks : undefined,
      });
      resetComposer();
      setQuestTab('pending');
    } finally {
      setQuickAdding(false);
    }
  };

  const handleAnalyzeDraft = async () => {
    if (!quickTitle.trim() || analyzingDraft) return;
    setAnalyzingDraft(true);
    try {
      const res = await systemApi.analyzeTaskDraft({
        title: quickTitle.trim(),
        description: quickDesc.trim() || undefined,
        durationMinutes: quickDur,
        type: quickType,
      });
      setDraftAnalysis(res);
    } finally {
      setAnalyzingDraft(false);
    }
  };

  const handleApplyDraft = async () => {
    if (!draftAnalysis || !quickTitle.trim() || quickAdding) return;
    setQuickAdding(true);
    try {
      await onCreateCustomQuest({
        title: draftAnalysis.suggestedTitle || quickTitle.trim(),
        description: quickDesc.trim() || draftAnalysis.statReason,
        durationMinutes: draftAnalysis.durationMinutes || quickDur,
        type: draftAnalysis.type,
        rank: draftAnalysis.rank,
        scheduledSlot: draftAnalysis.scheduledSlot,
        primaryStat: draftAnalysis.primaryStat,
        secondaryStat: draftAnalysis.secondaryStat,
        skillId: quickSkillId || draftAnalysis.skillId,
        goalId: quickGoalId || undefined,
        statRewards: draftAnalysis.statRewards,
        requiresProof: quickRequireProof || draftAnalysis.requiresProof,
        ifThenTrigger: quickIfThen.trim() || undefined,
        subtasks: quickSubtasks.length > 0 ? quickSubtasks : undefined,
        syncToTimetable: true,
      });
      resetComposer();
      setQuestTab('pending');
    } finally {
      setQuickAdding(false);
    }
  };

  const handleLoadDraftIntoCustomizer = () => {
    if (!draftAnalysis) return;
    setQuickTitle(draftAnalysis.suggestedTitle || quickTitle);
    setQuickType(draftAnalysis.type);
    setQuickRank(draftAnalysis.rank);
    setQuickDur(draftAnalysis.durationMinutes || quickDur);
    setQuickStat(draftAnalysis.primaryStat);
    if (draftAnalysis.skillId) setQuickSkillId(draftAnalysis.skillId);
    if (draftAnalysis.scheduledSlot) setQuickSlot(draftAnalysis.scheduledSlot);
    setQuickSyncCalendar(true);
    setShowAdvancedComposer(true);
    setDraftAnalysis(null);
  };

  const openEditQuest = (q: Quest) => {
    const pStat = (Object.keys(q.statRewards || {})[0] as AttributeKey) || 'INT';
    setEditingQuestId(q.id);
    setEditTitle(q.title);
    setEditDesc(q.description || '');
    setEditType(q.type);
    setEditRank(q.rank);
    setEditDur(q.durationMinutes || 25);
    setEditStat(pStat);
    setEditSlot(q.scheduledSlot || 'Flexible');
    setEditSyncCalendar(
      Boolean(q.linkedBlockId) || /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/.test(q.scheduledSlot || '')
    );
    setEditGoalId(q.goalId || '');
    setEditSkillId(q.skillId || '');
    setEditIfThen(q.ifThenTrigger || '');
    setEditRequireProof(Boolean(q.requiresProof));
    setEditSubtasks(q.subtasks ? [...q.subtasks] : []);
    setEditNewSubtask('');
  };

  const handleSaveEditQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestId || !editTitle.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await onUpdateQuest(editingQuestId, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        type: editType,
        rank: editRank,
        durationMinutes: Math.max(5, Math.min(240, Number(editDur) || 25)),
        primaryStat: editStat,
        scheduledSlot: editSlot.trim() || 'Flexible',
        syncToTimetable: editSyncCalendar,
        goalId: editGoalId || undefined,
        skillId: editSkillId || undefined,
        ifThenTrigger: editIfThen.trim() || undefined,
        requiresProof: editRequireProof,
        subtasks: editSubtasks,
      });
      setEditingQuestId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const openCreateHabitForm = () => {
    setEditingHabitId(null);
    setHabTitle('');
    setHabTime('morning');
    setHabFreq('daily');
    setHabDays([1, 3, 5]);
    setHabTargetWeek(3);
    setHabDuration(20);
    setHabStandard('');
    setHabMinimum('');
    setHabStat('AGI');
    setHabGoalId('');
    setHabSkillId('');
    setShowHabitForm(true);
  };

  const openEditHabitForm = (h: CoreHabit) => {
    setEditingHabitId(h.id);
    setHabTitle(h.title);
    setHabTime(h.timeOfDay);
    setHabFreq(h.frequency);
    setHabDays(h.customDays && h.customDays.length > 0 ? h.customDays : [1, 3, 5]);
    setHabTargetWeek(h.targetPerWeek || 3);
    setHabDuration(h.durationMinutes || 20);
    setHabStandard(h.standardSpec || '');
    setHabMinimum(h.minimumSpec || '');
    setHabStat(h.primaryStat || 'AGI');
    setHabGoalId(h.goalId || '');
    setHabSkillId(h.skillId || '');
    setShowHabitForm(true);
  };

  const handleSaveHabitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habTitle.trim() || savingHabit) return;
    setSavingHabit(true);
    try {
      const payload = {
        title: habTitle.trim(),
        timeOfDay: habTime,
        frequency: habFreq,
        customDays: habFreq === 'custom_days' ? habDays : undefined,
        targetPerWeek: habFreq === 'times_per_week' ? habTargetWeek : undefined,
        durationMinutes: Math.max(2, Math.min(180, Number(habDuration) || 20)),
        standardSpec: habStandard.trim() || `${habDuration} phút thực hiện chuẩn`,
        minimumSpec: habMinimum.trim() || '2 phút khởi động tối thiểu',
        primaryStat: habStat,
        goalId: habGoalId || undefined,
        skillId: habSkillId || undefined,
      };
      if (editingHabitId && onUpdateHabit) {
        await onUpdateHabit(editingHabitId, payload);
      } else {
        await onCreateHabit(payload);
      }
      setEditingHabitId(null);
      setShowHabitForm(false);
    } finally {
      setSavingHabit(false);
    }
  };

  const prefillSlotInComposer = (slotStr: string, maxDurMins?: number) => {
    soundEngine.click();
    setQuickSlot(slotStr);
    setQuickSyncCalendar(true);
    if (maxDurMins && maxDurMins >= 15) {
      setQuickDur(Math.min(60, maxDurMins));
    }
    setShowAdvancedComposer(true);
    setTimeout(() => {
      composerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      composerInputRef.current?.focus();
    }, 50);
  };

  // Hero Next Action Target
  const nextAction = localIntelligence?.nextBestAction;
  const heroHabit =
    nextAction?.kind === 'habit_now' && nextAction.targetId
      ? habits.find((h) => h.id === nextAction.targetId) || null
      : null;
  const heroQuest =
    nextAction?.kind === 'top_quest' && nextAction.targetId
      ? pendingQuests.find((q) => q.id === nextAction.targetId) || pendingQuests[0] || null
      : pendingQuests[0] || null;

  const activeElapsedSec = activeSession ? getQuestElapsedSeconds(activeSession, nowMs) : 0;
  const activeTargetSec = activeSession
    ? Math.max(60, (activeSession.durationMinutes || 25) * 60)
    : 1500;
  const activeProgressPct = Math.min(100, Math.round((activeElapsedSec / activeTargetSec) * 100));

  const insight = localIntelligence?.topInsightBanner;
  const insightBorderCls =
    insight?.tone === 'red'
      ? 'border-[var(--px-red)] text-[var(--px-red-text)]'
      : insight?.tone === 'green'
        ? 'border-[var(--px-green)] text-[var(--px-green-text)]'
        : insight?.tone === 'blue'
          ? 'border-[var(--px-blue)] text-[var(--px-blue-text)]'
          : 'border-[var(--px-gold)] text-[var(--px-gold-text)]';

  // Build unified chronological Today Timeline (Fixed Timetable Blocks + Scheduled Quests)
  const todayTimelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      startTime: string;
      endTime: string;
      startMins: number;
      title: string;
      kind: 'block' | 'quest';
      subLabel: string;
      status?: string;
      quest?: Quest;
    }> = [];

    for (const blk of todayAnalysis.blocks || []) {
      const [h, m] = blk.startTime.split(':').map(Number);
      items.push({
        id: `blk-${blk.id}`,
        startTime: blk.startTime,
        endTime: blk.endTime,
        startMins: (h || 0) * 60 + (m || 0),
        title: blk.title,
        kind: 'block',
        subLabel:
          blk.type === 'sleep'
            ? 'Giờ ngủ'
            : blk.type === 'class_work'
              ? 'Lịch cố định'
              : blk.type === 'commute_meal'
                ? 'Ăn / Di chuyển'
                : blk.type === 'rest_buffer'
                  ? 'Nghỉ ngơi'
                  : 'Khối lịch',
      });
    }

    for (const q of todayQuests) {
      if (q.status === 'rejected') continue;
      // Avoid duplicating if already represented by its linkedBlockId in blocks
      const match = (q.scheduledSlot || '').match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      if (!match) continue;
      if (q.linkedBlockId && todayAnalysis.blocks.some((b) => b.id === q.linkedBlockId)) {
        // Enrich the existing block entry into a quest item so user can control it directly
        const existingIdx = items.findIndex((it) => it.id === `blk-${q.linkedBlockId}`);
        if (existingIdx >= 0) {
          items[existingIdx] = {
            ...items[existingIdx],
            kind: 'quest',
            title: q.title,
            subLabel: `${TYPE_META[q.type]?.label || 'Quest'} · +${q.xpReward} XP`,
            status: q.status,
            quest: q,
          };
          continue;
        }
      }
      const [h, m] = match[1].split(':').map(Number);
      items.push({
        id: `q-${q.id}`,
        startTime: match[1],
        endTime: match[2],
        startMins: (h || 0) * 60 + (m || 0),
        title: q.title,
        kind: 'quest',
        subLabel: `${TYPE_META[q.type]?.label || 'Quest'} · +${q.xpReward} XP`,
        status: q.status,
        quest: q,
      });
    }

    return items.sort((a, b) => a.startMins - b.startMins);
  }, [todayAnalysis.blocks, todayQuests]);

  return (
    <div className="mx-auto max-w-[1480px] space-y-5 p-4 sm:p-6">
      {/* 1. UNIFIED COMMAND COCKPIT HEADER */}
      <header className="px-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-extrabold text-main">
                Điều Phối &amp; Quản Lý Hôm Nay
              </h1>
              <span className="font-mono text-xs font-bold text-[var(--px-gold-text)]">
                {todayAnalysis.dayLabel}
              </span>
              <span className={`px-pill font-mono text-[10px] ${modeInfo.cls}`}>
                {modeInfo.label}
              </span>
              {player.plannedRestMode && (
                <span className="px-pill border-[var(--px-green)] font-mono text-[10px] font-bold text-[var(--px-green-text)]">
                  Grace Day · Nghỉ Chủ Động
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] text-sub">
              <span>
                Giờ trống{' '}
                <strong className="text-[var(--px-green-text)]">
                  {(todayAnalysis.totalFreeMinutes / 60).toFixed(1)}h
                </strong>
              </span>
              <span className="text-dim">·</span>
              <span>
                Nhiệm vụ{' '}
                <strong className="text-main">
                  {completedQuests.length}/{completedQuests.length + pendingQuests.length}
                </strong>{' '}
                xong (còn {pendingQuests.length})
              </span>
              <span className="text-dim">·</span>
              <span>
                Thói quen{' '}
                <strong className="text-[var(--px-gold-text)]">
                  {completedHabitsCount}/{dueHabits.length}
                </strong>
              </span>
              <span className="text-dim">·</span>
              <span>
                Focus PC{' '}
                <strong className="text-[var(--px-green-text)]">{focusTotalMins}p</strong>/
                {focusGoalMins}p ({focusGoalPct}%)
              </span>
            </div>
          </div>

          {/* Primary Top Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Energy Picker */}
            <div ref={energyRef} className="relative">
              <button
                type="button"
                onClick={() => setEnergyMenuOpen((v) => !v)}
                className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                title="Cập nhật thể trạng hôm nay (Không trừ HP)"
              >
                <PxBolt size={13} color={energyMeta.color} />
                <span className="font-mono font-bold" style={{ color: energyMeta.color }}>
                  {player.energyLevel}% ({energyMeta.label})
                </span>
              </button>
              {energyMenuOpen && (
                <div className="rpg-window absolute right-0 top-full z-30 mt-1.5 w-48 p-1.5">
                  {ENERGY_STEPS.map((st) => (
                    <button
                      key={st.val}
                      type="button"
                      onClick={async () => {
                        setEnergyMenuOpen(false);
                        await onCheckinEnergy(st.val);
                      }}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-xs hover:bg-[var(--bg-surface-2)] ${
                        Math.abs(player.energyLevel - st.val) <= 10
                          ? 'bg-[var(--bg-surface-2)] font-bold'
                          : ''
                      }`}
                    >
                      <span className="text-main">{st.label}</span>
                      <span className="font-mono font-bold" style={{ color: st.color }}>
                        {st.val}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Minimum Viable Day (MVD) Toggle */}
            <button
              type="button"
              disabled={togglingMvd}
              onClick={async () => {
                setTogglingMvd(true);
                try {
                  await onToggleMvd(!mvdActive);
                } finally {
                  setTogglingMvd(false);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${
                mvdActive ? 'btn-primary' : 'btn-secondary'
              }`}
              title="Ngày Tối Thiểu (MVD): ưu tiên bản 2–5 phút của mỗi thói quen để giữ chuỗi vào ngày bận/mệt"
            >
              <PxShield size={13} />
              <span>{mvdActive ? 'MVD: Bật' : 'Ngày Tối Thiểu'}</span>
            </button>

            {/* Planned Rest / Grace Day Toggle */}
            {onTogglePlannedRest && (
              <button
                type="button"
                disabled={togglingRest}
                onClick={async () => {
                  setTogglingRest(true);
                  try {
                    await onTogglePlannedRest(!player.plannedRestMode);
                  } finally {
                    setTogglingRest(false);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${
                  player.plannedRestMode ? 'btn-emerald' : 'btn-secondary'
                }`}
                title="Nghỉ Chủ Động (Grace Day): bảo toàn chuỗi, hồi HP và không trừ HP khi chốt ngày"
              >
                <PxCoffee size={13} />
                <span>{player.plannedRestMode ? 'Đang Nghỉ Chủ Động' : 'Nghỉ Chủ Động'}</span>
              </button>
            )}

            {/* AI Plan Today + Optional Directive Note */}
            <div className="flex items-center">
              <button
                type="button"
                disabled={orchestrating}
                onClick={async () => {
                  setOrchestrating(true);
                  try {
                    await onOrchestrate(orchestrateNote.trim());
                  } finally {
                    setOrchestrating(false);
                  }
                }}
                className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                title="AI tự động xếp nhiệm vụ vừa khung giờ rảnh hôm nay"
              >
                {orchestrating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PxRefresh size={13} />
                )}
                <span>AI Xếp Việc</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOrchestrateNote((v) => !v)}
                className={`btn-secondary -ml-[2px] px-1.5 py-1.5 text-xs ${
                  showOrchestrateNote || orchestrateNote ? 'text-[var(--px-gold-text)]' : 'text-dim'
                }`}
                title="Ghi chú ưu tiên trước khi AI xếp việc"
              >
                <PxGear size={13} />
              </button>
            </div>

            {/* Evening Closeout */}
            <button
              type="button"
              onClick={() => void onOpenCloseout()}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs ${
                eveningCloseoutBadge && !alreadyClosedToday ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {alreadyClosedToday ? (
                <PxCheck size={13} color="var(--px-green-text)" />
              ) : (
                <PxCalendar size={13} />
              )}
              <span>{alreadyClosedToday ? 'Đã Chốt Ngày' : 'Chốt Ngày'}</span>
            </button>
          </div>
        </div>

        {showOrchestrateNote && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setOrchestrating(true);
              try {
                await onOrchestrate(orchestrateNote.trim());
                setShowOrchestrateNote(false);
              } finally {
                setOrchestrating(false);
              }
            }}
            className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-3"
          >
            <input
              value={orchestrateNote}
              onChange={(e) => setOrchestrateNote(e.target.value)}
              placeholder="Chỉ thị cho AI hôm nay (VD: Sáng tập trung làm đồ án, chiều ôn IELTS, tối chạy bộ 30p)..."
              className="min-w-[240px] flex-1 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={orchestrating}
              className="btn-primary px-3.5 py-1.5 text-xs"
            >
              {orchestrating ? 'Đang lập...' : 'Áp dụng & Xếp việc'}
            </button>
          </form>
        )}
      </header>

      {/* 2. CONTEXTUAL LOCAL INTELLIGENCE + LIVE WEEKLY RAID STRIP */}
      {(insight || weeklyRaid?.raid) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {insight && (
            <div
              className={`flex flex-wrap items-center justify-between gap-2 border-l-4 bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs ${insightBorderCls} ${
                weeklyRaid?.raid ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="font-bold">{insight.headline}</span>
                <span className="mx-1.5 text-dim">·</span>
                <span className="text-sub">{insight.detail}</span>
              </div>
              {localIntelligence?.todayLoad.isOverloaded && !mvdActive && (
                <button
                  type="button"
                  onClick={() => void onToggleMvd(true)}
                  className="btn-secondary shrink-0 px-2.5 py-1 text-[11px]"
                >
                  Bật Ngày Tối Thiểu
                </button>
              )}
            </div>
          )}

          {weeklyRaid?.raid &&
            (() => {
              const raid = weeklyRaid.raid;
              const isDefeated = raid.status === 'defeated' || raid.currentHp <= 0;
              const hpPct =
                raid.maxHp > 0
                  ? Math.max(0, Math.min(100, Math.round((raid.currentHp / raid.maxHp) * 100)))
                  : 0;
              const unclaimedCount = raid.chests.filter((c) => c.unlocked && !c.claimed).length;
              return (
                <div
                  className={`px-card flex items-center justify-between gap-2.5 px-3.5 py-2 ${
                    insight ? 'lg:col-span-5' : 'lg:col-span-12'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenRaidArena?.()}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-90"
                    title="Mở Đấu Trường Raid Boss Tuần"
                  >
                    <span className="px-inset flex h-7 w-7 shrink-0 items-center justify-center bg-[#12101a]">
                      <RaidBossSprite
                        archetype={raid.archetype}
                        size={24}
                        enraged={!isDefeated && hpPct < 30}
                        defeated={isDefeated}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-pixel text-[8.5px] font-bold text-[var(--px-red-text)]">
                          RAID {raid.difficultyTier}
                        </span>
                        <span className="truncate font-display text-xs font-extrabold text-main">
                          {raid.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="rpg-bar-track h-2 flex-1">
                          <div
                            className="h-full"
                            style={{
                              width: `${hpPct}%`,
                              backgroundColor: isDefeated ? 'var(--px-green)' : 'var(--px-red)',
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] font-bold text-sub">
                          {isDefeated ? `OVERKILL +${raid.overkillDamage}` : `${hpPct}% HP`}
                        </span>
                      </div>
                    </div>
                  </button>
                  {unclaimedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenRaidArena?.()}
                      className="btn-primary inline-flex shrink-0 items-center gap-1 px-2 py-1 font-mono text-[10px]"
                    >
                      <PxTreasureChest state="ready" size={12} />
                      <span>{unclaimedCount} Rương</span>
                    </button>
                  )}
                </div>
              );
            })()}
        </div>
      )}

      {/* 3. HERO FOCUS CARD — "NGAY BÂY GIỜ / VIỆC QUAN TRỌNG NHẤT" */}
      <section className="px-card-hero p-4 sm:p-5">
        {activeSession ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-pixel bg-[var(--px-gold)] px-1.5 py-0.5 text-[9px] font-bold text-[#140e04]">
                    {activeSession.isPaused ? 'TẠM DỪNG' : 'ĐANG TẬP TRUNG'}
                  </span>
                  <span className="px-pill font-mono text-[10px]">
                    {TYPE_META[activeSession.type]?.label || 'Daily'} · Rank {activeSession.rank}
                  </span>
                  {(activeSession.verifiedFocusSeconds ?? 0) >= 60 && (
                    <span className="px-pill font-mono text-[10px] text-[var(--px-green-text)]">
                      Tập trung {activeSession.focusIntegrityPct ?? 100}%
                    </span>
                  )}
                </div>
                <h2 className="mt-2 font-display text-lg font-extrabold text-main">
                  {activeSession.title}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-sub">
                  Khung {activeSession.scheduledSlot} · Mục tiêu {activeSession.durationMinutes}p
                  {activeSession.actualStartTime
                    ? ` · Bắt đầu lúc ${activeSession.actualStartTime}`
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-inset px-3 py-1.5 font-mono text-lg font-extrabold tabular-nums text-[var(--px-gold-text)]">
                  {formatHms(activeElapsedSec)}
                </span>
                {activeSession.isPaused ? (
                  <button
                    type="button"
                    onClick={() => void onStartQuest(activeSession.id)}
                    className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                  >
                    <PxPlay size={13} />
                    <span>Tiếp tục</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onPauseQuest(activeSession.id)}
                    className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                  >
                    <PxPause size={13} />
                    <span>Tạm dừng</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEnterDungeon(activeSession)}
                  className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                  title="Vào Đấu Trường Focus (+25% XP)"
                >
                  <PxSword size={13} />
                  <span>Đấu trường Focus</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeSession.requiresProof) {
                      setProofQuestId(activeSession.id);
                      setProofText('');
                    } else {
                      void onCompleteQuest(activeSession.id);
                    }
                  }}
                  className="btn-emerald inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
                >
                  <PxCheck size={14} />
                  <span>Hoàn thành</span>
                </button>
              </div>
            </div>

            <div className="rpg-bar-track h-2.5 w-full">
              <div
                className="h-full transition-all"
                style={{
                  width: `${activeProgressPct}%`,
                  backgroundColor:
                    activeProgressPct >= 100 ? 'var(--px-green)' : 'var(--px-gold)',
                }}
              />
            </div>

            {proofQuestId === activeSession.id && (
              <div className="flex flex-wrap gap-2 pt-1">
                <input
                  value={proofText}
                  onChange={(e) => setProofText(e.target.value)}
                  placeholder="Ghi ngắn kết quả (tự lưu vào Sổ Bằng Chứng & Tri Thức)..."
                  className="min-w-[220px] flex-1 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await onCompleteQuest(activeSession.id, proofText);
                    setProofQuestId(null);
                    setProofText('');
                  }}
                  className="btn-primary px-3.5 py-1.5 text-xs"
                >
                  Xác nhận hoàn thành
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <span className="font-pixel text-[9px] font-bold uppercase tracking-wider text-[var(--px-gold-text)]">
                BƯỚC TIẾP THEO QUAN TRỌNG NHẤT
              </span>
              <h2 className="mt-1 font-display text-lg font-extrabold text-main">
                {nextAction?.title || 'Bắt đầu 1 phiên tập trung 25 phút'}
              </h2>
              <p className="mt-0.5 text-xs text-sub">
                {nextAction?.subtitle}
                {nextAction?.reason ? ` — ${nextAction.reason}` : ''}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {heroHabit ? (
                <button
                  type="button"
                  onClick={() =>
                    void onCheckinHabit(heroHabit.id, mvdActive ? 'minimum' : 'full')
                  }
                  className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                >
                  <PxCheck size={14} />
                  <span>{mvdActive ? 'Check bản tối thiểu' : 'Check-in ngay'}</span>
                </button>
              ) : heroQuest ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onStartQuest(heroQuest.id)}
                    className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                  >
                    <PxPlay size={13} />
                    <span>Bắt đầu ngay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterDungeon(heroQuest)}
                    className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                  >
                    <PxSword size={13} />
                    <span>Vào Focus</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void onQuickStartFocus(25)}
                  className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                >
                  <PxSword size={14} />
                  <span>Focus ngay 25p</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Inline Unlogged PC Focus Credit */}
        {assistantOverview &&
          assistantOverview.activity.uncreditedFocusMinutes >= 15 &&
          assistantOverview.activity.suggestedFocusSession && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs">
              <span className="text-sub">
                PC Tracker ghi nhận{' '}
                <strong className="font-mono text-[var(--px-green-text)]">
                  {assistantOverview.activity.uncreditedFocusMinutes}p
                </strong>{' '}
                tập trung ({assistantOverview.activity.suggestedFocusSession.topApp}) chưa cộng điểm.
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={convertingFocus}
                  onClick={async () => {
                    const sf = assistantOverview.activity.suggestedFocusSession;
                    if (!sf) return;
                    setConvertingFocus(true);
                    try {
                      await onConvertFocusToQuest({
                        mode: 'complete_new',
                        title: sf.suggestedTitle,
                        primaryStat: sf.primaryStat,
                      });
                    } finally {
                      setConvertingFocus(false);
                    }
                  }}
                  className="btn-emerald inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                >
                  {convertingFocus ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PxCheck size={12} />
                  )}
                  <span>Ghi nhận thành Quest hoàn thành</span>
                </button>
              </div>
            </div>
          )}
      </section>

      {/* 4. RESPONSIVE 12-COLUMN MAXIMIZED DESKTOP WORKSPACE */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* ==================== LEFT COLUMN (7 COLS): UNIFIED QUEST CREATION & MANAGEMENT ==================== */}
        <div className="space-y-5 xl:col-span-7">
          <section ref={composerSectionRef} className="px-card">
            {/* Section Title Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-3">
              <div className="flex items-center gap-2">
                <PxSword size={15} color="var(--px-gold-text)" />
                <h2 className="font-display text-sm font-extrabold text-main">
                  Thêm &amp; Quản Lý Nhiệm Vụ Hôm Nay
                </h2>
                <span className="px-pill font-mono text-[10px]">
                  {pendingQuests.length} cần làm · {completedQuests.length} xong
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowProtocolsDrawer((v) => !v)}
                  className={`btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] ${
                    showProtocolsDrawer ? 'border-[var(--px-plum)] text-[var(--px-plum-text)]' : ''
                  }`}
                >
                  <PxBook size={12} color="var(--px-plum-text)" />
                  <span>Mẫu khoa học</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedComposer((v) => !v)}
                  className={`btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] ${
                    showAdvancedComposer ? 'border-[var(--px-gold)] text-[var(--px-gold-text)]' : ''
                  }`}
                >
                  <PxGear size={12} />
                  <span>{showAdvancedComposer ? 'Thu gọn tùy chỉnh' : 'Tùy chỉnh chi tiết'}</span>
                </button>
              </div>
            </div>

            {/* Unified Quest Composer Form */}
            <form
              onSubmit={handleQuickAdd}
              className="border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3.5 sm:px-4"
            >
              {/* Row 1: Fast 1-Line Quick Add */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={composerInputRef}
                  value={quickTitle}
                  onChange={(e) => {
                    setQuickTitle(e.target.value);
                    if (draftAnalysis) setDraftAnalysis(null);
                  }}
                  placeholder="Nhập nhiệm vụ cần làm hôm nay... (Enter để thêm ngay)"
                  className="min-w-[210px] flex-1 px-3 py-2 text-xs sm:text-sm"
                />

                {/* Duration Presets */}
                <div className="px-inset flex items-center p-0.5">
                  {[15, 25, 45, 60, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setQuickDur(d)}
                      className={`px-2 py-1 font-mono text-[11px] font-bold ${
                        quickDur === d
                          ? 'bg-[var(--px-gold)] text-[#140e04]'
                          : 'text-sub hover:text-main'
                      }`}
                    >
                      {d}p
                    </button>
                  ))}
                </div>

                {/* Quick Type Selector */}
                <select
                  value={quickType}
                  onChange={(e) => setQuickType(e.target.value as QuestType)}
                  className="px-2 py-1.5 text-xs font-bold"
                  title="Loại nhiệm vụ"
                >
                  <option value="daily">Daily (Hàng ngày)</option>
                  <option value="main">Main ★ (Trọng tâm)</option>
                  <option value="side">Side (Phụ)</option>
                  <option value="recovery">Hồi phục (0 phạt HP)</option>
                  <option value="emergency">Khẩn cấp</option>
                </select>

                {/* Sync to Timetable 1-Click Toggle */}
                <button
                  type="button"
                  onClick={() => setQuickSyncCalendar((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 font-mono text-[11px] font-bold ${
                    quickSyncCalendar ? 'btn-primary' : 'btn-secondary'
                  }`}
                  title="Tự động gắn nhiệm vụ này lên Thời Khóa Biểu hôm nay"
                >
                  <PxCalendar size={12} />
                  <span>{quickSyncCalendar ? 'Gắn lịch: Bật' : 'Gắn lịch'}</span>
                </button>

                <button
                  type="submit"
                  disabled={quickAdding || !quickTitle.trim()}
                  className="btn-primary inline-flex items-center gap-1 px-3.5 py-2 text-xs"
                >
                  {quickAdding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PxPlus size={13} />
                  )}
                  <span>Thêm</span>
                </button>

                <button
                  type="button"
                  disabled={analyzingDraft || !quickTitle.trim()}
                  onClick={() => void handleAnalyzeDraft()}
                  className="btn-arcane inline-flex items-center gap-1 px-2.5 py-2 text-xs"
                  title="AI tự phân tích chỉ số, kỹ năng, độ khó và tìm khung giờ trống phù hợp nhất"
                >
                  {analyzingDraft ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PxSparkle size={13} />
                  )}
                  <span>AI Gợi Ý</span>
                </button>
              </div>

              {/* AI Draft Analysis Preview */}
              {draftAnalysis && (
                <div className="mt-3 flex flex-col gap-2 border-2 border-[var(--px-plum)] bg-[var(--bg-surface)] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      <span className="font-bold text-[var(--px-gold-text)]">
                        {TYPE_META[draftAnalysis.type]?.label || draftAnalysis.type} · Rank{' '}
                        {draftAnalysis.rank}
                      </span>
                      <span>·</span>
                      <span className="font-bold text-[var(--px-green-text)]">
                        +{draftAnalysis.primaryStat}
                        {draftAnalysis.secondaryStat ? ` / +${draftAnalysis.secondaryStat}` : ''}
                      </span>
                      {draftAnalysis.skillName && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--px-blue-text)]">
                            Skill: {draftAnalysis.skillName}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span className="text-main">Khung {draftAnalysis.scheduledSlot}</span>
                      <span>·</span>
                      <span className="text-[var(--px-gold-text)]">
                        +{draftAnalysis.xpReward} XP · +{draftAnalysis.spReward} SP
                      </span>
                    </div>
                    <p className="text-[11px] text-sub">
                      <strong className="text-main">{draftAnalysis.suggestedTitle}:</strong>{' '}
                      {draftAnalysis.statReason}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleLoadDraftIntoCustomizer}
                      className="btn-secondary px-2.5 py-1.5 text-[11px]"
                    >
                      Tùy chỉnh thêm
                    </button>
                    <button
                      type="button"
                      disabled={quickAdding}
                      onClick={() => void handleApplyDraft()}
                      className="btn-primary px-3 py-1.5 text-[11px]"
                    >
                      Áp dụng &amp; Gắn lịch
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Detailed Quest Customizer */}
              {showAdvancedComposer && (
                <div className="mt-3 space-y-3 border-t border-[var(--border-hairline)] pt-3 text-xs">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Primary Stat */}
                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-sub">
                        Chỉ số cộng thêm
                      </label>
                      <select
                        value={quickStat}
                        onChange={(e) => setQuickStat(e.target.value as AttributeKey | 'AUTO')}
                        className="w-full px-2.5 py-1.5 text-xs"
                      >
                        <option value="AUTO">Tự động nhận diện (Auto)</option>
                        {Object.entries(STAT_META).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Rank / Difficulty */}
                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-sub">
                        Cấp độ khó (Rank)
                      </label>
                      <select
                        value={quickRank}
                        onChange={(e) => setQuickRank(e.target.value as QuestRank | 'AUTO')}
                        className="w-full px-2.5 py-1.5 text-xs"
                      >
                        <option value="AUTO">Tự động theo thời lượng</option>
                        <option value="D">D-Rank (Nhẹ · 15-25p)</option>
                        <option value="C">C-Rank (Chuẩn · 30-45p)</option>
                        <option value="B">B-Rank (Sâu · 50-75p)</option>
                        <option value="A">A-Rank (Nặng · 80-120p)</option>
                        <option value="S">S-Rank (Đột phá · 120p+)</option>
                      </select>
                    </div>

                    {/* Custom Duration */}
                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-sub">
                        Thời lượng (phút)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={240}
                        value={quickDur}
                        onChange={(e) =>
                          setQuickDur(Math.max(5, Math.min(240, Number(e.target.value) || 25)))
                        }
                        className="w-full px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>

                    {/* Scheduled Slot */}
                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-sub">
                        Khung giờ thực hiện
                      </label>
                      <input
                        value={quickSlot}
                        onChange={(e) => setQuickSlot(e.target.value)}
                        placeholder="VD: 08:30 - 09:30 hoặc Flexible"
                        className="w-full px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Quick Free Window Chips for Scheduled Slot */}
                  {todayAnalysis.freeWindows.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-sub">
                        Chọn nhanh khung rảnh hôm nay:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickSlot('Flexible');
                          setQuickSyncCalendar(false);
                        }}
                        className={`border px-2 py-0.5 font-mono text-[10px] font-bold ${
                          quickSlot === 'Flexible'
                            ? 'border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sub'
                        }`}
                      >
                        Linh hoạt
                      </button>
                      {todayAnalysis.freeWindows.slice(0, 5).map((fw, idx) => {
                        const slotVal = `${fw.startTime} - ${fw.endTime}`;
                        const active = quickSlot === slotVal;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setQuickSlot(slotVal);
                              setQuickSyncCalendar(true);
                            }}
                            className={`border px-2 py-0.5 font-mono text-[10px] font-bold ${
                              active
                                ? 'border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--px-green-text)] hover:border-[var(--px-green)]'
                            }`}
                          >
                            {fw.startTime}–{fw.endTime} ({fw.durationMinutes}p)
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Goal Link & Skill Link */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-sub">
                        Liên kết Mục tiêu lớn (tự cộng tiến độ Mục tiêu)
                      </label>
                      <select
                        value={quickGoalId}
                        onChange={(e) => setQuickGoalId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs"
                      >
                        <option value="">-- Không gắn mục tiêu cụ thể --</option>
                        {goals.map((g) => (
                          <option key={g.id} value={g.id}>
                            🎯 {g.title} ({g.progress}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-mono text-[10px] uppercase text-sub">
                        Liên kết Kỹ năng (nhận Skill XP khi hoàn thành)
                      </label>
                      <select
                        value={quickSkillId}
                        onChange={(e) => setQuickSkillId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs"
                      >
                        <option value="">-- Tự động suy luận kỹ năng phù hợp --</option>
                        {skills.map((s) => (
                          <option key={s.id} value={s.id}>
                            ⚡ {s.name} ({s.primaryStat} · Lv.{s.masteryTier})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description & If-Then Plan */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <input
                      value={quickDesc}
                      onChange={(e) => setQuickDesc(e.target.value)}
                      placeholder="Mô tả mục tiêu đầu ra / ghi chú chi tiết..."
                      className="px-3 py-1.5 text-xs"
                    />
                    <input
                      value={quickIfThen}
                      onChange={(e) => setQuickIfThen(e.target.value)}
                      placeholder="Kế hoạch Nếu–Thì (VD: Nếu 20:00 ngồi vào bàn → Mở ngay tài liệu chương 3)..."
                      className="px-3 py-1.5 text-xs"
                    />
                  </div>

                  {/* Subtask Builder */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={newSubtaskDraft}
                        onChange={(e) => setNewSubtaskDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newSubtaskDraft.trim()) {
                              setQuickSubtasks((prev) => [...prev, newSubtaskDraft.trim()]);
                              setNewSubtaskDraft('');
                            }
                          }
                        }}
                        placeholder="Thêm bước nhỏ (Subtask / Checklist)... bấm Enter hoặc + Thêm bước"
                        className="flex-1 px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newSubtaskDraft.trim()) {
                            setQuickSubtasks((prev) => [...prev, newSubtaskDraft.trim()]);
                            setNewSubtaskDraft('');
                          }
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        + Thêm bước
                      </button>
                    </div>
                    {quickSubtasks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {quickSubtasks.map((st, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                          >
                            <span className="font-mono text-[10px] text-[var(--px-gold-text)]">
                              #{idx + 1}
                            </span>
                            <span>{st}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setQuickSubtasks((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-dim hover:text-[var(--px-red-text)]"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Checkboxes */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-sub">
                        <input
                          type="checkbox"
                          checked={quickSyncCalendar}
                          onChange={(e) => setQuickSyncCalendar(e.target.checked)}
                        />
                        <span>Đồng bộ thẳng lên Thời Khóa Biểu hôm nay</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-sub">
                        <input
                          type="checkbox"
                          checked={quickRequireProof}
                          onChange={(e) => setQuickRequireProof(e.target.checked)}
                        />
                        <span>Yêu cầu ghi chú bằng chứng (Proof-of-Work) khi hoàn thành</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={resetComposer}
                      className="text-[11px] text-dim hover:text-main"
                    >
                      Xóa nháp
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Collapsible Scientific Protocols Drawer */}
            {showProtocolsDrawer && (
              <div className="border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="font-pixel text-[9.5px] font-bold text-[var(--px-plum-text)]">
                    THƯ VIỆN GIAO THỨC KHOA HỌC (1-CLICK ADD)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProtocolsDrawer(false)}
                    className="text-xs text-dim hover:text-main"
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SCIENTIFIC_PROTOCOLS.map((proto) => {
                    const busy = creatingProtocolId === proto.id;
                    return (
                      <div
                        key={proto.id}
                        className="px-card flex flex-col justify-between p-3 text-xs"
                      >
                        <div>
                          <div className="font-mono text-[10px] font-bold text-[var(--px-plum-text)]">
                            {proto.researcherTag}
                          </div>
                          <h4 className="mt-0.5 font-display text-xs font-bold text-main">
                            {proto.title}
                          </h4>
                          <p className="mt-1 text-[11px] leading-relaxed text-sub">
                            {proto.description}
                          </p>
                        </div>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setCreatingProtocolId(proto.id);
                              try {
                                await onCreateCustomQuest({
                                  title: proto.title,
                                  description: proto.description,
                                  type: proto.type,
                                  rank: proto.rank,
                                  durationMinutes: proto.durationMinutes,
                                  scheduledSlot: 'Flexible',
                                  learningMethod: proto.learningMethod,
                                  primaryStat: proto.primaryStat,
                                  scientificProtocol: proto.learningMethod,
                                  requiresProof: false,
                                });
                              } finally {
                                setCreatingProtocolId(null);
                              }
                            }}
                            className="btn-primary flex flex-1 items-center justify-center gap-1 py-1 text-[11px]"
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PxPlus size={11} />
                            )}
                            <span>Thêm ngay</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickTitle(proto.title);
                              setQuickDesc(proto.description);
                              setQuickDur(proto.durationMinutes);
                              setQuickType(proto.type);
                              setQuickRank(proto.rank);
                              setQuickStat(proto.primaryStat);
                              setShowAdvancedComposer(true);
                              setShowProtocolsDrawer(false);
                            }}
                            className="btn-secondary px-2.5 py-1 text-[11px]"
                          >
                            Tùy chỉnh
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter, Search & Sort Control Bar */}
            <div className="flex flex-col gap-2.5 border-b border-[var(--border-hairline)] px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Status Tabs */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuestTab('pending')}
                    className={`px-2.5 py-1 text-xs font-bold ${
                      questTab === 'pending'
                        ? 'border border-[var(--border-hairline)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]'
                        : 'text-dim hover:text-main'
                    }`}
                  >
                    Cần làm ({pendingQuests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestTab('completed')}
                    className={`px-2.5 py-1 text-xs font-bold ${
                      questTab === 'completed'
                        ? 'border border-[var(--border-hairline)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]'
                        : 'text-dim hover:text-main'
                    }`}
                  >
                    Đã xong ({completedQuests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestTab('all')}
                    className={`px-2.5 py-1 text-xs font-bold ${
                      questTab === 'all'
                        ? 'border border-[var(--border-hairline)] bg-[var(--bg-surface-2)] text-main'
                        : 'text-dim hover:text-main'
                    }`}
                  >
                    Tất cả ({todayQuests.length})
                  </button>
                </div>

                {/* Search + Sort */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="relative">
                    <PxSearch
                      size={11}
                      className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-dim"
                    />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Lọc nhiệm vụ..."
                      className="w-36 py-1 pl-6 pr-2 text-[11px] sm:w-44"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'priority' | 'slot' | 'duration' | 'xp')
                    }
                    className="px-2 py-1 text-[11px]"
                    title="Sắp xếp danh sách"
                  >
                    <option value="priority">Xếp: Ưu tiên</option>
                    <option value="slot">Xếp: Giờ lịch</option>
                    <option value="duration">Xếp: Thời lượng</option>
                    <option value="xp">Xếp: Điểm XP</option>
                  </select>
                </div>
              </div>

              {/* Type Filter Chips + Goal Filter */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { key: 'all' as const, label: 'Mọi loại' },
                      { key: 'main' as const, label: 'Main ★' },
                      { key: 'daily' as const, label: 'Daily' },
                      { key: 'side' as const, label: 'Side' },
                      { key: 'recovery' as const, label: 'Hồi phục' },
                      { key: 'emergency' as const, label: 'Khẩn cấp' },
                    ]
                  ).map((tf) => (
                    <button
                      key={tf.key}
                      type="button"
                      onClick={() => setTypeFilter(tf.key)}
                      className={`px-2 py-0.5 font-mono text-[10.5px] font-semibold ${
                        typeFilter === tf.key
                          ? 'bg-[var(--px-gold)] text-[#140e04]'
                          : 'bg-[var(--bg-subtle)] text-sub hover:text-main'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {goals.length > 0 && (
                  <select
                    value={goalFilter}
                    onChange={(e) => setGoalFilter(e.target.value)}
                    className="max-w-[200px] px-2 py-0.5 text-[11px]"
                  >
                    <option value="all">🎯 Tất cả mục tiêu</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        🎯 {g.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Quest Rows List */}
            {filteredQuests.length === 0 ? (
              <div className="p-8 text-center text-xs text-sub">
                {questTab === 'pending' ? (
                  <>
                    Chưa có nhiệm vụ nào khớp bộ lọc. Hãy thêm việc mới ở thanh phía trên hoặc bấm{' '}
                    <strong className="text-main">AI Xếp Việc</strong>.
                  </>
                ) : (
                  <>Chưa có nhiệm vụ nào trong danh mục này.</>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {filteredQuests.map((q) => {
                  const isExpanded = expandedQuestId === q.id;
                  const isEditing = editingQuestId === q.id;
                  const showProof = proofQuestId === q.id;
                  const isCompleted = q.status === 'completed';
                  const isSkippedOrRejected = q.status === 'skipped' || q.status === 'rejected';
                  const isRunning = Boolean(q.status === 'pending' && q.startedAt && !q.isPaused);
                  const isPaused = Boolean(q.status === 'pending' && q.isPaused);
                  const elapsedSec = getQuestElapsedSeconds(q, nowMs);
                  const linkedGoal = q.goalId ? goalMap.get(q.goalId) : undefined;
                  const linkedSkill = q.skillId ? skillMap.get(q.skillId) : undefined;
                  const typeInfo = TYPE_META[q.type] || TYPE_META.daily;
                  const primaryStatKey =
                    (Object.keys(q.statRewards || {})[0] as AttributeKey) || 'INT';
                  const spReward = q.type === 'main' || q.type === 'hidden' ? 2 : 1;

                  return (
                    <div
                      key={q.id}
                      className={`px-4 py-3 transition hover:bg-[var(--bg-surface-2)] ${
                        isRunning ? 'bg-[var(--bg-surface-2)]' : ''
                      }`}
                    >
                      {/* Row Top Bar */}
                      <div className="flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          {/* 1-Click Complete / Reopen Checkbox Button */}
                          {!isCompleted && !isSkippedOrRejected ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (q.requiresProof) {
                                  setProofQuestId(showProof ? null : q.id);
                                  setProofText('');
                                } else {
                                  void onCompleteQuest(q.id);
                                }
                              }}
                              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-[var(--border-ink)] bg-[var(--bg-subtle)] text-transparent hover:border-[var(--px-green)] hover:text-[var(--px-green-text)]"
                              title={
                                q.requiresProof
                                  ? 'Ghi nhận kết quả & Hoàn thành'
                                  : 'Hoàn thành ngay (1-Click)'
                              }
                            >
                              <PxCheck size={12} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onReopenQuest) {
                                  void onReopenQuest(q.id);
                                } else {
                                  void onUpdateQuest(q.id, { status: 'pending' });
                                }
                              }}
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-[var(--border-ink)] ${
                                isCompleted
                                  ? 'bg-[var(--px-green)] text-white'
                                  : 'bg-[var(--bg-muted)] text-dim'
                              }`}
                              title="Bấm để hoàn tác (Đưa về danh sách Cần làm)"
                            >
                              <PxCheck size={12} />
                            </button>
                          )}

                          {/* 2-Min Micro-Start Button (for pending quests) */}
                          {!isCompleted && !isSkippedOrRejected && (
                            <button
                              type="button"
                              disabled={Boolean(q.microStartDone)}
                              onClick={() => void onMicroStartQuest(q.id)}
                              className={`mt-0.5 inline-flex shrink-0 items-center gap-0.5 border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                q.microStartDone
                                  ? 'border-[var(--px-gold)] bg-[var(--bg-subtle)] text-[var(--px-gold-text)] opacity-80'
                                  : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-sub hover:border-[var(--px-gold)] hover:text-[var(--px-gold-text)]'
                              }`}
                              title={
                                q.microStartDone
                                  ? 'Đã khởi động 2 phút (+10 XP)'
                                  : 'Khởi động 2 phút (+10 XP & +10G ngay)'
                              }
                            >
                              <PxBolt size={10} />
                              <span>2p</span>
                            </button>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`font-display text-sm font-bold ${
                                  isCompleted
                                    ? 'line-through text-sub'
                                    : isSkippedOrRejected
                                      ? 'line-through text-dim'
                                      : 'text-main'
                                }`}
                              >
                                {q.title}
                              </span>

                              <span
                                className={`border px-1.5 py-0 font-mono text-[10px] font-bold ${typeInfo.badgeCls}`}
                              >
                                {typeInfo.label} · {q.rank}
                              </span>

                              <span className="px-pill font-mono text-[10px] text-[var(--px-gold-text)]">
                                +{primaryStatKey}
                              </span>

                              {(isRunning || isPaused) && (
                                <span className="border border-[var(--px-gold)] bg-[var(--bg-subtle)] px-1.5 py-0 font-mono text-[10px] font-bold text-[var(--px-gold-text)]">
                                  {isRunning
                                    ? `● Đang chạy ${formatHms(elapsedSec)}`
                                    : `⏸ Tạm dừng ${formatHms(elapsedSec)}`}
                                </span>
                              )}
                            </div>

                            {/* Metadata Strip */}
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-sub">
                              <span className="inline-flex items-center gap-1">
                                <PxClock size={11} color="var(--px-gold-text)" />
                                {q.scheduledSlot} ({q.durationMinutes}p)
                              </span>

                              {q.linkedBlockId && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[var(--px-blue-text)]"
                                  title="Nhiệm vụ này đã được đồng bộ lên Thời Khóa Biểu"
                                >
                                  <PxCalendar size={11} />
                                  Đã gắn lịch
                                </span>
                              )}

                              <span className="font-bold text-[var(--px-green-text)]">
                                +{q.xpReward} XP · +{q.goldReward}G · +{spReward} SP
                              </span>

                              {linkedGoal && (
                                <span className="truncate text-[var(--px-blue-text)]">
                                  🎯 {linkedGoal.title}
                                </span>
                              )}

                              {linkedSkill && (
                                <span className="truncate text-[var(--px-plum-text)]">
                                  ⚡ {linkedSkill.name}
                                </span>
                              )}

                              {q.subtasks.length > 0 && (
                                <span className="text-main">
                                  ☑ {q.subtasks.filter((s) => s.done).length}/{q.subtasks.length}{' '}
                                  bước
                                </span>
                              )}
                            </div>

                            {q.proofNote && (
                              <p className="mt-1 text-[11px] text-[var(--px-green-text)]">
                                Bằng chứng: &ldquo;{q.proofNote}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Direct Row Action Buttons */}
                        <div className="flex shrink-0 items-center gap-1">
                          {!isCompleted && !isSkippedOrRejected ? (
                            <>
                              {!isRunning ? (
                                <button
                                  type="button"
                                  onClick={() => void onStartQuest(q.id)}
                                  className="btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
                                  title="Bắt đầu bấm giờ làm việc"
                                >
                                  <PxPlay size={11} />
                                  <span>{isPaused ? 'Tiếp' : 'Bắt đầu'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void onPauseQuest(q.id)}
                                  className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs"
                                  title="Tạm dừng phiên"
                                >
                                  <PxPause size={11} />
                                  <span>Dừng</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onEnterDungeon(q)}
                                className="btn-secondary p-1.5"
                                title="Mở Đấu trường Focus (+25% XP & +2 SP)"
                              >
                                <PxSword size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onReopenQuest) {
                                    void onReopenQuest(q.id);
                                  } else {
                                    void onUpdateQuest(q.id, { status: 'pending' });
                                  }
                                }}
                                className="btn-secondary px-2 py-1 text-[11px]"
                                title="Đưa nhiệm vụ này trở lại danh sách Cần làm"
                              >
                                Mở lại
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void onCreateCustomQuest({
                                    title: q.title,
                                    description: q.description,
                                    type: q.type,
                                    rank: q.rank,
                                    durationMinutes: q.durationMinutes,
                                    primaryStat: primaryStatKey,
                                    goalId: q.goalId,
                                    skillId: q.skillId,
                                    scheduledSlot: 'Flexible',
                                  })
                                }
                                className="btn-secondary px-2 py-1 text-[11px]"
                                title="Tạo bản sao nhiệm vụ này vào Cần làm"
                              >
                                + Tạo lại
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingQuestId(null);
                              } else {
                                openEditQuest(q);
                              }
                            }}
                            className={`btn-secondary p-1.5 ${
                              isEditing ? 'border-[var(--px-gold)] text-[var(--px-gold-text)]' : ''
                            }`}
                            title="Sửa đầy đủ thông tin nhiệm vụ"
                          >
                            <PxEdit size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedQuestId(isExpanded ? null : q.id)}
                            className="btn-secondary p-1.5 text-sub"
                            title="Chi tiết, Bước nhỏ & Tùy chọn"
                          >
                            <PxChevron size={12} dir={isExpanded ? 'up' : 'down'} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                (isRunning || isPaused) &&
                                !window.confirm(
                                  `Nhiệm vụ "${q.title}" đang tính giờ. Bạn chắc chắn muốn xóa?`
                                )
                              ) {
                                return;
                              }
                              void onDeleteQuest(q.id);
                            }}
                            className="btn-secondary p-1.5 text-dim hover:text-[var(--px-red-text)]"
                            title="Xóa nhiệm vụ (và gỡ khối lịch liên kết nếu có)"
                          >
                            <PxTrash size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Inline Proof-of-Work Input */}
                      {showProof && (
                        <div className="mt-2.5 flex flex-wrap gap-2 bg-[var(--bg-subtle)] p-2.5">
                          <input
                            value={proofText}
                            onChange={(e) => setProofText(e.target.value)}
                            placeholder="Ghi ngắn kết quả đạt được (tự lưu vào Sổ Bằng Chứng & Tri Thức)..."
                            className="min-w-[200px] flex-1 px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await onCompleteQuest(q.id, proofText);
                              setProofQuestId(null);
                              setProofText('');
                            }}
                            className="btn-primary px-3 py-1.5 text-xs"
                          >
                            Xác nhận hoàn thành
                          </button>
                          <button
                            type="button"
                            onClick={() => setProofQuestId(null)}
                            className="btn-secondary px-2.5 py-1.5 text-xs"
                          >
                            Hủy
                          </button>
                        </div>
                      )}

                      {/* Full Inline Quest Editor */}
                      {isEditing && (
                        <form
                          onSubmit={handleSaveEditQuest}
                          className="mt-3 space-y-3 border-t-2 border-[var(--px-gold)] bg-[var(--bg-subtle)] p-3.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-pixel text-[9.5px] font-bold text-[var(--px-gold-text)]">
                              CHỈNH SỬA NHIỆM VỤ &amp; ĐỒNG BỘ LỊCH
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingQuestId(null)}
                              className="text-dim hover:text-main"
                            >
                              Đóng
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="sm:col-span-2">
                              <label className="mb-1 block font-mono text-[10px] text-sub">
                                Tên nhiệm vụ
                              </label>
                              <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-semibold"
                                required
                              />
                            </div>

                            <div>
                              <label className="mb-1 block font-mono text-[10px] text-sub">
                                Loại nhiệm vụ
                              </label>
                              <select
                                value={editType}
                                onChange={(e) => setEditType(e.target.value as QuestType)}
                                className="w-full px-2 py-1.5 text-xs"
                              >
                                <option value="daily">Daily (Hàng ngày)</option>
                                <option value="main">Main ★ (Trọng tâm)</option>
                                <option value="side">Side (Phụ)</option>
                                <option value="recovery">Hồi phục</option>
                                <option value="emergency">Khẩn cấp</option>
                                <option value="hidden">Hidden</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block font-mono text-[10px] text-sub">
                                Độ khó &amp; Thời lượng
                              </label>
                              <div className="flex gap-1.5">
                                <select
                                  value={editRank}
                                  onChange={(e) => setEditRank(e.target.value as QuestRank)}
                                  className="w-20 px-2 py-1.5 text-xs font-bold"
                                >
                                  <option value="D">Rank D</option>
                                  <option value="C">Rank C</option>
                                  <option value="B">Rank B</option>
                                  <option value="A">Rank A</option>
                                  <option value="S">Rank S</option>
                                </select>
                                <input
                                  type="number"
                                  min={5}
                                  max={240}
                                  value={editDur}
                                  onChange={(e) => setEditDur(Number(e.target.value) || 25)}
                                  className="min-w-0 flex-1 px-2 py-1.5 font-mono text-xs"
                                  title="Thời lượng (phút)"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className="mb-1 block font-mono text-[10px] text-sub">
                                Chỉ số chính
                              </label>
                              <select
                                value={editStat}
                                onChange={(e) => setEditStat(e.target.value as AttributeKey)}
                                className="w-full px-2 py-1.5 text-xs"
                              >
                                {Object.entries(STAT_META).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block font-mono text-[10px] text-sub">
                                Khung giờ (HH:mm - HH:mm)
                              </label>
                              <input
                                value={editSlot}
                                onChange={(e) => setEditSlot(e.target.value)}
                                placeholder="VD: 14:00 - 15:00"
                                className="w-full px-2.5 py-1.5 font-mono text-xs"
                              />
                            </div>

                            <div>
                              <label className="mb-1 block font-mono text-[10px] text-sub">
                                Liên kết Mục tiêu
                              </label>
                              <select
                                value={editGoalId}
                                onChange={(e) => setEditGoalId(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs"
                              >
                                <option value="">-- Không gắn --</option>
                                {goals.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    🎯 {g.title}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1 block font-mono text-[10px] text-sub">
                                Liên kết Kỹ năng
                              </label>
                              <select
                                value={editSkillId}
                                onChange={(e) => setEditSkillId(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs"
                              >
                                <option value="">-- Tự động --</option>
                                {skills.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    ⚡ {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Quick Free Windows Picker inside Editor */}
                          {todayAnalysis.freeWindows.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[10px] text-sub">
                                Chọn khung rảnh:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditSlot('Flexible');
                                  setEditSyncCalendar(false);
                                }}
                                className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px]"
                              >
                                Linh hoạt
                              </button>
                              {todayAnalysis.freeWindows.slice(0, 4).map((fw, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setEditSlot(`${fw.startTime} - ${fw.endTime}`);
                                    setEditSyncCalendar(true);
                                  }}
                                  className="border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px] text-[var(--px-green-text)] hover:border-[var(--px-green)]"
                                >
                                  {fw.startTime}–{fw.endTime}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <input
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Mô tả chi tiết..."
                              className="px-2.5 py-1.5 text-xs"
                            />
                            <input
                              value={editIfThen}
                              onChange={(e) => setEditIfThen(e.target.value)}
                              placeholder="Kế hoạch Nếu–Thì..."
                              className="px-2.5 py-1.5 text-xs"
                            />
                          </div>

                          {/* Subtasks Editor inside Inline Edit */}
                          <div className="space-y-1.5 border-t border-[var(--border-hairline)] pt-2">
                            <div className="font-mono text-[10px] uppercase text-sub">
                              Các bước nhỏ (Checklist Subtasks)
                            </div>
                            {editSubtasks.map((st, idx) => (
                              <div key={st.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={st.done}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setEditSubtasks((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, done: checked } : item
                                      )
                                    );
                                  }}
                                />
                                <input
                                  value={st.label}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditSubtasks((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, label: val } : item
                                      )
                                    );
                                  }}
                                  className="flex-1 px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditSubtasks((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="p-1 text-dim hover:text-[var(--px-red-text)]"
                                >
                                  <PxTrash size={12} />
                                </button>
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <input
                                value={editNewSubtask}
                                onChange={(e) => setEditNewSubtask(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (editNewSubtask.trim()) {
                                      setEditSubtasks((prev) => [
                                        ...prev,
                                        {
                                          id: `sub-${Date.now()}-${prev.length}`,
                                          label: editNewSubtask.trim(),
                                          done: false,
                                        },
                                      ]);
                                      setEditNewSubtask('');
                                    }
                                  }
                                }}
                                placeholder="Thêm bước nhỏ mới..."
                                className="flex-1 px-2.5 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (editNewSubtask.trim()) {
                                    setEditSubtasks((prev) => [
                                      ...prev,
                                      {
                                        id: `sub-${Date.now()}-${prev.length}`,
                                        label: editNewSubtask.trim(),
                                        done: false,
                                      },
                                    ]);
                                    setEditNewSubtask('');
                                  }
                                }}
                                className="btn-secondary px-2.5 py-1 text-xs"
                              >
                                + Thêm bước
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex flex-wrap items-center gap-4">
                              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-sub">
                                <input
                                  type="checkbox"
                                  checked={editSyncCalendar}
                                  onChange={(e) => setEditSyncCalendar(e.target.checked)}
                                />
                                <span>Đồng bộ / Cập nhật trên Thời Khóa Biểu</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-sub">
                                <input
                                  type="checkbox"
                                  checked={editRequireProof}
                                  onChange={(e) => setEditRequireProof(e.target.checked)}
                                />
                                <span>Cần ghi nhận bằng chứng</span>
                              </label>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingQuestId(null)}
                                className="btn-secondary px-3 py-1.5 text-xs"
                              >
                                Hủy
                              </button>
                              <button
                                type="submit"
                                disabled={savingEdit}
                                className="btn-primary px-4 py-1.5 text-xs"
                              >
                                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                              </button>
                            </div>
                          </div>
                        </form>
                      )}

                      {/* Progressive Disclosure Details Drawer */}
                      {isExpanded && !isEditing && (
                        <div className="mt-3 space-y-2.5 border-t border-[var(--border-hairline)] pt-3 text-xs">
                          {q.description && <p className="text-sub">{q.description}</p>}
                          {q.ifThenTrigger && (
                            <div className="px-inset p-2 text-[11px] text-sub">
                              <strong className="text-main">Nếu–Thì:</strong> {q.ifThenTrigger}
                            </div>
                          )}

                          {/* Interactive Subtasks Checklist + Quick Add Subtask */}
                          <div className="space-y-1.5">
                            {q.subtasks.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => void onToggleSubtask(q.id, st.id)}
                                className="flex w-full items-center gap-2 text-left text-xs text-sub hover:text-main"
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center border border-[var(--border-ink)] ${
                                    st.done
                                      ? 'bg-[var(--px-green)] text-white'
                                      : 'bg-[var(--bg-subtle)]'
                                  }`}
                                >
                                  {st.done && <PxCheck size={9} />}
                                </span>
                                <span className={st.done ? 'line-through opacity-60' : ''}>
                                  {st.label}
                                </span>
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {!isCompleted && !q.microStartDone && (
                              <button
                                type="button"
                                onClick={() => void onMicroStartQuest(q.id)}
                                className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-[var(--px-gold-text)]"
                              >
                                <PxBolt size={11} />
                                <span>Khởi động 2p (+10 XP)</span>
                              </button>
                            )}
                            {!isCompleted && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProofQuestId(q.id);
                                  setProofText('');
                                }}
                                className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                              >
                                <PxBook size={11} />
                                <span>Hoàn thành kèm ghi chú</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditQuest(q)}
                              className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                            >
                              <PxEdit size={11} />
                              <span>Sửa chi tiết / Thêm bước nhỏ</span>
                            </button>
                            {!isCompleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRejectingId(rejectingId === q.id ? null : q.id)
                                  }
                                  className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                                >
                                  <PxRefresh size={11} />
                                  <span>Đổi bài khác</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onFailQuest(q.id)}
                                  className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-[var(--px-red-text)]"
                                >
                                  <PxWarn size={11} danger />
                                  <span>Bỏ lỡ</span>
                                </button>
                              </>
                            )}
                          </div>

                          {rejectingId === q.id && (
                            <div className="flex flex-wrap items-center gap-1.5 bg-[var(--bg-subtle)] p-2">
                              <span className="text-[11px] text-sub">Lý do đổi để AI thích nghi:</span>
                              {(
                                [
                                  { reason: 'low_energy' as RejectionReason, label: 'Đang mệt' },
                                  { reason: 'no_time' as RejectionReason, label: 'Thiếu giờ' },
                                  { reason: 'too_hard' as RejectionReason, label: 'Quá nặng' },
                                  { reason: 'not_relevant' as RejectionReason, label: 'Đổi hướng' },
                                ]
                              ).map((opt) => (
                                <button
                                  key={opt.reason}
                                  type="button"
                                  onClick={async () => {
                                    await onRejectQuest(q.id, opt.reason);
                                    setRejectingId(null);
                                  }}
                                  className="btn-secondary px-2 py-0.5 text-[11px]"
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ==================== RIGHT COLUMN (5 COLS): HABITS + SPACED RECALL + TODAY SCHEDULE ==================== */}
        <div className="space-y-5 xl:col-span-5">
          {/* 1. CORE HABITS & RITUALS MANAGER */}
          <section className="px-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-3">
              <div className="flex items-center gap-2">
                <PxFlame size={15} />
                <h2 className="font-display text-sm font-extrabold text-main">
                  Thói Quen Cốt Lõi
                </h2>
                <span className="px-pill font-mono text-[10px]">
                  {completedHabitsCount}/{dueHabits.length} hôm nay
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(['all', 'morning', 'anytime', 'evening'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setHabitFilter(tab)}
                    className={`px-2 py-1 text-[11px] font-semibold ${
                      habitFilter === tab
                        ? 'border border-[var(--border-hairline)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]'
                        : 'text-dim hover:text-main'
                    }`}
                  >
                    {tab === 'all' ? 'Tất cả' : TIME_OF_DAY_META[tab]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (showHabitForm && !editingHabitId) {
                      setShowHabitForm(false);
                    } else {
                      openCreateHabitForm();
                    }
                  }}
                  className="btn-primary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                >
                  <PxPlus size={11} />
                  <span>Thêm</span>
                </button>
              </div>
            </div>

            {/* Create / Edit Habit Form */}
            {showHabitForm && (
              <form
                onSubmit={handleSaveHabitSubmit}
                className="space-y-3 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[9.5px] font-bold text-[var(--px-gold-text)]">
                    {editingHabitId ? 'CHỈNH SỬA THÓI QUEN' : 'THÊM THÓI QUEN CỐT LÕI MỚI'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHabitForm(false);
                      setEditingHabitId(null);
                    }}
                    className="text-dim hover:text-main"
                  >
                    Đóng
                  </button>
                </div>

                <input
                  value={habTitle}
                  onChange={(e) => setHabTitle(e.target.value)}
                  placeholder="Tên thói quen (VD: Đọc sách chuyên ngành, Tập thể lực...)"
                  className="w-full px-3 py-2 text-xs font-semibold"
                  required
                />

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={habTime}
                    onChange={(e) => setHabTime(e.target.value as HabitTimeOfDay)}
                    className="px-2 py-1.5 text-xs"
                  >
                    <option value="morning">Buổi Sáng</option>
                    <option value="anytime">Trong ngày</option>
                    <option value="evening">Buổi Tối</option>
                  </select>
                  <select
                    value={habFreq}
                    onChange={(e) => setHabFreq(e.target.value as HabitFrequency)}
                    className="px-2 py-1.5 text-xs"
                  >
                    {Object.entries(FREQ_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={2}
                      max={180}
                      value={habDuration}
                      onChange={(e) => setHabDuration(Number(e.target.value) || 20)}
                      className="w-full px-2 py-1.5 font-mono text-xs"
                      title="Thời lượng chuẩn (phút)"
                    />
                    <span className="text-[11px] text-sub">p</span>
                  </div>
                </div>

                {habFreq === 'custom_days' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-sub">Chọn ngày:</span>
                    {DOW_CHIPS.map((d) => {
                      const sel = habDays.includes(d.dow);
                      return (
                        <button
                          key={d.dow}
                          type="button"
                          onClick={() =>
                            setHabDays((prev) =>
                              sel ? prev.filter((x) => x !== d.dow) : [...prev, d.dow]
                            )
                          }
                          className={`border px-2 py-0.5 font-mono text-[11px] font-bold ${
                            sel
                              ? 'border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sub'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {habFreq === 'times_per_week' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-sub">Mục tiêu mỗi tuần:</span>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={habTargetWeek}
                      onChange={(e) => setHabTargetWeek(Number(e.target.value) || 3)}
                      className="w-16 px-2 py-1 font-mono text-xs"
                    />
                    <span className="text-[11px] text-sub">buổi / tuần</span>
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    value={habStandard}
                    onChange={(e) => setHabStandard(e.target.value)}
                    placeholder="Bản chuẩn (VD: Đọc 20 trang hoặc 30 phút tập trung)"
                    className="w-full px-3 py-1.5 text-xs"
                  />
                  <input
                    value={habMinimum}
                    onChange={(e) => setHabMinimum(e.target.value)}
                    placeholder="Bản tối thiểu ngày bận (VD: Đọc 2 trang / 5 phút giãn cơ)"
                    className="w-full px-3 py-1.5 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={habStat}
                    onChange={(e) => setHabStat(e.target.value as AttributeKey)}
                    className="px-2 py-1.5 text-xs"
                  >
                    {Object.entries(STAT_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={habGoalId}
                    onChange={(e) => setHabGoalId(e.target.value)}
                    className="px-2 py-1.5 text-xs"
                  >
                    <option value="">🎯 Liên kết mục tiêu (tùy chọn)</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        🎯 {g.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHabitForm(false);
                      setEditingHabitId(null);
                    }}
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={savingHabit}
                    className="btn-primary px-4 py-1.5 text-xs"
                  >
                    {savingHabit
                      ? 'Đang lưu...'
                      : editingHabitId
                        ? 'Cập nhật Thói quen'
                        : 'Lưu Thói quen'}
                  </button>
                </div>
              </form>
            )}

            {habits.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 p-6 text-center">
                <p className="text-xs text-sub">
                  Chưa có Thói quen cốt lõi nào. Tạo 2–4 thói quen lặp lại kèm bản tối thiểu 2 phút
                  để giữ nhịp mỗi ngày.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onSeedStarterHabits()}
                    className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
                  >
                    <PxSparkle size={12} />
                    <span>Nạp 4 thói quen mẫu</span>
                  </button>
                  <button
                    type="button"
                    onClick={openCreateHabitForm}
                    className="btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
                  >
                    <PxPlus size={12} />
                    <span>Tự thiết kế</span>
                  </button>
                </div>
              </div>
            ) : visibleHabits.length === 0 ? (
              <div className="p-4 text-center text-xs text-dim">
                Không có thói quen nào trong khung giờ này.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {visibleHabits.map((h) => {
                  const doneKind = h.completedToday;
                  const isBusy = busyId === `hab-${h.id}`;
                  const linkedGoal = h.goalId ? goalMap.get(h.goalId) : undefined;
                  const isDueToday = h.dueToday !== false;

                  return (
                    <div
                      key={h.id}
                      className={`flex items-center justify-between gap-2.5 px-4 py-2.5 transition hover:bg-[var(--bg-surface-2)] ${
                        doneKind ? 'opacity-80' : ''
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(`hab-${h.id}`);
                            try {
                              await onCheckinHabit(
                                h.id,
                                doneKind ? 'undo' : mvdActive ? 'minimum' : 'full'
                              );
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 border-[var(--border-ink)] ${
                            doneKind === 'full'
                              ? 'bg-[var(--px-green)] text-white'
                              : doneKind === 'minimum'
                                ? 'bg-[var(--px-gold)] text-[#140e04]'
                                : 'bg-[var(--bg-subtle)] text-transparent hover:border-[var(--px-gold)]'
                          }`}
                          title={
                            doneKind
                              ? 'Bấm để hoàn tác'
                              : mvdActive
                                ? 'Check-in bản tối thiểu'
                                : 'Check-in bản chuẩn'
                          }
                        >
                          <PxCheck size={12} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`truncate text-xs font-bold sm:text-sm ${
                                doneKind ? 'line-through text-sub' : 'text-main'
                              }`}
                            >
                              {h.title}
                            </span>
                            <span className="px-pill font-mono text-[9.5px] text-[var(--px-gold-text)]">
                              +{h.primaryStat}
                            </span>
                            {(h.currentStreak ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] font-bold text-[var(--px-gold-text)]">
                                <PxFlame size={10} />
                                {h.currentStreak}d
                              </span>
                            )}
                            {!isDueToday && (
                              <span className="font-mono text-[10px] text-dim">(Nghỉ hôm nay)</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-sub">
                            <span className="truncate">
                              {mvdActive || doneKind === 'minimum'
                                ? `Tối thiểu: ${h.minimumSpec}`
                                : h.standardSpec}
                            </span>
                            {linkedGoal && (
                              <span className="text-[var(--px-blue-text)]">
                                · 🎯 {linkedGoal.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!doneKind && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(`hab-${h.id}`);
                              try {
                                await onCheckinHabit(h.id, 'minimum');
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className={`px-2 py-1 font-mono text-[10px] font-bold ${
                              mvdActive ? 'btn-primary' : 'btn-secondary text-[var(--px-gold-text)]'
                            }`}
                            title={`Hoàn thành bản tối thiểu để giữ chuỗi: ${h.minimumSpec}`}
                          >
                            2p
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void onQuickStartFocus(h.durationMinutes || 25, h.title)}
                          className="btn-secondary p-1"
                          title={`Mở phiên Focus ${h.durationMinutes || 25}p cho thói quen này`}
                        >
                          <PxSword size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditHabitForm(h)}
                          className="btn-secondary p-1 text-sub hover:text-main"
                          title="Sửa thói quen"
                        >
                          <PxEdit size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Xóa thói quen "${h.title}"?`)) {
                              void onDeleteHabit(h.id);
                            }
                          }}
                          className="btn-secondary p-1 text-dim hover:text-[var(--px-red-text)]"
                          title="Xóa thói quen"
                        >
                          <PxTrash size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. PROGRESSIVE SPACED RECALL CARD */}
          {dueRecallNotes.length > 0 && currentRecallNote && (
            <section className="px-card border-l-4 border-l-[var(--px-plum)]">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <PxBook size={14} color="var(--px-plum-text)" />
                  <span className="font-bold text-main">
                    Ôn tập ngắt quãng: {dueRecallNotes.length} thẻ đến hạn
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.click();
                      setRecallOpen((v) => !v);
                      setRecallRevealed(false);
                    }}
                    className="btn-arcane px-2.5 py-1 text-[11px]"
                  >
                    {recallOpen ? 'Thu gọn' : 'Ôn ngay 1p'}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenGrowthTab}
                    className="text-[11px] font-semibold text-sub hover:text-main"
                  >
                    Kho Tri Thức →
                  </button>
                </div>
              </div>

              {recallOpen && (
                <div className="space-y-3 border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase text-[var(--px-plum-text)]">
                      ACTIVE RECALL · LẦN ÔN #{currentRecallNote.recallCount + 1}
                    </div>
                    <h3 className="mt-1 font-display text-sm font-bold text-main">
                      {currentRecallNote.recallPrompt || currentRecallNote.title}
                    </h3>
                  </div>

                  {!recallRevealed ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.click();
                        setRecallRevealed(true);
                      }}
                      className="btn-secondary px-4 py-1.5 text-xs"
                    >
                      Tự nhớ lại xong → Hiện nội dung
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="px-card whitespace-pre-wrap p-3 text-xs leading-relaxed text-main">
                        {currentRecallNote.content}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { rating: 'again' as const, label: 'Quên (1d)', cls: 'btn-crimson' },
                            { rating: 'hard' as const, label: 'Mờ (2d)', cls: 'btn-secondary' },
                            { rating: 'good' as const, label: 'Nhớ rõ', cls: 'btn-emerald' },
                            { rating: 'easy' as const, label: 'Rất chắc', cls: 'btn-primary' },
                          ]
                        ).map((opt) => (
                          <button
                            key={opt.rating}
                            type="button"
                            disabled={reviewingNoteId === currentRecallNote.id}
                            onClick={async () => {
                              setReviewingNoteId(currentRecallNote.id);
                              try {
                                await onReviewKnowledge(currentRecallNote.id, opt.rating);
                                setRecallRevealed(false);
                              } finally {
                                setReviewingNoteId(null);
                              }
                            }}
                            className={`${opt.cls} px-2.5 py-1 text-[11px]`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 3. TODAY'S LIVE SCHEDULE & FREE WINDOWS PANEL (Unified with TimetablePlanner) */}
          <section className="px-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-3">
              <div className="flex items-center gap-2">
                <PxCalendar size={15} color="var(--px-blue-text)" />
                <h2 className="font-display text-sm font-extrabold text-main">
                  Lịch &amp; Khung Giờ Trống Hôm Nay
                </h2>
              </div>
              {onOpenTimetableTab && (
                <button
                  type="button"
                  onClick={onOpenTimetableTab}
                  className="font-mono text-[11px] font-bold text-[var(--px-gold-text)] hover:underline"
                >
                  Mở Lịch Tuần Đầy Đủ →
                </button>
              )}
            </div>

            {/* Free Windows — 1-Click Schedule Task Into Window */}
            <div className="border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3.5">
              <div className="mb-2 flex items-center justify-between font-mono text-[10.5px]">
                <span className="font-bold uppercase text-sub">
                  Khung giờ trống khả dụng ({todayAnalysis.freeWindows.length})
                </span>
                <span className="text-[var(--px-green-text)]">
                  Bấm để xếp nhiệm vụ vào khung giờ
                </span>
              </div>

              {todayAnalysis.freeWindows.length === 0 ? (
                <p className="text-xs text-dim">
                  Hôm nay lịch đã kín. Bạn có thể tạo nhiệm vụ Linh hoạt hoặc điều chỉnh trong tab
                  Lịch &amp; Nhịp.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {todayAnalysis.freeWindows.slice(0, 5).map((fw, idx) => {
                    const slotLabel = `${fw.startTime} - ${fw.endTime}`;
                    const qualityLabel =
                      fw.windowQuality === 'DEEP_WORK_PRIME'
                        ? 'Deep Work Tốt'
                        : fw.windowQuality === 'STANDARD_FOCUS'
                          ? 'Focus Chuẩn'
                          : 'Sprint Ngắn';
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-main">
                            {fw.startTime} – {fw.endTime}
                          </span>
                          <span className="ml-1.5 font-mono text-[11px] text-sub">
                            ({fw.durationMinutes}p · {qualityLabel})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => prefillSlotInComposer(slotLabel, fw.durationMinutes)}
                          className="btn-secondary shrink-0 px-2 py-0.5 font-mono text-[10.5px] font-bold text-[var(--px-gold-text)]"
                        >
                          + Xếp việc vào đây
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Today's Unified Chronological Timeline (Fixed Blocks + Scheduled Quests) */}
            <div className="p-3.5">
              <div className="mb-2 flex items-center justify-between font-mono text-[10.5px]">
                <span className="font-bold uppercase text-sub">
                  Dòng thời gian hôm nay ({todayTimelineItems.length} mục)
                </span>
                {goals.length > 0 && (
                  <button
                    type="button"
                    onClick={onOpenGrowthTab}
                    className="inline-flex items-center gap-1 text-[var(--px-blue-text)] hover:underline"
                  >
                    <PxTarget size={11} />
                    <span>{goals.length} Mục tiêu đang chạy</span>
                  </button>
                )}
              </div>

              {todayTimelineItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-dim">
                  Chưa có khối lịch cố định hay nhiệm vụ gắn giờ nào hôm nay.
                </div>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {todayTimelineItems.map((it) => {
                    const isQuest = it.kind === 'quest' && Boolean(it.quest);
                    const isDone = it.status === 'completed';
                    return (
                      <div
                        key={it.id}
                        className={`flex items-center justify-between gap-2 border px-2.5 py-1.5 text-xs ${
                          isQuest
                            ? isDone
                              ? 'border-[var(--px-green)] bg-[var(--bg-subtle)] opacity-75'
                              : 'border-[var(--px-gold)] bg-[var(--bg-surface-2)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--px-gold-text)]">
                              {it.startTime}–{it.endTime}
                            </span>
                            <span
                              className={`truncate font-semibold ${
                                isDone ? 'line-through text-sub' : 'text-main'
                              }`}
                            >
                              {it.title}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-dim">{it.subLabel}</div>
                        </div>

                        {isQuest && it.quest && (
                          <div className="flex shrink-0 items-center gap-1">
                            {!isDone && (
                              <button
                                type="button"
                                onClick={() => void onStartQuest(it.quest!.id)}
                                className="btn-primary px-1.5 py-0.5 text-[10px]"
                                title="Bắt đầu"
                              >
                                <PxPlay size={9} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditQuest(it.quest!)}
                              className="btn-secondary px-1.5 py-0.5 text-[10px]"
                              title="Sửa nhiệm vụ"
                            >
                              <PxEdit size={9} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
