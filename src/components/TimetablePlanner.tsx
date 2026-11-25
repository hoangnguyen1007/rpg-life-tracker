import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  FileUp,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import type {
  AIDayPlanResult,
  DayScheduleAnalysis,
  Quest,
  TimetableBlock,
  TimetableBlockType,
  WeeklyBlueprintBlockDraft,
  WeeklyBlueprintDraft,
} from '../types/system';
import { systemApi } from '../utils/api';
import {
  getVnDayOfWeek,
  getVnNowMinutes,
  getVnTodayKey,
} from '../utils/timeVn';
import { WeeklyBalanceChart } from './VisualIllustrations';

interface TimetablePlannerProps {
  weeklyAnalysis: DayScheduleAnalysis[];
  quests?: Quest[];
  onSaveBatch: (blocks: Array<Omit<TimetableBlock, 'id'>>, replaceExisting?: boolean) => Promise<void>;
  onUpdateBlock: (id: string, updates: Partial<TimetableBlock>) => Promise<void>;
  onDeleteBlock: (id: string) => Promise<void>;
  onDeleteQuest?: (questId: string) => Promise<void>;
  onClearTimetable: (dayOfWeek?: number) => Promise<void>;
  onImportText: (rawText: string, replaceAll?: boolean) => Promise<void>;
  onAiPlanDaySchedule?: (payload: { prompt: string; dayOfWeek: number }) => Promise<AIDayPlanResult>;
  onApplyWeeklyBlueprint?: (blocks: WeeklyBlueprintBlockDraft[], syncTodayQuests: boolean) => Promise<void>;
}

const DAY_PILLS = [
  { dow: 1, short: 'T2', full: 'Thứ 2' },
  { dow: 2, short: 'T3', full: 'Thứ 3' },
  { dow: 3, short: 'T4', full: 'Thứ 4' },
  { dow: 4, short: 'T5', full: 'Thứ 5' },
  { dow: 5, short: 'T6', full: 'Thứ 6' },
  { dow: 6, short: 'T7', full: 'Thứ 7' },
  { dow: 0, short: 'CN', full: 'Chủ nhật' },
];

const BLOCK_STYLES: Record<
  TimetableBlockType,
  { label: string; gridCls: string; pillCls: string }
> = {
  sleep: {
    label: 'Giờ ngủ',
    gridCls: 'bg-indigo-100 border-indigo-400 text-indigo-950 dark:bg-indigo-950/85 dark:border-indigo-500/80 dark:text-indigo-100',
    pillCls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  },
  class_work: {
    label: 'Công việc / Học tập',
    gridCls: 'bg-rose-100 border-rose-400 text-rose-950 dark:bg-rose-950/85 dark:border-rose-500/80 dark:text-rose-100',
    pillCls: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
  commute_meal: {
    label: 'Ăn uống / Di chuyển',
    gridCls: 'bg-amber-100 border-amber-400 text-amber-950 dark:bg-amber-950/80 dark:border-amber-500/80 dark:text-amber-100',
    pillCls: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  fixed_habit: {
    label: 'Thói quen cố định',
    gridCls: 'bg-emerald-100 border-emerald-400 text-emerald-950 dark:bg-emerald-950/85 dark:border-emerald-500/80 dark:text-emerald-100',
    pillCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  rest_buffer: {
    label: 'Nghỉ ngơi',
    gridCls: 'bg-sky-100 border-sky-400 text-sky-950 dark:bg-sky-950/85 dark:border-sky-500/80 dark:text-sky-100',
    pillCls: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
  adhoc_event: {
    label: 'Đột xuất',
    gridCls: 'bg-violet-100 border-violet-400 text-violet-950 dark:bg-violet-950/85 dark:border-violet-500/80 dark:text-violet-100',
    pillCls: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
};

const QUICK_LIFE_TEMPLATES: Array<{
  buttonLabel: string;
  title: string;
  startTime: string;
  endTime: string;
  type: TimetableBlockType;
  energyCost: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  days: number[];
}> = [
  {
    buttonLabel: '+ Khối Công việc / Học tập Sáng 08:00-12:00 T2-T6',
    title: 'Khối Công việc / Học tập Sáng',
    startTime: '08:00',
    endTime: '12:00',
    type: 'class_work',
    energyCost: 'HIGH',
    days: [1, 2, 3, 4, 5],
  },
  {
    buttonLabel: '+ Khối Chiều 13:30-17:30 T2-T6',
    title: 'Khối Công việc / Học tập Chiều',
    startTime: '13:30',
    endTime: '17:30',
    type: 'class_work',
    energyCost: 'HIGH',
    days: [1, 2, 3, 4, 5],
  },
  {
    buttonLabel: '+ Lớp Kỹ năng / Rèn luyện Tối 19:00-21:00 T3-T5-T7',
    title: 'Lớp Kỹ năng / Rèn luyện Tối',
    startTime: '19:00',
    endTime: '21:00',
    type: 'class_work',
    energyCost: 'MEDIUM',
    days: [2, 4, 6],
  },
  {
    buttonLabel: '+ Rèn luyện Thể chất 17:30-18:30 T2-T4-T6',
    title: 'Rèn luyện Thể chất',
    startTime: '17:30',
    endTime: '18:30',
    type: 'fixed_habit',
    energyCost: 'MEDIUM',
    days: [1, 3, 5],
  },
  {
    buttonLabel: '+ Nhịp Ngủ & Hồi phục 23:00-06:30 Cả tuần',
    title: 'Nhịp Ngủ & Hồi phục',
    startTime: '23:00',
    endTime: '06:30',
    type: 'sleep',
    energyCost: 'NONE',
    days: [1, 2, 3, 4, 5, 6, 0],
  },
];

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseSlotRange(slot: string): { startTime: string; endTime: string } | null {
  const m = slot.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  const norm = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return `${pad2(hh)}:${pad2(mm)}`;
  };
  return { startTime: norm(m[1]), endTime: norm(m[2]) };
}

interface CalendarPositionedItem {
  id: string;
  kind: 'block' | 'quest';
  title: string;
  startTime: string;
  endTime: string;
  cStart: number;
  cEnd: number;
  block?: TimetableBlock;
  quest?: Quest;
  colIndex: number;
  totalCols: number;
}

/**
 * Interval-column packer for concurrent calendar blocks in a single day column.
 * Guarantees zero text overlap by splitting overlapping clusters side-by-side.
 */
function packDayIntervals(
  items: Array<Omit<CalendarPositionedItem, 'colIndex' | 'totalCols'>>
): CalendarPositionedItem[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.cStart - b.cStart || b.cEnd - a.cEnd);

  // Build connected overlap clusters
  const clusters: Array<Array<Omit<CalendarPositionedItem, 'colIndex' | 'totalCols'>>> = [];
  let currentCluster: Array<Omit<CalendarPositionedItem, 'colIndex' | 'totalCols'>> = [];
  let clusterMaxEnd = -1;

  for (const item of sorted) {
    if (currentCluster.length === 0 || item.cStart < clusterMaxEnd) {
      currentCluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.cEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterMaxEnd = item.cEnd;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const result: CalendarPositionedItem[] = [];
  for (const cluster of clusters) {
    const colEndTimes: number[] = [];
    const assigned: Array<{ item: Omit<CalendarPositionedItem, 'colIndex' | 'totalCols'>; colIndex: number }> = [];

    for (const item of cluster) {
      let colIdx = colEndTimes.findIndex((endT) => endT <= item.cStart);
      if (colIdx === -1) {
        colIdx = colEndTimes.length;
        colEndTimes.push(item.cEnd);
      } else {
        colEndTimes[colIdx] = item.cEnd;
      }
      assigned.push({ item, colIndex: colIdx });
    }

    const totalCols = Math.max(1, colEndTimes.length);
    for (const entry of assigned) {
      result.push({
        ...entry.item,
        colIndex: entry.colIndex,
        totalCols,
      });
    }
  }

  return result;
}

function convertIcsTokenToVn(
  token: string,
  isUtc: boolean
): { dow: number; hhmm: string } {
  const y = Number(token.slice(0, 4));
  const m = Number(token.slice(4, 6));
  const d = Number(token.slice(6, 8));
  const hh = Number(token.slice(9, 11));
  const mm = Number(token.slice(11, 13));
  const ss = Number(token.slice(13, 15) || 0);

  if (isUtc) {
    const utcDate = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(utcDate);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const dowMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const hr = get('hour').padStart(2, '0');
    const mn = get('minute').padStart(2, '0');
    return {
      dow: dowMap[get('weekday')] ?? utcDate.getUTCDay(),
      hhmm: `${hr === '24' ? '00' : hr}:${mn}`,
    };
  }

  const localDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    dow: localDow,
    hhmm: `${pad2(hh)}:${pad2(mm)}`,
  };
}

function parseIcsOrCsv(content: string, filename: string): Array<Omit<TimetableBlock, 'id'>> {
  const rawBlocks: Array<Omit<TimetableBlock, 'id'>> = [];

  if (filename.toLowerCase().endsWith('.csv')) {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.toLowerCase().startsWith('day')) continue;
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 4) {
        const dow = Number(parts[0]);
        if (!Number.isNaN(dow) && parts[1].includes(':') && parts[2].includes(':')) {
          rawBlocks.push({
            dayOfWeek: ((dow % 7) + 7) % 7,
            startTime: parts[1],
            endTime: parts[2],
            title: parts[3],
            type: (parts[4] as TimetableBlockType) || 'class_work',
            energyCost: 'MEDIUM',
            isRecurring: true,
          });
        }
      }
    }
  } else {
    // Unfold RFC 5545 folded lines (\r\n + space/tab) before regex matching
    const unfolded = content.replace(/\r?\n[ \t]/g, '');
    const events = unfolded.split('BEGIN:VEVENT').slice(1);
    for (const ev of events) {
      const sumMatch = ev.match(/SUMMARY[^:]*:(.*)/i);
      const dtStartMatch = ev.match(/DTSTART([^:]*):(\d{8}T\d{4,6})(Z?)/i);
      const dtEndMatch = ev.match(/DTEND([^:]*):(\d{8}T\d{4,6})(Z?)/i);
      if (!dtStartMatch) continue;

      const sIsUtc = dtStartMatch[3].toUpperCase() === 'Z';
      const startInfo = convertIcsTokenToVn(dtStartMatch[2], sIsUtc);

      let endInfo: { dow: number; hhmm: string };
      if (dtEndMatch) {
        const eIsUtc = dtEndMatch[3].toUpperCase() === 'Z';
        endInfo = convertIcsTokenToVn(dtEndMatch[2], eIsUtc);
      } else {
        const endMins = Math.min(1439, toMins(startInfo.hhmm) + 60);
        endInfo = {
          dow: startInfo.dow,
          hhmm: `${pad2(Math.floor(endMins / 60))}:${pad2(endMins % 60)}`,
        };
      }

      const rawTitle = (sumMatch?.[1] || 'Lịch từ ICS')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\n/gi, ' ')
        .trim();

      if (!rawTitle || startInfo.hhmm === endInfo.hhmm) continue;

      if (startInfo.hhmm > endInfo.hhmm) {
        rawBlocks.push(
          {
            dayOfWeek: startInfo.dow,
            startTime: startInfo.hhmm,
            endTime: '23:59',
            title: rawTitle,
            type: 'class_work',
            energyCost: 'MEDIUM',
            isRecurring: true,
          },
          {
            dayOfWeek: (startInfo.dow + 1) % 7,
            startTime: '00:00',
            endTime: endInfo.hhmm,
            title: rawTitle,
            type: 'class_work',
            energyCost: 'MEDIUM',
            isRecurring: true,
          }
        );
      } else {
        rawBlocks.push({
          dayOfWeek: startInfo.dow,
          startTime: startInfo.hhmm,
          endTime: endInfo.hhmm,
          title: rawTitle,
          type: 'class_work',
          energyCost: 'MEDIUM',
          isRecurring: true,
        });
      }
    }
  }

  // Deduplicate identical (dayOfWeek, startTime, endTime, title) across multi-week university feeds
  const seen = new Set<string>();
  const deduped: Array<Omit<TimetableBlock, 'id'>> = [];
  for (const b of rawBlocks) {
    const key = `${b.dayOfWeek}|${b.startTime}|${b.endTime}|${b.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(b);
  }
  return deduped;
}

const HOUR_HEIGHT = 52;

export const TimetablePlanner: React.FC<TimetablePlannerProps> = ({
  weeklyAnalysis,
  quests = [],
  onSaveBatch,
  onUpdateBlock,
  onDeleteBlock,
  onDeleteQuest,
  onClearTimetable,
  onImportText,
  onAiPlanDaySchedule,
  onApplyWeeklyBlueprint,
}) => {
  const [todayDow, setTodayDow] = useState<number>(() => getVnDayOfWeek());
  const [todayKey, setTodayKey] = useState<string>(() => getVnTodayKey());
  const [nowMins, setNowMins] = useState<number>(() => getVnNowMinutes());

  useEffect(() => {
    const id = window.setInterval(() => {
      setTodayDow(getVnDayOfWeek());
      setTodayKey(getVnTodayKey());
      setNowMins(getVnNowMinutes());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const [selectedDow, setSelectedDow] = useState<number>(todayDow);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [fullDayRange, setFullDayRange] = useState<boolean>(false);
  const [showTodayQuests, setShowTodayQuests] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<'none' | 'text' | 'batch'>('none');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // AI Day Scheduler Bar
  const [aiDayOfWeek, setAiDayOfWeek] = useState<number>(todayDow);
  const [aiDayPrompt, setAiDayPrompt] = useState('');
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiPlanSummary, setAiPlanSummary] = useState<string | null>(null);

  // AI Weekly Blueprint Modal/Drawer
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [blueprintFocusNote, setBlueprintFocusNote] = useState('');
  const [blueprintGenerating, setBlueprintGenerating] = useState(false);
  const [blueprintApplying, setBlueprintApplying] = useState(false);
  const [blueprintDraft, setBlueprintDraft] = useState<WeeklyBlueprintDraft | null>(null);
  const [blueprintBlocks, setBlueprintBlocks] = useState<WeeklyBlueprintBlockDraft[]>([]);
  const [blueprintSyncToday, setBlueprintSyncToday] = useState(true);
  const [blueprintNotice, setBlueprintNotice] = useState<string | null>(null);

  // Batch Multi-Day Form
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [type, setType] = useState<TimetableBlockType>('class_work');
  const [energyCost, setEnergyCost] = useState<'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [adding, setAdding] = useState(false);

  // Natural Language Importer
  const [rawImportText, setRawImportText] = useState(
    'Thứ 2-6 Khối Công việc / Học tập Sáng 08:00-12:00\nThứ 2-6 Khối Chiều 13:30-17:30\nThứ 2, 4, 6 Rèn luyện Thể chất 17:30-18:30\nTối thứ 3, 5, 7 Lớp Kỹ năng / Rèn luyện Tối 19:00-21:00\nCả tuần Nhịp Ngủ & Hồi phục 23:30-07:00'
  );
  const [previewBlocks, setPreviewBlocks] = useState<Array<Omit<TimetableBlock, 'id'>> | null>(null);
  const [replaceAllOnImport, setReplaceAllOnImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline Editor (shared by calendar click & day ledger)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const dayDetailRef = useRef<HTMLDivElement>(null);

  const visibleStartHour = fullDayRange ? 0 : 6;
  const visibleEndHour = fullDayRange ? 24 : 23;
  const visibleStartMins = visibleStartHour * 60;
  const visibleEndMins = visibleEndHour * 60;
  const totalGridHeight = (visibleEndHour - visibleStartHour) * HOUR_HEIGHT;

  const hoursList = useMemo(
    () => Array.from({ length: visibleEndHour - visibleStartHour }, (_, idx) => visibleStartHour + idx),
    [visibleStartHour, visibleEndHour]
  );

  // Compute Monday..Sunday dates strictly from Vietnam (UTC+7) todayKey + todayDow
  const weekDates = useMemo(() => {
    const [ty, tm, td] = todayKey.split('-').map(Number);
    const vnTodayUtc = Date.UTC(ty || 2026, (tm || 1) - 1, td || 1);
    const diffToMon = todayDow === 0 ? -6 : 1 - todayDow;
    const mondayUtc = vnTodayUtc + (diffToMon + weekOffset * 7) * 86400000;

    return DAY_PILLS.map((dp, idx) => {
      const date = new Date(mondayUtc + idx * 86400000);
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      const dateKeyStr = `${y}-${pad2(m)}-${pad2(d)}`;
      return {
        ...dp,
        date,
        dateStr: `${pad2(d)}/${pad2(m)}`,
        fullDateStr: `${pad2(d)}/${pad2(m)}/${y}`,
        isToday: dateKeyStr === todayKey,
      };
    });
  }, [todayKey, todayDow, weekOffset]);

  const weekRangeLabel = `Tuần ${weekDates[0].dateStr} – ${weekDates[6].fullDateStr}`;
  const analysisByDow = useMemo(
    () => new Map(weeklyAnalysis.map((d) => [d.dayOfWeek, d])),
    [weeklyAnalysis]
  );

  const todayQuestsWithSlots = useMemo(
    () =>
      quests.filter(
        (q) => q.dateKey === todayKey && q.status !== 'rejected' && Boolean(parseSlotRange(q.scheduledSlot))
      ),
    [quests, todayKey]
  );

  const activeDay = weeklyAnalysis.find((d) => d.dayOfWeek === selectedDow) || weeklyAnalysis[0];
  const showNowLine = weekOffset === 0 && nowMins >= visibleStartMins && nowMins <= visibleEndMins;
  const nowLineTop = ((nowMins - visibleStartMins) / 60) * HOUR_HEIGHT;

  const toggleDayInBatch = (dow: number) => {
    setSelectedDays((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
    );
  };

  const handleEmptyCellClick = (dow: number, hour: number) => {
    const startStr = `${pad2(hour)}:00`;
    const endHour = Math.min(23, hour + 1);
    const endStr = hour === 23 ? '23:59' : `${pad2(endHour)}:00`;
    setSelectedDow(dow);
    setSelectedDays([dow]);
    setStartTime(startStr);
    setEndTime(endStr);
    setActiveTool('batch');
  };

  const handleBlockClick = (b: TimetableBlock) => {
    setSelectedDow(b.dayOfWeek);
    setEditingId(b.id);
    setEditTitle(b.title);
    setEditStart(b.startTime);
    setEditEnd(b.endTime);
    dayDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedDays.length === 0) return;
    setAdding(true);
    try {
      const blocks: Array<Omit<TimetableBlock, 'id'>> = [];
      for (const dow of selectedDays) {
        if (startTime > endTime) {
          blocks.push(
            { dayOfWeek: dow, startTime, endTime: '23:59', title: title.trim(), type, energyCost, isRecurring: true },
            { dayOfWeek: (dow + 1) % 7, startTime: '00:00', endTime, title: title.trim(), type, energyCost, isRecurring: true }
          );
        } else if (startTime < endTime) {
          blocks.push({ dayOfWeek: dow, startTime, endTime, title: title.trim(), type, energyCost, isRecurring: true });
        }
      }
      if (blocks.length > 0) {
        await onSaveBatch(blocks, false);
        setTitle('');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportNotice(null);
    const text = await file.text();
    const parsed = parseIcsOrCsv(text, file.name);
    if (parsed.length > 0) {
      await onSaveBatch(parsed, replaceAllOnImport);
      setImportNotice(`Đã lưu ${parsed.length} khối lịch hợp lệ từ ${file.name} (đã lọc trùng).`);
    } else {
      setImportNotice(`Không tìm thấy sự kiện hợp lệ trong ${file.name}.`);
    }
    e.target.value = '';
  };

  const handleAiPlanDaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAiPlanDaySchedule || !aiDayPrompt.trim()) return;
    setAiPlanning(true);
    setAiPlanSummary(null);
    try {
      const res = await onAiPlanDaySchedule({
        prompt: aiDayPrompt.trim(),
        dayOfWeek: aiDayOfWeek,
      });
      setSelectedDow(res.dayOfWeek);
      setAiPlanSummary(res.summary);
      setAiDayPrompt('');
    } finally {
      setAiPlanning(false);
    }
  };

  const handleGenerateBlueprint = async () => {
    setBlueprintGenerating(true);
    setBlueprintNotice(null);
    try {
      const draft = await systemApi.generateWeeklyBlueprint({
        focusNote: blueprintFocusNote.trim() || undefined,
        maxBlocksPerDay: 2,
      });
      setBlueprintDraft(draft);
      setBlueprintBlocks(draft.blocks);
    } catch (err) {
      setBlueprintNotice(err instanceof Error ? err.message : 'Không thể tạo bản nháp tuần.');
    } finally {
      setBlueprintGenerating(false);
    }
  };

  const handleApplyBlueprint = async () => {
    const selected = blueprintBlocks.filter((b) => b.selected);
    if (selected.length === 0) return;
    setBlueprintApplying(true);
    setBlueprintNotice(null);
    try {
      if (onApplyWeeklyBlueprint) {
        await onApplyWeeklyBlueprint(blueprintBlocks, blueprintSyncToday);
      } else {
        const res = await systemApi.applyWeeklyBlueprint(blueprintBlocks, blueprintSyncToday);
        setImportNotice(res.message);
      }
      setShowBlueprintModal(false);
    } catch (err) {
      setBlueprintNotice(err instanceof Error ? err.message : 'Không thể áp dụng lịch tuần.');
    } finally {
      setBlueprintApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar & Visual Weekly Balance Chart */}
      <section className="studio-surface p-5">
        <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-6">
            <div>
              <h2 className="font-display text-lg font-extrabold text-main">
                Thời Khóa Biểu Tuần
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowBlueprintModal(true);
                  setBlueprintNotice(null);
                  if (!blueprintDraft) {
                    void handleGenerateBlueprint();
                  }
                }}
                className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>✨ AI Lập Lịch Tuần (Blueprint)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool(activeTool === 'text' ? 'none' : 'text')}
                className={activeTool === 'text' ? 'btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs' : 'btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs'}
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>Import Text / AI</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool(activeTool === 'batch' ? 'none' : 'batch')}
                className={activeTool === 'batch' ? 'btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs' : 'btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs'}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>+ Thêm hàng loạt</span>
              </button>

              <input ref={fileInputRef} type="file" accept=".ics,.csv" onChange={handleFileUpload} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <FileUp className="h-3.5 w-3.5" />
                <span>.ICS / .CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Xóa toàn bộ thời khóa biểu cả tuần?')) {
                    onClearTimetable();
                  }
                }}
                className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa tuần</span>
              </button>
            </div>
            {importNotice && (
              <p className="rounded-[2px] border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-400">
                {importNotice}
              </p>
            )}
          </div>

          <div className="lg:col-span-6">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-main">Cân bằng 7 ngày</span>
            </div>
            <WeeklyBalanceChart
              weeklyAnalysis={weeklyAnalysis}
              selectedDow={selectedDow}
              onSelectDow={setSelectedDow}
            />
          </div>
        </div>

        {/* Tool Drawer 1: Natural Language Bulk Import */}
        {activeTool === 'text' && (
          <div className="mt-4 space-y-3 border-t-2 pt-4 studio-divider">
            <p className="text-xs text-sub">
              Dán lịch trình của bạn theo từng dòng (hỗ trợ tự nhận diện thứ, khối công việc / học tập, lớp kỹ năng buổi tối, rèn luyện thể chất và nhịp ngủ qua đêm):
            </p>
            <textarea
              rows={4}
              value={rawImportText}
              onChange={(e) => setRawImportText(e.target.value)}
              className="w-full p-3 font-mono text-xs"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-sub">
                <input
                  type="checkbox"
                  checked={replaceAllOnImport}
                  onChange={(e) => setReplaceAllOnImport(e.target.checked)}
                />
                <span>Xóa lịch cũ trước khi import</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setImporting(true);
                    try {
                      const res = await systemApi.previewImportTimetableText(rawImportText);
                      setPreviewBlocks(res.parsedBlocks);
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={importing}
                  className="btn-secondary px-3.5 py-1.5 text-xs"
                >
                  Xem trước
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setImporting(true);
                    try {
                      await onImportText(rawImportText, replaceAllOnImport);
                      setPreviewBlocks(null);
                      setActiveTool('none');
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={importing}
                  className="btn-primary flex items-center gap-1.5 px-4 py-1.5 text-xs"
                >
                  {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Import vào lịch</span>
                </button>
              </div>
            </div>
            {previewBlocks && (
              <div className="grid max-h-36 grid-cols-1 gap-1.5 overflow-y-auto rounded-[2px] border-2 p-3 studio-subtle studio-divider sm:grid-cols-2">
                {previewBlocks.map((b, i) => (
                  <div key={i} className="font-mono text-xs text-main">
                    {DAY_PILLS.find((d) => d.dow === b.dayOfWeek)?.short} • {b.startTime}-{b.endTime}: {b.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tool Drawer 2: Multi-Day Batch Adder */}
        {activeTool === 'batch' && (
          <form onSubmit={handleBatchSubmit} className="mt-4 space-y-3 border-t-2 pt-4 text-xs studio-divider">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-main">Mẫu nhanh:</span>
              {QUICK_LIFE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.buttonLabel}
                  type="button"
                  onClick={() => {
                    setTitle(tpl.title);
                    setStartTime(tpl.startTime);
                    setEndTime(tpl.endTime);
                    setType(tpl.type);
                    setEnergyCost(tpl.energyCost);
                    setSelectedDays(tpl.days);
                  }}
                  className="btn-secondary px-2.5 py-1 text-xs"
                >
                  {tpl.buttonLabel}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DAY_PILLS.map((dp) => (
                <button
                  key={dp.dow}
                  type="button"
                  onClick={() => toggleDayInBatch(dp.dow)}
                  className={`px-3 py-1 font-mono text-xs ${
                    selectedDays.includes(dp.dow) ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {dp.short}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên khối lịch (VD: Khối Công việc Sáng, Lớp Kỹ năng...)"
                className="px-3 py-2 text-sm sm:col-span-2"
              />
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="px-2.5 py-2" />
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="px-2.5 py-2" />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TimetableBlockType)}
                className="px-2.5 py-2"
              >
                <option value="class_work">Công việc / Học tập</option>
                <option value="sleep">Giờ ngủ</option>
                <option value="commute_meal">Ăn uống / Di chuyển</option>
                <option value="fixed_habit">Thói quen cố định</option>
                <option value="rest_buffer">Nghỉ ngơi</option>
                <option value="adhoc_event">Việc đột xuất</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={adding || !title.trim()} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs">
                <Plus className="h-4 w-4" />
                <span>Thêm vào {selectedDays.length} ngày đã chọn</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* AI Tự Xếp Lịch Theo Ngày Bar */}
      {onAiPlanDaySchedule && (
        <section className="studio-surface p-4">
          <form onSubmit={handleAiPlanDaySubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={aiDayOfWeek}
              onChange={(e) => setAiDayOfWeek(Number(e.target.value))}
              className="px-2.5 py-2 text-xs font-semibold sm:w-40"
              aria-label="Chọn ngày AI xếp lịch"
            >
              <option value={todayDow}>
                Hôm nay ({DAY_PILLS.find((d) => d.dow === todayDow)?.short})
              </option>
              {DAY_PILLS.map((dp) => (
                <option key={dp.dow} value={dp.dow}>
                  {dp.full}
                </option>
              ))}
            </select>

            <input
              value={aiDayPrompt}
              onChange={(e) => setAiDayPrompt(e.target.value)}
              placeholder="Nhờ AI xếp lịch: VD 'Chiều tập gym 1h, tối học ngoại ngữ 45p, làm dự án 1.5h lúc rảnh'..."
              className="flex-1 px-3 py-2 text-xs"
            />

            <button
              type="submit"
              disabled={aiPlanning || !aiDayPrompt.trim()}
              className="btn-primary flex shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-xs"
            >
              {aiPlanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>AI Xếp Lịch</span>
            </button>
          </form>

          {aiPlanSummary && (
            <p className="mt-2 font-mono text-xs text-emerald-400">
              ✓ {aiPlanSummary}
            </p>
          )}
        </section>
      )}

      {/* AI Weekly Blueprint Modal / Drawer */}
      {showBlueprintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="rpg-window studio-surface flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b-2 px-5 py-4 studio-divider">
              <div>
                <h3 className="font-display text-base font-extrabold text-main">
                  ✨ AI Lập Lịch Tuần Tự Động (Weekly Blueprint)
                </h3>
                <p className="text-xs text-sub">
                  Tự động rà soát 7 ngày trống, né giờ ngủ 23:30–07:00 &amp; lịch cố định, ưu tiên Giờ Vàng và bù các chỉ số còn yếu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBlueprintModal(false)}
                className="btn-secondary p-1.5"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Focus Note & Generate Bar */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={blueprintFocusNote}
                  onChange={(e) => setBlueprintFocusNote(e.target.value)}
                  placeholder="Ghi chú ưu tiên tuần này (VD: Ưu tiên đồ án + ôn ngoại ngữ + tập thể dục)..."
                  className="flex-1 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  disabled={blueprintGenerating}
                  onClick={handleGenerateBlueprint}
                  className="btn-primary flex shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-xs"
                >
                  {blueprintGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{blueprintDraft ? 'Tạo Lại Bản Nháp' : 'Tạo Bản Nháp Tuần'}</span>
                </button>
              </div>

              {blueprintNotice && (
                <p className="rounded-[2px] border-2 border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                  {blueprintNotice}
                </p>
              )}

              {blueprintGenerating && !blueprintDraft && (
                <div className="py-10 text-center text-xs text-sub">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-400" />
                  <p className="mt-2">AI đang phân tích dữ liệu 7 ngày &amp; sắp xếp khung giờ không trùng lịch...</p>
                </div>
              )}

              {blueprintDraft && (
                <>
                  {/* Summary & Empirical Peak Hour */}
                  <div className="space-y-2 rounded-[2px] border-2 p-3.5 studio-subtle studio-divider">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="rounded-[2px] border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-bold text-amber-400">
                        {blueprintDraft.mode === 'llm' ? 'LIVE LLM' : 'SMART HEURISTIC'}
                      </span>
                      <span className="text-cyan-400">
                        Giờ Vàng Thực Tế: <strong>{blueprintDraft.empiricalPeakHour || 'Chưa đủ dữ liệu'}</strong>
                      </span>
                      {blueprintDraft.weakestStats.length > 0 && (
                        <span className="text-emerald-400">
                          Chỉ số cần bù: <strong>{blueprintDraft.weakestStats.join(' · ')}</strong>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-main">{blueprintDraft.summary}</p>
                  </div>

                  {/* Proposed Conflict-Free Blocks Grouped by Day T2 -> CN */}
                  <div className="space-y-3">
                    {DAY_PILLS.map((dp) => {
                      const dayBlocks = blueprintBlocks
                        .map((blk, idx) => ({ blk, idx }))
                        .filter(({ blk }) => blk.dayOfWeek === dp.dow);
                      if (dayBlocks.length === 0) return null;

                      return (
                        <div key={dp.dow} className="rounded-[2px] border-2 studio-divider overflow-hidden">
                          <div className="border-b-2 px-3.5 py-2 font-display text-xs font-extrabold text-main studio-subtle studio-divider">
                            {dp.full} ({dayBlocks.length} khối đề xuất)
                          </div>
                          <div className="divide-y-2 studio-divider">
                            {dayBlocks.map(({ blk, idx }) => (
                              <div key={blk.id} className="space-y-1.5 p-3 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={blk.selected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setBlueprintBlocks((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, selected: checked } : item
                                        )
                                      );
                                    }}
                                    className="h-4 w-4 accent-amber-500"
                                  />
                                  <input
                                    type="time"
                                    value={blk.startTime}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBlueprintBlocks((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, startTime: val } : item
                                        )
                                      );
                                    }}
                                    className="px-2 py-1 font-mono text-xs"
                                  />
                                  <span className="text-dim">–</span>
                                  <input
                                    type="time"
                                    value={blk.endTime}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBlueprintBlocks((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, endTime: val } : item
                                        )
                                      );
                                    }}
                                    className="px-2 py-1 font-mono text-xs"
                                  />
                                  <input
                                    value={blk.title}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setBlueprintBlocks((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, title: val } : item
                                        )
                                      );
                                    }}
                                    className="min-w-[180px] flex-1 px-2.5 py-1 text-xs font-semibold"
                                  />
                                  <span className="rounded-[2px] border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
                                    +{blk.primaryStat}
                                  </span>
                                </div>
                                <p className="pl-6 text-[11px] text-sub">{blk.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {blueprintDraft && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 px-5 py-3.5 studio-subtle studio-divider">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-main">
                  <input
                    type="checkbox"
                    checked={blueprintSyncToday}
                    onChange={(e) => setBlueprintSyncToday(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span>Đồng bộ luôn thành Quest cho các khối hôm nay</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBlueprintModal(false)}
                    className="btn-secondary px-3.5 py-2 text-xs"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={blueprintApplying || blueprintBlocks.filter((b) => b.selected).length === 0}
                    onClick={handleApplyBlueprint}
                    className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs"
                  >
                    {blueprintApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>
                      Áp dụng cả tuần ({blueprintBlocks.filter((b) => b.selected).length} khối)
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google-Calendar-style 2D Pixel Weekly Time-Grid */}
      <section className="studio-surface overflow-hidden">
        {/* Calendar Toolbar */}
        <div className="flex flex-col gap-3 border-b-2 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between studio-divider">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Tuần trước</span>
            </button>
            <div className="flex items-center gap-2 rounded-[2px] border-2 px-3 py-1.5 font-mono text-xs font-bold text-main studio-subtle studio-divider">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>{weekRangeLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={weekOffset === 0 ? 'btn-primary px-2.5 py-1.5 text-xs' : 'btn-secondary px-2.5 py-1.5 text-xs'}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="btn-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs"
            >
              <span>Tuần sau</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFullDayRange((v) => !v)}
              className={fullDayRange ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-secondary px-3 py-1.5 text-xs'}
            >
              {fullDayRange ? '24h' : '06h–23h'}
            </button>
            <button
              type="button"
              onClick={() => setShowTodayQuests((v) => !v)}
              className={showTodayQuests ? 'btn-emerald flex items-center gap-1.5 px-3 py-1.5 text-xs' : 'btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs'}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Quest hôm nay ({todayQuestsWithSlots.length})</span>
            </button>
          </div>
        </div>

        {/* Hourly Matrix Grid (Horizontally scrollable only on tiny screens) */}
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            {/* 7 Day Column Headers */}
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b-2 studio-divider">
              <div className="flex items-center justify-center border-r-2 p-2 font-mono text-[10px] font-bold text-dim studio-subtle studio-divider">
                GIỜ
              </div>
              {weekDates.map((wd) => {
                const dayData = analysisByDow.get(wd.dow);
                const isSelected = selectedDow === wd.dow;
                return (
                  <button
                    key={wd.dow}
                    type="button"
                    onClick={() => setSelectedDow(wd.dow)}
                    className={`border-r last:border-r-0 px-2 py-2 text-left transition studio-divider ${
                      wd.isToday
                        ? 'bg-amber-500/15'
                        : isSelected
                          ? 'bg-indigo-500/10'
                          : 'studio-subtle hover:bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-display text-xs font-extrabold ${wd.isToday ? 'text-amber-400' : 'text-main'}`}>
                        {wd.full}
                      </span>
                      {wd.isToday && (
                        <span className="font-pixel rounded-[2px] border border-amber-400 bg-amber-500/20 px-1 py-0.5 text-[8px] font-bold text-amber-300">
                          TODAY
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between font-mono text-[10px]">
                      <span className="text-dim">{wd.fullDateStr}</span>
                      <span className="font-semibold text-emerald-400">
                        Rảnh {dayData ? (dayData.totalFreeMinutes / 60).toFixed(1) : '0.0'}h
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Matrix Body */}
            <div
              className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
              style={{ height: `${totalGridHeight}px` }}
            >
              {/* Sticky Left Time Labels */}
              <div className="sticky left-0 z-20 border-r-2 studio-subtle studio-divider">
                {hoursList.map((hr) => (
                  <div
                    key={hr}
                    className="relative border-b px-2 pt-1 text-right font-mono text-[10px] font-semibold text-dim"
                    style={{
                      height: `${HOUR_HEIGHT}px`,
                      borderColor: 'var(--cal-grid-line, var(--border-hairline))',
                    }}
                  >
                    {pad2(hr)}:00
                  </div>
                ))}
              </div>

              {/* 7 Day Columns */}
              {weekDates.map((wd) => {
                const dayData = analysisByDow.get(wd.dow);
                const rawItems: Array<Omit<CalendarPositionedItem, 'colIndex' | 'totalCols'>> = [];

                for (const b of dayData?.blocks || []) {
                  const s = toMins(b.startTime);
                  const e = toMins(b.endTime);
                  if (e <= visibleStartMins || s >= visibleEndMins) continue;
                  const cStart = Math.max(s, visibleStartMins);
                  const cEnd = Math.min(e, visibleEndMins);
                  if (cEnd <= cStart) continue;
                  rawItems.push({
                    id: b.id,
                    kind: 'block',
                    title: b.title,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    cStart,
                    cEnd,
                    block: b,
                  });
                }

                if (showTodayQuests && wd.isToday) {
                  for (const q of todayQuestsWithSlots) {
                    const parsed = parseSlotRange(q.scheduledSlot);
                    if (!parsed) continue;
                    const s = toMins(parsed.startTime);
                    const e = toMins(parsed.endTime);
                    if (e <= visibleStartMins || s >= visibleEndMins) continue;
                    const cStart = Math.max(s, visibleStartMins);
                    const cEnd = Math.min(e, visibleEndMins);
                    if (cEnd <= cStart) continue;
                    rawItems.push({
                      id: `quest-${q.id}`,
                      kind: 'quest',
                      title: q.title,
                      startTime: parsed.startTime,
                      endTime: parsed.endTime,
                      cStart,
                      cEnd,
                      quest: q,
                    });
                  }
                }

                const positioned = packDayIntervals(rawItems);

                return (
                  <div
                    key={wd.dow}
                    className="relative border-r last:border-r-0 studio-divider"
                    style={{
                      height: `${totalGridHeight}px`,
                      backgroundColor: wd.isToday ? 'var(--cal-today-bg, rgba(245,158,11,0.05))' : undefined,
                    }}
                  >
                    {/* Clickable Hourly Slots + 30m Dashed Mid-Line */}
                    {hoursList.map((hr) => (
                      <div
                        key={hr}
                        onClick={() => handleEmptyCellClick(wd.dow, hr)}
                        title={`Bấm để thêm khối lúc ${pad2(hr)}:00 (${wd.full})`}
                        className="group relative cursor-pointer border-b transition hover:bg-amber-500/10"
                        style={{
                          height: `${HOUR_HEIGHT}px`,
                          borderColor: 'var(--cal-grid-line, var(--border-hairline))',
                        }}
                      >
                        <div
                          className="pointer-events-none absolute left-0 right-0 top-1/2 border-b border-dashed"
                          style={{ borderColor: 'var(--cal-half-line, rgba(148,163,184,0.18))' }}
                        />
                        <span className="pointer-events-none absolute right-1 top-0.5 hidden font-mono text-[9px] text-amber-400 group-hover:inline">
                          + {pad2(hr)}:00
                        </span>
                      </div>
                    ))}

                    {/* Positioned Blocks & Today's AI Quests */}
                    {positioned.map((item) => {
                      const topPx = ((item.cStart - visibleStartMins) / 60) * HOUR_HEIGHT;
                      const heightPx = Math.max(20, ((item.cEnd - item.cStart) / 60) * HOUR_HEIGHT - 2);
                      const widthPct = 100 / item.totalCols;
                      const leftPct = item.colIndex * widthPct;

                      if (item.kind === 'quest' && item.quest) {
                        const questObj = item.quest;
                        const isDone = questObj.status === 'completed';
                        return (
                          <div
                            key={item.id}
                            title={`[AI Quest] ${questObj.title} (${item.startTime}–${item.endTime})`}
                            className={`group absolute z-10 overflow-hidden rounded-[2px] border-2 border-dashed px-1.5 py-0.5 text-[10px] leading-tight ${
                              isDone
                                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 line-through opacity-75'
                                : 'border-amber-400 bg-amber-500/20 text-amber-100'
                            }`}
                            style={{
                              top: `${topPx + 1}px`,
                              height: `${heightPx}px`,
                              left: `calc(${leftPct}% + 2px)`,
                              width: `calc(${widthPct}% - 4px)`,
                            }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-mono text-[9px] font-bold">
                                ⚡ {item.startTime}–{item.endTime}
                              </span>
                              {onDeleteQuest && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Xóa nhiệm vụ "${questObj.title}"?`)) {
                                      void onDeleteQuest(questObj.id);
                                    }
                                  }}
                                  className="hidden shrink-0 rounded-[2px] bg-rose-600/80 px-1 text-[9px] font-bold text-white hover:bg-rose-500 group-hover:inline-flex"
                                  title="Xóa nhiệm vụ này"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <div className="truncate font-bold">{item.title}</div>
                          </div>
                        );
                      }

                      const blk = item.block!;
                      const st = BLOCK_STYLES[blk.type];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBlockClick(blk);
                          }}
                          title={`${blk.title} (${blk.startTime}–${blk.endTime}) — Bấm để sửa`}
                          className={`absolute z-10 overflow-hidden rounded-[2px] border px-1.5 py-0.5 text-left text-[10px] leading-tight transition hover:brightness-110 ${st.gridCls}`}
                          style={{
                            top: `${topPx + 1}px`,
                            height: `${heightPx}px`,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                        >
                          <div className="truncate font-mono text-[9px] font-bold opacity-85">
                            {blk.startTime}–{blk.endTime}
                          </div>
                          <div className="line-clamp-2 break-words font-semibold">{blk.title}</div>
                        </button>
                      );
                    })}

                    {/* Current-Time Pixel Line on Today's Column */}
                    {wd.isToday && showNowLine && (
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                        style={{ top: `${nowLineTop}px` }}
                      >
                        <span
                          className="h-2.5 w-2.5 -ml-1 rounded-[1px]"
                          style={{ backgroundColor: 'var(--cal-now-line, #f59e0b)' }}
                        />
                        <div
                          className="h-[2px] flex-1"
                          style={{ backgroundColor: 'var(--cal-now-line, #f59e0b)' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Selected Day Detail Ledger & Free Windows */}
      {activeDay && (
        <section ref={dayDetailRef} className="studio-surface overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 px-5 py-4 studio-divider">
                <div>
                  <h3 className="font-display text-base font-bold text-main">
                    Chi tiết {activeDay.dayLabel}
                  </h3>
                  <p className="text-xs text-sub">
                    Ngủ: {(activeDay.totalSleepMinutes / 60).toFixed(1)}h • Học/Làm: {(activeDay.totalBusyMinutes / 60).toFixed(1)}h • Rảnh: {(activeDay.totalFreeMinutes / 60).toFixed(1)}h
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const copies = activeDay.blocks.map((b) => ({
                        dayOfWeek: (activeDay.dayOfWeek + 1) % 7,
                        startTime: b.startTime,
                        endTime: b.endTime,
                        title: b.title,
                        type: b.type,
                        energyCost: b.energyCost,
                        isRecurring: b.isRecurring,
                      }));
                      if (copies.length > 0) onSaveBatch(copies, false);
                    }}
                    className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy sang ngày sau</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onClearTimetable(activeDay.dayOfWeek)}
                    className="btn-secondary px-2.5 py-1 text-xs text-rose-500"
                  >
                    Xóa ngày
                  </button>
                </div>
              </div>

              <div className="divide-y-2 studio-divider">
                {activeDay.blocks.length === 0 ? (
                  <div className="p-5 text-xs text-dim">
                    Chưa có khối lịch cố định nào trong ngày này. Bấm vào ô giờ trống trên lịch tuần để thêm.
                  </div>
                ) : (
                  activeDay.blocks.map((b) => {
                    const st = BLOCK_STYLES[b.type];
                    const isEditing = editingId === b.id;
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        {isEditing ? (
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="px-2 py-1 text-xs" />
                            <input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="px-2 py-1 text-xs" />
                            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="flex-1 px-2 py-1 text-xs" />
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateBlock(b.id, { startTime: editStart, endTime: editEnd, title: editTitle });
                                setEditingId(null);
                              }}
                              className="btn-primary p-1.5"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="font-mono text-xs font-semibold text-main">
                                {b.startTime}–{b.endTime}
                              </span>
                              <span className={`rounded-[2px] px-2 py-0.5 text-[11px] font-medium ${st.pillCls}`}>
                                {st.label}
                              </span>
                              <span className="truncate text-sm font-medium text-main">{b.title}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(b.id);
                                  setEditTitle(b.title);
                                  setEditStart(b.startTime);
                                  setEditEnd(b.endTime);
                                }}
                                className="p-1 text-dim hover:text-main"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => onDeleteBlock(b.id)} className="p-1 text-dim hover:text-rose-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border-t-2 p-5 lg:col-span-5 lg:border-l-2 lg:border-t-0 studio-divider">
              <h3 className="mb-3 font-display text-base font-bold text-main">
                Các khoảng rảnh AI phát hiện ({activeDay.freeWindows.length})
              </h3>
              <div className="divide-y-2 studio-divider">
                {activeDay.freeWindows.map((w, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-xs">
                    <span className="font-mono font-semibold text-main">
                      {w.startTime} – {w.endTime} ({w.durationMinutes}p)
                    </span>
                    <span className="rounded-[2px] border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400">
                      {w.windowQuality === 'DEEP_WORK_PRIME'
                        ? 'Deep Work Tốt'
                        : w.windowQuality === 'STANDARD_FOCUS'
                          ? 'Focus Chuẩn'
                          : 'Sprint Ngắn'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
