import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CalendarCheck,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  Edit3,
  FlaskConical,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Swords,
  Timer,
  Trash2,
  Wand2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  AIChatMessage,
  AIChatThread,
  AISettings,
  AgentMemoryLog,
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
} from '../types/system';
import { systemApi } from '../utils/api';
import { getVnTodayKey } from '../utils/timeVn';
import { DayAllocationDonut } from './VisualIllustrations';
import { PixelDungeonDiorama } from './DungeonSprites';
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
}

const TYPE_PILLS: Record<string, { label: string; cls: string }> = {
  daily: { label: 'Daily', cls: 'bg-sky-500/15 text-sky-600 border-sky-500/40 dark:text-sky-300' },
  main: { label: 'Main', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/45 dark:text-amber-300' },
  side: { label: 'Side', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300' },
  hidden: { label: 'Hidden', cls: 'bg-violet-500/15 text-violet-700 border-violet-500/40 dark:text-violet-300' },
  emergency: { label: 'Urgent', cls: 'bg-rose-500/15 text-rose-700 border-rose-500/40 dark:text-rose-300' },
  recovery: { label: 'Recovery', cls: 'bg-teal-500/15 text-teal-700 border-teal-500/40 dark:text-teal-300' },
};

const CHAT_SCOPES: Array<{
  key: ChatContextScope;
  label: string;
  dotCls: string;
  placeholder: string;
}> = [
  { key: 'general', label: 'Tổng hợp', dotCls: 'bg-amber-400', placeholder: 'Hỏi AI về kế hoạch hôm nay...' },
  { key: 'timetable', label: 'Lịch', dotCls: 'bg-sky-400', placeholder: 'Hỏi AI về sắp xếp lịch & giờ trống...' },
  { key: 'goals', label: 'Mục tiêu', dotCls: 'bg-emerald-400', placeholder: 'Hỏi AI về lộ trình mục tiêu...' },
  { key: 'skills', label: 'Kĩ năng', dotCls: 'bg-violet-400', placeholder: 'Hỏi AI về nâng cấp kỹ năng & chỉ số...' },
  { key: 'review', label: 'Phản tư', dotCls: 'bg-rose-400', placeholder: 'Phân tích nguyên nhân mệt / trì hoãn...' },
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
}) => {
  const [focusNote, setFocusNote] = useState('');
  const [showFocusNote, setShowFocusNote] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [settling, setSettling] = useState(false);
  const [failingId, setFailingId] = useState<string | null>(null);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);

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
      <section className="px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-sub">
            <span className="font-display font-bold text-main">{todayAnalysis.dayLabel}</span>
            <span className="text-dim">•</span>
            <span>
              Rảnh{' '}
              <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                {(todayAnalysis.totalFreeMinutes / 60).toFixed(1)}h
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border-2 p-0.5 studio-subtle rpg-divider rounded-[2px]">
              {[100, 75, 45, 20].map((val) => {
                const selected = Math.abs(player.energyLevel - val) <= 12;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onCheckinEnergy(val)}
                    className={`px-2 py-1 font-mono text-[11px] font-bold transition rounded-[2px] ${
                      selected
                        ? 'bg-amber-500 text-[#180f03]'
                        : 'text-sub hover:text-main'
                    }`}
                    title={`Check-in năng lượng ${val}% (đồng bộ Trái Tim HP)`}
                  >
                    {val}%
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
              className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-1.5 text-xs font-semibold transition rounded-[2px] ${
                player.plannedRestMode
                  ? 'border-teal-500 bg-teal-500/20 text-teal-700 dark:text-teal-300'
                  : 'btn-secondary'
              }`}
              title="Bật Nghỉ Chủ Động (Grace Day) để hồi phục & bảo toàn chuỗi"
            >
              {togglingRest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Coffee className="h-3.5 w-3.5" />
              )}
              <span>Nghỉ Chủ Động</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFocusNote((v) => !v)}
              className={`btn-secondary flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${
                showFocusNote || focusNote ? 'border-amber-500 text-amber-600 dark:text-amber-300' : ''
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Ghi chú AI</span>
            </button>

            <button
              type="button"
              disabled={orchestrating}
              onClick={() => void runOrchestrate()}
              className="btn-primary flex items-center gap-1.5 px-4 py-1.5 text-xs"
            >
              {orchestrating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>{orchestrating ? 'Đang lập...' : 'AI Lập Kế Hoạch'}</span>
            </button>

            {onSettleDay && (
              <button
                type="button"
                disabled={settling}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Chốt ngày hôm nay? Các nhiệm vụ bắt buộc chưa hoàn thành sẽ trừ HP theo mức rủi ro (hoặc 0 HP nếu bật Nghỉ Chủ Động).'
                    )
                  ) {
                    return;
                  }
                  setSettling(true);
                  try {
                    await onSettleDay();
                  } finally {
                    setSettling(false);
                  }
                }}
                className="btn-secondary flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
                title="Tổng kết ngày hôm nay"
              >
                {settling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span>Chốt Ngày</span>
              </button>
            )}
          </div>
        </div>

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
              className="flex-1 px-3 py-1.5 text-xs"
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

      {/* 3) Flush 2-Page Tracker Workspace (Left 7 cols + Right 5 cols) */}
      <div className="grid grid-cols-1 divide-y-2 lg:grid-cols-12 lg:divide-x-2 lg:divide-y-0 rpg-divider">
        {/* Left Page (7 cols): Live Session Tracker + Quick-Add + AI Gợi Ý Điểm + Checklist */}
        <section className="lg:col-span-7">
          {/* Live Flexible Task Session Tracker Strip */}
          {activeSession && (
            <div className="border-b-2 border-amber-500/60 bg-amber-500/10 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 border border-amber-500/60 bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300 rounded-[2px]">
                      <Timer className="h-3 w-3" />
                      {activeSession.isPaused ? 'TẠM DỪNG' : 'ĐANG CHẠY'}
                    </span>
                    <span className="truncate font-display text-xs font-extrabold text-main">
                      {activeSession.title}
                    </span>
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
                          ? 'text-amber-600 dark:text-amber-300'
                          : activeOverMins > 5
                            ? 'text-rose-500 font-bold'
                            : activeOverMins >= 0
                              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                              : 'text-sky-600 dark:text-cyan-300 font-bold'
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
                  <span className="font-mono border-2 border-amber-500/60 bg-[#0d111d] px-2.5 py-1 text-sm font-extrabold text-amber-300 rounded-[2px]">
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
                          <Play className="h-3.5 w-3.5 text-emerald-500" />
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
                          <Pause className="h-3.5 w-3.5 text-amber-500" />
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
                    <Check className="h-3.5 w-3.5" />
                    <span>Hoàn thành</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xóa phiên đang chạy "${activeSession.title}"?`)) {
                        void onDeleteQuest(activeSession.id);
                      }
                    }}
                    className="btn-secondary p-1.5 text-dim hover:text-rose-500"
                    title="Xóa nhiệm vụ đang chạy"
                    aria-label={`Xóa ${activeSession.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="rpg-bar-track mt-2 h-2 w-full">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                  style={{ width: `${activeElapsedPct}%` }}
                />
              </div>

              {showSessionProof && activeSession.requiresProof && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <input
                    value={sessionProofText}
                    onChange={(e) => setSessionProofText(e.target.value)}
                    placeholder="Ghi ngắn gọn kết quả thực tế của phiên làm việc..."
                    className="min-w-[200px] flex-1 px-3 py-1.5 text-xs"
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
                placeholder="Thêm nhanh việc cần làm hôm nay... (Enter để thêm)"
                className="min-w-[190px] flex-1 px-3 py-2 text-xs sm:text-sm"
              />

              <div className="flex items-center border-2 p-0.5 studio-surface rpg-divider rounded-[2px]">
                {[25, 45, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setQuickDur(d)}
                    className={`px-2 py-1 font-mono text-[11px] font-bold transition rounded-[2px] ${
                      quickDur === d ? 'bg-amber-500 text-[#180f03]' : 'text-sub hover:text-main'
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
                {quickAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span>Thêm</span>
              </button>

              <button
                type="button"
                disabled={analyzingDraft || !quickTitle.trim()}
                onClick={() => void handleAnalyzeDraft()}
                className="btn-arcane flex items-center gap-1 px-3 py-2 text-xs"
                title="AI tự phân tích việc này cộng chỉ số nào, kỹ năng nào, bao nhiêu XP/SP và tìm khung giờ trống"
              >
                {analyzingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                <span>AI Gợi Ý Điểm</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvancedAdd((v) => !v)}
                className={`btn-secondary px-2.5 py-2 text-[11px] ${
                  showAdvancedAdd ? 'border-amber-500 text-amber-600 dark:text-amber-300' : ''
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
              <div className="mt-2.5 flex flex-col gap-2 border-2 border-violet-500/50 bg-violet-500/10 p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between rounded-[2px]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-main">
                    Gợi ý: <span className="text-amber-600 dark:text-amber-300">+{draftAnalysis.primaryStat}</span>
                    {draftAnalysis.secondaryStat ? (
                      <span className="text-sky-600 dark:text-cyan-300"> · +{draftAnalysis.secondaryStat}</span>
                    ) : null}
                    {draftAnalysis.skillName ? (
                      <span> · Skill: <strong>{draftAnalysis.skillName}</strong></span>
                    ) : null}{' '}
                    · +{draftAnalysis.xpReward} XP · +{draftAnalysis.spReward} SP · Slot{' '}
                    <span className="font-mono">{draftAnalysis.scheduledSlot}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-sub">"{draftAnalysis.statReason}"</p>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-sub">
                    <input
                      type="checkbox"
                      checked={syncDraftToTimetable}
                      onChange={(e) => setSyncDraftToTimetable(e.target.checked)}
                      className="h-3.5 w-3.5 accent-violet-500"
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
                  className="px-2.5 py-1.5 text-xs"
                >
                  <option value="daily">Daily (-12 HP)</option>
                  <option value="main">Main (-18 HP)</option>
                  <option value="side">Side (-8 HP)</option>
                  <option value="recovery">Recovery (0 HP)</option>
                </select>
                <select
                  value={quickStat}
                  onChange={(e) => setQuickStat(e.target.value as AttributeKey)}
                  className="px-2.5 py-1.5 text-xs"
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
                  className="px-2.5 py-1.5 text-xs"
                />
                <label className="flex cursor-pointer items-center gap-1.5 px-2 text-xs text-sub">
                  <input
                    type="checkbox"
                    checked={quickRequireProof}
                    onChange={(e) => setQuickRequireProof(e.target.checked)}
                    className="h-3.5 w-3.5 accent-amber-500"
                  />
                  <span>Cần ghi nhận kết quả</span>
                </label>
                <input
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  placeholder="Mô tả chi tiết (tùy chọn)..."
                  className="sm:col-span-4 px-2.5 py-1.5 text-xs"
                />
              </div>
            )}
          </form>

          {/* Filter Header + Collapsible Scientific Protocols Drawer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 px-4 py-2.5 sm:px-5 rpg-divider">
            <div className="flex items-center gap-1 border-2 p-0.5 studio-subtle rpg-divider rounded-[2px]">
              <button
                type="button"
                onClick={() => setQuestFilter('pending')}
                className={`px-3 py-1 text-xs font-bold transition rounded-[2px] ${
                  questFilter === 'pending' ? 'bg-amber-500 text-[#180f03]' : 'text-sub hover:text-main'
                }`}
              >
                Cần làm ({pendingQuests.length})
              </button>
              <button
                type="button"
                onClick={() => setQuestFilter('completed')}
                className={`px-3 py-1 text-xs font-bold transition rounded-[2px] ${
                  questFilter === 'completed' ? 'bg-amber-500 text-[#180f03]' : 'text-sub hover:text-main'
                }`}
              >
                Đã xong ({completedQuests.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowProtocolsLibrary((v) => !v)}
              className={`btn-secondary flex items-center gap-1.5 px-2.5 py-1 text-xs ${
                showProtocolsLibrary ? 'border-violet-500 text-violet-600 dark:text-violet-300' : ''
              }`}
            >
              <FlaskConical className="h-3.5 w-3.5 text-violet-500" />
              <span>Mẫu khoa học</span>
            </button>
          </div>

          {showProtocolsLibrary && (
            <div className="border-b-2 p-4 studio-subtle rpg-divider">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SCIENTIFIC_PROTOCOLS.map((proto) => {
                  const busy = creatingProtocolId === proto.id;
                  return (
                    <div key={proto.id} className="rpg-pane flex flex-col justify-between p-3">
                      <div>
                        <div className="font-mono text-[10px] font-semibold text-violet-600 dark:text-violet-400">
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
                        className="btn-secondary mt-2.5 flex w-full items-center justify-center gap-1 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
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
                <Sparkles className="mx-auto h-7 w-7 text-amber-500" />
                <p className="mt-2 font-display text-sm font-bold text-main">
                  Chưa có việc cần làm hôm nay
                </p>
                <p className="mt-1 text-xs text-sub">
                  Gõ vào ô <strong>"Thêm nhanh việc cần làm..."</strong> phía trên hoặc bấm <strong>"AI Lập Kế Hoạch"</strong>.
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
                      className={`px-4 py-3 transition hover:bg-slate-500/5 sm:px-5 ${
                        isRunning ? 'bg-amber-500/5' : ''
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
                            <Check className="h-4 w-4" />
                          </button>

                          {q.microStartDone ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5 border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-300 rounded-[2px]"
                              title="Đã khởi động 2 phút (+10 XP)"
                            >
                              <Zap className="h-3 w-3" />
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
                              className="btn-secondary inline-flex shrink-0 items-center gap-0.5 border-amber-500/45 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-300"
                              title="Atomic Habits: Khởi động 2 phút (+10 XP)"
                            >
                              {microStartingId === q.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="h-3 w-3 text-amber-500" />
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
                                  className="min-w-[160px] flex-1 px-2 py-1 text-xs"
                                />
                                <input
                                  value={editSlot}
                                  onChange={(e) => setEditSlot(e.target.value)}
                                  className="w-28 px-2 py-1 text-xs"
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
                                      className={`font-mono border px-1.5 py-0.5 text-[10px] font-bold rounded-[2px] ${
                                        isRunning
                                          ? 'border-amber-500/70 bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                          : 'border-slate-500/50 bg-slate-500/15 text-sub'
                                      }`}
                                    >
                                      {isRunning ? `Đang chạy ${formatMsShort(elapsedSec)}` : `Tạm dừng ${formatMsShort(elapsedSec)}`}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-sub">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-amber-500" />
                                    {q.scheduledSlot} ({q.durationMinutes}p)
                                  </span>
                                  <span>·</span>
                                  <span className="font-sans font-semibold">{pill.label}</span>
                                  <span>·</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    +{q.xpReward} XP · +{spReward} SP
                                  </span>
                                  <span>·</span>
                                  <span
                                    className={
                                      hpStake === 0
                                        ? 'text-teal-600 dark:text-teal-400'
                                        : 'text-rose-500 dark:text-rose-400'
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
                              <Play className="h-3 w-3" />
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
                              <Pause className="h-3 w-3 text-amber-500" />
                              <span>Tạm dừng</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onEnterDungeon(q)}
                            className="btn-secondary flex items-center gap-1 px-2 py-1 text-xs"
                            title="Mở Focus Mode (+25% XP & +2 SP)"
                          >
                            <Swords className="h-3.5 w-3.5 text-amber-500" />
                            <span className="hidden sm:inline">Focus</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedQuestId(isExpanded ? null : q.id)}
                            className="btn-secondary flex items-center gap-1 px-2 py-1 text-xs text-sub"
                          >
                            <span>Chi tiết</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
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
                            className="btn-secondary p-1.5 text-dim hover:text-rose-500"
                            title="Xóa nhiệm vụ"
                            aria-label={`Xóa ${q.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Proof-of-Work bar (only if requiresProof) */}
                      {isCompleting && (
                        <div className="mt-2.5 flex flex-wrap gap-2 border-2 p-2.5 studio-subtle rpg-divider rounded-[2px]">
                          <input
                            value={proofText}
                            onChange={(e) => setProofText(e.target.value)}
                            placeholder="Ghi ngắn gọn kết quả vừa hoàn thành..."
                            className="min-w-[200px] flex-1 px-3 py-1.5 text-xs"
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
                              <span className="inline-flex items-center gap-1 border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300 rounded-[2px]">
                                <FlaskConical className="h-3 w-3" />
                                {q.scientificProtocol}
                              </span>
                            )}
                            {linkedSkill && (
                              <span className="inline-flex items-center gap-1 border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 rounded-[2px]">
                                <Zap className="h-3 w-3" />
                                Skill: {linkedSkill.name}
                              </span>
                            )}
                          </div>

                          {q.description && <p className="text-sub">{q.description}</p>}

                          {q.ifThenTrigger && (
                            <div className="flex items-start gap-1.5 border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1.5 text-main rounded-[2px]">
                              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
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
                                  {st.done ? (
                                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                  ) : (
                                    <Square className="h-3.5 w-3.5 shrink-0 text-dim" />
                                  )}
                                  <span className={st.done ? 'line-through opacity-60' : ''}>{st.label}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="border p-2.5 text-[11px] text-sub studio-subtle rpg-divider rounded-[2px]">
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
                              <Edit3 className="h-3 w-3" />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectingId(isRejecting ? null : q.id)}
                              className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-[11px] text-rose-500"
                            >
                              <XCircle className="h-3 w-3" />
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
                                  <AlertTriangle className="h-3 w-3" />
                                )}
                                <span>Bỏ lỡ (-HP)</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onDeleteQuest(q.id)}
                              className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] text-dim hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Xóa</span>
                            </button>
                          </div>

                          {isRejecting && (
                            <div className="flex flex-wrap items-center gap-1.5 border p-2.5 studio-subtle rpg-divider rounded-[2px]">
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
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      +{cq.xpReward} XP
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Xóa bản ghi "${cq.title}" khỏi danh sách?`)) {
                          void onDeleteQuest(cq.id);
                        }
                      }}
                      className="btn-secondary p-1 text-dim hover:text-rose-500"
                      title="Xóa nhiệm vụ đã hoàn thành"
                      aria-label={`Xóa ${cq.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Page (5 cols): 3-Tab RPG Tome */}
        <section className="flex flex-col lg:col-span-5">
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
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  <h3 className="font-display text-xs font-bold text-main">Cố vấn AI</h3>
                  <span className="rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] text-dim studio-subtle rpg-divider">
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
                    <Plus className="h-3 w-3 text-amber-400" />
                  )}
                  <span>Context mới</span>
                </button>
              </div>

              {/* 1-Row Context Scope Picker */}
              {showScopePicker && (
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5 rounded-[2px] border p-2 studio-subtle rpg-divider">
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
                      <span className={`h-2 w-2 rounded-full ${sc.dotCls}`} />
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
                        className={`group flex shrink-0 items-center gap-1.5 rounded-[2px] border px-2 py-1 text-[11px] transition ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/15 font-bold text-main'
                            : 'studio-subtle rpg-divider text-sub hover:border-amber-500/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectChatThread?.(th.id)}
                          className="flex items-center gap-1.5 text-left"
                          title={`${scopeMeta.label}: ${th.title}`}
                        >
                          {threadBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                          ) : (
                            <span className={`h-2 w-2 shrink-0 rounded-full ${scopeMeta.dotCls}`} />
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
                            className="p-0.5 text-dim opacity-70 hover:text-rose-400 group-hover:opacity-100"
                            title="Xóa context này"
                            aria-label={`Xóa ${th.title}`}
                          >
                            <X className="h-3 w-3" />
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
                  <div className="space-y-2 border-2 p-3 text-sub studio-subtle rpg-divider rounded-[2px]">
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
                    className={`p-3 rounded-[2px] ${
                      msg.role === 'user'
                        ? 'ml-6 border-2 border-amber-500/60 bg-amber-500/15 text-main'
                        : 'mr-2 border-2 studio-subtle rpg-divider text-main'
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
                      <div className="mt-2.5 space-y-2 border-t pt-2 rpg-divider">
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    <span>Đang phân tích và soạn phản hồi...</span>
                  </div>
                )}

                {currentThreadError && (
                  <div className="flex items-center gap-2 rounded-[2px] border border-rose-500/50 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
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
                  className="max-h-28 min-h-[38px] flex-1 resize-y px-3 py-2 text-xs leading-snug"
                />
                <button
                  type="submit"
                  disabled={isCurrentThreadPending || !currentDraft.trim()}
                  className="btn-primary shrink-0 px-3.5 py-2.5"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {utilityTab === 'rhythm' && (
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
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
                      <div key={idx} className="flex items-center justify-between border px-2.5 py-1.5 studio-subtle rpg-divider rounded-[2px]">
                        <span className="font-mono font-semibold text-main">
                          {fw.startTime} – {fw.endTime}
                        </span>
                        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
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
                    <Bot className="h-3.5 w-3.5 text-amber-500" />
                    <span>Chỉ thị Hội đồng AI</span>
                  </div>
                  <p className="mt-1 text-sub">{deliberation.systemDirective}</p>
                  {deliberation.agentNotes.length > 0 && (
                    <div className="mt-2 space-y-1 text-[11px] text-sub">
                      {deliberation.agentNotes.map((n, i) => (
                        <div key={i}>
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
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
                  <BookOpen className="h-4 w-4 text-amber-500" />
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
                    className="w-full px-3 py-2 text-xs"
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
                      {savingReflection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
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
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
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
