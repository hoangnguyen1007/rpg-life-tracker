import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  PixelRivets,
  PxAutomaton,
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
  PxScroll,
  PxShield,
  PxSparkle,
  PxSword,
  PxTrash,
  PxWarn,
} from './PixelIcons';
import type {
  AIChatMessage,
  AIChatThread,
  AISettings,
  AgentMemoryLog,
  AssistantOverviewPayload,
  AttributeKey,
  BossMission,
  ChatContextScope,
  CouncilDeliberation,
  DayScheduleAnalysis,
  PlayerState,
  Quest,
  QuestRank,
  QuestType,
  RejectionReason,
  SkillNode,
  StatMap,
  StoryChapter,
  TaskDraftAnalysis,
  WeeklyRaidPayload,
} from '../types/system';
import { systemApi } from '../utils/api';
import { getVnTodayKey } from '../utils/timeVn';
import { DayAllocationDonut } from './VisualIllustrations';
import { PixelDungeonDiorama } from './DungeonSprites';
import { PxTreasureChest, RaidBossSprite } from './RaidBossSprites';
import { MarkdownContent } from './MarkdownContent';

interface QuestCouncilBoardProps {
  player: PlayerState;
  aiSettings: AISettings;
  todayAnalysis: DayScheduleAnalysis;
  quests: Quest[];
  skills?: SkillNode[];
  chapters?: StoryChapter[];
  bosses?: BossMission[];
  shadowsCount?: number;
  deliberation: CouncilDeliberation | null;
  memoryLogs: AgentMemoryLog[];
  initialReflectionNote?: string;
  chatThreads?: AIChatThread[];
  activeChatThreadId?: string | null;
  chatDraftsByKey?: Record<string, string>;
  pendingChatKeys?: Record<string, boolean>;
  optimisticMessagesByKey?: Record<string, AIChatMessage | undefined>;
  chatErrorByKey?: Record<string, string | null>;
  utilityTab?: 'advisor' | 'rhythm' | 'reflect';
  onChangeUtilityTab?: (tab: 'advisor' | 'rhythm' | 'reflect') => void;
  onSelectChatThread?: (threadId: string) => void;
  onCreateChatThread?: (contextScope: ChatContextScope, title?: string) => Promise<void>;
  onDeleteChatThread?: (threadId: string) => Promise<void>;
  onChangeChatDraft?: (key: string, value: string) => void;
  onSendChatPrompt?: (
    prompt: string,
    contextScope?: ChatContextScope,
    explicitThreadId?: string | null
  ) => Promise<void>;
  onOpenSettings: () => void;
  onNavigateBosses?: () => void;
  onCheckinEnergy: (energy: number) => Promise<void>;
  onOrchestrate: (focusNote: string) => Promise<void>;
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
    statRewards?: Partial<StatMap>;
    requiresProof?: boolean;
    syncToTimetable?: boolean;
  }) => Promise<void>;
  onDeleteQuest: (questId: string) => Promise<void>;
  onToggleSubtask: (questId: string, subtaskId: string) => Promise<void>;
  onCompleteQuest: (questId: string, proofNote?: string) => Promise<void>;
  onStartQuest?: (questId: string) => Promise<void>;
  onPauseQuest?: (questId: string) => Promise<void>;
  onRejectQuest: (questId: string, reason: RejectionReason) => Promise<void>;
  onFailQuest?: (questId: string) => Promise<void>;
  onSettleDay?: () => Promise<void>;
  onUpdateQuest: (questId: string, updates: Partial<Quest>) => Promise<void>;
  onMicroStartQuest: (questId: string) => Promise<unknown>;
  onReflect: (payload: { reflectionNote?: string; plannedRestMode?: boolean }) => Promise<unknown>;
  onEnterDungeon: (quest: Quest) => void;
  assistantOverview?: AssistantOverviewPayload | null;
  onConvertFocusToQuest?: (payload: {
    mode: 'complete_new' | 'credit_pending';
    title?: string;
    questId?: string;
    primaryStat?: AttributeKey;
  }) => Promise<void>;
  onOpenAssistant?: () => void;
  weeklyRaid?: WeeklyRaidPayload | null;
  onOpenRaidArena?: () => void;
  onQuickStartFocus?: (durationMinutes: number, title?: string) => Promise<void>;
  eveningCloseoutBadge?: boolean;
  alreadyClosedToday?: boolean;
}

const TYPE_PILLS: Record<string, { label: string; cls: string }> = {
  daily: {
    label: 'Daily',
    cls: 'border-[var(--px-blue)] bg-[var(--bg-surface-2)] text-[var(--px-blue-text)]',
  },
  main: {
    label: 'Main',
    cls: 'border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-[var(--px-gold-text)]',
  },
  side: {
    label: 'Side',
    cls: 'border-[var(--px-green)] bg-[var(--bg-surface-2)] text-[var(--px-green-text)]',
  },
  hidden: {
    label: 'Hidden',
    cls: 'border-[var(--px-plum)] bg-[var(--bg-surface-2)] text-[var(--px-plum-text)]',
  },
  emergency: {
    label: 'Urgent',
    cls: 'border-[var(--px-red)] bg-[var(--bg-surface-2)] text-[var(--px-red-text)]',
  },
  recovery: {
    label: 'Recovery',
    cls: 'border-[var(--px-green)] bg-[var(--bg-subtle)] text-[var(--px-green-text)]',
  },
};

const CHAT_SCOPES: Array<{
  key: ChatContextScope;
  label: string;
  dotCls: string;
  placeholder: string;
}> = [
  { key: 'general', label: 'Tổng hợp', dotCls: 'bg-[var(--px-gold)]', placeholder: 'Hỏi AI về kế hoạch hôm nay...' },
  { key: 'timetable', label: 'Lịch', dotCls: 'bg-[var(--px-blue)]', placeholder: 'Hỏi AI về sắp xếp lịch & giờ trống...' },
  { key: 'goals', label: 'Mục tiêu', dotCls: 'bg-[var(--px-green)]', placeholder: 'Hỏi AI về lộ trình mục tiêu...' },
  { key: 'skills', label: 'Kĩ năng', dotCls: 'bg-[var(--px-plum)]', placeholder: 'Hỏi AI về nâng cấp kỹ năng & chỉ số...' },
  { key: 'review', label: 'Phản tư', dotCls: 'bg-[var(--px-red)]', placeholder: 'Phân tích nguyên nhân mệt / trì hoãn...' },
];

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

const QUICK_AI_CHIPS = [
  'Gợi ý 2 quest Deep Work vừa khung rảnh hôm nay',
  'Hôm nay hơi mệt, đề xuất nhịp phục hồi nhẹ nhàng',
  'Kiểm tra cân bằng 6 chỉ số & tiến độ hiện tại',
];

function getQuestHpStake(q: Quest, plannedRestMode?: boolean): number {
  if (plannedRestMode || q.type === 'hidden' || q.type === 'recovery') return 0;
  if (q.type === 'main') return 18;
  if (q.type === 'emergency') return 15;
  if (q.type === 'daily') return 12;
  return 8;
}

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
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatMsShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const QuestCouncilBoard: React.FC<QuestCouncilBoardProps> = ({
  player,
  aiSettings,
  todayAnalysis,
  quests,
  skills = [],
  chapters = [],
  bosses = [],
  shadowsCount = 0,
  deliberation,
  memoryLogs,
  initialReflectionNote = '',
  chatThreads = [],
  activeChatThreadId = null,
  chatDraftsByKey = {},
  pendingChatKeys = {},
  optimisticMessagesByKey = {},
  chatErrorByKey = {},
  utilityTab = 'advisor',
  onChangeUtilityTab,
  onSelectChatThread,
  onCreateChatThread,
  onDeleteChatThread,
  onChangeChatDraft,
  onSendChatPrompt,
  onOpenSettings: _onOpenSettings,
  onNavigateBosses,
  onCheckinEnergy,
  onOrchestrate,
  onCreateCustomQuest,
  onDeleteQuest,
  onToggleSubtask,
  onCompleteQuest,
  onStartQuest,
  onPauseQuest,
  onRejectQuest,
  onFailQuest,
  onSettleDay,
  onUpdateQuest,
  onMicroStartQuest,
  onReflect,
  onEnterDungeon,
  assistantOverview,
  onConvertFocusToQuest,
  onOpenAssistant,
  weeklyRaid,
  onOpenRaidArena,
  onQuickStartFocus,
  eveningCloseoutBadge = false,
  alreadyClosedToday = false,
}) => {
  const [focusNote, setFocusNote] = useState('');
  const [showFocusNote, setShowFocusNote] = useState(false);
  const [showQuickFocus, setShowQuickFocus] = useState(false);
  const [quickFocusTitle, setQuickFocusTitle] = useState('');
  const [startingQuickFocus, setStartingQuickFocus] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [settling, setSettling] = useState(false);
  const [failingId, setFailingId] = useState<string | null>(null);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);
  const [convertingFocus, setConvertingFocus] = useState(false);

  // Live 1-second stopwatch tick for flexible task sessions
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const hasRunning = quests.some((q) => q.status === 'pending' && q.startedAt && !q.isPaused);
    if (!hasRunning) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quests]);

  // Instant 1-Line Quick-Add + AI Draft Analyzer State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDur, setQuickDur] = useState<number>(25);
  const [quickAdding, setQuickAdding] = useState(false);
  const [analyzingDraft, setAnalyzingDraft] = useState(false);
  const [draftAnalysis, setDraftAnalysis] = useState<TaskDraftAnalysis | null>(null);
  const [syncDraftToTimetable, setSyncDraftToTimetable] = useState(true);
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
  const [quickType, setQuickType] = useState<QuestType>('daily');
  const [quickStat, setQuickStat] = useState<AttributeKey>('INT');
  const [quickSlot, setQuickSlot] = useState('Flexible');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickRequireProof, setQuickRequireProof] = useState(false);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const [questFilter, setQuestFilter] = useState<'pending' | 'completed'>('pending');
  const [showProtocolsLibrary, setShowProtocolsLibrary] = useState(false);
  const [creatingProtocolId, setCreatingProtocolId] = useState<string | null>(null);

  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [proofText, setProofText] = useState('');
  const [sessionProofText, setSessionProofText] = useState('');
  const [showSessionProof, setShowSessionProof] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSlot, setEditSlot] = useState('');
  const [microStartingId, setMicroStartingId] = useState<string | null>(null);

  const [reflectionDraft, setReflectionDraft] = useState(initialReflectionNote);
  const [savingReflection, setSavingReflection] = useState(false);
  const [togglingRest, setTogglingRest] = useState(false);

  const [showScopePicker, setShowScopePicker] = useState(false);
  const [newScope, setNewScope] = useState<ChatContextScope>('general');
  const [creatingThread, setCreatingThread] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeThread =
    chatThreads.find((t) => t.id === activeChatThreadId) || chatThreads[0] || null;
  const currentThreadKey = activeThread?.id || '__new__';
  const currentScope: ChatContextScope = activeThread?.contextScope || newScope;
  const currentDraft = chatDraftsByKey[currentThreadKey] ?? '';
  const isCurrentThreadPending = Boolean(pendingChatKeys[currentThreadKey]);
  const currentOptimisticMsg = optimisticMessagesByKey[currentThreadKey];
  const currentThreadError = chatErrorByKey[currentThreadKey] || null;
  const visibleMessages: AIChatMessage[] = [
    ...(activeThread?.messages || []),
    ...(currentOptimisticMsg ? [currentOptimisticMsg] : []),
  ];

  useEffect(() => {
    setReflectionDraft(initialReflectionNote);
  }, [initialReflectionNote]);

  useEffect(() => {
    if (utilityTab === 'advisor') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [utilityTab, activeThread?.id, visibleMessages.length, isCurrentThreadPending]);

  const todayKey = getVnTodayKey();
  const todayQuests = quests.filter((q) => q.dateKey === todayKey || q.status === 'pending');
  const pendingQuests = todayQuests.filter((q) => q.status === 'pending');
  const completedQuests = todayQuests.filter((q) => q.status === 'completed');

  const activeSession =
    pendingQuests.find((q) => q.startedAt && !q.isPaused) ||
    pendingQuests.find((q) => q.isPaused || (q.pausedAccumulatedSeconds ?? 0) > 0) ||
    null;

  const activeChapter =
    chapters.find((c) => c.unlocked && !c.completed) ||
    chapters.filter((c) => c.completed).slice(-1)[0] ||
    chapters[0];
  const activeStage = activeChapter?.stages?.find((s) => s.unlocked && !s.completed) || null;
  const activeBoss =
    (activeStage?.bossId &&
      bosses.find((b) => b.id === activeStage.bossId && b.unlocked && !b.defeated)) ||
    null;

  const isLiveAi = Boolean(aiSettings.useLiveLlm && aiSettings.apiKey);

  const runOrchestrate = async () => {
    setOrchestrating(true);
    try {
      await onOrchestrate(focusNote);
    } finally {
      setOrchestrating(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || quickAdding) return;
    setQuickAdding(true);
    try {
      await onCreateCustomQuest({
        title: quickTitle.trim(),
        description: showAdvancedAdd ? quickDesc.trim() : undefined,
        type: showAdvancedAdd ? quickType : 'daily',
        durationMinutes: quickDur,
        scheduledSlot: showAdvancedAdd ? quickSlot.trim() || 'Flexible' : 'Flexible',
        primaryStat: showAdvancedAdd ? quickStat : 'INT',
        requiresProof: showAdvancedAdd ? quickRequireProof : false,
      });
      setQuickTitle('');
      setQuickDesc('');
      setDraftAnalysis(null);
      setQuestFilter('pending');
      setTimeout(() => quickInputRef.current?.focus(), 20);
    } finally {
      setQuickAdding(false);
    }
  };

  const handleAnalyzeDraft = async () => {
    if (!quickTitle.trim() || analyzingDraft) return;
    setAnalyzingDraft(true);
    try {
      const analysis = await systemApi.analyzeTaskDraft({
        title: quickTitle.trim(),
        description: quickDesc.trim() || undefined,
        durationMinutes: quickDur,
        type: showAdvancedAdd ? quickType : undefined,
      });
      setDraftAnalysis(analysis);
    } finally {
      setAnalyzingDraft(false);
    }
  };

  const handleApplyDraftAnalysis = async () => {
    if (!draftAnalysis || quickAdding) return;
    setQuickAdding(true);
    try {
      await onCreateCustomQuest({
        title: draftAnalysis.suggestedTitle,
        description: quickDesc.trim() || draftAnalysis.statReason,
        type: draftAnalysis.type,
        rank: draftAnalysis.rank,
        durationMinutes: draftAnalysis.durationMinutes,
        scheduledSlot: draftAnalysis.scheduledSlot,
        primaryStat: draftAnalysis.primaryStat,
        secondaryStat: draftAnalysis.secondaryStat,
        skillId: draftAnalysis.skillId,
        statRewards: draftAnalysis.statRewards,
        requiresProof: draftAnalysis.requiresProof,
        syncToTimetable: syncDraftToTimetable,
      });
      setQuickTitle('');
      setQuickDesc('');
      setDraftAnalysis(null);
      setQuestFilter('pending');
      setTimeout(() => quickInputRef.current?.focus(), 20);
    } finally {
      setQuickAdding(false);
    }
  };

  const sendConsultPrompt = (prompt: string) => {
    if (!prompt.trim() || isCurrentThreadPending) return;
    void onSendChatPrompt?.(prompt, currentScope, activeThread?.id ?? null);
  };

  const activeElapsedSec = activeSession ? getQuestElapsedSeconds(activeSession, nowMs) : 0;
  const activeEstimatedSec = activeSession ? Math.max(60, activeSession.durationMinutes * 60) : 60;
  const activeElapsedPct = Math.min(100, Math.round((activeElapsedSec / activeEstimatedSec) * 100));
  const activeElapsedMins = Math.floor(activeElapsedSec / 60);
  const activeOverMins = activeSession ? activeElapsedMins - activeSession.durationMinutes : 0;

  return (
    <div className="divide-y-2 rpg-divider">
      {/* 1) Concise Top Command Strip */}
      <section className="relative px-4 py-3 sm:px-5">
        <PixelRivets />
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-sub">
            <span className="font-display font-bold text-main">{todayAnalysis.dayLabel}</span>
            <span className="text-dim">•</span>
            <span>
              Rảnh{' '}
              <strong className="font-mono text-[var(--px-green-text)]">
                {(todayAnalysis.totalFreeMinutes / 60).toFixed(1)}h
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="px-inset flex items-center gap-1 rounded-none px-1.5 py-0.5"
              title="Chọn thể trạng để AI điều chỉnh độ nặng kế hoạch hôm nay — KHÔNG trừ HP!"
            >
              <span className="px-1 text-[11px] font-bold text-sub">Thể trạng:</span>
              {[
                { val: 100, label: 'Sung sức' },
                { val: 75, label: 'Ổn định' },
                { val: 45, label: 'Hơi mệt' },
                { val: 20, label: 'Cạn pin' },
              ].map((opt) => {
                const selected = Math.abs(player.energyLevel - opt.val) <= 12;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => onCheckinEnergy(opt.val)}
                    className={`rounded-none px-2 py-1 text-[11px] font-bold transition ${
                      selected
                        ? 'bg-[var(--px-gold)] text-[#140e04]'
                        : 'text-sub hover:text-main'
                    }`}
                    title="Chọn thể trạng để AI điều chỉnh độ nặng kế hoạch hôm nay — KHÔNG trừ HP!"
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={togglingRest}
              onClick={async () => {
                setTogglingRest(true);
                try {
                  await onReflect({ plannedRestMode: !player.plannedRestMode });
                } finally {
                  setTogglingRest(false);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-none px-2.5 py-1.5 text-xs font-semibold transition ${
                player.plannedRestMode ? 'btn-emerald' : 'btn-secondary'
              }`}
              title="Bật Nghỉ Chủ Động (Grace Day) để hồi phục & bảo toàn chuỗi"
            >
              {togglingRest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PxCoffee size={14} />
              )}
              <span>Nghỉ Chủ Động</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFocusNote((v) => !v)}
              className={`btn-secondary flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${
                showFocusNote || focusNote
                  ? 'border-[var(--px-gold)] text-[var(--px-gold-text)]'
                  : ''
              }`}
            >
              <PxGear size={14} />
              <span>Ghi chú AI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQuickFocus((v) => !v)}
              className={`${
                showQuickFocus ? 'btn-primary' : 'btn-arcane'
              } flex items-center gap-1.5 px-2.5 py-1.5 text-xs`}
              title="Bắt đầu phiên Focus 1-click trong Hầm Ngục (25p / 45p / 60p / 90p)"
            >
              <PxSword size={14} />
              <span>Focus Nhanh</span>
            </button>

            <button
              type="button"
              disabled={orchestrating}
              onClick={() => void runOrchestrate()}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              {orchestrating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PxRefresh size={14} />
              )}
              <span>{orchestrating ? 'Đang lập...' : 'AI Lập Kế Hoạch'}</span>
            </button>

            {onSettleDay && (
              <button
                type="button"
                disabled={settling}
                onClick={async () => {
                  setSettling(true);
                  try {
                    await onSettleDay();
                  } finally {
                    setSettling(false);
                  }
                }}
                className={`btn-secondary flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${
                  alreadyClosedToday
                    ? 'border-[var(--px-green)] text-[var(--px-green-text)]'
                    : eveningCloseoutBadge
                      ? 'border-[var(--px-gold)] text-[var(--px-gold-text)]'
                      : ''
                }`}
                title={
                  alreadyClosedToday
                    ? 'Xem lại Phiếu Chốt Ngày hôm nay'
                    : eveningCloseoutBadge
                      ? 'Đã đến giờ chốt ngày (21h+) — Mở Nghi thức Chốt Ngày'
                      : 'Tổng kết ngày hôm nay'
                }
              >
                {settling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : alreadyClosedToday ? (
                  <PxCheck size={14} className="text-[var(--px-green-text)]" />
                ) : (
                  <PxCalendar size={14} className="text-[var(--px-green-text)]" />
                )}
                <span>{alreadyClosedToday ? 'Đã Chốt' : 'Chốt Ngày'}</span>
                {eveningCloseoutBadge && !alreadyClosedToday && (
                  <span className="rounded-none bg-[var(--px-gold)] px-1 py-0.5 font-mono text-[9px] font-extrabold leading-none text-[#140e04]">
                    21h+
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {showQuickFocus && (
          <div className="px-inset relative mt-3 space-y-2.5 rounded-none border-2 border-[var(--px-plum)] p-3">
            <PixelRivets />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={quickFocusTitle}
                onChange={(e) => setQuickFocusTitle(e.target.value)}
                placeholder="Tên phiên tập trung (để trống tự đặt)..."
                className="min-w-0 flex-1 rounded-none px-3 py-1.5 text-xs"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { mins: 25, label: '25p Pomodoro' },
                  { mins: 45, label: '45p Deep Work' },
                  { mins: 60, label: '60p Học Sâu' },
                  { mins: 90, label: '90p Ultradian' },
                ].map((preset) => (
                  <button
                    key={preset.mins}
                    type="button"
                    disabled={startingQuickFocus}
                    onClick={async () => {
                      if (startingQuickFocus) return;
                      setStartingQuickFocus(true);
                      try {
                        await onQuickStartFocus?.(preset.mins, quickFocusTitle.trim() || undefined);
                        setQuickFocusTitle('');
                        setShowQuickFocus(false);
                      } finally {
                        setStartingQuickFocus(false);
                      }
                    }}
                    className="btn-arcane inline-flex items-center gap-1 px-2.5 py-1.5 font-mono text-[11px] font-bold"
                  >
                    {startingQuickFocus ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <PxClock size={12} />
                    )}
                    <span>{preset.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowQuickFocus(false)}
                  className="btn-secondary p-1.5"
                  aria-label="Đóng Focus Nhanh"
                >
                  <PxClose size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {showFocusNote && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runOrchestrate();
            }}
            className="mt-3 flex flex-col gap-2 border-t-2 pt-3 sm:flex-row rpg-divider"
          >
            <input
              value={focusNote}
              onChange={(e) => setFocusNote(e.target.value)}
              placeholder="Ghi chú hôm nay (VD: Sáng Deep Work chuyên môn, chiều rèn ngoại ngữ, tối vận động & đọc sách)..."
              className="flex-1 rounded-none px-3 py-1.5 text-xs"
            />
            <button type="submit" disabled={orchestrating} className="btn-secondary px-3 py-1.5 text-xs">
              Áp dụng &amp; Lập lịch
            </button>
          </form>
        )}
      </section>

      {/* 2) Compact Fog-of-War Pixel Dungeon Diorama */}
      <PixelDungeonDiorama
        rank={player.rank}
        avatarStyle={player.profile.avatarStyle}
        hp={player.hp ?? 100}
        maxHp={player.maxHp ?? 100}
        shadowsCount={shadowsCount}
        chapter={activeChapter}
        activeBoss={activeBoss}
        onOpenCampaign={onNavigateBosses}
      />

      {/* 2b) Compact 1-Line Live Weekly Raid Boss HP Strip */}
      {weeklyRaid?.raid &&
        (() => {
          const raid = weeklyRaid.raid;
          const isDefeated = raid.status === 'defeated' || raid.currentHp <= 0;
          const hpPct =
            raid.maxHp > 0
              ? Math.max(0, Math.min(100, Math.round((raid.currentHp / raid.maxHp) * 100)))
              : 0;
          const isEnraged = !isDefeated && hpPct < 30 && raid.status === 'active';
          const unclaimedCount = raid.chests.filter((c) => c.unlocked && !c.claimed).length;
          const days = Math.floor(Math.max(0, weeklyRaid.secondsUntilReset) / 86400);
          const hours = Math.floor((Math.max(0, weeklyRaid.secondsUntilReset) % 86400) / 3600);
          const weakShort =
            raid.weaknessCategory === 'deep_work'
              ? 'Deep Work'
              : raid.weaknessCategory === 'study'
                ? 'Study'
                : 'Quests';

          return (
            <section
              aria-label="Weekly Raid Boss Strip"
              className="relative bg-[var(--bg-surface-2)] px-4 py-2 sm:px-5"
            >
              <PixelRivets />
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onOpenRaidArena?.()}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-90"
                  title={`${raid.name} (${raid.title}) — Mở Đấu Trường Raid`}
                >
                  <span className="px-inset flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-[#12101a] p-0.5">
                    <RaidBossSprite
                      archetype={raid.archetype}
                      size={28}
                      enraged={isEnraged}
                      defeated={isDefeated}
                    />
                  </span>

                  <span
                    className={`font-pixel shrink-0 rounded-none border-2 px-1.5 py-0.5 text-[9px] font-bold ${
                      isDefeated
                        ? 'border-[var(--px-gold)] bg-[var(--bg-subtle)] text-[var(--px-gold-text)]'
                        : 'border-[var(--px-red)] bg-[var(--bg-subtle)] text-[var(--px-red-text)]'
                    }`}
                  >
                    {raid.difficultyTier}-RANK
                  </span>

                  <span className="min-w-0 truncate font-display text-xs font-extrabold text-main">
                    {raid.name}
                  </span>

                  <span className="hidden shrink-0 items-center rounded-none border border-[var(--px-blue)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--px-blue-text)] xl:inline-flex">
                    {weakShort} x{raid.weaknessMultiplier.toFixed(2)}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="rpg-bar-track h-2.5 w-24 rounded-none sm:w-32">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${hpPct}%`,
                          backgroundColor: isDefeated
                            ? 'var(--border-strong)'
                            : isEnraged
                              ? '#d94154'
                              : 'var(--px-red)',
                        }}
                      />
                    </div>
                    <span
                      className={`font-mono text-[11px] font-extrabold ${
                        isDefeated
                          ? 'text-[var(--px-plum-text)]'
                          : isEnraged
                            ? 'text-[var(--px-red-text)]'
                            : 'text-main'
                      }`}
                    >
                      {isDefeated ? `OVERKILL +${raid.overkillDamage}` : `${hpPct}%`}
                    </span>
                  </div>

                  <span className="hidden font-mono text-[11px] text-sub md:inline-block">
                    Còn {days}n {hours}g
                  </span>

                  {unclaimedCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-none border-2 border-[var(--px-gold)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[var(--px-gold-text)]">
                      <PxTreasureChest state="ready" size={14} />
                      <span>{unclaimedCount} Rương!</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenRaidArena?.()}
                    className={`${unclaimedCount > 0 ? 'btn-primary' : 'btn-secondary'} px-2.5 py-1 font-mono text-xs font-bold`}
                  >
                    Raid →
                  </button>
                </div>
              </div>
            </section>
          );
        })()}

      {/* 3) Flush 2-Page Tracker Workspace (Left 7 cols + Right 5 cols) */}
      <div className="grid grid-cols-1 divide-y-2 lg:grid-cols-12 lg:divide-x-2 lg:divide-y-0 rpg-divider">
        {/* Left Page (7 cols): Live Session Tracker + Quick-Add + AI Gợi Ý Điểm + Checklist */}
        <section className="lg:col-span-7">
          {/* Live Flexible Task Session Tracker Strip */}
          {activeSession && (
            <div className="relative border-b-2 border-[var(--px-gold)] bg-[var(--bg-surface-2)] px-4 py-3 sm:px-5">
              <PixelRivets />
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-inset inline-flex items-center gap-1 rounded-none border-[var(--px-gold)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--px-gold-text)]">
                      <PxClock size={12} />
                      {activeSession.isPaused ? 'TẠM DỪNG' : 'ĐANG CHẠY'}
                    </span>
                    <span className="truncate font-display text-xs font-extrabold text-main">
                      {activeSession.title}
                    </span>
                    {(activeSession.verifiedFocusSeconds ?? 0) >= 60 && (
                      <span
                        className={`rounded-none border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          (activeSession.focusIntegrityPct ?? 100) >= 80
                            ? 'border-[var(--px-green)] bg-[var(--bg-subtle)] text-[var(--px-green-text)]'
                            : 'border-[var(--px-gold)] bg-[var(--bg-subtle)] text-[var(--px-gold-text)]'
                        }`}
                        title="Chất lượng tập trung đo bởi Windows Activity Tracker"
                      >
                        Tập trung {activeSession.focusIntegrityPct ?? 100}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-sub">
                    <span>
                      {activeSession.actualStartTime
                        ? `Bắt đầu ${activeSession.actualStartTime}`
                        : 'Đang tính giờ'}
                    </span>
                    <span>·</span>
                    <span>Dự kiến {activeSession.durationMinutes}p</span>
                    <span>·</span>
                    <span
                      className={
                        activeSession.isPaused
                          ? 'text-[var(--px-gold-text)]'
                          : activeOverMins > 5
                            ? 'font-bold text-[var(--px-red-text)]'
                            : activeOverMins >= 0
                              ? 'font-bold text-[var(--px-green-text)]'
                              : 'font-bold text-[var(--px-blue-text)]'
                      }
                    >
                      {activeSession.isPaused
                        ? 'Đang tạm dừng'
                        : activeOverMins > 0
                          ? `Vượt dự kiến +${activeOverMins}p`
                          : activeOverMins === 0
                            ? 'Đúng tiến độ'
                            : 'Sớm hơn dự kiến'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-inset rounded-none border-[var(--px-gold)] px-2.5 py-1 font-mono text-sm font-extrabold text-[var(--px-gold-text)]">
                    {formatHms(activeElapsedSec)}
                  </span>

                  {activeSession.isPaused
                    ? onStartQuest && (
                        <button
                          type="button"
                          disabled={sessionBusyId === activeSession.id}
                          onClick={async () => {
                            setSessionBusyId(activeSession.id);
                            try {
                              await onStartQuest(activeSession.id);
                            } finally {
                              setSessionBusyId(null);
                            }
                          }}
                          className="btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs"
                        >
                          <PxPlay size={13} className="text-[var(--px-green-text)]" />
                          <span>Tiếp tục</span>
                        </button>
                      )
                    : onPauseQuest && (
                        <button
                          type="button"
                          disabled={sessionBusyId === activeSession.id}
                          onClick={async () => {
                            setSessionBusyId(activeSession.id);
                            try {
                              await onPauseQuest(activeSession.id);
                            } finally {
                              setSessionBusyId(null);
                            }
                          }}
                          className="btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs"
                        >
                          <PxPause size={13} className="text-[var(--px-gold-text)]" />
                          <span>Tạm dừng</span>
                        </button>
                      )}

                  <button
                    type="button"
                    onClick={() => {
                      if (activeSession.requiresProof) {
                        setShowSessionProof((v) => !v);
                      } else {
                        void onCompleteQuest(activeSession.id);
                      }
                    }}
                    className="btn-emerald flex items-center gap-1 px-3 py-1.5 text-xs"
                  >
                    <PxCheck size={14} />
                    <span>Hoàn thành</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xóa phiên đang chạy "${activeSession.title}"?`)) {
                        void onDeleteQuest(activeSession.id);
                      }
                    }}
                    className="btn-secondary p-1.5 text-dim hover:text-[var(--px-red-text)]"
                    title="Xóa nhiệm vụ đang chạy"
                    aria-label={`Xóa ${activeSession.title}`}
                  >
                    <PxTrash size={14} />
                  </button>
                </div>
              </div>

              <div className="rpg-bar-track mt-2 h-2.5 w-full rounded-none">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${activeElapsedPct}%`,
                    backgroundColor: activeElapsedPct >= 100 ? 'var(--px-green)' : 'var(--px-gold)',
                  }}
                />
              </div>

              {showSessionProof && activeSession.requiresProof && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <input
                    value={sessionProofText}
                    onChange={(e) => setSessionProofText(e.target.value)}
                    placeholder="Ghi ngắn gọn kết quả thực tế của phiên làm việc..."
                    className="min-w-[200px] flex-1 rounded-none px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await onCompleteQuest(activeSession.id, sessionProofText);
                      setSessionProofText('');
                      setShowSessionProof(false);
                    }}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    Xác nhận hoàn thành
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Smart Unlogged PC Focus Banner */}
          {assistantOverview &&
            assistantOverview.activity.uncreditedFocusMinutes >= 15 &&
            assistantOverview.activity.suggestedFocusSession &&
            onConvertFocusToQuest && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--px-green)] bg-[var(--bg-surface-2)] px-4 py-2 text-xs sm:px-5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <PxBolt size={14} className="text-[var(--px-green-text)]" />
                  <span className="truncate text-main">
                    PC ghi nhận{' '}
                    <strong className="font-mono text-[var(--px-green-text)]">
                      {assistantOverview.activity.uncreditedFocusMinutes}p
                    </strong>{' '}
                    tập trung ({assistantOverview.activity.suggestedFocusSession.topApp})
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
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
                    className="btn-emerald flex items-center gap-1 px-2.5 py-1 text-[11px]"
                  >
                    {convertingFocus ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <PxCheck size={12} />
                    )}
                    <span>Ghi nhận thành Quest</span>
                  </button>
                  {onOpenAssistant && (
                    <button
                      type="button"
                      onClick={onOpenAssistant}
                      className="btn-secondary px-2 py-1 text-[11px]"
                    >
                      Chi tiết
                    </button>
                  )}
                </div>
              </div>
            )}

          {/* Instant 1-Line Quick-Add Bar + AI Gợi Ý Điểm + Stat Guide Reference */}
          <form onSubmit={handleQuickAdd} className="border-b-2 p-3.5 studio-subtle sm:px-5 rpg-divider">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={quickInputRef}
                value={quickTitle}
                onChange={(e) => {
                  setQuickTitle(e.target.value);
                  if (draftAnalysis) setDraftAnalysis(null);
                }}
                placeholder="Thêm việc hôm nay... (Enter)"
                className="min-w-[190px] flex-1 rounded-none px-3 py-2 text-xs sm:text-sm"
              />

              <div className="px-inset flex items-center rounded-none p-0.5">
                {[25, 45, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setQuickDur(d)}
                    className={`rounded-none px-2 py-1 font-mono text-[11px] font-bold transition ${
                      quickDur === d ? 'bg-[var(--px-gold)] text-[#140e04]' : 'text-sub hover:text-main'
                    }`}
                  >
                    {d}p
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={quickAdding || !quickTitle.trim()}
                className="btn-primary flex items-center gap-1 px-3 py-2 text-xs"
              >
                {quickAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PxPlus size={14} />}
                <span>Thêm</span>
              </button>

              <button
                type="button"
                disabled={analyzingDraft || !quickTitle.trim()}
                onClick={() => void handleAnalyzeDraft()}
                className="btn-arcane flex items-center gap-1 px-3 py-2 text-xs"
                title="AI tự phân tích việc này cộng chỉ số nào, kỹ năng nào, bao nhiêu XP/SP và tìm khung giờ trống"
              >
                {analyzingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PxSparkle size={14} />}
                <span>AI Gợi Ý Điểm</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedAdd((v) => !v)}
                className={`btn-secondary px-2.5 py-2 text-[11px] ${
                  showAdvancedAdd ? 'border-[var(--px-gold)] text-[var(--px-gold-text)]' : ''
                }`}
              >
                Nâng cao
              </button>
            </div>

            {/* 1-Line Stat Guide Reference */}
            <p className="mt-2 text-[11px] text-dim">
              <strong>Gợi ý tăng điểm:</strong> INT Tư duy/Code · PER Đọc/Ngoại ngữ · AGI Focus/Lịch · STR Thể dục/Vận động · VIT Ngủ/Hồi phục · CHA Giao tiếp/Nhóm
            </p>

            {/* AI Draft Suggestion Preview Strip */}
            {draftAnalysis && (
              <div className="px-inset mt-2.5 flex flex-col gap-2 rounded-none border-2 border-[var(--px-plum)] p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-main">
                    Gợi ý: <span className="text-[var(--px-gold-text)]">+{draftAnalysis.primaryStat}</span>
                    {draftAnalysis.secondaryStat ? (
                      <span className="text-[var(--px-blue-text)]"> · +{draftAnalysis.secondaryStat}</span>
                    ) : null}
                    {draftAnalysis.skillName ? (
                      <span> · Skill: <strong>{draftAnalysis.skillName}</strong></span>
                    ) : null}{' '}
                    · +{draftAnalysis.xpReward} XP · +{draftAnalysis.spReward} SP · Slot{' '}
                    <span className="font-mono">{draftAnalysis.scheduledSlot}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-sub">&ldquo;{draftAnalysis.statReason}&rdquo;</p>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-sub">
                    <input
                      type="checkbox"
                      checked={syncDraftToTimetable}
                      onChange={(e) => setSyncDraftToTimetable(e.target.checked)}
                    />
                    <span>Gắn lên Lịch</span>
                  </label>
                  <button
                    type="button"
                    disabled={quickAdding}
                    onClick={() => void handleApplyDraftAnalysis()}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    Áp dụng &amp; Thêm
                  </button>
                </div>
              </div>
            )}

            {showAdvancedAdd && (
              <div className="mt-2.5 grid grid-cols-1 gap-2 border-t pt-2.5 sm:grid-cols-4 rpg-divider">
                <select
                  value={quickType}
                  onChange={(e) => setQuickType(e.target.value as QuestType)}
                  className="rounded-none px-2.5 py-1.5 text-xs"
                >
                  <option value="daily">Daily (-12 HP)</option>
                  <option value="main">Main (-18 HP)</option>
                  <option value="side">Side (-8 HP)</option>
                  <option value="recovery">Recovery (0 HP)</option>
                </select>
                <select
                  value={quickStat}
                  onChange={(e) => setQuickStat(e.target.value as AttributeKey)}
                  className="rounded-none px-2.5 py-1.5 text-xs"
                >
                  <option value="INT">INT · Trí tuệ</option>
                  <option value="PER">PER · Nhận thức</option>
                  <option value="AGI">AGI · Tốc độ</option>
                  <option value="STR">STR · Thể lực</option>
                  <option value="VIT">VIT · Hồi phục</option>
                  <option value="CHA">CHA · Giao tiếp</option>
                </select>
                <input
                  value={quickSlot}
                  onChange={(e) => setQuickSlot(e.target.value)}
                  placeholder="Khung giờ (VD: 14:00 - 15:00)"
                  className="rounded-none px-2.5 py-1.5 text-xs"
                />
                <label className="flex cursor-pointer items-center gap-1.5 px-2 text-xs text-sub">
                  <input
                    type="checkbox"
                    checked={quickRequireProof}
                    onChange={(e) => setQuickRequireProof(e.target.checked)}
                  />
                  <span>Cần ghi nhận kết quả</span>
                </label>
                <input
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  placeholder="Mô tả chi tiết (tùy chọn)..."
                  className="rounded-none sm:col-span-4 px-2.5 py-1.5 text-xs"
                />
              </div>
            )}
          </form>

          {/* Filter Header + Collapsible Scientific Protocols Drawer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 px-4 py-2.5 sm:px-5 rpg-divider">
            <div className="px-inset flex items-center gap-1 rounded-none p-0.5">
              <button
                type="button"
                onClick={() => setQuestFilter('pending')}
                className={`rounded-none px-3 py-1 text-xs font-bold transition ${
                  questFilter === 'pending' ? 'bg-[var(--px-gold)] text-[#140e04]' : 'text-sub hover:text-main'
                }`}
              >
                Cần làm ({pendingQuests.length})
              </button>
              <button
                type="button"
                onClick={() => setQuestFilter('completed')}
                className={`rounded-none px-3 py-1 text-xs font-bold transition ${
                  questFilter === 'completed' ? 'bg-[var(--px-gold)] text-[#140e04]' : 'text-sub hover:text-main'
                }`}
              >
                Đã xong ({completedQuests.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowProtocolsLibrary((v) => !v)}
              className={`btn-secondary flex items-center gap-1.5 px-2.5 py-1 text-xs ${
                showProtocolsLibrary ? 'border-[var(--px-plum)] text-[var(--px-plum-text)]' : ''
              }`}
            >
              <PxBook size={14} className="text-[var(--px-plum-text)]" />
              <span>Mẫu khoa học</span>
            </button>
          </div>

          {showProtocolsLibrary && (
            <div className="border-b-2 p-4 studio-subtle rpg-divider">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SCIENTIFIC_PROTOCOLS.map((proto) => {
                  const busy = creatingProtocolId === proto.id;
                  return (
                    <div key={proto.id} className="rpg-pane relative flex flex-col justify-between p-3">
                      <PixelRivets />
                      <div>
                        <div className="font-mono text-[10px] font-semibold text-[var(--px-plum-text)]">
                          {proto.researcherTag}
                        </div>
                        <h4 className="mt-0.5 font-display text-xs font-bold text-main">{proto.title}</h4>
                        <p className="mt-1 text-[11px] leading-relaxed text-sub">{proto.description}</p>
                      </div>
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
                              requiresProof: false,
                            });
                          } finally {
                            setCreatingProtocolId(null);
                          }
                        }}
                        className="btn-secondary mt-2.5 flex w-full items-center justify-center gap-1 py-1 text-[11px] font-semibold text-[var(--px-gold-text)]"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <PxPlus size={12} />}
                        <span>Thêm vào hôm nay</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ultra-Clean Scannable Checklist */}
          {questFilter === 'pending' ? (
            pendingQuests.length === 0 ? (
              <div className="p-10 text-center">
                <PxSparkle size={28} className="mx-auto text-[var(--px-gold-text)]" />
                <p className="mt-2 font-display text-sm font-bold text-main">
                  Chưa có việc cần làm hôm nay
                </p>
                <p className="mt-1 text-xs text-sub">
                  Gõ vào ô <strong>&ldquo;Thêm nhanh việc cần làm...&rdquo;</strong> phía trên hoặc bấm <strong>&ldquo;AI Lập Kế Hoạch&rdquo;</strong>.
                </p>
              </div>
            ) : (
              <div className="divide-y-2 rpg-divider">
                {pendingQuests.map((q) => {
                  const pill = TYPE_PILLS[q.type] || TYPE_PILLS.main;
                  const hpStake = getQuestHpStake(q, player.plannedRestMode);
                  const spReward = q.type === 'main' || q.type === 'hidden' ? 2 : 1;
                  const isExpanded = expandedQuestId === q.id;
                  const isCompleting = completingId === q.id;
                  const isRejecting = rejectingId === q.id;
                  const isEditing = editingQuestId === q.id;
                  const isRunning = Boolean(q.startedAt && !q.isPaused);
                  const isPaused = Boolean(q.isPaused);
                  const elapsedSec = getQuestElapsedSeconds(q, nowMs);
                  const linkedSkill = q.skillId ? skills.find((s) => s.id === q.skillId) : undefined;

                  return (
                    <div
                      key={q.id}
                      className={`px-4 py-3 transition hover:bg-[var(--bg-surface-2)] sm:px-5 ${
                        isRunning ? 'bg-[var(--bg-surface-2)]' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:flex-nowrap">
                        {/* Left: 1-Click Checkoff + 2p Micro-Start + Title + Compact Meta */}
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (q.requiresProof) {
                                setCompletingId(isCompleting ? null : q.id);
                                setProofText('');
                              } else {
                                void onCompleteQuest(q.id);
                              }
                            }}
                            className="btn-emerald flex h-7 w-7 shrink-0 items-center justify-center p-0 text-xs"
                            title={q.requiresProof ? 'Ghi nhận & Hoàn thành' : 'Hoàn thành ngay (1-Click)'}
                            aria-label={`Hoàn thành ${q.title}`}
                          >
                            <PxCheck size={14} />
                          </button>

                          {q.microStartDone ? (
                            <span
                              className="px-inset inline-flex shrink-0 items-center gap-0.5 rounded-none border-[var(--px-gold)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--px-gold-text)]"
                              title="Đã khởi động 2 phút (+10 XP)"
                            >
                              <PxBolt size={11} />
                              2p
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={microStartingId === q.id}
                              onClick={async () => {
                                setMicroStartingId(q.id);
                                try {
                                  await onMicroStartQuest(q.id);
                                } finally {
                                  setMicroStartingId(null);
                                }
                              }}
                              className="btn-secondary inline-flex shrink-0 items-center gap-0.5 border-[var(--px-gold)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--px-gold-text)]"
                              title="Atomic Habits: Khởi động 2 phút (+10 XP)"
                            >
                              {microStartingId === q.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <PxBolt size={11} className="text-[var(--px-gold-text)]" />
                              )}
                              <span>2p</span>
                            </button>
                          )}

                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <div className="flex flex-wrap gap-2">
                                <input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="min-w-[160px] flex-1 rounded-none px-2 py-1 text-xs"
                                />
                                <input
                                  value={editSlot}
                                  onChange={(e) => setEditSlot(e.target.value)}
                                  className="w-28 rounded-none px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onUpdateQuest(q.id, { title: editTitle, scheduledSlot: editSlot });
                                    setEditingQuestId(null);
                                  }}
                                  className="btn-primary px-2.5 py-1 text-xs"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingQuestId(null)}
                                  className="btn-secondary px-2.5 py-1 text-xs"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="truncate font-display text-sm font-bold text-main">
                                    {q.title}
                                  </h4>
                                  {(isRunning || isPaused) && (
                                    <span
                                      className={`rounded-none border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                        isRunning
                                          ? 'border-[var(--px-gold)] bg-[var(--bg-subtle)] text-[var(--px-gold-text)]'
                                          : 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-sub'
                                      }`}
                                    >
                                      {isRunning ? `Đang chạy ${formatMsShort(elapsedSec)}` : `Tạm dừng ${formatMsShort(elapsedSec)}`}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-sub">
                                  <span className="flex items-center gap-1">
                                    <PxClock size={12} className="text-[var(--px-gold-text)]" />
                                    {q.scheduledSlot} ({q.durationMinutes}p)
                                  </span>
                                  <span>·</span>
                                  <span className={`rounded-none border px-1.5 py-0 font-sans text-[10px] font-bold ${pill.cls}`}>
                                    {pill.label}
                                  </span>
                                  <span>·</span>
                                  <span className="font-semibold text-[var(--px-green-text)]">
                                    +{q.xpReward} XP · +{spReward} SP
                                  </span>
                                  <span>·</span>
                                  <span
                                    className={
                                      hpStake === 0
                                        ? 'text-[var(--px-green-text)]'
                                        : 'text-[var(--px-red-text)]'
                                    }
                                  >
                                    {hpStake === 0 ? '0 HP' : `-${hpStake} HP`}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right: [▶ Bắt đầu / ⏸ Tạm dừng] + [Focus] + [Chi tiết ▾] */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {onStartQuest && !isRunning && (
                            <button
                              type="button"
                              disabled={sessionBusyId === q.id}
                              onClick={async () => {
                                setSessionBusyId(q.id);
                                try {
                                  await onStartQuest(q.id);
                                } finally {
                                  setSessionBusyId(null);
                                }
                              }}
                              className="btn-primary flex items-center gap-1 px-2.5 py-1 text-xs"
                              title="Bắt đầu tính giờ phiên làm việc"
                            >
                              <PxPlay size={12} />
                              <span>{isPaused ? 'Tiếp tục' : 'Bắt đầu'}</span>
                            </button>
                          )}

                          {onPauseQuest && isRunning && (
                            <button
                              type="button"
                              disabled={sessionBusyId === q.id}
                              onClick={async () => {
                                setSessionBusyId(q.id);
                                try {
                                  await onPauseQuest(q.id);
                                } finally {
                                  setSessionBusyId(null);
                                }
                              }}
                              className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-xs"
                            >
                              <PxPause size={12} className="text-[var(--px-gold-text)]" />
                              <span>Tạm dừng</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onEnterDungeon(q)}
                            className="btn-secondary flex items-center gap-1 px-2 py-1 text-xs"
                            title="Mở Focus Mode (+25% XP & +2 SP)"
                          >
                            <PxSword size={13} />
                            <span className="hidden sm:inline">Focus</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedQuestId(isExpanded ? null : q.id)}
                            className="btn-secondary flex items-center gap-1 px-2 py-1 text-xs text-sub"
                          >
                            <span>Chi tiết</span>
                            <PxChevron size={12} dir={isExpanded ? 'up' : 'down'} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                (isRunning || isPaused) &&
                                !window.confirm(`Nhiệm vụ "${q.title}" đang bấm giờ dở. Bạn chắc chắn muốn xóa?`)
                              ) {
                                return;
                              }
                              void onDeleteQuest(q.id);
                            }}
                            className="btn-secondary p-1.5 text-dim hover:text-[var(--px-red-text)]"
                            title="Xóa nhiệm vụ"
                            aria-label={`Xóa ${q.title}`}
                          >
                            <PxTrash size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Inline Proof-of-Work bar (only if requiresProof) */}
                      {isCompleting && (
                        <div className="px-inset mt-2.5 flex flex-wrap gap-2 rounded-none p-2.5">
                          <input
                            value={proofText}
                            onChange={(e) => setProofText(e.target.value)}
                            placeholder="Ghi ngắn gọn kết quả vừa hoàn thành..."
                            className="min-w-[200px] flex-1 rounded-none px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await onCompleteQuest(q.id, proofText);
                              setCompletingId(null);
                              setProofText('');
                            }}
                            className="btn-primary px-3.5 py-1.5 text-xs"
                          >
                            Xác nhận
                          </button>
                        </div>
                      )}

                      {/* Collapsed Details Panel */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2.5 border-t-2 pt-3 text-xs rpg-divider">
                          <div className="flex flex-wrap items-center gap-2">
                            {q.scientificProtocol && (
                              <span className="inline-flex items-center gap-1 rounded-none border-2 border-[var(--px-plum)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--px-plum-text)]">
                                <PxBook size={12} />
                                {q.scientificProtocol}
                              </span>
                            )}
                            {linkedSkill && (
                              <span className="inline-flex items-center gap-1 rounded-none border-2 border-[var(--px-blue)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--px-blue-text)]">
                                <PxBolt size={12} />
                                Skill: {linkedSkill.name}
                              </span>
                            )}
                          </div>

                          {q.description && <p className="text-sub">{q.description}</p>}

                          {q.ifThenTrigger && (
                            <div className="px-inset flex items-start gap-1.5 rounded-none border-[var(--px-blue)] px-2.5 py-1.5 text-main">
                              <PxShield size={14} className="mt-0.5 text-[var(--px-blue-text)]" />
                              <span>
                                <strong>Kế hoạch Nếu–Thì:</strong> {q.ifThenTrigger}
                              </span>
                            </div>
                          )}

                          {q.subtasks.length > 0 && (
                            <div className="space-y-1.5 pl-1">
                              {q.subtasks.map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => onToggleSubtask(q.id, st.id)}
                                  className="flex w-full items-center gap-2 text-left text-xs text-sub hover:text-main"
                                >
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center border-2 border-[var(--border-ink)] rounded-none ${
                                      st.done
                                        ? 'bg-[var(--px-green)] text-white'
                                        : 'bg-[var(--bg-subtle)]'
                                    }`}
                                  >
                                    {st.done && <PxCheck size={10} />}
                                  </span>
                                  <span className={st.done ? 'line-through opacity-60' : ''}>{st.label}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="px-inset rounded-none p-2.5 text-[11px] text-sub">
                            <p>
                              <strong>Phương pháp:</strong> {q.learningMethod}
                            </p>
                            <p className="mt-1">
                              <strong>Lý do AI chọn:</strong> {q.reasoning}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQuestId(q.id);
                                setEditTitle(q.title);
                                setEditSlot(q.scheduledSlot);
                              }}
                              className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-[11px]"
                            >
                              <PxEdit size={12} />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectingId(isRejecting ? null : q.id)}
                              className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-[11px] text-[var(--px-red-text)]"
                            >
                              <PxClose size={12} />
                              <span>Đổi bài</span>
                            </button>

                            {onFailQuest && (
                              <button
                                type="button"
                                disabled={failingId === q.id}
                                onClick={async () => {
                                  setFailingId(q.id);
                                  try {
                                    await onFailQuest(q.id);
                                  } finally {
                                    setFailingId(null);
                                  }
                                }}
                                className="btn-crimson flex items-center gap-1 px-2.5 py-1 text-[11px]"
                              >
                                {failingId === q.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <PxWarn size={12} danger />
                                )}
                                <span>Bỏ lỡ (-HP)</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onDeleteQuest(q.id)}
                              className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] text-dim hover:text-[var(--px-red-text)]"
                            >
                              <PxTrash size={13} />
                              <span>Xóa</span>
                            </button>
                          </div>

                          {isRejecting && (
                            <div className="px-inset flex flex-wrap items-center gap-1.5 rounded-none p-2.5">
                              <span className="text-[11px] text-sub">Lý do đổi:</span>
                              {[
                                { reason: 'low_energy' as RejectionReason, label: 'Đang mệt' },
                                { reason: 'no_time' as RejectionReason, label: 'Thiếu thời gian' },
                                { reason: 'too_hard' as RejectionReason, label: 'Quá nặng' },
                                { reason: 'not_relevant' as RejectionReason, label: 'Đổi hướng khác' },
                              ].map((opt) => (
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
            )
          ) : completedQuests.length === 0 ? (
            <div className="p-10 text-center text-xs text-dim">
              Chưa có nhiệm vụ nào hoàn thành hôm nay.
            </div>
          ) : (
            <div className="divide-y-2 rpg-divider">
              {completedQuests.map((cq) => (
                <div key={cq.id} className="flex items-start justify-between gap-3 px-4 py-3 text-xs sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-sub line-through">{cq.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-dim">
                      {cq.actualDurationMinutes ? `Thực làm ${cq.actualDurationMinutes}p` : `Dự kiến ${cq.durationMinutes}p`}
                      {cq.actualStartTime && cq.actualEndTime ? ` (${cq.actualStartTime}–${cq.actualEndTime})` : ''}
                    </p>
                    {cq.proofNote && (
                      <p className="mt-1 text-[11px] text-dim">Ghi nhận: {cq.proofNote}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono font-semibold text-[var(--px-green-text)]">
                      +{cq.xpReward} XP
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Xóa bản ghi "${cq.title}" khỏi danh sách?`)) {
                          void onDeleteQuest(cq.id);
                        }
                      }}
                      className="btn-secondary p-1 text-dim hover:text-[var(--px-red-text)]"
                      title="Xóa nhiệm vụ đã hoàn thành"
                      aria-label={`Xóa ${cq.title}`}
                    >
                      <PxTrash size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Page (5 cols): 3-Tab RPG Tome */}
        <section className="relative flex flex-col lg:col-span-5">
          <PixelRivets />
          <div className="border-b-2 px-4 pt-3 rpg-divider studio-subtle">
            <div className="grid grid-cols-3 gap-1">
              {[
                { key: 'advisor' as const, label: 'Cố vấn AI' },
                { key: 'rhythm' as const, label: 'Nhịp 24h' },
                { key: 'reflect' as const, label: 'Phản tư' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onChangeUtilityTab?.(t.key)}
                  className={`py-2 text-xs transition ${
                    utilityTab === t.key ? 'rpg-tab-active' : 'rpg-tab'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {utilityTab === 'advisor' && (
            <div className="flex flex-1 flex-col p-4">
              {/* Compact Advisor Header */}
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PxAutomaton size={16} className="text-[var(--px-gold-text)]" />
                  <h3 className="font-display text-xs font-bold text-main">Cố vấn AI</h3>
                  <span className="px-inset rounded-none px-1.5 py-0.5 font-mono text-[10px] text-dim">
                    {isLiveAi ? aiSettings.model : 'Offline'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={creatingThread}
                  onClick={() => setShowScopePicker((v) => !v)}
                  className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-[11px]"
                >
                  {creatingThread ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PxPlus size={12} className="text-[var(--px-gold-text)]" />
                  )}
                  <span>Context mới</span>
                </button>
              </div>

              {/* 1-Row Context Scope Picker */}
              {showScopePicker && (
                <div className="px-inset mb-2.5 flex flex-wrap items-center gap-1.5 rounded-none p-2">
                  <span className="text-[10px] font-semibold text-dim">Chủ đề:</span>
                  {CHAT_SCOPES.map((sc) => (
                    <button
                      key={sc.key}
                      type="button"
                      disabled={creatingThread}
                      onClick={async () => {
                        setNewScope(sc.key);
                        setShowScopePicker(false);
                        if (onCreateChatThread) {
                          setCreatingThread(true);
                          try {
                            await onCreateChatThread(sc.key);
                          } finally {
                            setCreatingThread(false);
                          }
                        }
                      }}
                      className="btn-secondary flex items-center gap-1.5 px-2 py-1 text-[11px]"
                    >
                      <span className={`h-2 w-2 rounded-none ${sc.dotCls}`} />
                      <span>{sc.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Persistent Context Thread Tabs */}
              {chatThreads.length > 0 && (
                <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
                  {chatThreads.map((th) => {
                    const isSelected = activeThread?.id === th.id;
                    const scopeMeta =
                      CHAT_SCOPES.find((s) => s.key === th.contextScope) || CHAT_SCOPES[0];
                    const threadBusy = Boolean(pendingChatKeys[th.id]);
                    return (
                      <div
                        key={th.id}
                        className={`group flex shrink-0 items-center gap-1.5 rounded-none border-2 px-2 py-1 text-[11px] transition ${
                          isSelected
                            ? 'border-[var(--px-gold)] bg-[var(--bg-surface-2)] font-bold text-main'
                            : 'border-[var(--border-ink)] studio-subtle text-sub hover:border-[var(--px-gold)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectChatThread?.(th.id)}
                          className="flex items-center gap-1.5 text-left"
                          title={`${scopeMeta.label}: ${th.title}`}
                        >
                          {threadBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin text-[var(--px-gold-text)]" />
                          ) : (
                            <span className={`h-2 w-2 shrink-0 rounded-none ${scopeMeta.dotCls}`} />
                          )}
                          <span className="max-w-[125px] truncate">{th.title}</span>
                        </button>
                        {onDeleteChatThread && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                th.messages.length > 0 &&
                                !window.confirm(`Xóa cuộc trò chuyện "${th.title}"?`)
                              ) {
                                return;
                              }
                              void onDeleteChatThread(th.id);
                            }}
                            className="p-0.5 text-dim opacity-70 hover:text-[var(--px-red-text)] group-hover:opacity-100"
                            title="Xóa context này"
                            aria-label={`Xóa ${th.title}`}
                          >
                            <PxClose size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Scrollable Messages Viewport */}
              <div className="mb-3 min-h-[260px] max-h-[460px] flex-1 space-y-2.5 overflow-y-auto pr-1 text-xs">
                {visibleMessages.length === 0 && !isCurrentThreadPending && (
                  <div className="px-inset space-y-2 rounded-none p-3 text-sub">
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_AI_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => sendConsultPrompt(chip)}
                          className="btn-secondary px-2.5 py-1 text-left text-[11px]"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {visibleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-none p-3 ${
                      msg.role === 'user'
                        ? 'ml-6 border-2 border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-main'
                        : 'rpg-pane relative mr-2 text-main'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-main">
                        {msg.content}
                      </p>
                    ) : (
                      <MarkdownContent content={msg.content} />
                    )}

                    {msg.suggestedQuests && msg.suggestedQuests.length > 0 && (
                      <div className="mt-2.5 space-y-2 border-t-2 pt-2 rpg-divider">
                        {msg.suggestedQuests.map((sq, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{sq.title}</p>
                              <p className="text-[11px] text-dim">
                                {sq.durationMinutes}p · {sq.learningMethod}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onCreateCustomQuest({
                                  title: sq.title,
                                  description: sq.description,
                                  type: sq.type,
                                  rank: sq.rank,
                                  durationMinutes: sq.durationMinutes,
                                  learningMethod: sq.learningMethod,
                                  primaryStat: sq.primaryStat,
                                  requiresProof: false,
                                })
                              }
                              className="btn-primary shrink-0 px-2.5 py-1 text-[11px]"
                            >
                              + Thêm Quest
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isCurrentThreadPending && (
                  <div className="flex items-center gap-2 px-1 text-xs text-sub">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--px-gold-text)]" />
                    <span>Đang phân tích và soạn phản hồi...</span>
                  </div>
                )}

                {currentThreadError && (
                  <div className="px-inset flex items-center gap-2 rounded-none border-[var(--px-red)] px-2.5 py-2 text-[11px] text-[var(--px-red-text)]">
                    <PxWarn size={14} danger />
                    <span>{currentThreadError}</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendConsultPrompt(currentDraft);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  rows={1}
                  value={currentDraft}
                  onChange={(e) => onChangeChatDraft?.(currentThreadKey, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendConsultPrompt(currentDraft);
                    }
                  }}
                  placeholder={
                    CHAT_SCOPES.find((s) => s.key === currentScope)?.placeholder ||
                    'Nhắn tin hỏi cố vấn AI...'
                  }
                  className="max-h-28 min-h-[38px] flex-1 resize-y rounded-none px-3 py-2 text-xs leading-snug"
                />
                <button
                  type="submit"
                  disabled={isCurrentThreadPending || !currentDraft.trim()}
                  className="btn-primary shrink-0 px-3.5 py-2.5"
                  aria-label="Gửi tin nhắn"
                >
                  <PxChevron size={14} dir="right" />
                </button>
              </form>
            </div>
          )}

          {utilityTab === 'rhythm' && (
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--px-gold-text)]">
                  Phân bổ 24 giờ · {todayAnalysis.dayLabel}
                </p>
                <DayAllocationDonut analysis={todayAnalysis} />
              </div>

              <div className="border-t-2 pt-3 rpg-divider">
                <p className="mb-2 font-display text-xs font-bold text-main">
                  Khung giờ trống khả dụng hôm nay
                </p>
                {todayAnalysis.freeWindows.length === 0 ? (
                  <p className="text-xs text-dim">Hôm nay lịch cố định đã kín, ưu tiên nghỉ ngơi &amp; micro-habit.</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {todayAnalysis.freeWindows.map((fw, idx) => (
                      <div key={idx} className="px-inset flex items-center justify-between rounded-none px-2.5 py-1.5">
                        <span className="font-mono font-semibold text-main">
                          {fw.startTime} – {fw.endTime}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--px-green-text)]">
                          {fw.durationMinutes}p · {fw.windowQuality.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {deliberation && (
                <div className="border-t-2 pt-3 text-xs rpg-divider">
                  <div className="flex items-center gap-1.5 font-semibold text-main">
                    <PxAutomaton size={14} className="text-[var(--px-gold-text)]" />
                    <span>Chỉ thị Hội đồng AI</span>
                  </div>
                  <p className="mt-1 text-sub">{deliberation.systemDirective}</p>
                  {deliberation.agentNotes.length > 0 && (
                    <div className="mt-2 space-y-1 text-[11px] text-sub">
                      {deliberation.agentNotes.map((n, i) => (
                        <div key={i}>
                          <span className="font-mono font-semibold text-[var(--px-gold-text)]">
                            [{n.agent}]
                          </span>{' '}
                          {n.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {utilityTab === 'reflect' && (
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <PxScroll size={15} className="text-[var(--px-gold-text)]" />
                  <h3 className="font-display text-xs font-bold text-main">
                    Nhật ký Phản tư 1 dòng hôm nay
                  </h3>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!reflectionDraft.trim() || savingReflection) return;
                    setSavingReflection(true);
                    try {
                      await onReflect({ reflectionNote: reflectionDraft.trim() });
                    } finally {
                      setSavingReflection(false);
                    }
                  }}
                  className="space-y-2"
                >
                  <input
                    value={reflectionDraft}
                    onChange={(e) => setReflectionDraft(e.target.value)}
                    placeholder="Điều gì tạo đà tốt nhất hôm nay hoặc cần điều chỉnh?"
                    className="w-full rounded-none px-3 py-2 text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-dim">
                      {player.plannedRestMode ? 'Đang bật Nghỉ Chủ Động (Grace Day)' : 'Chế độ bình thường'}
                    </span>
                    <button
                      type="submit"
                      disabled={savingReflection || !reflectionDraft.trim()}
                      className="btn-primary flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
                    >
                      {savingReflection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PxCheck size={14} />}
                      <span>Lưu Reflection</span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="border-t-2 pt-3 rpg-divider">
                <h4 className="mb-2 font-display text-xs font-bold text-main">
                  Ghi nhớ thích nghi gần đây của AI
                </h4>
                {memoryLogs.length === 0 ? (
                  <p className="text-xs text-dim">Chưa có bản ghi nhớ nào.</p>
                ) : (
                  <div className="max-h-60 divide-y-2 overflow-y-auto rpg-divider text-xs">
                    {memoryLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="py-2">
                        <div className="flex items-center justify-between font-mono text-[10px] text-dim">
                          <span className="font-semibold text-[var(--px-gold-text)]">
                            [{log.agent}]
                          </span>
                          <span>{log.eventType}</span>
                        </div>
                        <p className="mt-0.5 text-main">{log.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
