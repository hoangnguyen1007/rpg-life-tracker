import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ActivityCategory,
  AttributeKey,
  DailyFocusTrendPoint,
  HeatmapDayCell,
  LongTermAnalyticsPayload,
  StatGrowthBalanceItem,
  WeeklyGrade,
  WeeklyReviewRecord,
} from '../types/system';
import { systemApi } from '../utils/api';
import {
  PixelRivets,
  PxBolt,
  PxCalendar,
  PxCheck,
  PxClock,
  PxFlame,
  PxRefresh,
  PxScroll,
  PxShield,
  PxSparkle,
  PxStar,
  PxStatAgi,
  PxStatCha,
  PxStatInt,
  PxStatPer,
  PxStatStr,
  PxStatVit,
  PxTarget,
  PxWarn,
} from './PixelIcons';

const STAT_ORDER: AttributeKey[] = ['INT', 'PER', 'STR', 'VIT', 'AGI', 'CHA'];

const STAT_INFO: Record<
  AttributeKey,
  {
    name: string;
    desc: string;
    hex: string;
    textVar: string;
    Icon: React.FC<{ size?: number; color?: string; className?: string }>;
  }
> = {
  INT: {
    name: 'Intelligence',
    desc: 'Tư duy hệ thống & Chuyên môn',
    hex: '#3267a8',
    textVar: 'var(--px-blue-text)',
    Icon: PxStatInt,
  },
  PER: {
    name: 'Perception',
    desc: 'Ngoại ngữ & Nghiên cứu',
    hex: '#2f7d8c',
    textVar: 'var(--px-blue-text)',
    Icon: PxStatPer,
  },
  STR: {
    name: 'Strength',
    desc: 'Thể lực & Kỷ luật hành động',
    hex: '#c99330',
    textVar: 'var(--px-gold-text)',
    Icon: PxStatStr,
  },
  VIT: {
    name: 'Vitality',
    desc: 'Giấc ngủ & Hồi phục bền bỉ',
    hex: '#b83a4b',
    textVar: 'var(--px-red-text)',
    Icon: PxStatVit,
  },
  AGI: {
    name: 'Agility',
    desc: 'Tốc độ Deep Work & Timeboxing',
    hex: '#2e8b57',
    textVar: 'var(--px-green-text)',
    Icon: PxStatAgi,
  },
  CHA: {
    name: 'Charisma',
    desc: 'Giao tiếp & Ảnh hưởng',
    hex: '#73499e',
    textVar: 'var(--px-plum-text)',
    Icon: PxStatCha,
  },
};

const GRADE_META: Record<
  WeeklyGrade,
  {
    rankLabel: string;
    subtitle: string;
    bgHex: string;
    fgHex: string;
    subHex: string;
  }
> = {
  S: {
    rankLabel: 'HUYỀN THOẠI',
    subtitle: 'Nhịp kỷ luật đỉnh cao',
    bgHex: '#c99330',
    fgHex: '#140e04',
    subHex: '#3b2506',
  },
  A: {
    rankLabel: 'TINH ANH',
    subtitle: 'Tập trung sắc bén & ổn định',
    bgHex: '#73499e',
    fgHex: '#f3ead8',
    subHex: '#e2d4f5',
  },
  B: {
    rankLabel: 'VỮNG VÀNG',
    subtitle: 'Tiến độ tốt, còn dư địa bứt phá',
    bgHex: '#2e8b57',
    fgHex: '#ffffff',
    subHex: '#d9f5e5',
  },
  C: {
    rankLabel: 'GIỮ NHỊP',
    subtitle: 'Cần siết lại khung giờ tập trung',
    bgHex: '#3267a8',
    fgHex: '#ffffff',
    subHex: '#d4e7fc',
  },
  D: {
    rankLabel: 'BÁO ĐỘNG',
    subtitle: 'Cần gỡ ngay điểm nghẽn xao nhãng',
    bgHex: '#b83a4b',
    fgHex: '#ffffff',
    subHex: '#fbd9de',
  },
};

const STAT_STATUS_META: Record<
  StatGrowthBalanceItem['status'],
  { label: string; bgHex: string; fgHex: string }
> = {
  strong: {
    label: 'Mạnh',
    bgHex: '#2e8b57',
    fgHex: '#ffffff',
  },
  balanced: {
    label: 'Cân bằng',
    bgHex: '#3267a8',
    fgHex: '#ffffff',
  },
  lagging: {
    label: 'Đang hụt',
    bgHex: '#b83a4b',
    fgHex: '#ffffff',
  },
};

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  deep_work: 'Deep Work',
  study_research: 'Học tập',
  communication: 'Giao tiếp',
  distraction: 'Xao nhãng',
  other: 'Khác',
  idle: 'Nghỉ',
};

/**
 * 16-bit solid retro emerald steps:
 * Dark Obsidian: #182921 -> #224a34 -> #2e734c -> #38a169 -> #52c484
 * Light Parchment: crisp warm-parchment emerald ramp with high-contrast ink text
 */
const HEATMAP_INTENSITY_CLS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#dfd1b5] text-[#6e5c45] dark:bg-[#182921] dark:text-[#7c9c8b]',
  1: 'bg-[#b3d4bc] text-[#173b27] dark:bg-[#224a34] dark:text-[#b7e0c6]',
  2: 'bg-[#6fb38a] text-[#0d291a] dark:bg-[#2e734c] dark:text-[#e6f7ec]',
  3: 'bg-[#2e8b57] text-[#ffffff] dark:bg-[#38a169] dark:text-[#ffffff]',
  4: 'bg-[#1f6b40] text-[#fff8e0] dark:bg-[#52c484] dark:text-[#0d1f15]',
};

function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes || 0));
  if (safe < 60) return `${safe}p`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m === 0 ? `${h}g` : `${h}g ${m}p`;
}

function formatHoursBig(minutes: number): string {
  const safe = Math.max(0, minutes || 0);
  if (safe < 60) return `${Math.round(safe)}p`;
  return `${(safe / 60).toFixed(1)}h`;
}

function formatDateVn(dateKey: string): string {
  if (!dateKey) return '—';
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatShortRange(start: string, end: string): string {
  const s = start?.split('-');
  const e = end?.split('-');
  if (s?.length === 3 && e?.length === 3) {
    return `${s[2]}/${s[1]} – ${e[2]}/${e[1]}`;
  }
  return `${start} – ${end}`;
}

function formatTimestampVn(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const WeeklyReviewDossier: React.FC = () => {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [analytics, setAnalytics] = useState<LongTermAnalyticsPayload | null>(null);
  const [reviews, setReviews] = useState<WeeklyReviewRecord[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [activeHeatmapDate, setActiveHeatmapDate] = useState<string | null>(null);
  const [activeTrendDate, setActiveTrendDate] = useState<string | null>(null);

  const loadReviewData = useCallback(async (targetRange: '7d' | '30d') => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemApi.getLongTermReview(targetRange);
      setAnalytics(res.analytics);
      const list = Array.isArray(res.reviews) ? res.reviews : [];
      setReviews(list);
      setSelectedReviewId((prev) =>
        prev && list.some((r) => r.id === prev) ? prev : list[0]?.id ?? null
      );
      if (res.analytics.heatmap30d.length > 0) {
        const lastCell = res.analytics.heatmap30d[res.analytics.heatmap30d.length - 1];
        setActiveHeatmapDate(lastCell.dateKey);
      }
      if (res.analytics.dailyTrend.length > 0) {
        const lastPt = res.analytics.dailyTrend[res.analytics.dailyTrend.length - 1];
        setActiveTrendDate(lastPt.dateKey);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tải dữ liệu tổng kết 7/30 ngày.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviewData(range);
  }, [range, loadReviewData]);

  const handleGenerateReview = async () => {
    setGenerating(true);
    setError(null);
    setStatusNotice(null);
    try {
      const res = await systemApi.generateWeeklyReview();
      const list = Array.isArray(res.reviews) ? res.reviews : [res.review];
      setReviews(list);
      if (res.review?.id) {
        setSelectedReviewId(res.review.id);
      }
      if (range === '7d' && res.analytics) {
        setAnalytics(res.analytics);
      } else {
        await loadReviewData(range);
      }
      setStatusNotice(
        `Đã tạo hồ sơ chẩn đoán tuần ${formatShortRange(
          res.review.weekStart,
          res.review.weekEnd
        )} (Hạng ${res.review.grade}).`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tạo chẩn đoán AI tuần này.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const selectedReviewIndex = useMemo(() => {
    if (reviews.length === 0) return -1;
    const idx = reviews.findIndex((r) => r.id === selectedReviewId);
    return idx >= 0 ? idx : 0;
  }, [reviews, selectedReviewId]);

  const selectedReview =
    selectedReviewIndex >= 0 ? reviews[selectedReviewIndex] : null;
  const previousReview =
    selectedReviewIndex >= 0 && selectedReviewIndex + 1 < reviews.length
      ? reviews[selectedReviewIndex + 1]
      : null;

  const activeHeatmapCell: HeatmapDayCell | null = useMemo(() => {
    if (!analytics || analytics.heatmap30d.length === 0) return null;
    return (
      analytics.heatmap30d.find((c) => c.dateKey === activeHeatmapDate) ||
      analytics.heatmap30d[analytics.heatmap30d.length - 1]
    );
  }, [analytics, activeHeatmapDate]);

  const activeTrendPoint: DailyFocusTrendPoint | null = useMemo(() => {
    if (!analytics || analytics.dailyTrend.length === 0) return null;
    return (
      analytics.dailyTrend.find((p) => p.dateKey === activeTrendDate) ||
      analytics.dailyTrend[analytics.dailyTrend.length - 1]
    );
  }, [analytics, activeTrendDate]);

  const orderedStats = useMemo(() => {
    if (!analytics) return [];
    const byKey = new Map(analytics.statBalance.map((item) => [item.stat, item]));
    return STAT_ORDER.map(
      (stat) =>
        byKey.get(stat) || {
          stat,
          currentValue: 0,
          sharePct: 0,
          status: 'balanced' as const,
        }
    );
  }, [analytics]);

  const maxStatValue = useMemo(() => {
    if (orderedStats.length === 0) return 10;
    return Math.max(10, ...orderedStats.map((s) => s.currentValue));
  }, [orderedStats]);

  const weakestSet = useMemo(
    () => new Set(analytics?.weakestStats ?? []),
    [analytics]
  );

  // Pure SVG 16-bit Trend Chart Geometry
  const trendChart = useMemo(() => {
    const pts = analytics?.dailyTrend ?? [];
    const svgW = 640;
    const svgH = 228;
    const padL = 44;
    const padR = 12;
    const padT = 16;
    const padB = 30;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    const rawMax = Math.max(
      30,
      ...pts.map((p) =>
        Math.max(p.deepWorkMinutes + p.studyMinutes, p.distractionMinutes)
      )
    );
    const step = rawMax <= 120 ? 30 : rawMax <= 360 ? 60 : 120;
    const maxY = Math.ceil(rawMax / step) * step;
    const yTicks = [0, Math.round(maxY / 3), Math.round((maxY * 2) / 3), maxY];

    return { pts, svgW, svgH, padL, padR, padT, padB, plotW, plotH, maxY, yTicks };
  }, [analytics]);

  const totalCombinedFocusMins = useMemo(() => {
    if (!analytics) return 0;
    const combined = analytics.totalDeepWorkMinutes + analytics.totalStudyMinutes;
    return combined > 0 ? combined : analytics.totalFocusMinutes;
  }, [analytics]);

  const topHelpful = useMemo(
    () => (analytics?.topHelpfulApps ?? []).slice(0, 5),
    [analytics]
  );
  const topDraining = useMemo(
    () => (analytics?.topDrainingApps ?? []).slice(0, 5),
    [analytics]
  );
  const maxHelpfulMins = Math.max(1, ...topHelpful.map((a) => a.minutes));
  const maxDrainingMins = Math.max(1, ...topDraining.map((a) => a.minutes));

  if (loading && !analytics) {
    return (
      <div className="rpg-window relative flex min-h-[260px] flex-col items-center justify-center gap-3 p-8 text-center">
        <PixelRivets />
        <PxRefresh size={26} color="var(--px-gold-text)" className="animate-spin" />
        <p className="font-pixel text-xs text-main">ĐANG TỔNG HỢP HỒ SƠ HIỆU SUẤT...</p>
        <p className="text-xs text-dim">
          Đang gom dữ liệu tập trung, xao nhãng, quest và chỉ số từ SQLite.
        </p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="rpg-pane relative space-y-3 p-6 text-center">
        <PixelRivets />
        <div className="flex justify-center">
          <PxWarn size={26} danger />
        </div>
        <p className="font-display text-sm font-bold text-main">
          Không thể tải Hồ Sơ Tổng Kết 7/30 Ngày
        </p>
        <p className="font-mono text-xs text-[var(--px-red-text)]">{error}</p>
        <button
          type="button"
          onClick={() => loadReviewData(range)}
          className="btn-secondary inline-flex items-center gap-2 rounded-none px-4 py-2 text-xs"
        >
          <PxRefresh size={13} />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  if (!analytics) return null;

  const gradeInfo = GRADE_META[analytics.grade] || GRADE_META.C;
  const focusScoreRounded = Math.round(analytics.avgFocusScore);
  const completionRounded = Math.round(analytics.completionRatePct);

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      {/* Status / Error Banner */}
      {error && (
        <div className="px-inset flex flex-wrap items-center justify-between gap-2 border-2 border-[var(--px-red)] px-4 py-2.5 text-xs text-[var(--px-red-text)]">
          <div className="flex items-center gap-2">
            <PxWarn size={14} danger />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-mono text-[11px] underline"
          >
            Đóng
          </button>
        </div>
      )}

      {statusNotice && (
        <div className="px-inset flex flex-wrap items-center justify-between gap-2 border-2 border-[var(--px-green)] px-4 py-2.5 text-xs text-[var(--px-green-text)]">
          <div className="flex items-center gap-2">
            <PxCheck size={14} color="var(--px-green-text)" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="font-mono text-[11px] underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* ==================== 1. TOP HERO SUMMARY BAR ==================== */}
      <section className="rpg-window relative p-4 sm:p-5">
        <PixelRivets />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* 16-Bit Beveled Stamp Grade Plaque + Title */}
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="relative flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-none border-2 border-[var(--border-ink)] sm:h-24 sm:w-24"
              style={{
                backgroundColor: gradeInfo.bgHex,
                boxShadow:
                  'inset 2px 2px 0 rgba(255,255,255,0.26), inset -2px -2px 0 rgba(0,0,0,0.42), 3px 3px 0 rgba(0,0,0,0.45)',
              }}
            >
              <PixelRivets />
              <span
                className="font-pixel text-[8px] font-bold tracking-wider"
                style={{ color: gradeInfo.subHex }}
              >
                HẠNG TUẦN
              </span>
              <span
                className="font-pixel text-4xl font-bold leading-none sm:text-5xl"
                style={{ color: gradeInfo.fgHex }}
              >
                {analytics.grade}
              </span>
              <span
                className="mt-1 font-mono text-[9px] font-bold"
                style={{ color: gradeInfo.subHex }}
              >
                {gradeInfo.rankLabel}
              </span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-2 py-0.5 font-pixel text-[10px] font-bold text-[#140e04]">
                  DOSSIER {range === '7d' ? '7 NGÀY' : '30 NGÀY'}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-dim">
                  <PxCalendar size={13} />
                  {formatDateVn(analytics.startDate)} → {formatDateVn(analytics.endDate)}
                </span>
              </div>
              <h2 className="font-display text-lg font-extrabold text-main sm:text-xl">
                Hồ Sơ Tổng Kết &amp; Chẩn Đoán Hiệu Suất
              </h2>
              <p className="text-xs text-sub">{gradeInfo.subtitle}</p>
            </div>
          </div>

          {/* Range Switcher + AI Diagnosis CTA */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Chọn khoảng thời gian"
              className="px-inset inline-flex p-0.5"
            >
              <button
                type="button"
                onClick={() => setRange('7d')}
                disabled={loading}
                className={`rounded-none px-3 py-1.5 font-mono text-xs font-bold ${
                  range === '7d'
                    ? 'border border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                    : 'text-sub hover:text-main'
                }`}
              >
                7 Ngày
              </button>
              <button
                type="button"
                onClick={() => setRange('30d')}
                disabled={loading}
                className={`rounded-none px-3 py-1.5 font-mono text-xs font-bold ${
                  range === '30d'
                    ? 'border border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                    : 'text-sub hover:text-main'
                }`}
              >
                30 Ngày
              </button>
            </div>

            <button
              type="button"
              onClick={() => loadReviewData(range)}
              disabled={loading}
              title="Làm mới số liệu"
              className="btn-secondary inline-flex items-center gap-1.5 rounded-none px-3 py-2 text-xs"
            >
              <PxRefresh size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateReview}
              disabled={generating}
              className="btn-arcane inline-flex items-center gap-1.5 rounded-none px-3.5 py-2 text-xs"
            >
              {generating ? (
                <PxRefresh size={13} color="#ffffff" className="animate-spin" />
              ) : (
                <PxSparkle size={13} />
              )}
              <span>
                {generating
                  ? 'Đang chẩn đoán AI...'
                  : 'Tạo Chẩn Đoán AI Tuần Này'}
              </span>
            </button>
          </div>
        </div>

        {/* 4 Hero KPI Stat Tiles */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t-2 pt-4 sm:grid-cols-2 lg:grid-cols-4 studio-divider">
          {/* KPI 1: Total Deep Work + Study */}
          <div className="px-inset p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sub">
                Deep Work + Học Tập
              </span>
              <PxFlame size={16} />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-pixel text-2xl font-bold text-[var(--px-green-text)]">
                {formatHoursBig(totalCombinedFocusMins)}
              </span>
              <span className="font-mono text-[11px] text-dim">
                ({formatDuration(totalCombinedFocusMins)})
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[10px] text-dim">
              <span>DW: {formatDuration(analytics.totalDeepWorkMinutes)}</span>
              <span>Học: {formatDuration(analytics.totalStudyMinutes)}</span>
              <span className="font-semibold text-[var(--px-red-text)]">
                Xao nhãng: {formatDuration(analytics.totalDistractionMinutes)}
              </span>
            </div>
          </div>

          {/* KPI 2: Avg Focus Score */}
          <div className="px-inset p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sub">
                Điểm Tập Trung TB
              </span>
              <PxBolt size={15} />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-pixel text-2xl font-bold text-[var(--px-blue-text)]">
                {focusScoreRounded}%
              </span>
              <span className="font-mono text-[10px] text-dim">
                {focusScoreRounded >= 75
                  ? 'Rất sâu'
                  : focusScoreRounded >= 50
                  ? 'Ổn định'
                  : 'Nhiều nhiễu'}
              </span>
            </div>
            <div className="rpg-bar-track mt-2 h-2.5 w-full">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, Math.max(0, focusScoreRounded))}%`,
                  backgroundColor:
                    focusScoreRounded >= 75
                      ? '#2e8b57'
                      : focusScoreRounded >= 50
                      ? '#c99330'
                      : '#b83a4b',
                }}
              />
            </div>
          </div>

          {/* KPI 3: Quest Completion Rate */}
          <div className="px-inset p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sub">
                Hoàn Thành Quest
              </span>
              <PxCheck size={15} color="var(--px-plum-text)" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-pixel text-2xl font-bold text-[var(--px-plum-text)]">
                {completionRounded}%
              </span>
              <span className="font-mono text-[11px] text-dim">
                {analytics.questsCompleted}/{analytics.questsTotal} quest
              </span>
            </div>
            <div className="rpg-bar-track mt-2 h-2.5 w-full">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, Math.max(0, completionRounded))}%`,
                  backgroundColor: '#73499e',
                }}
              />
            </div>
          </div>

          {/* KPI 4: Empirical Peak Hour */}
          <div className="px-inset border-2 border-[var(--px-gold)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--px-gold-text)]">
                Giờ Vàng Thực Tế
              </span>
              <PxClock size={15} color="var(--px-gold-text)" />
            </div>
            <div className="mt-1.5 font-pixel text-lg font-bold text-[var(--px-gold-text)] sm:text-xl">
              {analytics.empiricalPeakHour || 'Chưa đủ dữ liệu'}
            </div>
            <p className="mt-1.5 text-[11px] text-sub">
              {analytics.empiricalPeakHour
                ? 'Khung giờ não bộ đạt độ sâu cao nhất từ log PC'
                : 'Bật Trợ Lý PC để đo tự động khung giờ vàng thực tế'}
            </p>
          </div>
        </div>
      </section>

      {/* ==================== 2. HEATMAP + DAILY TREND CHART ==================== */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* 30-Day Pixel Focus Heatmap */}
        <section className="rpg-pane relative flex min-w-0 flex-col justify-between p-4 sm:p-5 xl:col-span-5">
          <PixelRivets />
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <PxCalendar size={15} color="var(--px-green-text)" />
                <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                  Bản Đồ Nhiệt Tập Trung 30 Ngày
                </h3>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-dim">
                <span>Ít</span>
                {([0, 1, 2, 3, 4] as const).map((lvl) => (
                  <span
                    key={lvl}
                    title={`Mức cường độ ${lvl}/4`}
                    className={`h-3 w-3 rounded-none border border-[var(--border-ink)] ${HEATMAP_INTENSITY_CLS[lvl]}`}
                  />
                ))}
                <span>Sâu</span>
              </div>
            </div>

            {/* Live Cell Inspector */}
            {activeHeatmapCell ? (
              <div className="px-inset mt-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-mono text-[11px]">
                <span className="font-bold text-main">
                  {formatDateVn(activeHeatmapCell.dateKey)}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                  <span className="font-semibold text-[var(--px-green-text)]">
                    Focus: {formatDuration(activeHeatmapCell.focusMinutes)}
                  </span>
                  <span className="font-semibold text-[var(--px-red-text)]">
                    Xao nhãng: {formatDuration(activeHeatmapCell.distractionMinutes)}
                  </span>
                  <span className="font-semibold text-[var(--px-plum-text)]">
                    Quest: {activeHeatmapCell.questsCompleted}
                  </span>
                  <span className="text-dim">
                    Score: {Math.round(activeHeatmapCell.focusScore)}%
                  </span>
                </div>
              </div>
            ) : null}

            {/* 30 Crisp Square Cells (rounded-none, 2px dark ink borders) */}
            {analytics.heatmap30d.length === 0 ? (
              <div className="px-inset mt-4 p-6 text-center text-xs text-dim">
                Chưa có dữ liệu 30 ngày gần nhất.
              </div>
            ) : (
              <div className="px-inset mt-3 grid grid-cols-6 gap-1.5 p-2.5 sm:grid-cols-10">
                {analytics.heatmap30d.slice(-30).map((cell) => {
                  const isActive = activeHeatmapCell?.dateKey === cell.dateKey;
                  const dayNum = cell.dateKey.slice(8, 10);
                  const tooltip = `${cell.dateKey} · Focus: ${cell.focusMinutes}p · Xao nhãng: ${cell.distractionMinutes}p · Quest: ${cell.questsCompleted} · Focus Score: ${Math.round(cell.focusScore)}%`;
                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      title={tooltip}
                      onMouseEnter={() => setActiveHeatmapDate(cell.dateKey)}
                      onFocus={() => setActiveHeatmapDate(cell.dateKey)}
                      onClick={() => setActiveHeatmapDate(cell.dateKey)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-none border-2 border-[var(--border-ink)] font-mono ${
                        HEATMAP_INTENSITY_CLS[cell.intensity]
                      } ${
                        isActive
                          ? 'outline outline-2 outline-offset-1 outline-[var(--px-gold)]'
                          : 'hover:brightness-110'
                      }`}
                    >
                      <span className="text-[10px] font-bold leading-none">{dayNum}</span>
                      <span className="mt-0.5 text-[8px] leading-none opacity-90">
                        {cell.questsCompleted > 0
                          ? `Q${cell.questsCompleted}`
                          : cell.focusMinutes > 0
                          ? `${cell.focusMinutes}p`
                          : '·'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="mt-3 border-t-2 pt-2.5 text-[11px] text-dim studio-divider">
            Di chuột hoặc chạm vào từng ô ngày để xem chi tiết số phút tập trung, xao nhãng và nhiệm vụ hoàn thành.
          </p>
        </section>

        {/* Daily Deep Work vs Distraction Trend Bar Chart (Pure 16-Bit SVG) */}
        <section className="rpg-pane relative flex min-w-0 flex-col justify-between p-4 sm:p-5 xl:col-span-7">
          <PixelRivets />
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <PxScroll size={15} color="var(--px-gold-text)" />
                <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                  Xu Hướng Tập Trung vs Xao Nhãng ({range === '7d' ? '7 Ngày' : '30 Ngày'})
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-sub">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 border border-[var(--border-ink)]"
                    style={{ backgroundColor: '#2e8b57' }}
                  />
                  Deep Work
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 border border-[var(--border-ink)]"
                    style={{ backgroundColor: '#3267a8' }}
                  />
                  Học tập
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 border border-[var(--border-ink)]"
                    style={{ backgroundColor: '#b83a4b' }}
                  />
                  Xao nhãng
                </span>
              </div>
            </div>

            {/* Active Day Readout Bar */}
            {activeTrendPoint && (
              <div className="px-inset mt-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-mono text-[11px]">
                <span className="font-bold text-main">
                  Ngày {activeTrendPoint.label} ({activeTrendPoint.dateKey})
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                  <span className="font-semibold text-[var(--px-green-text)]">
                    DW: {formatDuration(activeTrendPoint.deepWorkMinutes)}
                  </span>
                  <span className="font-semibold text-[var(--px-blue-text)]">
                    Học: {formatDuration(activeTrendPoint.studyMinutes)}
                  </span>
                  <span className="font-semibold text-[var(--px-red-text)]">
                    Xao nhãng: {formatDuration(activeTrendPoint.distractionMinutes)}
                  </span>
                  <span className="text-sub">
                    Quest: {activeTrendPoint.questsCompleted} · Score:{' '}
                    {Math.round(activeTrendPoint.focusScore)}%
                  </span>
                </div>
              </div>
            )}

            {/* Pure Responsive 16-Bit SVG Chart (shapeRendering="crispEdges") */}
            {trendChart.pts.length === 0 ? (
              <div className="px-inset mt-4 p-8 text-center text-xs text-dim">
                Chưa có dữ liệu biểu đồ xu hướng cho khoảng thời gian này.
              </div>
            ) : (
              <div className="px-inset mt-3 w-full overflow-hidden p-2">
                <svg
                  viewBox={`0 0 ${trendChart.svgW} ${trendChart.svgH}`}
                  shapeRendering="crispEdges"
                  className="block h-auto w-full select-none"
                  role="img"
                  aria-label="Biểu đồ xu hướng Deep Work, Học tập và Xao nhãng theo ngày"
                >
                  {/* Horizontal Gridlines & Y-Axis Labels */}
                  {trendChart.yTicks.map((tick) => {
                    const ratio = tick / Math.max(1, trendChart.maxY);
                    const y = Math.round(
                      trendChart.padT + trendChart.plotH * (1 - ratio)
                    );
                    return (
                      <g key={tick}>
                        <line
                          x1={trendChart.padL}
                          y1={y}
                          x2={trendChart.svgW - trendChart.padR}
                          y2={y}
                          stroke={
                            tick === 0 ? 'var(--border-ink)' : 'var(--border-hairline)'
                          }
                          strokeWidth={tick === 0 ? '2' : '1'}
                          strokeDasharray={tick === 0 ? undefined : '3 3'}
                        />
                        <text
                          x={trendChart.padL - 6}
                          y={y + 3}
                          textAnchor="end"
                          fill="var(--text-muted)"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {formatDuration(tick)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Vertical Crisp 16-Bit Bars per Day */}
                  {trendChart.pts.map((pt, idx) => {
                    const count = trendChart.pts.length;
                    const slotW = trendChart.plotW / Math.max(1, count);
                    const slotX = Math.round(trendChart.padL + idx * slotW);
                    const innerPad = count > 14 ? 2 : 8;
                    const usableW = Math.max(4, Math.floor(slotW - innerPad * 2));
                    const gap = count > 14 ? 1 : 3;
                    const barW = Math.max(2, Math.floor((usableW - gap) / 2));

                    const baseY = trendChart.padT + trendChart.plotH;
                    const dwH = Math.round(
                      (pt.deepWorkMinutes / Math.max(1, trendChart.maxY)) *
                        trendChart.plotH
                    );
                    const studyH = Math.round(
                      (pt.studyMinutes / Math.max(1, trendChart.maxY)) *
                        trendChart.plotH
                    );
                    const distH = Math.round(
                      (pt.distractionMinutes / Math.max(1, trendChart.maxY)) *
                        trendChart.plotH
                    );

                    const isSelected = activeTrendPoint?.dateKey === pt.dateKey;
                    const showLabel =
                      count <= 10 ||
                      idx === 0 ||
                      idx === count - 1 ||
                      idx % 5 === 0;

                    const focusBarX = slotX + innerPad;
                    const distBarX = focusBarX + barW + gap;

                    return (
                      <g
                        key={pt.dateKey}
                        className="cursor-pointer"
                        onMouseEnter={() => setActiveTrendDate(pt.dateKey)}
                        onClick={() => setActiveTrendDate(pt.dateKey)}
                      >
                        <title>
                          {`${pt.dateKey}: Deep Work ${pt.deepWorkMinutes}p · Học ${pt.studyMinutes}p · Xao nhãng ${pt.distractionMinutes}p · Quest ${pt.questsCompleted}`}
                        </title>

                        {/* Highlight backdrop on active column */}
                        <rect
                          x={slotX}
                          y={trendChart.padT}
                          width={Math.ceil(slotW)}
                          height={trendChart.plotH}
                          fill={isSelected ? 'var(--accent-soft)' : 'transparent'}
                        />

                        {/* Deep Work bar (flat retro emerald) */}
                        {dwH > 0 && (
                          <rect
                            x={focusBarX}
                            y={baseY - Math.max(2, dwH)}
                            width={barW}
                            height={Math.max(2, dwH)}
                            fill="#2e8b57"
                          />
                        )}

                        {/* Study bar (stacked above Deep Work, flat retro cobalt) */}
                        {studyH > 0 && (
                          <rect
                            x={focusBarX}
                            y={baseY - (dwH > 0 ? Math.max(2, dwH) : 0) - Math.max(2, studyH)}
                            width={barW}
                            height={Math.max(2, studyH)}
                            fill="#3267a8"
                          />
                        )}

                        {/* Distraction bar (paired right side, flat retro crimson) */}
                        {distH > 0 && (
                          <rect
                            x={distBarX}
                            y={baseY - Math.max(2, distH)}
                            width={barW}
                            height={Math.max(2, distH)}
                            fill="#b83a4b"
                          />
                        )}

                        {/* X-Axis Tick Label */}
                        {showLabel && (
                          <text
                            x={Math.round(slotX + slotW / 2)}
                            y={baseY + 15}
                            textAnchor="middle"
                            fill={
                              isSelected
                                ? 'var(--px-gold-text)'
                                : 'var(--text-muted)'
                            }
                            fontSize="9"
                            fontWeight={isSelected ? '700' : '500'}
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          <p className="mt-3 border-t-2 pt-2.5 text-[11px] text-dim studio-divider">
            Mỗi ngày so sánh trực tiếp cột trái (Deep Work + Học tập) với cột phải (Xao nhãng) để phát hiện ngày rò rỉ tập trung.
          </p>
        </section>
      </div>

      {/* ==================== 3. 2-COLUMN APP & STAT INSIGHTS ==================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Top 5 Helpful vs Top 5 Draining Apps */}
        <section className="rpg-pane relative min-w-0 divide-y-2 studio-divider lg:col-span-6">
          <PixelRivets />
          {/* Top 5 Helpful Apps */}
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PxFlame size={15} />
                <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                  Top 5 App Tăng Tập Trung
                </h3>
              </div>
              <span className="font-pixel text-[9px] text-[var(--px-green-text)]">
                DEEP WORK &amp; HỌC
              </span>
            </div>

            {topHelpful.length === 0 ? (
              <div className="px-inset p-4 text-center text-xs text-dim">
                Chưa ghi nhận ứng dụng tập trung nào trong khoảng thời gian này.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topHelpful.map((app, idx) => {
                  const pct = Math.max(
                    6,
                    Math.round((app.minutes / maxHelpfulMins) * 100)
                  );
                  return (
                    <div
                      key={`${app.processName}-${idx}`}
                      className="px-inset min-w-0 space-y-1.5 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-none border border-[var(--border-ink)] bg-[#2e8b57] px-1.5 py-0.5 font-pixel text-[9px] font-bold text-white">
                            #{idx + 1}
                          </span>
                          <span
                            title={app.processName}
                            className="truncate font-mono font-bold text-main"
                          >
                            {app.processName}
                          </span>
                          <span className="hidden shrink-0 rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[9px] text-dim sm:inline">
                            {CATEGORY_LABEL[app.category] || app.category}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-[var(--px-green-text)]">
                          {formatDuration(app.minutes)}
                        </span>
                      </div>
                      <div className="rpg-bar-track h-2.5 w-full">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              app.category === 'study_research'
                                ? '#3267a8'
                                : '#2e8b57',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top 5 Draining Apps */}
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PxWarn size={15} danger />
                <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                  Top 5 App Hút Thời Gian
                </h3>
              </div>
              <span className="font-pixel text-[9px] text-[var(--px-red-text)]">
                XAO NHÃNG / RÒ RỈ
              </span>
            </div>

            {topDraining.length === 0 ? (
              <div className="px-inset border-2 border-[var(--px-green)] p-4 text-center text-xs text-[var(--px-green-text)]">
                Tuyệt vời! Chưa phát hiện ứng dụng xao nhãng đáng kể trong kỳ này.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topDraining.map((app, idx) => {
                  const pct = Math.max(
                    6,
                    Math.round((app.minutes / maxDrainingMins) * 100)
                  );
                  return (
                    <div
                      key={`${app.processName}-${idx}`}
                      className="px-inset min-w-0 space-y-1.5 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-none border border-[var(--border-ink)] bg-[#b83a4b] px-1.5 py-0.5 font-pixel text-[9px] font-bold text-white">
                            #{idx + 1}
                          </span>
                          <span
                            title={app.processName}
                            className="truncate font-mono font-bold text-main"
                          >
                            {app.processName}
                          </span>
                          <span className="hidden shrink-0 rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[9px] text-dim sm:inline">
                            {CATEGORY_LABEL[app.category] || app.category}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-[var(--px-red-text)]">
                          {formatDuration(app.minutes)}
                        </span>
                      </div>
                      <div className="rpg-bar-track h-2.5 w-full">
                        <div
                          className="h-full"
                          style={{ width: `${pct}%`, backgroundColor: '#b83a4b' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right: 6-Stat Balance with Hand-Crafted PxStat* Icons */}
        <section className="rpg-pane relative min-w-0 p-4 sm:p-5 lg:col-span-6">
          <PixelRivets />
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
            <div className="flex items-center gap-2">
              <PxShield size={15} color="var(--px-gold-text)" />
              <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                Cân Bằng 6 Chỉ Số (INT / PER / STR / VIT / AGI / CHA)
              </h3>
            </div>
            <span className="font-mono text-[10px] text-dim">Tỉ trọng hiện tại</span>
          </div>

          {/* Weakest Stats Callout */}
          {analytics.weakestStats.length > 0 && (
            <div className="px-inset mb-3.5 flex flex-wrap items-center gap-2 border-2 border-[var(--px-red)] px-3 py-2 text-xs">
              <PxWarn size={15} danger />
              <span className="font-semibold text-main">
                Chỉ số đang tụt cần ưu tiên:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {analytics.weakestStats.map((st) => (
                  <span
                    key={st}
                    className="rounded-none border border-[var(--border-ink)] bg-[#b83a4b] px-2 py-0.5 font-pixel text-[10px] font-bold text-white"
                  >
                    {st} · {STAT_INFO[st]?.name ?? st}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 6 Stat Rows */}
          <div className="space-y-2.5">
            {orderedStats.map((item) => {
              const meta = STAT_INFO[item.stat];
              const badge = STAT_STATUS_META[item.status];
              const StatIcon = meta.Icon;
              const isWeak = weakestSet.has(item.stat) || item.status === 'lagging';
              const barPct = Math.min(
                100,
                Math.max(4, Math.round((item.currentValue / maxStatValue) * 100))
              );

              return (
                <div
                  key={item.stat}
                  className={`px-inset p-2.5 ${
                    isWeak ? 'border-2 border-[var(--px-red)]' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)]">
                        <StatIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="font-pixel text-[11px] font-bold"
                            style={{ color: meta.textVar }}
                          >
                            {item.stat}
                          </span>
                          <span className="text-xs font-bold text-main">
                            {meta.name}
                          </span>
                          <span
                            className="rounded-none border border-[var(--border-ink)] px-1.5 py-0.5 font-mono text-[9px] font-bold"
                            style={{
                              backgroundColor: badge.bgHex,
                              color: badge.fgHex,
                            }}
                          >
                            {badge.label}
                          </span>
                          {weakestSet.has(item.stat) && (
                            <span className="rounded-none border border-[var(--border-ink)] bg-[var(--px-gold)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#140e04]">
                              Ưu tiên bù
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-dim">{meta.desc}</p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-mono">
                      <span className="text-sm font-bold text-main">
                        {item.currentValue}
                      </span>
                      <span className="ml-1.5 text-[10px] text-dim">
                        ({item.sharePct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  <div className="rpg-bar-track mt-2 h-2.5 w-full">
                    <div
                      className="h-full"
                      style={{ width: `${barPct}%`, backgroundColor: meta.hex }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ==================== 4. AI BOTTLENECK DIAGNOSIS & HISTORY ==================== */}
      <section className="rpg-window relative p-4 sm:p-5">
        <PixelRivets />
        <div className="flex flex-col gap-3 border-b-2 pb-3.5 sm:flex-row sm:items-center sm:justify-between studio-divider">
          <div className="flex items-center gap-2.5">
            <PxSparkle size={18} />
            <div>
              <h3 className="font-display text-base font-extrabold text-main">
                Chẩn Đoán Điểm Nghẽn AI &amp; Lịch Sử Các Tuần Trước
              </h3>
              <p className="text-xs text-dim">
                Tổng kết tự động điểm mạnh, điểm nghẽn theo bằng chứng app/khung giờ và ưu tiên số 1 cho tuần kế tiếp.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateReview}
            disabled={generating}
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5 rounded-none px-3.5 py-2 text-xs"
          >
            {generating ? (
              <PxRefresh size={13} color="#140e04" className="animate-spin" />
            ) : (
              <PxSparkle size={13} color="#140e04" />
            )}
            <span>
              {generating ? 'Đang phân tích...' : 'Tạo Chẩn Đoán AI Tuần Này'}
            </span>
          </button>
        </div>

        {/* Past Weeks History Selector */}
        {reviews.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sub">
                <PxScroll size={14} color="var(--px-gold-text)" />
                <span>Lịch sử các tuần trước ({reviews.length} bản ghi)</span>
              </div>
              {reviews.length > 3 && (
                <select
                  aria-label="Chọn tuần tổng kết trong lịch sử"
                  value={selectedReview?.id ?? ''}
                  onChange={(e) => setSelectedReviewId(e.target.value)}
                  className="px-2.5 py-1 font-mono text-xs"
                >
                  {reviews.map((rev, idx) => (
                    <option key={rev.id} value={rev.id}>
                      {idx === 0 ? '[Mới nhất] ' : ''}
                      Tuần {formatShortRange(rev.weekStart, rev.weekEnd)} — Hạng {rev.grade} (
                      {Math.round(rev.metrics.avgFocusScore)}%)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {reviews.slice(0, 8).map((rev, idx) => {
                const isSelected = selectedReview?.id === rev.id;
                const revGrade = GRADE_META[rev.grade] || GRADE_META.C;
                return (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => setSelectedReviewId(rev.id)}
                    className={`flex items-center gap-2 rounded-none border-2 px-3 py-1.5 text-left ${
                      isSelected
                        ? 'border-[var(--px-gold)] bg-[var(--accent-soft)]'
                        : 'px-inset hover:border-[var(--px-gold)]'
                    }`}
                  >
                    <span
                      className="rounded-none border border-[var(--border-ink)] px-1.5 py-0.5 font-pixel text-[10px] font-bold"
                      style={{
                        backgroundColor: revGrade.bgHex,
                        color: revGrade.fgHex,
                      }}
                    >
                      {rev.grade}
                    </span>
                    <div className="font-mono text-[11px] leading-tight">
                      <div className="font-bold text-main">
                        {formatShortRange(rev.weekStart, rev.weekEnd)}
                        {idx === 0 ? ' · Mới' : ''}
                      </div>
                      <div className="text-[10px] text-dim">
                        Focus {Math.round(rev.metrics.avgFocusScore)}% ·{' '}
                        {formatDuration(rev.metrics.totalFocusMinutes)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Diagnosis Body OR Empty State */}
        {!selectedReview ? (
          <div className="px-inset mt-4 p-6 text-center">
            <div className="mb-2 flex justify-center">
              <PxSparkle size={22} />
            </div>
            <p className="font-display text-sm font-bold text-main">
              Chưa có bản Chẩn Đoán Tuần nào được lưu
            </p>
            <p className="mx-auto mt-1 max-w-lg text-xs text-sub">
              Nhấn nút <strong>Tạo Chẩn Đoán AI Tuần Này</strong> để hệ thống phân tích dữ liệu tập trung, app xao nhãng, tỉ lệ quest và đề ra 1 ưu tiên sắc bén nhất cho tuần sau.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Archived Week Metadata */}
            <div className="px-inset flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="rounded-none border border-[var(--border-ink)] px-2 py-0.5 font-pixel text-[10px] font-bold"
                  style={{
                    backgroundColor: (GRADE_META[selectedReview.grade] || GRADE_META.C).bgHex,
                    color: (GRADE_META[selectedReview.grade] || GRADE_META.C).fgHex,
                  }}
                >
                  HẠNG {selectedReview.grade}
                </span>
                <span className="font-mono font-bold text-main">
                  Tuần {formatDateVn(selectedReview.weekStart)} →{' '}
                  {formatDateVn(selectedReview.weekEnd)}
                </span>
                <span
                  className="rounded-none border border-[var(--border-ink)] px-2 py-0.5 font-mono text-[10px] font-bold text-white"
                  style={{
                    backgroundColor:
                      selectedReview.diagnosis.mode === 'llm' ? '#73499e' : '#3267a8',
                  }}
                >
                  {selectedReview.diagnosis.mode === 'llm'
                    ? 'AI LLM Diagnosis'
                    : 'Heuristic Engine'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-dim">
                <span>
                  Focus:{' '}
                  <strong className="text-main">
                    {formatDuration(selectedReview.metrics.totalFocusMinutes)}
                  </strong>
                </span>
                <span>
                  Score:{' '}
                  <strong className="text-main">
                    {Math.round(selectedReview.metrics.avgFocusScore)}%
                  </strong>
                </span>
                <span>
                  Quest:{' '}
                  <strong className="text-main">
                    {selectedReview.metrics.questsCompleted} (
                    {Math.round(selectedReview.metrics.completionRatePct)}%)
                  </strong>
                </span>
                {selectedReview.metrics.empiricalPeakHour && (
                  <span>
                    Giờ vàng:{' '}
                    <strong className="text-[var(--px-gold-text)]">
                      {selectedReview.metrics.empiricalPeakHour}
                    </strong>
                  </span>
                )}
                <span>Tạo lúc {formatTimestampVn(selectedReview.createdAt)}</span>
              </div>
            </div>

            {/* Week-over-Week Delta Strip if previous review exists */}
            {previousReview && (
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-dim">
                  So với tuần{' '}
                  {formatShortRange(previousReview.weekStart, previousReview.weekEnd)}:
                </span>
                {(() => {
                  const scoreDiff = Math.round(
                    selectedReview.metrics.avgFocusScore -
                      previousReview.metrics.avgFocusScore
                  );
                  const focusDiff = Math.round(
                    selectedReview.metrics.totalFocusMinutes -
                      previousReview.metrics.totalFocusMinutes
                  );
                  const questDiff = Math.round(
                    selectedReview.metrics.completionRatePct -
                      previousReview.metrics.completionRatePct
                  );
                  const fmtSigned = (n: number, suffix: string) =>
                    `${n > 0 ? '+' : ''}${n}${suffix}`;
                  const deltaStyle = (n: number) =>
                    n > 0
                      ? { backgroundColor: '#2e8b57', color: '#ffffff' }
                      : n < 0
                      ? { backgroundColor: '#b83a4b', color: '#ffffff' }
                      : {
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-secondary)',
                        };
                  return (
                    <>
                      <span
                        className="rounded-none border border-[var(--border-ink)] px-2 py-0.5 font-bold"
                        style={deltaStyle(scoreDiff)}
                      >
                        Focus Score {fmtSigned(scoreDiff, '%')}
                      </span>
                      <span
                        className="rounded-none border border-[var(--border-ink)] px-2 py-0.5 font-bold"
                        style={deltaStyle(focusDiff)}
                      >
                        Tổng Focus {fmtSigned(focusDiff, 'p')}
                      </span>
                      <span
                        className="rounded-none border border-[var(--border-ink)] px-2 py-0.5 font-bold"
                        style={deltaStyle(questDiff)}
                      >
                        Quest Rate {fmtSigned(questDiff, '%')}
                      </span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Headline & Recommended Window */}
            <div className="px-inset p-4">
              <p className="font-display text-base font-extrabold leading-snug text-main sm:text-lg">
                “{selectedReview.diagnosis.headline}”
              </p>
              {selectedReview.diagnosis.recommendedFocusWindow && (
                <div className="mt-2.5 inline-flex flex-wrap items-center gap-1.5 rounded-none border-2 border-[var(--border-ink)] bg-[#3267a8] px-2.5 py-1 font-mono text-xs font-semibold text-white">
                  <PxClock size={13} color="#ffffff" />
                  <span>
                    Khung giờ Deep Work khuyến nghị:{' '}
                    <strong>{selectedReview.diagnosis.recommendedFocusWindow}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* 3 Strengths + 3 Bottlenecks */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* 3 Strengths */}
              <div className="px-inset border-2 border-[var(--px-green)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <PxStar size={15} color="var(--px-green-text)" />
                  <h4 className="font-display text-sm font-extrabold text-[var(--px-green-text)]">
                    3 Điểm Mạnh Nổi Bật
                  </h4>
                </div>
                <ul className="space-y-2.5 text-xs leading-relaxed text-main">
                  {selectedReview.diagnosis.strengths.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-[var(--border-ink)] bg-[#2e8b57] font-pixel text-[9px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3 Bottlenecks */}
              <div className="px-inset border-2 border-[var(--px-red)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <PxWarn size={15} danger />
                  <h4 className="font-display text-sm font-extrabold text-[var(--px-red-text)]">
                    3 Điểm Nghẽn Cần Gỡ
                  </h4>
                </div>
                <ul className="space-y-2.5 text-xs leading-relaxed text-main">
                  {selectedReview.diagnosis.bottlenecks.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-[var(--border-ink)] bg-[#b83a4b] font-pixel text-[9px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* #1 Next Week Priority Highlighted in 16-bit Gold Stamp Frame */}
            <div className="px-inset relative border-2 border-[var(--px-gold)] p-4">
              <PixelRivets />
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-2.5 py-0.5 font-pixel text-[10px] font-bold text-[#140e04]">
                  <PxBolt size={12} color="#140e04" />
                  ƯU TIÊN SỐ 1 TUẦN TỚI
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--px-gold-text)]">
                  <PxTarget size={13} color="var(--px-gold-text)" />
                  Hành động đòn bẩy cao nhất
                </span>
              </div>
              <p className="mt-2.5 font-display text-sm font-extrabold leading-relaxed text-main sm:text-base">
                {selectedReview.diagnosis.nextWeekTopPriority}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
