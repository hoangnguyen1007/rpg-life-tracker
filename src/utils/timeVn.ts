export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getVnParts(date: Date = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  dayOfWeek: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VN_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }
  const hour = map.hour === '24' ? '00' : (map.hour || '00');
  const minute = map.minute || '00';
  const second = map.second || '00';
  return {
    year: map.year || '1970',
    month: map.month || '01',
    day: map.day || '01',
    hour,
    minute,
    second,
    dayOfWeek: WEEKDAY_MAP[map.weekday || 'Sun'] ?? 0,
  };
}

export function getVnTodayKey(date: Date = new Date()): string {
  const p = getVnParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function getVnDayOfWeek(date: Date = new Date()): number {
  return getVnParts(date).dayOfWeek;
}

export function getVnNowMinutes(date: Date = new Date()): number {
  const p = getVnParts(date);
  return Number(p.hour) * 60 + Number(p.minute);
}

export function getVnClockString(date: Date = new Date()): string {
  const p = getVnParts(date);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function formatVnTimeShort(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = getVnParts(d);
  return `${p.hour}:${p.minute}`;
}
