export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const vnPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: VN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

export interface VnNowParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
  dateKey: string;
  hhmm: string;
  clock: string;
}

export function getVnNowParts(date: Date = new Date()): VnNowParts {
  const parts = vnPartsFormatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const year = Number(map.year || 1970);
  const month = Number(map.month || 1);
  const day = Number(map.day || 1);
  const rawHour = Number(map.hour || 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(map.minute || 0);
  const second = Number(map.second || 0);
  const dayOfWeek = WEEKDAY_TO_INDEX[map.weekday || 'Mon'] ?? 1;

  const yStr = String(year).padStart(4, '0');
  const mStr = String(month).padStart(2, '0');
  const dStr = String(day).padStart(2, '0');
  const hStr = String(hour).padStart(2, '0');
  const minStr = String(minute).padStart(2, '0');
  const sStr = String(second).padStart(2, '0');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dayOfWeek,
    dateKey: `${yStr}-${mStr}-${dStr}`,
    hhmm: `${hStr}:${minStr}`,
    clock: `${hStr}:${minStr}:${sStr}`,
  };
}

export function getVnTodayKey(date: Date = new Date()): string {
  return getVnNowParts(date).dateKey;
}

export function getVnDayOfWeek(date: Date = new Date()): number {
  return getVnNowParts(date).dayOfWeek;
}

export function getVnDayOfWeekFromDateKey(dateKey: string): number {
  const parsed = new Date(`${dateKey}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) {
    return getVnDayOfWeek();
  }
  return getVnDayOfWeek(parsed);
}

export function getVnTimeHHmm(date: Date = new Date()): string {
  return getVnNowParts(date).hhmm;
}

export function getVnNowMinutes(date: Date = new Date()): number {
  const parts = getVnNowParts(date);
  return parts.hour * 60 + parts.minute;
}

export function getVnClockString(date: Date = new Date()): string {
  return getVnNowParts(date).clock;
}
