import React, { useEffect, useRef, useState } from 'react';
import type {
  CloseoutGrade,
  CloseoutMood,
  DailyCloseoutRecord,
  EveningCloseoutPreviewPayload,
} from '../types/system';
import { soundEngine } from '../utils/soundEngine';
import {
  PixelRivets,
  PxBolt,
  PxBook,
  PxCalendar,
  PxCheck,
  PxClose,
  PxCoffee,
  PxFlame,
  PxRefresh,
  PxScroll,
  PxShield,
  PxSkull,
  PxSparkle,
  PxStar,
  PxSword,
  PxTarget,
  PxWarn,
} from './PixelIcons';

export interface EveningCloseoutModalProps {
  preview: EveningCloseoutPreviewPayload | null;
  loading?: boolean;
  submitting?: boolean;
  initialReflectionNote?: string;
  onSubmitCloseout: (payload: {
    mood: CloseoutMood;
    bottleneckTags: string[];
    reflectionNote: string;
    carryOverQuestIds: string[];
  }) => Promise<DailyCloseoutRecord | null>;
  onClose: () => void;
}

const MOOD_OPTIONS: Array<{
  value: CloseoutMood;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
}> = [
  {
    value: 'energized',
    label: 'Sung sức',
    renderIcon: (active) => <PxBolt size={13} color={active ? '#140e04' : 'var(--px-green-text)'} />,
  },
  {
    value: 'steady',
    label: 'Bình ổn',
    renderIcon: (active) => <PxShield size={13} color={active ? '#140e04' : 'var(--px-blue-text)'} />,
  },
  {
    value: 'tired',
    label: 'Hơi mệt',
    renderIcon: (active) => <PxCoffee size={13} color={active ? '#140e04' : 'var(--px-gold-text)'} />,
  },
  {
    value: 'overwhelmed',
    label: 'Quá tải',
    renderIcon: (active) => (
      <PxWarn size={13} danger={!active} color={active ? '#140e04' : undefined} />
    ),
  },
];

const MOOD_LABELS: Record<CloseoutMood, string> = {
  energized: 'Sung sức',
  steady: 'Bình ổn',
  tired: 'Hơi mệt',
  overwhelmed: 'Quá tải',
};

const BOTTLENECK_CHIPS = [
  'Mạng xã hội / Video',
  'Buồn ngủ / Mệt',
  'Việc đột xuất',
  'Khó bắt đầu',
  'Nhịp ổn định',
] as const;

const GRADE_STYLES: Record<
  CloseoutGrade,
  { bg: string; fg: string; label: string }
> = {
  S: { bg: '#c99330', fg: '#140e04', label: 'XUẤT SẮC' },
  A: { bg: '#2e8b57', fg: '#ffffff', label: 'VỮNG NHỊP' },
  B: { bg: '#3267a8', fg: '#ffffff', label: 'ỔN ĐỊNH' },
  C: { bg: '#b88435', fg: '#140e04', label: 'CẦN SIẾT' },
  D: { bg: '#b83a4b', fg: '#ffffff', label: 'CẢNH BÁO' },
};

function formatDateVn(dateKey?: string): string {
  if (!dateKey) return '--/--/----';
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTimeVn(iso?: string): string {
  if (!iso) return '--:--';
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) {
      return iso.slice(11, 16) || '--:--';
    }
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dt);
  } catch {
    return iso.slice(11, 16) || '--:--';
  }
}

export const EveningCloseoutModal: React.FC<EveningCloseoutModalProps> = ({
  preview,
  loading = false,
  submitting = false,
  initialReflectionNote = '',
  onSubmitCloseout,
  onClose,
}) => {
  const [mood, setMood] = useState<CloseoutMood>('steady');
  const [bottleneckTags, setBottleneckTags] = useState<string[]>([]);
  const [reflectionNote, setReflectionNote] = useState(initialReflectionNote);
  const [carryOverIds, setCarryOverIds] = useState<string[]>([]);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<DailyCloseoutRecord | null>(null);

  const revealSoundPlayedRef = useRef(false);

  const isBusy = submitting || localSubmitting;
  const activeCloseout: DailyCloseoutRecord | null =
    submittedRecord || (preview?.alreadyClosedToday ? preview.todayCloseout : null);

  // Sync initial reflection draft when opening
  useEffect(() => {
    if (initialReflectionNote && !reflectionNote) {
      setReflectionNote(initialReflectionNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReflectionNote]);

  // Keep carryOverIds pruned to valid pending quests whenever preview refreshes
  useEffect(() => {
    if (!preview) return;
    const validIds = new Set(preview.pendingQuests.map((q) => q.id));
    setCarryOverIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [preview]);

  // Play crisp 16-bit audio feedback once when Dossier reveals
  useEffect(() => {
    if (!activeCloseout || revealSoundPlayedRef.current) return;
    revealSoundPlayedRef.current = true;
    if (activeCloseout.grade === 'S' || activeCloseout.grade === 'A') {
      soundEngine.questComplete();
    } else {
      soundEngine.systemPing();
    }
  }, [activeCloseout]);

  // Escape key dismiss (blocked while submitting)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isBusy, onClose]);

  const toggleBottleneck = (tag: string) => {
    soundEngine.click();
    setBottleneckTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleCarryOverQuest = (questId: string) => {
    soundEngine.click();
    setCarryOverIds((prev) =>
      prev.includes(questId) ? prev.filter((id) => id !== questId) : [...prev, questId]
    );
  };

  const pendingQuests = preview?.pendingQuests ?? [];
  const allCarrySelected =
    pendingQuests.length > 0 && pendingQuests.every((q) => carryOverIds.includes(q.id));

  const toggleSelectAllCarryOver = () => {
    soundEngine.click();
    if (allCarrySelected) {
      setCarryOverIds([]);
    } else {
      setCarryOverIds(pendingQuests.map((q) => q.id));
    }
  };

  const handleConfirmSubmit = async () => {
    if (isBusy || !preview) return;
    setLocalSubmitting(true);
    setSubmitError(null);
    try {
      const record = await onSubmitCloseout({
        mood,
        bottleneckTags,
        reflectionNote: reflectionNote.trim(),
        carryOverQuestIds: carryOverIds,
      });
      if (record) {
        revealSoundPlayedRef.current = false;
        setSubmittedRecord(record);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Không thể hoàn tất Chốt Ngày. Vui lòng thử lại.'
      );
    } finally {
      setLocalSubmitting(false);
    }
  };

  const headerDateKey = activeCloseout?.dateKey || preview?.dateKey;
  const tomorrowLabel = formatDateVn(preview?.tomorrowDateKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        className="rpg-window relative max-h-[92vh] w-full max-w-[660px] overflow-y-auto rounded-none p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <PixelRivets />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 pb-3 rpg-divider">
          <div className="min-w-0 flex-1">
            <span className="font-pixel inline-flex items-center gap-1.5 rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-2 py-0.5 text-[9.5px] font-bold uppercase text-[#140e04]">
              <PxScroll size={11} color="#140e04" />
              <span>NGHI THỨC CHỐT NGÀY · {headerDateKey || '...'}</span>
            </span>
            <h2 className="mt-1.5 font-display text-base font-extrabold text-main sm:text-lg">
              {activeCloseout
                ? 'Phiếu Chốt Ngày & Chẩn Đoán Kỷ Luật'
                : 'Tổng Kết Kỷ Luật & Chốt Sổ Cuối Ngày'}
            </h2>
            <p className="text-xs text-sub">
              {activeCloseout
                ? `Hồ sơ kỷ luật ngày ${formatDateVn(activeCloseout.dateKey)} đã được lưu vĩnh viễn vào Nhật Ký SQLite.`
                : 'Đối soát trung thực giờ tập trung, xao nhãng, sát thương HP & dời việc tồn sang ngày mai.'}
            </p>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="btn-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-none"
            aria-label="Đóng"
          >
            <PxClose size={13} />
          </button>
        </div>

        {/* Loading State */}
        {loading && !preview ? (
          <div className="px-inset mt-4 flex flex-col items-center justify-center gap-2.5 rounded-none p-8 text-center">
            <PxRefresh size={22} color="var(--px-gold-text)" className="animate-spin" />
            <p className="font-display text-sm font-bold text-main">
              Đang tổng hợp bảng điểm kỷ luật hôm nay...
            </p>
          </div>
        ) : !preview && !activeCloseout ? (
          <div className="px-inset mt-4 space-y-3 rounded-none p-6 text-center">
            <PxWarn size={22} danger className="mx-auto" />
            <p className="font-display text-sm font-bold text-main">
              Không thể tải dữ liệu chốt ngày.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary rounded-none px-4 py-1.5 text-xs"
            >
              Đóng
            </button>
          </div>
        ) : activeCloseout ? (
          /* ==================== STATE B: 16-BIT CLOSEOUT RESULT DOSSIER ==================== */
          (() => {
            const gradeStyle = GRADE_STYLES[activeCloseout.grade] || GRADE_STYLES.B;
            const scoreClamped = Math.max(0, Math.min(100, Math.round(activeCloseout.score)));
            return (
              <div className="mt-4 space-y-4">
                {/* Prominent 16-Bit Pixel Grade Crest */}
                <div className="px-inset flex flex-col items-center gap-4 rounded-none p-4 sm:flex-row sm:items-stretch">
                  <div
                    className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-none border-2 border-[var(--border-ink)]"
                    style={{ backgroundColor: gradeStyle.bg, color: gradeStyle.fg }}
                  >
                    <span className="font-pixel text-[7.5px] font-bold uppercase opacity-90">
                      HẠNG NGÀY
                    </span>
                    <span className="font-pixel mt-0.5 text-4xl font-bold leading-none">
                      {activeCloseout.grade}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between text-center sm:text-left">
                    <div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                        <span className="rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-xs font-extrabold tabular-nums text-main">
                          {scoreClamped}/100
                        </span>
                        <span
                          className="font-pixel rounded-none border-2 border-[var(--border-ink)] px-2 py-0.5 text-[8.5px] font-bold uppercase"
                          style={{
                            backgroundColor:
                              activeCloseout.generatedBy === 'ai'
                                ? 'var(--px-plum)'
                                : 'var(--bg-muted)',
                            color:
                              activeCloseout.generatedBy === 'ai'
                                ? '#ffffff'
                                : 'var(--text-primary)',
                          }}
                        >
                          {activeCloseout.generatedBy === 'ai' ? 'AI COACH' : 'LOCAL AUDIT'}
                        </span>
                        <span className="rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px] font-bold text-sub">
                          {gradeStyle.label} · {MOOD_LABELS[activeCloseout.mood] || activeCloseout.mood}
                        </span>
                      </div>

                      <h3 className="mt-2 font-display text-sm font-extrabold leading-snug text-main sm:text-base">
                        {activeCloseout.headline}
                      </h3>
                    </div>

                    <div className="mt-2.5">
                      <div className="rpg-bar-track h-2.5 w-full">
                        <div
                          className="h-full"
                          style={{ width: `${scoreClamped}%`, backgroundColor: gradeStyle.bg }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Metrics & Settlement Strip */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="px-inset rounded-none p-2">
                    <div className="font-mono text-[10px] text-dim">Tập trung</div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold tabular-nums text-[var(--px-green-text)]">
                      {activeCloseout.focusTotalMinutes}p ({activeCloseout.focusScore}%)
                    </div>
                  </div>

                  <div className="px-inset rounded-none p-2">
                    <div className="font-mono text-[10px] text-dim">Xao nhãng</div>
                    <div
                      className="mt-0.5 font-mono text-xs font-extrabold tabular-nums"
                      style={{
                        color: activeCloseout.darkRegenTriggered
                          ? 'var(--px-red-text)'
                          : 'var(--text-primary)',
                      }}
                    >
                      {activeCloseout.distractionMinutes}/{activeCloseout.distractionBudgetMinutes}p
                    </div>
                  </div>

                  <div className="px-inset rounded-none p-2">
                    <div className="font-mono text-[10px] text-dim">Sát thương Raid</div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold tabular-nums text-[var(--px-gold-text)]">
                      -{activeCloseout.raidDamageToday} HP
                    </div>
                  </div>

                  <div className="px-inset rounded-none p-2">
                    <div className="font-mono text-[10px] text-dim">Sát thương HP</div>
                    <div
                      className="mt-0.5 font-mono text-xs font-extrabold tabular-nums"
                      style={{
                        color:
                          activeCloseout.hpDamageTaken > 0
                            ? 'var(--px-red-text)'
                            : 'var(--px-green-text)',
                      }}
                    >
                      {activeCloseout.hpDamageTaken > 0
                        ? `-${activeCloseout.hpDamageTaken} HP`
                        : '0 HP'}
                      {activeCloseout.died ? ' · NGÃ' : ''}
                    </div>
                  </div>

                  <div className="px-inset col-span-2 rounded-none p-2 sm:col-span-1">
                    <div className="font-mono text-[10px] text-dim">Dời sang mai</div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold tabular-nums text-[var(--px-blue-text)]">
                      {activeCloseout.carriedOverCount > 0
                        ? `${activeCloseout.carriedOverCount} việc`
                        : '0 việc'}
                    </div>
                  </div>
                </div>

                {activeCloseout.carriedOverCount > 0 && (
                  <div className="px-inset flex items-start gap-2 rounded-none border-[var(--px-blue)] px-3 py-2 text-xs text-sub">
                    <PxCalendar size={14} color="var(--px-blue-text)" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-[var(--px-blue-text)]">
                        Đã dời {activeCloseout.carriedOverCount} việc sang{' '}
                        {preview?.tomorrowDateKey ? tomorrowLabel : 'ngày mai'}
                      </span>
                      {activeCloseout.carriedOverTitles.length > 0 && (
                        <span className="text-sub">
                          : {activeCloseout.carriedOverTitles.join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 3 Crisp Coaching Plaques */}
                <div className="space-y-2.5">
                  <div className="px-inset rounded-none border-l-4 border-l-[var(--px-green)] p-3">
                    <div className="flex items-center gap-1.5 font-display text-xs font-extrabold uppercase text-[var(--px-green-text)]">
                      <PxCheck size={13} color="var(--px-green-text)" />
                      <span>Điểm Mạnh Hôm Nay</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-main">
                      {activeCloseout.strengthSummary}
                    </p>
                  </div>

                  <div className="px-inset rounded-none border-l-4 border-l-[var(--px-red)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="flex items-center gap-1.5 font-display text-xs font-extrabold uppercase text-[var(--px-red-text)]">
                        <PxWarn size={13} danger />
                        <span>Điểm Nghẽn Chính</span>
                      </span>
                      {activeCloseout.bottleneckTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {activeCloseout.bottleneckTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-sub"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-main">
                      {activeCloseout.bottleneckSummary}
                    </p>
                  </div>

                  <div className="px-inset rounded-none border-l-4 border-l-[var(--px-gold)] p-3">
                    <div className="flex items-center gap-1.5 font-display text-xs font-extrabold uppercase text-[var(--px-gold-text)]">
                      <PxStar size={13} color="var(--px-gold-text)" />
                      <span>Chiến Thuật Ngày Mai</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-main">
                      {activeCloseout.tomorrowAdvice}
                    </p>
                  </div>
                </div>

                {/* Saved Reflection Quote */}
                {activeCloseout.reflectionNote.trim() && (
                  <div className="px-inset flex items-start gap-2 rounded-none p-3 text-xs">
                    <PxBook size={14} color="var(--px-plum-text)" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[10px] font-bold uppercase text-dim">
                        Phản tư đã lưu
                      </span>
                      <p className="mt-0.5 italic text-sub">
                        “{activeCloseout.reflectionNote.trim()}”
                      </p>
                    </div>
                  </div>
                )}

                {/* Dossier Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 pt-3.5 rpg-divider">
                  <span className="font-mono text-[11px] text-dim">
                    Đã chốt lúc {formatTimeVn(activeCloseout.closedAt)} · Thuần kỷ luật
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-primary flex items-center gap-1.5 rounded-none px-5 py-2 text-xs font-extrabold"
                  >
                    <PxCheck size={13} color="#140e04" />
                    <span>Đóng Phiếu Chốt Ngày</span>
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          /* ==================== STATE A: CLOSEOUT FORM ==================== */
          (() => {
            const m = preview!.metrics;
            const focusScoreColor =
              m.focusScore >= 70
                ? 'var(--px-green-text)'
                : m.focusScore >= 45
                  ? 'var(--px-gold-text)'
                  : 'var(--px-red-text)';
            const hasDamage = preview!.projectedHpDamage > 0;
            return (
              <div className="mt-4 space-y-4">
                {/* 4-Card Live Today Scorecard */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="px-inset rounded-none p-2.5">
                    <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-sub">
                      <PxTarget size={11} />
                      <span>Tập trung</span>
                    </div>
                    <div className="mt-1 font-mono text-base font-extrabold tabular-nums text-[var(--px-green-text)]">
                      {m.focusTotalMinutes}p
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-dim">
                      DW {m.deepWorkMinutes}p · Học {m.studyMinutes}p
                    </div>
                  </div>

                  <div className="px-inset rounded-none p-2.5">
                    <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-sub">
                      <PxFlame size={11} />
                      <span>Focus Score</span>
                    </div>
                    <div
                      className="mt-1 font-mono text-base font-extrabold tabular-nums"
                      style={{ color: focusScoreColor }}
                    >
                      {m.focusScore}%
                    </div>
                    <div className="rpg-bar-track mt-1 h-1.5 w-full">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, m.focusScore))}%`,
                          backgroundColor:
                            m.focusScore >= 70
                              ? 'var(--px-green)'
                              : m.focusScore >= 45
                                ? 'var(--px-gold)'
                                : 'var(--px-red)',
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="px-inset rounded-none p-2.5"
                    style={
                      m.darkRegenTriggered ? { borderColor: 'var(--px-red)' } : undefined
                    }
                  >
                    <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-sub">
                      <PxWarn size={11} danger={m.darkRegenTriggered || m.distractionMinutes > m.distractionBudgetMinutes} />
                      <span>Xao nhãng</span>
                    </div>
                    <div
                      className="mt-1 font-mono text-base font-extrabold tabular-nums"
                      style={{
                        color:
                          m.darkRegenTriggered || m.distractionMinutes > m.distractionBudgetMinutes
                            ? 'var(--px-red-text)'
                            : 'var(--text-primary)',
                      }}
                    >
                      {m.distractionMinutes}p
                      <span className="text-[11px] font-normal text-dim">
                        /{m.distractionBudgetMinutes}p
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-bold">
                      {m.darkRegenTriggered ? (
                        <span className="text-[var(--px-red-text)]">BOSS HỒI MÁU!</span>
                      ) : (
                        <span className="text-dim">Trong kiểm soát</span>
                      )}
                    </div>
                  </div>

                  <div className="px-inset rounded-none p-2.5">
                    <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-sub">
                      <PxSword size={11} />
                      <span>Sát thương Raid</span>
                    </div>
                    <div className="mt-1 font-mono text-base font-extrabold tabular-nums text-[var(--px-gold-text)]">
                      -{m.raidDamageToday} HP
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-dim">
                      Xong {m.questsCompleted} việc hôm nay
                    </div>
                  </div>
                </div>

                {/* Hardcore Unfinished Quests & Carry-Over Selector */}
                <div className="space-y-2">
                  {pendingQuests.length === 0 ? (
                    <div className="px-inset flex items-center gap-2.5 rounded-none border-[var(--px-green)] p-3 text-xs font-bold text-[var(--px-green-text)]">
                      <PxCheck size={15} color="var(--px-green-text)" />
                      <span>Không còn việc tồn đọng — Sạch bảng hôm nay (0 sát thương HP)!</span>
                    </div>
                  ) : (
                    <>
                      <div
                        className="rounded-none border-2 p-3"
                        style={{
                          borderColor: hasDamage ? 'var(--px-red)' : 'var(--px-green)',
                          backgroundColor: hasDamage
                            ? 'rgba(184, 58, 75, 0.14)'
                            : 'rgba(46, 139, 87, 0.14)',
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-main">
                            <PxSkull
                              size={15}
                              color={hasDamage ? 'var(--px-red-text)' : 'var(--px-green-text)'}
                            />
                            <span>
                              Còn <strong className="font-mono">{pendingQuests.length}</strong> việc
                              chưa xong → Dự kiến chịu{' '}
                              <strong
                                className="font-mono"
                                style={{
                                  color: hasDamage
                                    ? 'var(--px-red-text)'
                                    : 'var(--px-green-text)',
                                }}
                              >
                                -{preview!.projectedHpDamage} HP
                              </strong>{' '}
                              {m.plannedRestMode
                                ? '(Nghỉ Chủ Động bảo vệ)'
                                : 'chuẩn sinh tồn'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={toggleSelectAllCarryOver}
                            className="btn-secondary rounded-none px-2 py-1 font-mono text-[10px] font-bold"
                          >
                            {allCarrySelected ? 'Bỏ chọn tất cả' : 'Chọn dời tất cả'}
                          </button>
                        </div>

                        {preview!.projectedDieRisk && (
                          <div className="mt-2 flex items-center gap-1.5 border-t border-[var(--px-red)] pt-2 font-mono text-[11px] font-extrabold text-[var(--px-red-text)]">
                            <PxWarn size={13} danger />
                            <span>
                              NGUY CƠ KIỆT SỨC: HP hiện tại ({m.playerHp}/{m.playerMaxHp}) sẽ về 0
                              và quay về Checkpoint!
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="px-inset max-h-40 space-y-1.5 overflow-y-auto rounded-none p-2.5">
                        {pendingQuests.map((q) => {
                          const checked = carryOverIds.includes(q.id);
                          return (
                            <div
                              key={q.id}
                              className="flex items-center justify-between gap-2 border-b pb-1.5 last:border-b-0 last:pb-0 rpg-divider"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-pixel shrink-0 rounded-none border border-[var(--px-gold)] bg-[var(--bg-surface)] px-1 py-0.5 text-[8px] font-bold text-[var(--px-gold-text)]">
                                    {q.rank}
                                  </span>
                                  <span className="truncate text-xs font-bold text-main">
                                    {q.title}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px]">
                                  <span className="text-dim">{q.durationMinutes}p</span>
                                  <span
                                    className="font-bold"
                                    style={{
                                      color:
                                        q.hpDamage > 0
                                          ? 'var(--px-red-text)'
                                          : 'var(--text-muted)',
                                    }}
                                  >
                                    {q.hpDamage > 0 ? `-${q.hpDamage} HP` : '0 HP'}
                                  </span>
                                </div>
                              </div>

                              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-bold text-sub hover:text-main">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isBusy}
                                  onChange={() => toggleCarryOverQuest(q.id)}
                                />
                                <span>Dời sang mai</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* 30-Second Quick Reflection */}
                <div className="px-inset space-y-3 rounded-none p-3.5">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-main">
                      <span>Trạng thái cuối ngày (30 giây phản tư)</span>
                      <span className="font-mono text-[10px] text-dim">
                        Ngày mai: {tomorrowLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {MOOD_OPTIONS.map((opt) => {
                        const active = mood === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              soundEngine.click();
                              setMood(opt.value);
                            }}
                            className={`flex items-center justify-center gap-1.5 rounded-none px-2 py-2 text-xs font-bold ${
                              active ? 'btn-primary' : 'btn-secondary'
                            }`}
                          >
                            {opt.renderIcon(active)}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs font-bold text-sub">
                      Điểm nghẽn chính hôm nay (chọn nhiều nếu có):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {BOTTLENECK_CHIPS.map((tag) => {
                        const active = bottleneckTags.includes(tag);
                        const isPositive = tag === 'Nhịp ổn định';
                        return (
                          <button
                            key={tag}
                            type="button"
                            disabled={isBusy}
                            onClick={() => toggleBottleneck(tag)}
                            className={`rounded-none px-2.5 py-1 text-[11px] font-bold ${
                              active
                                ? isPositive
                                  ? 'btn-emerald'
                                  : 'btn-primary'
                                : 'btn-secondary'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="evening-closeout-reflection"
                      className="mb-1 block text-xs font-bold text-sub"
                    >
                      Ghi chú phản tư ngắn (tùy chọn)
                    </label>
                    <textarea
                      id="evening-closeout-reflection"
                      rows={2}
                      value={reflectionNote}
                      disabled={isBusy}
                      onChange={(e) => setReflectionNote(e.target.value)}
                      placeholder="Ghi nhanh 1 điều làm tốt hoặc điểm nghẽn chính hôm nay..."
                      className="w-full rounded-none p-2.5 text-xs"
                    />
                  </div>
                </div>

                {submitError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-none border-2 border-[var(--px-red)] bg-[var(--px-red)]/15 px-3 py-2 text-xs font-bold text-[var(--px-red-text)]"
                  >
                    <PxWarn size={14} danger className="mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 pt-3.5 rpg-divider">
                  <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-dim">
                    <PxShield size={12} color="var(--px-gold-text)" />
                    <span>Thuần kỷ luật — không cộng XP/Gold/HP miễn phí</span>
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={onClose}
                      className="btn-secondary rounded-none px-3.5 py-2 text-xs"
                    >
                      Hủy
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleConfirmSubmit()}
                      className={`${
                        hasDamage ? 'btn-crimson' : 'btn-primary'
                      } flex items-center gap-1.5 rounded-none px-4 py-2 text-xs font-extrabold`}
                    >
                      {isBusy ? (
                        <>
                          <PxRefresh size={13} className="animate-spin" />
                          <span>Đang chốt &amp; AI chấm điểm...</span>
                        </>
                      ) : (
                        <>
                          <PxSparkle size={13} color={hasDamage ? '#ffffff' : '#140e04'} />
                          <span>Xác nhận Chốt Ngày &amp; AI Chấm Điểm</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};

export default EveningCloseoutModal;
