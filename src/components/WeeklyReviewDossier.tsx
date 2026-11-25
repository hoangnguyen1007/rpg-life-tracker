import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
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

const STAT_ORDER: AttributeKey[] = ['INT', 'PER', 'STR', 'VIT', 'AGI', 'CHA'];

const STAT_INFO: Record<
  AttributeKey,
  { name: string; desc: string; hex: string; textCls: string }
> = {
  INT: {
    name: 'Intelligence',
    desc: 'Tư duy hệ thống & Chuyên môn',
    hex: '#f59e0b',
    textCls: 'text-amber-700 dark:text-amber-400',
  },
  PER: {
    name: 'Perception',
    desc: 'Ngoại ngữ & Nghiên cứu',
    hex: '#06b6d4',
    textCls: 'text-cyan-700 dark:text-cyan-400',
  },
  STR: {
    name: 'Strength',
    desc: 'Thể lực & Kỷ luật hành động',
    hex: '#f97316',
    textCls: 'text-orange-700 dark:text-orange-400',
  },
  VIT: {
    name: 'Vitality',
    desc: 'Giấc ngủ & Hồi phục bền bỉ',
    hex: '#10b981',
    textCls: 'text-emerald-700 dark:text-emerald-400',
  },
  AGI: {
    name: 'Agility',
    desc: 'Tốc độ Deep Work & Timeboxing',
    hex: '#8b5cf6',
    textCls: 'text-violet-700 dark:text-violet-400',
  },
  CHA: {
    name: 'Charisma',
    desc: 'Giao tiếp & Ảnh hưởng',
    hex: '#f43f5e',
    textCls: 'text-rose-700 dark:text-rose-400',
  },
};

const GRADE_META: Record<
  WeeklyGrade,
  {
    rankLabel: string;
    subtitle: string;
    plaqueCls: string;
    letterCls: string;
    pillCls: string;
  }
> = {
  S: {
    rankLabel: 'HUYỀN THOẠI',
    subtitle: 'Nhịp kỷ luật đỉnh cao',
    plaqueCls:
      'border-amber-600 bg-amber-500/15 shadow-[3px_3px_0_rgba(180,83,9,0.45)] dark:border-amber-400 dark:bg-amber-500/20 dark:shadow-[3px_3px_0_#78350f]',
    letterCls: 'text-amber-700 dark:text-amber-300',
    pillCls:
      'border-amber-600/60 bg-amber-500/15 text-amber-800 dark:border-amber-400/60 dark:text-amber-300',
  },
  A: {
    rankLabel: 'TINH ANH',
    subtitle: 'Tập trung sắc bén & ổn định',
    plaqueCls:
      'border-violet-600 bg-violet-500/15 shadow-[3px_3px_0_rgba(109,40,217,0.4)] dark:border-violet-400 dark:bg-violet-500/20 dark:shadow-[3px_3px_0_#4c1d95]',
    letterCls: 'text-violet-700 dark:text-violet-300',
    pillCls:
      'border-violet-600/60 bg-violet-500/15 text-violet-800 dark:border-violet-400/60 dark:text-violet-300',
  },
  B: {
    rankLabel: 'VỮNG VÀNG',
    subtitle: 'Tiến độ tốt, còn dư địa bứt phá',
    plaqueCls:
      'border-emerald-600 bg-emerald-500/15 shadow-[3px_3px_0_rgba(5,150,105,0.4)] dark:border-emerald-400 dark:bg-emerald-500/20 dark:shadow-[3px_3px_0_#064e3b]',
    letterCls: 'text-emerald-700 dark:text-emerald-300',
    pillCls:
      'border-emerald-600/60 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400/60 dark:text-emerald-300',
  },
  C: {
    rankLabel: 'GIỮ NHỊP',
    subtitle: 'Cần siết lại khung giờ tập trung',
    plaqueCls:
      'border-cyan-600 bg-cyan-500/15 shadow-[3px_3px_0_rgba(8,145,178,0.4)] dark:border-cyan-400 dark:bg-cyan-500/20 dark:shadow-[3px_3px_0_#164e63]',
    letterCls: 'text-cyan-800 dark:text-cyan-300',
    pillCls:
      'border-cyan-600/60 bg-cyan-500/15 text-cyan-800 dark:border-cyan-400/60 dark:text-cyan-300',
  },
  D: {
    rankLabel: 'BÁO ĐỘNG',
    subtitle: 'Cần gỡ ngay điểm nghẽn xao nhãng',
    plaqueCls:
      'border-rose-600 bg-rose-500/15 shadow-[3px_3px_0_rgba(190,18,60,0.4)] dark:border-rose-400 dark:bg-rose-500/20 dark:shadow-[3px_3px_0_#881337]',
    letterCls: 'text-rose-700 dark:text-rose-300',
    pillCls:
      'border-rose-600/60 bg-rose-500/15 text-rose-800 dark:border-rose-400/60 dark:text-rose-300',
  },
};

const STAT_STATUS_META: Record<
  StatGrowthBalanceItem['status'],
  { label: string; cls: string }
> = {
  strong: {
    label: 'Mạnh',
    cls: 'border-emerald-600/50 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400/50 dark:text-emerald-300',
  },
  balanced: {
    label: 'Cân bằng',
    cls: 'border-cyan-600/50 bg-cyan-500/15 text-cyan-800 dark:border-cyan-400/50 dark:text-cyan-300',
  },
  lagging: {
    label: 'Đang hụt',
    cls: 'border-rose-600/50 bg-rose-500/15 text-rose-800 dark:border-rose-400/50 dark:text-rose-300',
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

const HEATMAP_INTENSITY_CLS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'studio-divider bg-[var(--bg-subtle)] text-dim',
  1: 'border-emerald-700/40 bg-emerald-200/80 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300',
  2: 'border-emerald-600/70 bg-emerald-300 text-emerald-950 dark:border-emerald-600/80 dark:bg-emerald-800/80 dark:text-emerald-100',
  3: 'border-emerald-600 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-600 dark:text-emerald-50',
  4: 'border-emerald-700 bg-emerald-600 text-white ring-1 ring-amber-500/70 dark:border-emerald-300 dark:bg-emerald-400 dark:text-slate-950 dark:ring-amber-300/80',
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
  const hours = safe / 60;
  return `${hours >= 10 ? hours.toFixed(1) : hours.toFixed(1)}h`;
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

  // SVG Trend Chart Geometry
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
      <div className="rpg-window flex min-h-[260px] flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-amber-600 dark:text-amber-400" />
        <p className="font-pixel text-xs text-main">ĐANG TỔNG HỢP HỒ SƠ HIỆU SUẤT...</p>
        <p className="text-xs text-dim">
          Đang gom dữ liệu tập trung, xao nhãng, quest và chỉ số từ SQLite.
        </p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="rpg-pane space-y-3 p-6 text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400" />
        <p className="font-display text-sm font-bold text-main">
          Không thể tải Hồ Sơ Tổng Kết 7/30 Ngày
        </p>
        <p className="font-mono text-xs text-rose-700 dark:text-rose-400">{error}</p>
        <button
          type="button"
          onClick={() => loadReviewData(range)}
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border-2 border-rose-600/60 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-800 dark:border-rose-400/60 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border-2 border-emerald-600/60 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:border-emerald-400/60 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
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
      <section className="rpg-window p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Grade Plaque + Title */}
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={`relative flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-[2px] border-2 sm:h-24 sm:w-24 ${gradeInfo.plaqueCls}`}
            >
              <span className="font-pixel text-[8px] tracking-wider text-sub">
                HẠNG TUẦN
              </span>
              <span
                className={`font-pixel text-4xl font-bold leading-none sm:text-5xl ${gradeInfo.letterCls}`}
              >
                {analytics.grade}
              </span>
              <span className="mt-1 font-mono text-[9px] font-bold text-sub">
                {gradeInfo.rankLabel}
              </span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[2px] border border-amber-600/50 bg-amber-500/15 px-2 py-0.5 font-pixel text-[10px] text-amber-800 dark:border-amber-400/50 dark:text-amber-300">
                  DOSSIER {range === '7d' ? '7 NGÀY' : '30 NGÀY'}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-dim">
                  <Calendar className="h-3.5 w-3.5" />
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
              className="inline-flex rounded-[2px] border-2 p-0.5 studio-subtle studio-divider"
            >
              <button
                type="button"
                onClick={() => setRange('7d')}
                disabled={loading}
                className={`rounded-[2px] px-3 py-1.5 font-mono text-xs font-bold transition ${
                  range === '7d'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-sub hover:text-main'
                }`}
              >
                7 Ngày
              </button>
              <button
                type="button"
                onClick={() => setRange('30d')}
                disabled={loading}
                className={`rounded-[2px] px-3 py-1.5 font-mono text-xs font-bold transition ${
                  range === '30d'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
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
              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateReview}
              disabled={generating}
              className="btn-arcane inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>
                {generating
                  ? 'Đang chẩn đoán AI...'
                  : '✨ Tạo Chẩn Đoán AI Tuần Này'}
              </span>
            </button>
          </div>
        </div>

        {/* 4 Hero KPI Stat Tiles */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t-2 pt-4 sm:grid-cols-2 lg:grid-cols-4 studio-divider">
          {/* KPI 1: Total Deep Work + Study */}
          <div className="rounded-[2px] border-2 p-3 studio-subtle studio-divider">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sub">
                Deep Work + Học Tập
              </span>
              <Flame className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-pixel text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatHoursBig(totalCombinedFocusMins)}
              </span>
              <span className="font-mono text-[11px] text-dim">
                ({formatDuration(totalCombinedFocusMins)})
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[10px] text-dim">
              <span>DW: {formatDuration(analytics.totalDeepWorkMinutes)}</span>
              <span>Học: {formatDuration(analytics.totalStudyMinutes)}</span>
              <span className="text-rose-700 dark:text-rose-400">
                Xao nhãng: {formatDuration(analytics.totalDistractionMinutes)}
              </span>
            </div>
          </div>

          {/* KPI 2: Avg Focus Score */}
          <div className="rounded-[2px] border-2 p-3 studio-subtle studio-divider">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sub">
                Điểm Tập Trung TB
              </span>
              <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-pixel text-2xl font-bold text-cyan-700 dark:text-cyan-400">
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
                className={`h-full transition-all duration-500 ${
                  focusScoreRounded >= 75
                    ? 'bg-emerald-500'
                    : focusScoreRounded >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, focusScoreRounded))}%` }}
              />
            </div>
          </div>

          {/* KPI 3: Quest Completion Rate */}
          <div className="rounded-[2px] border-2 p-3 studio-subtle studio-divider">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-sub">
                Hoàn Thành Quest
              </span>
              <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-pixel text-2xl font-bold text-violet-700 dark:text-violet-400">
                {completionRounded}%
              </span>
              <span className="font-mono text-[11px] text-dim">
                {analytics.questsCompleted}/{analytics.questsTotal} quest
              </span>
            </div>
            <div className="rpg-bar-track mt-2 h-2.5 w-full">
              <div
                className="h-full bg-violet-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, completionRounded))}%` }}
              />
            </div>
          </div>

          {/* KPI 4: Empirical Peak Hour */}
          <div className="rounded-[2px] border-2 border-amber-600/50 bg-amber-500/10 p-3 dark:border-amber-400/50 dark:bg-amber-500/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Giờ Vàng Thực Tế
              </span>
              <Clock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="mt-1.5 font-pixel text-lg font-bold text-amber-800 dark:text-amber-300 sm:text-xl">
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
        <section className="rpg-pane flex min-w-0 flex-col justify-between p-4 sm:p-5 xl:col-span-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
                    className={`h-3 w-3 rounded-[2px] border ${HEATMAP_INTENSITY_CLS[lvl]}`}
                  />
                ))}
                <span>Sâu</span>
              </div>
            </div>

            {/* Live Cell Tooltip Readout (zero overflow clipping) */}
            {activeHeatmapCell ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[2px] border-2 px-3 py-2 font-mono text-[11px] studio-subtle studio-divider">
                <span className="font-bold text-main">
                  {formatDateVn(activeHeatmapCell.dateKey)}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Focus: {formatDuration(activeHeatmapCell.focusMinutes)}
                  </span>
                  <span className="font-semibold text-rose-700 dark:text-rose-400">
                    Xao nhãng: {formatDuration(activeHeatmapCell.distractionMinutes)}
                  </span>
                  <span className="font-semibold text-violet-700 dark:text-violet-400">
                    Quest: {activeHeatmapCell.questsCompleted}
                  </span>
                  <span className="text-dim">
                    Score: {Math.round(activeHeatmapCell.focusScore)}%
                  </span>
                </div>
              </div>
            ) : null}

            {/* 30 Crisp Square Cells (6x5 mobile, 10x3 desktop) */}
            {analytics.heatmap30d.length === 0 ? (
              <div className="mt-4 rounded-[2px] border-2 p-6 text-center text-xs text-dim studio-subtle studio-divider">
                Chưa có dữ liệu 30 ngày gần nhất.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-10">
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
                      className={`flex aspect-square flex-col items-center justify-center rounded-[2px] border-2 font-mono transition ${
                        HEATMAP_INTENSITY_CLS[cell.intensity]
                      } ${
                        isActive
                          ? 'scale-[1.04] ring-2 ring-amber-500 dark:ring-amber-300'
                          : 'hover:opacity-90'
                      }`}
                    >
                      <span className="text-[10px] font-bold leading-none">{dayNum}</span>
                      <span className="mt-0.5 text-[8px] leading-none opacity-85">
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

          <p className="mt-3 border-t pt-2.5 text-[11px] text-dim studio-divider">
            Di chuột hoặc chạm vào từng ô ngày để xem chi tiết số phút tập trung, xao nhãng và nhiệm vụ hoàn thành.
          </p>
        </section>

        {/* Daily Deep Work vs Distraction Trend Bar Chart (Pure SVG) */}
        <section className="rpg-pane flex min-w-0 flex-col justify-between p-4 sm:p-5 xl:col-span-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                  Xu Hướng Tập Trung vs Xao Nhãng ({range === '7d' ? '7 Ngày' : '30 Ngày'})
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-sub">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[1px] bg-emerald-500" />
                  Deep Work
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[1px] bg-cyan-500" />
                  Học tập
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[1px] bg-rose-500" />
                  Xao nhãng
                </span>
              </div>
            </div>

            {/* Active Day Readout Bar */}
            {activeTrendPoint && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[2px] border-2 px-3 py-2 font-mono text-[11px] studio-subtle studio-divider">
                <span className="font-bold text-main">
                  Ngày {activeTrendPoint.label} ({activeTrendPoint.dateKey})
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    DW: {formatDuration(activeTrendPoint.deepWorkMinutes)}
                  </span>
                  <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                    Học: {formatDuration(activeTrendPoint.studyMinutes)}
                  </span>
                  <span className="font-semibold text-rose-700 dark:text-rose-400">
                    Xao nhãng: {formatDuration(activeTrendPoint.distractionMinutes)}
                  </span>
                  <span className="text-sub">
                    Quest: {activeTrendPoint.questsCompleted} · Score:{' '}
                    {Math.round(activeTrendPoint.focusScore)}%
                  </span>
                </div>
              </div>
            )}

            {/* Pure Responsive SVG Chart */}
            {trendChart.pts.length === 0 ? (
              <div className="mt-4 rounded-[2px] border-2 p-8 text-center text-xs text-dim studio-subtle studio-divider">
                Chưa có dữ liệu biểu đồ xu hướng cho khoảng thời gian này.
              </div>
            ) : (
              <div className="mt-3 w-full overflow-hidden rounded-[2px] border-2 p-2 studio-subtle studio-divider">
                <svg
                  viewBox={`0 0 ${trendChart.svgW} ${trendChart.svgH}`}
                  className="block h-auto w-full select-none"
                  role="img"
                  aria-label="Biểu đồ xu hướng Deep Work, Học tập và Xao nhãng theo ngày"
                >
                  {/* Horizontal Gridlines & Y-Axis Labels */}
                  {trendChart.yTicks.map((tick) => {
                    const ratio = tick / Math.max(1, trendChart.maxY);
                    const y = trendChart.padT + trendChart.plotH * (1 - ratio);
                    return (
                      <g key={tick}>
                        <line
                          x1={trendChart.padL}
                          y1={y}
                          x2={trendChart.svgW - trendChart.padR}
                          y2={y}
                          stroke="var(--border-hairline)"
                          strokeWidth="1"
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

                  {/* Vertical Bars per Day */}
                  {trendChart.pts.map((pt, idx) => {
                    const count = trendChart.pts.length;
                    const slotW = trendChart.plotW / Math.max(1, count);
                    const slotX = trendChart.padL + idx * slotW;
                    const innerPad = count > 14 ? 1.5 : 8;
                    const usableW = Math.max(4, slotW - innerPad * 2);
                    const gap = count > 14 ? 1 : 3;
                    const barW = Math.max(2, (usableW - gap) / 2);

                    const baseY = trendChart.padT + trendChart.plotH;
                    const dwH =
                      (pt.deepWorkMinutes / Math.max(1, trendChart.maxY)) *
                      trendChart.plotH;
                    const studyH =
                      (pt.studyMinutes / Math.max(1, trendChart.maxY)) *
                      trendChart.plotH;
                    const distH =
                      (pt.distractionMinutes / Math.max(1, trendChart.maxY)) *
                      trendChart.plotH;

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
                          width={slotW}
                          height={trendChart.plotH}
                          fill={isSelected ? 'var(--accent-soft)' : 'transparent'}
                        />

                        {/* Deep Work bar (bottom of stacked focus bar) */}
                        {dwH > 0 && (
                          <rect
                            x={focusBarX}
                            y={baseY - dwH}
                            width={barW}
                            height={Math.max(2, dwH)}
                            fill="#10b981"
                          />
                        )}

                        {/* Study bar (stacked above Deep Work) */}
                        {studyH > 0 && (
                          <rect
                            x={focusBarX}
                            y={baseY - dwH - studyH}
                            width={barW}
                            height={Math.max(2, studyH)}
                            fill="#06b6d4"
                          />
                        )}

                        {/* Distraction bar (paired right side) */}
                        {distH > 0 && (
                          <rect
                            x={distBarX}
                            y={baseY - distH}
                            width={barW}
                            height={Math.max(2, distH)}
                            fill="#ef4444"
                          />
                        )}

                        {/* X-Axis Tick Label */}
                        {showLabel && (
                          <text
                            x={slotX + slotW / 2}
                            y={baseY + 15}
                            textAnchor="middle"
                            fill={
                              isSelected
                                ? 'var(--accent-primary)'
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

          <p className="mt-3 border-t pt-2.5 text-[11px] text-dim studio-divider">
            Mỗi ngày so sánh trực tiếp cột trái (Deep Work + Học tập) với cột phải (Xao nhãng) để phát hiện ngày rò rỉ tập trung.
          </p>
        </section>
      </div>

      {/* ==================== 3. 2-COLUMN APP & STAT INSIGHTS ==================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Top 5 Helpful vs Top 5 Draining Apps */}
        <section className="rpg-pane min-w-0 divide-y-2 studio-divider lg:col-span-6">
          {/* Top 5 Helpful Apps */}
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                  Top 5 App Tăng Tập Trung
                </h3>
              </div>
              <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                DEEP WORK &amp; HỌC TẬP
              </span>
            </div>

            {topHelpful.length === 0 ? (
              <div className="rounded-[2px] border-2 p-4 text-center text-xs text-dim studio-subtle studio-divider">
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
                    <div key={`${app.processName}-${idx}`} className="min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-[2px] border border-emerald-600/40 bg-emerald-500/15 px-1.5 py-0.5 font-pixel text-[9px] text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300">
                            #{idx + 1}
                          </span>
                          <span
                            title={app.processName}
                            className="truncate font-mono font-bold text-main"
                          >
                            {app.processName}
                          </span>
                          <span className="hidden shrink-0 rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] text-dim studio-subtle studio-divider sm:inline">
                            {CATEGORY_LABEL[app.category] || app.category}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {formatDuration(app.minutes)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-[2px] border studio-subtle studio-divider">
                        <div
                          className={`h-full transition-all duration-500 ${
                            app.category === 'study_research'
                              ? 'bg-cyan-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
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
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                  Top 5 App Hút Thời Gian
                </h3>
              </div>
              <span className="font-mono text-[10px] text-rose-700 dark:text-rose-400">
                XAO NHÃNG / RÒ RỈ
              </span>
            </div>

            {topDraining.length === 0 ? (
              <div className="rounded-[2px] border-2 border-emerald-600/40 bg-emerald-500/10 p-4 text-center text-xs text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-300">
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
                    <div key={`${app.processName}-${idx}`} className="min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 rounded-[2px] border border-rose-600/40 bg-rose-500/15 px-1.5 py-0.5 font-pixel text-[9px] text-rose-800 dark:border-rose-400/40 dark:text-rose-300">
                            #{idx + 1}
                          </span>
                          <span
                            title={app.processName}
                            className="truncate font-mono font-bold text-main"
                          >
                            {app.processName}
                          </span>
                          <span className="hidden shrink-0 rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] text-dim studio-subtle studio-divider sm:inline">
                            {CATEGORY_LABEL[app.category] || app.category}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-rose-700 dark:text-rose-400">
                          {formatDuration(app.minutes)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-[2px] border studio-subtle studio-divider">
                        <div
                          className="h-full bg-rose-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right: 6-Stat Balance (INT / PER / STR / VIT / AGI / CHA) */}
        <section className="rpg-pane min-w-0 p-4 sm:p-5 lg:col-span-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="font-display text-sm font-extrabold text-main sm:text-base">
                Cân Bằng 6 Chỉ Số (INT / PER / STR / VIT / AGI / CHA)
              </h3>
            </div>
            <span className="font-mono text-[10px] text-dim">Tỉ trọng hiện tại</span>
          </div>

          {/* Weakest Stats Callout */}
          {analytics.weakestStats.length > 0 && (
            <div className="mb-3.5 flex flex-wrap items-center gap-2 rounded-[2px] border-2 border-rose-600/50 bg-rose-500/10 px-3 py-2 text-xs dark:border-rose-400/50">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-400" />
              <span className="font-semibold text-main">Chỉ số đang tụt cần ưu tiên:</span>
              <div className="flex flex-wrap gap-1.5">
                {analytics.weakestStats.map((st) => (
                  <span
                    key={st}
                    className="rounded-[2px] border border-rose-600/60 bg-rose-500/20 px-2 py-0.5 font-pixel text-[10px] font-bold text-rose-800 dark:border-rose-400/60 dark:text-rose-200"
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
              const isWeak = weakestSet.has(item.stat) || item.status === 'lagging';
              const barPct = Math.min(
                100,
                Math.max(4, Math.round((item.currentValue / maxStatValue) * 100))
              );

              return (
                <div
                  key={item.stat}
                  className={`rounded-[2px] border-2 p-2.5 transition ${
                    isWeak
                      ? 'border-rose-600/50 bg-rose-500/5 dark:border-rose-400/40 dark:bg-rose-500/10'
                      : 'studio-subtle studio-divider'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`w-10 shrink-0 font-pixel text-xs font-bold ${meta.textCls}`}
                      >
                        {item.stat}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-main">{meta.name}</span>
                          <span
                            className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] font-bold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          {weakestSet.has(item.stat) && (
                            <span className="rounded-[2px] border border-amber-600/60 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-800 dark:border-amber-400/60 dark:text-amber-300">
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

                  <div className="mt-2 h-2 w-full overflow-hidden rounded-[2px] border studio-divider bg-[var(--bg-surface)]">
                    <div
                      className="h-full transition-all duration-500"
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
      <section className="rpg-window p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b-2 pb-3.5 sm:flex-row sm:items-center sm:justify-between studio-divider">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
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
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-1.5 px-3.5 py-2 text-xs"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>
              {generating ? 'Đang phân tích...' : '✨ Tạo Chẩn Đoán AI Tuần Này'}
            </span>
          </button>
        </div>

        {/* Past Weeks History Selector */}
        {reviews.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sub">
                <History className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
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
                      Tuần {formatShortRange(rev.weekStart, rev.weekEnd)} — Hạng {rev.grade} ({Math.round(rev.metrics.avgFocusScore)}%)
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
                    className={`flex items-center gap-2 rounded-[2px] border-2 px-3 py-1.5 text-left transition ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/15 dark:border-amber-400'
                        : 'studio-subtle studio-divider hover:border-amber-500/60'
                    }`}
                  >
                    <span
                      className={`rounded-[2px] border px-1.5 py-0.5 font-pixel text-[10px] font-bold ${revGrade.pillCls}`}
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
          <div className="mt-4 rounded-[2px] border-2 border-dashed p-6 text-center studio-subtle studio-divider">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-600 dark:text-amber-400" />
            <p className="font-display text-sm font-bold text-main">
              Chưa có bản Chẩn Đoán Tuần nào được lưu
            </p>
            <p className="mx-auto mt-1 max-w-lg text-xs text-sub">
              Nhấn nút <strong>✨ Tạo Chẩn Đoán AI Tuần Này</strong> để hệ thống phân tích dữ liệu tập trung, app xao nhãng, tỉ lệ quest và đề ra 1 ưu tiên sắc bén nhất cho tuần sau.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Archived Week Metadata + Comparison vs Prior Week */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border-2 px-3.5 py-2.5 studio-subtle studio-divider">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`rounded-[2px] border px-2 py-0.5 font-pixel text-[10px] font-bold ${
                    (GRADE_META[selectedReview.grade] || GRADE_META.C).pillCls
                  }`}
                >
                  HẠNG {selectedReview.grade}
                </span>
                <span className="font-mono font-bold text-main">
                  Tuần {formatDateVn(selectedReview.weekStart)} →{' '}
                  {formatDateVn(selectedReview.weekEnd)}
                </span>
                <span
                  className={`rounded-[2px] border px-2 py-0.5 font-mono text-[10px] font-bold ${
                    selectedReview.diagnosis.mode === 'llm'
                      ? 'border-violet-600/50 bg-violet-500/15 text-violet-800 dark:border-violet-400/50 dark:text-violet-300'
                      : 'border-cyan-600/50 bg-cyan-500/15 text-cyan-800 dark:border-cyan-400/50 dark:text-cyan-300'
                  }`}
                >
                  {selectedReview.diagnosis.mode === 'llm'
                    ? 'AI LLM Diagnosis'
                    : 'Heuristic Engine'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-dim">
                <span>
                  Focus: <strong className="text-main">{formatDuration(selectedReview.metrics.totalFocusMinutes)}</strong>
                </span>
                <span>
                  Score: <strong className="text-main">{Math.round(selectedReview.metrics.avgFocusScore)}%</strong>
                </span>
                <span>
                  Quest: <strong className="text-main">{selectedReview.metrics.questsCompleted} ({Math.round(selectedReview.metrics.completionRatePct)}%)</strong>
                </span>
                {selectedReview.metrics.empiricalPeakHour && (
                  <span>
                    Giờ vàng: <strong className="text-amber-700 dark:text-amber-400">{selectedReview.metrics.empiricalPeakHour}</strong>
                  </span>
                )}
                <span>Tạo lúc {formatTimestampVn(selectedReview.createdAt)}</span>
              </div>
            </div>

            {/* Week-over-Week Delta Strip if previous review exists */}
            {previousReview && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="text-dim">
                  So với tuần {formatShortRange(previousReview.weekStart, previousReview.weekEnd)}:
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
                  const deltaCls = (n: number) =>
                    n > 0
                      ? 'border-emerald-600/50 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/50 dark:text-emerald-300'
                      : n < 0
                      ? 'border-rose-600/50 bg-rose-500/10 text-rose-800 dark:border-rose-400/50 dark:text-rose-300'
                      : 'studio-divider studio-subtle text-sub';
                  return (
                    <>
                      <span className={`rounded-[2px] border px-2 py-0.5 font-bold ${deltaCls(scoreDiff)}`}>
                        Focus Score {fmtSigned(scoreDiff, '%')}
                      </span>
                      <span className={`rounded-[2px] border px-2 py-0.5 font-bold ${deltaCls(focusDiff)}`}>
                        Tổng Focus {fmtSigned(focusDiff, 'p')}
                      </span>
                      <span className={`rounded-[2px] border px-2 py-0.5 font-bold ${deltaCls(questDiff)}`}>
                        Quest Rate {fmtSigned(questDiff, '%')}
                      </span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Headline & Recommended Window */}
            <div className="rounded-[2px] border-2 p-4 studio-subtle studio-divider">
              <p className="font-display text-base font-extrabold leading-snug text-main sm:text-lg">
                “{selectedReview.diagnosis.headline}”
              </p>
              {selectedReview.diagnosis.recommendedFocusWindow && (
                <div className="mt-2.5 inline-flex flex-wrap items-center gap-1.5 rounded-[2px] border border-cyan-600/50 bg-cyan-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-800 dark:border-cyan-400/50 dark:text-cyan-300">
                  <Clock className="h-3.5 w-3.5" />
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
              <div className="rounded-[2px] border-2 border-emerald-600/40 bg-emerald-500/5 p-4 dark:border-emerald-400/40 dark:bg-emerald-500/10">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <h4 className="font-display text-sm font-extrabold text-emerald-900 dark:text-emerald-300">
                    3 Điểm Mạnh Nổi Bật
                  </h4>
                </div>
                <ul className="space-y-2.5 text-xs leading-relaxed text-main">
                  {selectedReview.diagnosis.strengths.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-emerald-600/50 bg-emerald-500/20 font-pixel text-[9px] font-bold text-emerald-900 dark:border-emerald-400/50 dark:text-emerald-200">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3 Bottlenecks */}
              <div className="rounded-[2px] border-2 border-rose-600/40 bg-rose-500/5 p-4 dark:border-rose-400/40 dark:bg-rose-500/10">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-700 dark:text-rose-400" />
                  <h4 className="font-display text-sm font-extrabold text-rose-900 dark:text-rose-300">
                    3 Điểm Nghẽn Cần Gỡ
                  </h4>
                </div>
                <ul className="space-y-2.5 text-xs leading-relaxed text-main">
                  {selectedReview.diagnosis.bottlenecks.slice(0, 3).map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-rose-600/50 bg-rose-500/20 font-pixel text-[9px] font-bold text-rose-900 dark:border-rose-400/50 dark:text-rose-200">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* #1 Next Week Priority Highlighted in Amber */}
            <div className="rounded-[2px] border-2 border-amber-600 bg-amber-500/15 p-4 shadow-[3px_3px_0_rgba(180,83,9,0.3)] dark:border-amber-400 dark:bg-amber-500/15 dark:shadow-[3px_3px_0_#78350f]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-[2px] border border-amber-700 bg-amber-500 px-2 py-0.5 font-pixel text-[10px] font-bold text-slate-950">
                  <Zap className="h-3 w-3" />
                  ƯU TIÊN SỐ 1 TUẦN TỚI
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-amber-900 dark:text-amber-300">
                  <Target className="h-3.5 w-3.5" />
                  Hành động đòn bẩy cao nhất
                </span>
              </div>
              <p className="mt-2.5 font-display text-sm font-extrabold leading-relaxed text-amber-950 dark:text-amber-100 sm:text-base">
                {selectedReview.diagnosis.nextWeekTopPriority}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
