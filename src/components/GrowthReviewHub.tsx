import React, { useMemo, useState } from 'react';
import type {
  AttributeKey,
  AuditLogEntry,
  CoreHabit,
  DailyProgressSnapshot,
  DisciplineMode,
  DisciplineSettings,
  Goal,
  KnowledgeNote,
  KnowledgeSource,
  LocalIntelligencePayload,
  PlayerGrowthBonuses,
  PlayerProfile,
  PlayerState,
  Quest,
  RecallRating,
  StorageInfoPayload,
} from '../types/system';
import { soundEngine } from '../utils/soundEngine';
import { getVnTodayKey } from '../utils/timeVn';
import {
  PxBolt,
  PxBook,
  PxCheck,
  PxClock,
  PxFlame,
  PxPlus,
  PxScroll,
  PxSearch,
  PxShield,
  PxSparkle,
  PxTarget,
  PxTrash,
  PxWarn,
} from './PixelIcons';
import { ProfileGoalsConsole } from './ProfileGoalsConsole';
import { StatusWindow } from './StatusWindow';
import { WeeklyReviewDossier } from './WeeklyReviewDossier';

type GrowthSubTab = 'diagnosis' | 'vault' | 'goals' | 'discipline' | 'stats';

const DISCIPLINE_MODES: Array<{
  mode: DisciplineMode;
  title: string;
  tagline: string;
  rules: string[];
  accentVar: string;
}> = [
  {
    mode: 'iron',
    title: 'Kỷ Luật Thép',
    tagline: 'Chuẩn Solo Leveling gốc — nghiêm khắc tối đa',
    rules: [
      '100% sát thương HP khi bỏ lỡ nhiệm vụ',
      'Bật cơ chế Checkpoint khi HP cạn về 0',
      '0 Khiên bảo vệ chuỗi mỗi tuần',
    ],
    accentVar: 'var(--px-red)',
  },
  {
    mode: 'balanced',
    title: 'Cân Bằng (Khuyên dùng)',
    tagline: 'Kỷ luật vững chắc, vẫn có vùng đệm cho ngày đột xuất',
    rules: [
      'Giảm 50% sát thương HP khi lỡ việc',
      '1 Khiên bảo vệ chuỗi tự động mỗi tuần',
      'Tự gợi ý Ngày Tối Thiểu khi năng lượng thấp',
    ],
    accentVar: 'var(--px-gold)',
  },
  {
    mode: 'sustainable',
    title: 'Bền Bỉ',
    tagline: 'Không phạt nặng — tập trung nuôi dưỡng thói quen dài hạn',
    rules: [
      '0 sát thương HP & tắt hồi sinh Checkpoint',
      'Ưu tiên tối đa Ngày Tối Thiểu (2–5 phút giữ chuỗi)',
      'Tập trung hoàn toàn vào tiến độ thực & hồi phục',
    ],
    accentVar: 'var(--px-green)',
  },
];

const SOURCE_LABELS: Record<KnowledgeSource, string> = {
  manual: 'Ghi chú',
  quest_proof: 'Proof Quest',
  boss_proof: 'Proof Boss',
  closeout: 'Chốt ngày',
};

export interface GrowthReviewHubProps {
  player: PlayerState;
  goals: Goal[];
  quests: Quest[];
  habits: CoreHabit[];
  knowledgeNotes: KnowledgeNote[];
  disciplineSettings: DisciplineSettings;
  localIntelligence: LocalIntelligencePayload | null;
  dailySnapshots: DailyProgressSnapshot[];
  storageInfo: StorageInfoPayload;
  auditLogs: AuditLogEntry[];
  growthBonuses: PlayerGrowthBonuses;
  onSaveProfile: (
    profile: Partial<PlayerProfile> & { hunterClass?: string; activeTitle?: string }
  ) => Promise<void>;
  onAnalyzeGoal: (rawInput: string) => Promise<void>;
  onUpdateGoal?: (id: string, patch: Partial<Goal>) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onSpawnGoalQuest?: (goalId: string, goalTitle: string) => void;
  onSelectTitle: (title: string) => Promise<void>;
  onUpdateDisciplineSettings: (patch: Partial<DisciplineSettings>) => Promise<void>;
  onCreateKnowledgeNote: (payload: {
    title: string;
    content: string;
    recallPrompt?: string;
    goalId?: string;
    primaryStat?: AttributeKey;
    tags?: string[];
    recallEnabled?: boolean;
  }) => Promise<void>;
  onToggleKnowledgeRecall: (note: KnowledgeNote) => Promise<void>;
  onDeleteKnowledgeNote: (id: string) => Promise<void>;
  onReviewKnowledgeNote: (id: string, rating: RecallRating) => Promise<void>;
}

export const GrowthReviewHub: React.FC<GrowthReviewHubProps> = ({
  player,
  goals,
  quests,
  habits: _habits,
  knowledgeNotes,
  disciplineSettings,
  localIntelligence,
  dailySnapshots,
  storageInfo,
  auditLogs,
  growthBonuses,
  onSaveProfile,
  onAnalyzeGoal,
  onUpdateGoal,
  onDeleteGoal,
  onSpawnGoalQuest,
  onSelectTitle,
  onUpdateDisciplineSettings,
  onCreateKnowledgeNote,
  onToggleKnowledgeRecall,
  onDeleteKnowledgeNote,
  onReviewKnowledgeNote,
}) => {
  const todayKey = getVnTodayKey();
  const [subTab, setSubTab] = useState<GrowthSubTab>('diagnosis');

  // Vault state
  const [vaultFilter, setVaultFilter] = useState<'all' | 'recall' | KnowledgeSource>('all');
  const [vaultQuery, setVaultQuery] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePrompt, setNotePrompt] = useState('');
  const [noteGoalId, setNoteGoalId] = useState('');
  const [noteStat, setNoteStat] = useState<AttributeKey>('PER');
  const [noteRecall, setNoteRecall] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [revealedRecallId, setRevealedRecallId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Discipline draft state
  const [focusGoalDraft, setFocusGoalDraft] = useState(disciplineSettings.dailyFocusGoalMinutes);
  const [budgetDraft, setBudgetDraft] = useState(disciplineSettings.distractionBudgetMinutes);
  const [shieldsDraft, setShieldsDraft] = useState(disciplineSettings.streakShieldsPerWeek);
  const [mvdEnergyDraft, setMvdEnergyDraft] = useState(disciplineSettings.mvdAutoSuggestEnergy);
  const [closeoutHourDraft, setCloseoutHourDraft] = useState(disciplineSettings.eveningCloseoutHour);
  const [savingDiscipline, setSavingDiscipline] = useState(false);

  const dueRecalls = useMemo(
    () =>
      knowledgeNotes.filter(
        (n) => n.recallEnabled && n.nextReviewDate && n.nextReviewDate <= todayKey
      ),
    [knowledgeNotes, todayKey]
  );

  const filteredNotes = useMemo(() => {
    const q = vaultQuery.trim().toLowerCase();
    return knowledgeNotes.filter((n) => {
      if (vaultFilter === 'recall' && !n.recallEnabled) return false;
      if (vaultFilter !== 'all' && vaultFilter !== 'recall' && n.source !== vaultFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [knowledgeNotes, vaultFilter, vaultQuery]);

  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const tabs: Array<{ key: GrowthSubTab; label: string; badge?: string | null }> = [
    { key: 'diagnosis', label: 'Chẩn Đoán & Mục Tiêu' },
    {
      key: 'vault',
      label: 'Sổ Bằng Chứng & Ôn Tập',
      badge: dueRecalls.length > 0 ? `${dueRecalls.length} đến hạn` : null,
    },
    { key: 'discipline', label: 'Phong Cách Kỷ Luật' },
    { key: 'goals', label: 'Hồ Sơ & Tạo Mục Tiêu' },
    { key: 'stats', label: 'Chỉ Số & Biểu Đồ' },
  ];

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await onCreateKnowledgeNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        recallPrompt: notePrompt.trim() || undefined,
        goalId: noteGoalId || undefined,
        primaryStat: noteStat,
        recallEnabled: noteRecall,
      });
      setNoteTitle('');
      setNoteContent('');
      setNotePrompt('');
      setNoteGoalId('');
      setShowAddNote(false);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1480px] space-y-5 p-4 sm:p-6">
      {/* Clean Header & Flat Sub-Nav */}
      <header className="space-y-3">
        <div>
          <h1 className="font-display text-xl font-extrabold text-main">Mục Tiêu & Phát Triển</h1>
          <p className="mt-0.5 text-xs text-sub">
            Trí tuệ cục bộ từ dữ liệu thật, Sổ Bằng Chứng có Spaced Recall và Phong cách Kỷ luật cá nhân hóa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-hairline)] pb-2.5">
          {tabs.map((t) => {
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  soundEngine.click();
                  setSubTab(t.key);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold ${
                  active
                    ? 'border border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                    : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-sub hover:text-main'
                }`}
              >
                <span>{t.label}</span>
                {t.badge && (
                  <span
                    className={`px-1 py-0.5 font-mono text-[10px] ${
                      active
                        ? 'bg-[#140e04]/20 text-[#140e04]'
                        : 'bg-[var(--px-plum)] text-white'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* 1. LOCAL INTELLIGENCE DIAGNOSIS + GOAL ALIGNMENT + WEEKLY REVIEW */}
      {subTab === 'diagnosis' && (
        <div className="space-y-5">
          {localIntelligence && (
            <>
              {/* 1 Concrete Weekly Adjustment Banner */}
              <section className="px-card-hero p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <PxSparkle size={18} color="var(--px-gold-text)" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-pixel text-[9px] font-bold uppercase text-[var(--px-gold-text)]">
                      1 ĐIỀU CHỈNH CỤ THỂ CHO TUẦN TỚI (TỪ DỮ LIỆU THẬT)
                    </div>
                    <p className="mt-1 text-sm font-semibold text-main leading-relaxed">
                      {localIntelligence.weeklyAdjustment}
                    </p>
                  </div>
                </div>
              </section>

              {/* 3 Real-Data Personal Rhythm Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Golden Hours & Distraction Peak */}
                <div className="px-card p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-main">
                    <PxClock size={14} color="var(--px-green-text)" />
                    <span>Giờ Vàng & Giờ Rủi Ro (14 ngày)</span>
                  </div>
                  {localIntelligence.goldenHours.length > 0 ? (
                    <div className="space-y-1.5">
                      {localIntelligence.goldenHours.map((w) => (
                        <div
                          key={w.label}
                          className="flex items-center justify-between bg-[var(--bg-subtle)] px-2.5 py-1.5 font-mono text-xs"
                        >
                          <span className="font-bold text-[var(--px-green-text)]">{w.label}</span>
                          <span className="text-sub">
                            {w.focusScore}% Focus · {w.focusMinutes}p
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-dim">
                      Cần thêm dữ liệu PC Tracker (từ 15p/khung giờ) để tự học giờ vàng của bạn.
                    </p>
                  )}

                  {localIntelligence.distractionPeakHours.length > 0 && (
                    <div className="border-t border-[var(--border-hairline)] pt-2">
                      <div className="text-[11px] font-semibold text-[var(--px-red-text)]">
                        Khung dễ xao nhãng nhất:
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {localIntelligence.distractionPeakHours.map((d) => (
                          <span key={d.label} className="px-pill font-mono text-[10px] text-[var(--px-red-text)]">
                            {d.label} ({d.distractionMinutes}p)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Habit Health */}
                <div className="px-card p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-main">
                      <PxFlame size={14} />
                      <span>Độ Bền Thói Quen (14 ngày)</span>
                    </div>
                    <span className="font-mono text-sm font-extrabold text-[var(--px-gold-text)]">
                      {localIntelligence.habitAnalytics.avgConsistency14dPct}%
                    </span>
                  </div>
                  {localIntelligence.habitAnalytics.activeCount === 0 ? (
                    <p className="text-xs text-dim">
                      Thêm Thói quen cốt lõi ở màn Hôm Nay để theo dõi độ bền và ngày hay trượt.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {localIntelligence.habitAnalytics.strongestHabit && (
                        <div className="bg-[var(--bg-subtle)] px-2.5 py-1.5">
                          <div className="text-[10px] uppercase text-[var(--px-green-text)]">
                            Vững nhất
                          </div>
                          <div className="flex justify-between font-semibold text-main">
                            <span className="truncate">
                              {localIntelligence.habitAnalytics.strongestHabit.title}
                            </span>
                            <span className="font-mono">
                              {localIntelligence.habitAnalytics.strongestHabit.consistency14dPct}%
                            </span>
                          </div>
                        </div>
                      )}
                      {localIntelligence.habitAnalytics.weakestHabit &&
                        localIntelligence.habitAnalytics.activeCount > 1 && (
                          <div className="bg-[var(--bg-subtle)] px-2.5 py-1.5">
                            <div className="text-[10px] uppercase text-[var(--px-red-text)]">
                              Cần cứu chuỗi
                            </div>
                            <div className="flex justify-between font-semibold text-main">
                              <span className="truncate">
                                {localIntelligence.habitAnalytics.weakestHabit.title}
                              </span>
                              <span className="font-mono">
                                {localIntelligence.habitAnalytics.weakestHabit.consistency14dPct}%
                              </span>
                            </div>
                            {localIntelligence.habitAnalytics.weakestHabit.weakestDayLabel && (
                              <div className="mt-0.5 text-[10px] text-dim">
                                Hay trượt vào:{' '}
                                {localIntelligence.habitAnalytics.weakestHabit.weakestDayLabel}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                </div>

                {/* Bottlenecks & Calibration */}
                <div className="px-card p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-main">
                    <PxWarn size={14} danger />
                    <span>Điểm Nghẽn & Ước Lượng</span>
                  </div>
                  {localIntelligence.topBottlenecks14d.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {localIntelligence.topBottlenecks14d.map((b) => (
                        <span key={b.tag} className="px-pill text-[11px] text-main">
                          {b.tag} <strong className="font-mono text-[var(--px-gold-text)]">×{b.count}</strong>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-dim">
                      Chưa ghi nhận điểm nghẽn lặp lại (hãy dùng Chốt Ngày buổi tối để tích lũy).
                    </p>
                  )}

                  {localIntelligence.estimationCalibration.note && (
                    <p className="border-t border-[var(--border-hairline)] pt-2 text-[11px] text-sub">
                      {localIntelligence.estimationCalibration.note}
                    </p>
                  )}
                </div>
              </div>

              {/* Goal Alignment Matrix */}
              <section className="px-card">
                <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PxTarget size={15} color="var(--px-gold-text)" />
                    <h2 className="font-display text-sm font-extrabold text-main">
                      Độ Khớp Mục Tiêu ↔ Hành Động 7 Ngày Qua
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('goals')}
                    className="text-xs font-semibold text-[var(--px-gold-text)] hover:underline"
                  >
                    + Thêm / Sửa Mục tiêu
                  </button>
                </div>

                {localIntelligence.goalAlignment.length === 0 ? (
                  <div className="p-6 text-center text-xs text-sub">
                    Chưa có mục tiêu nào. Tạo 1–3 mục tiêu lớn trong tab <strong>Hồ Sơ & Tạo Mục Tiêu</strong> để hệ thống đo xem việc hằng ngày có thực sự đẩy bạn tiến lên không.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-hairline)]">
                    {localIntelligence.goalAlignment.map((ga) => {
                      const statusMeta =
                        ga.status === 'on_track'
                          ? { label: 'Đang tiến tốt', cls: 'text-[var(--px-green-text)] border-[var(--px-green)]' }
                          : ga.status === 'slow'
                            ? { label: 'Chậm nhịp', cls: 'text-[var(--px-gold-text)] border-[var(--px-gold)]' }
                            : { label: 'Đang bỏ quên', cls: 'text-[var(--px-red-text)] border-[var(--px-red)]' };
                      return (
                        <div
                          key={ga.goalId}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-display text-sm font-bold text-main">
                                {ga.title}
                              </span>
                              <span className={`border px-1.5 py-0.5 font-mono text-[10px] font-bold ${statusMeta.cls}`}>
                                {statusMeta.label}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-sub">
                              <span>Thói quen gắn: <strong className="text-main">{ga.linkedHabitsCount}</strong></span>
                              <span>7 ngày xong: <strong className="text-main">{ga.linkedQuests7dCompleted} việc</strong> ({ga.linkedFocusMinutes7d}p)</span>
                              <span>Bằng chứng: <strong className="text-main">{ga.linkedNotesCount}</strong></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:w-56">
                            {onSpawnGoalQuest && (
                              <button
                                type="button"
                                onClick={() => onSpawnGoalQuest(ga.goalId, ga.title)}
                                className="btn-secondary shrink-0 px-2 py-1 font-mono text-[10.5px] font-bold text-[var(--px-gold-text)]"
                                title="Tạo nhiệm vụ hôm nay gắn với Mục tiêu này"
                              >
                                + Tạo Quest
                              </button>
                            )}
                            <div className="rpg-bar-track h-2.5 flex-1">
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.min(100, ga.progress)}%`,
                                  backgroundColor:
                                    ga.status === 'neglected' ? 'var(--px-red)' : 'var(--px-gold)',
                                }}
                              />
                            </div>
                            <span className="w-9 text-right font-mono text-xs font-bold text-main">
                              {ga.progress}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Embedded 7/30-Day Review Dossier */}
          <WeeklyReviewDossier />
        </div>
      )}

      {/* 2. PROOF & KNOWLEDGE VAULT + SPACED RECALL */}
      {subTab === 'vault' && (
        <div className="space-y-5">
          {/* Active Recall Session Box */}
          {dueRecalls.length > 0 && (
            <section className="px-card-hero p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PxBook size={16} color="var(--px-plum-text)" />
                  <span className="font-pixel text-[10px] font-bold text-[var(--px-plum-text)]">
                    ACTIVE RECALL · CÒN {dueRecalls.length} THẺ ĐẾN HẠN HÔM NAY
                  </span>
                </div>
                <span className="font-mono text-[11px] text-dim">
                  Lần ôn #{dueRecalls[0].recallCount + 1} · Chu kỳ {dueRecalls[0].recallIntervalDays || 1} ngày
                </span>
              </div>

              <h3 className="font-display text-base font-extrabold text-main">
                {dueRecalls[0].recallPrompt || dueRecalls[0].title}
              </h3>

              {revealedRecallId !== dueRecalls[0].id ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    setRevealedRecallId(dueRecalls[0].id);
                  }}
                  className="btn-arcane px-4 py-2 text-xs"
                >
                  Tự truy xuất trí nhớ xong → Lật đáp án
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="px-inset p-3.5 text-xs leading-relaxed text-main whitespace-pre-wrap">
                    {dueRecalls[0].content}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { rating: 'again' as const, label: 'Quên (ôn lại mai)', cls: 'btn-crimson' },
                        { rating: 'hard' as const, label: 'Nhớ mờ (+2 ngày)', cls: 'btn-secondary' },
                        { rating: 'good' as const, label: 'Nhớ rõ (+15 XP · +1 PER)', cls: 'btn-emerald' },
                        { rating: 'easy' as const, label: 'Rất chắc', cls: 'btn-primary' },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.rating}
                        type="button"
                        disabled={reviewingId === dueRecalls[0].id}
                        onClick={async () => {
                          setReviewingId(dueRecalls[0].id);
                          try {
                            await onReviewKnowledgeNote(dueRecalls[0].id, opt.rating);
                            setRevealedRecallId(null);
                          } finally {
                            setReviewingId(null);
                          }
                        }}
                        className={`${opt.cls} px-3.5 py-1.5 text-xs`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Toolbar + Add Note */}
          <section className="px-card">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-hairline)] p-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all' as const, label: `Tất cả (${knowledgeNotes.length})` },
                    { key: 'recall' as const, label: 'Có Spaced Recall' },
                    { key: 'quest_proof' as const, label: 'Proof Quest' },
                    { key: 'closeout' as const, label: 'Chốt ngày' },
                    { key: 'manual' as const, label: 'Ghi chú tay' },
                  ]
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setVaultFilter(f.key)}
                    className={`px-2.5 py-1 text-[11px] font-bold ${
                      vaultFilter === f.key
                        ? 'bg-[var(--bg-surface-2)] text-[var(--px-gold-text)] border border-[var(--border-hairline)]'
                        : 'text-dim hover:text-main'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <PxSearch
                    size={12}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"
                  />
                  <input
                    value={vaultQuery}
                    onChange={(e) => setVaultQuery(e.target.value)}
                    placeholder="Tìm kiến thức, bài học..."
                    className="w-44 py-1.5 pl-7 pr-2.5 text-xs sm:w-56"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddNote((v) => !v)}
                  className="btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                >
                  <PxPlus size={12} />
                  <span>Ghi bài học</span>
                </button>
              </div>
            </div>

            {showAddNote && (
              <form
                onSubmit={handleSaveNote}
                className="space-y-3 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 text-xs"
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Tiêu đề kiến thức / thành quả..."
                    className="px-3 py-2 text-xs"
                    required
                  />
                  <input
                    value={notePrompt}
                    onChange={(e) => setNotePrompt(e.target.value)}
                    placeholder="Câu hỏi tự kiểm tra Active Recall (tùy chọn)..."
                    className="px-3 py-2 text-xs"
                  />
                </div>
                <textarea
                  rows={3}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Viết lại bằng lời của chính bạn: ý cốt lõi, bài học, hoặc kết quả Proof-of-Work..."
                  className="w-full p-2.5 text-xs"
                  required
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={noteStat}
                      onChange={(e) => setNoteStat(e.target.value as AttributeKey)}
                      className="px-2 py-1 text-xs"
                    >
                      <option value="PER">PER · Tri thức</option>
                      <option value="INT">INT · Tư duy</option>
                      <option value="AGI">AGI · Thực thi</option>
                      <option value="STR">STR · Thể chất</option>
                      <option value="VIT">VIT · Hồi phục</option>
                      <option value="CHA">CHA · Giao tiếp</option>
                    </select>
                    {goals.length > 0 && (
                      <select
                        value={noteGoalId}
                        onChange={(e) => setNoteGoalId(e.target.value)}
                        className="px-2 py-1 text-xs"
                      >
                        <option value="">Liên kết mục tiêu (tùy chọn)</option>
                        {goals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-sub">
                      <input
                        type="checkbox"
                        checked={noteRecall}
                        onChange={(e) => setNoteRecall(e.target.checked)}
                      />
                      <span>Bật ôn tập ngắt quãng (Spaced Recall)</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddNote(false)}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      Hủy
                    </button>
                    <button type="submit" disabled={savingNote} className="btn-primary px-4 py-1.5 text-xs">
                      {savingNote ? 'Đang lưu...' : 'Lưu vào Kho'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-xs text-sub">
                Chưa có bản ghi nào. Mỗi khi bạn hoàn thành Quest kèm ghi chú, hạ Boss, Chốt Ngày hoặc tự ghi bài học, tất cả sẽ hội tụ sạch sẽ tại đây.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {filteredNotes.map((n) => {
                  const linkedGoal = n.goalId ? goalMap.get(n.goalId) : undefined;
                  const isDue = Boolean(
                    n.recallEnabled && n.nextReviewDate && n.nextReviewDate <= todayKey
                  );
                  return (
                    <div key={n.id} className="p-4 space-y-2 hover:bg-[var(--bg-surface-2)]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-pill font-mono text-[10px]">
                              {SOURCE_LABELS[n.source]}
                            </span>
                            <h3 className="font-display text-sm font-bold text-main">{n.title}</h3>
                            {linkedGoal && (
                              <span className="font-mono text-[11px] text-[var(--px-blue-text)]">
                                · {linkedGoal.title}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void onToggleKnowledgeRecall(n)}
                            className={`px-2 py-0.5 font-mono text-[10px] font-bold border ${
                              n.recallEnabled
                                ? isDue
                                  ? 'border-[var(--px-plum)] bg-[var(--px-plum)] text-white'
                                  : 'border-[var(--px-plum)] text-[var(--px-plum-text)]'
                                : 'border-[var(--border-hairline)] text-dim hover:text-main'
                            }`}
                            title="Bật/tắt lịch ôn tập ngắt quãng"
                          >
                            {n.recallEnabled
                              ? isDue
                                ? 'Đến hạn ôn'
                                : `Ôn: ${n.nextReviewDate}`
                              : '+ Bật Ôn tập'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Xóa ghi chú "${n.title}"?`)) {
                                void onDeleteKnowledgeNote(n.id);
                              }
                            }}
                            className="p-1 text-dim hover:text-[var(--px-red-text)]"
                          >
                            <PxTrash size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-sub whitespace-pre-wrap">
                        {n.content}
                      </p>
                      <div className="font-mono text-[10px] text-dim">
                        {n.createdAt.slice(0, 10)}
                        {n.recallCount > 0 ? ` · Đã ôn ${n.recallCount} lần` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 3. PERSONALIZED DISCIPLINE SETTINGS */}
      {subTab === 'discipline' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {DISCIPLINE_MODES.map((m) => {
              const selected = disciplineSettings.mode === m.mode;
              return (
                <button
                  key={m.mode}
                  type="button"
                  onClick={async () => {
                    soundEngine.systemPing();
                    const nextShields = m.mode === 'iron' ? 0 : m.mode === 'balanced' ? 1 : 2;
                    setShieldsDraft(nextShields);
                    await onUpdateDisciplineSettings({
                      mode: m.mode,
                      streakShieldsPerWeek: nextShields,
                    });
                  }}
                  className={`px-card flex flex-col justify-between p-4 text-left transition ${
                    selected ? 'border-2 bg-[var(--bg-surface-2)]' : 'hover:bg-[var(--bg-surface-2)]'
                  }`}
                  style={{
                    borderTop: `3px solid ${m.accentVar}`,
                    borderColor: selected ? m.accentVar : undefined,
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-extrabold text-main">{m.title}</h3>
                      {selected && (
                        <span className="bg-[var(--px-gold)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#140e04]">
                          ĐANG CHỌN
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-sub">{m.tagline}</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-main">
                      {m.rules.map((r) => (
                        <li key={r} className="flex items-start gap-1.5">
                          <PxCheck size={12} color={m.accentVar} className="mt-0.5 shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Numeric Targets & Guardrails */}
          <section className="px-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div className="flex items-center gap-2">
                <PxShield size={16} color="var(--px-gold-text)" />
                <h3 className="font-display text-sm font-extrabold text-main">
                  Ngưỡng Kỷ Luật Cá Nhân (Đồng bộ với Trợ Lý PC & Mini HUD)
                </h3>
              </div>
              <span className="px-pill font-mono text-[11px]">
                Khiên tuần này: {disciplineSettings.streakShieldsUsedThisWeek}/
                {disciplineSettings.streakShieldsPerWeek} đã dùng
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-main">
                  Mục tiêu Focus mỗi ngày ({focusGoalDraft} phút)
                </label>
                <input
                  type="range"
                  min={30}
                  max={480}
                  step={15}
                  value={focusGoalDraft}
                  onChange={(e) => setFocusGoalDraft(Number(e.target.value))}
                  className="px-slider w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-main">
                  Ngân sách Xao nhãng tối đa ({budgetDraft} phút)
                </label>
                <input
                  type="range"
                  min={10}
                  max={180}
                  step={5}
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(Number(e.target.value))}
                  className="px-slider w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-main">
                  Khiên bảo vệ chuỗi / tuần ({shieldsDraft} ngày)
                </label>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={shieldsDraft}
                  onChange={(e) => setShieldsDraft(Number(e.target.value))}
                  className="px-slider w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-main">
                  Gợi ý Ngày Tối Thiểu khi Energy ≤ {mvdEnergyDraft}%
                </label>
                <input
                  type="range"
                  min={20}
                  max={70}
                  step={5}
                  value={mvdEnergyDraft}
                  onChange={(e) => setMvdEnergyDraft(Number(e.target.value))}
                  className="px-slider w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-main">
                  Giờ nhắc Nghi thức Chốt Ngày ({closeoutHourDraft}:00)
                </label>
                <input
                  type="range"
                  min={18}
                  max={23}
                  step={1}
                  value={closeoutHourDraft}
                  onChange={(e) => setCloseoutHourDraft(Number(e.target.value))}
                  className="px-slider w-full"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={savingDiscipline}
                onClick={async () => {
                  setSavingDiscipline(true);
                  try {
                    await onUpdateDisciplineSettings({
                      dailyFocusGoalMinutes: focusGoalDraft,
                      distractionBudgetMinutes: budgetDraft,
                      streakShieldsPerWeek: shieldsDraft,
                      mvdAutoSuggestEnergy: mvdEnergyDraft,
                      eveningCloseoutHour: closeoutHourDraft,
                    });
                  } finally {
                    setSavingDiscipline(false);
                  }
                }}
                className="btn-primary inline-flex items-center gap-1.5 px-5 py-2 text-xs"
              >
                <PxBolt size={13} />
                <span>{savingDiscipline ? 'Đang lưu...' : 'Lưu Cấu Hình Kỷ Luật'}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 4. GOALS & PROFILE CONSOLE */}
      {subTab === 'goals' && (
        <ProfileGoalsConsole
          player={player}
          goals={goals}
          onSaveProfile={onSaveProfile}
          onAnalyzeGoal={onAnalyzeGoal}
          onUpdateGoal={onUpdateGoal}
          onDeleteGoal={onDeleteGoal}
          onSpawnGoalQuest={onSpawnGoalQuest}
        />
      )}

      {/* 5. STATS & HEATMAP */}
      {subTab === 'stats' && (
        <StatusWindow
          player={player}
          dailySnapshots={dailySnapshots}
          storageInfo={storageInfo}
          auditLogs={auditLogs}
          growthBonuses={growthBonuses}
          quests={quests}
          onSelectTitle={onSelectTitle}
        />
      )}
    </div>
  );
};
