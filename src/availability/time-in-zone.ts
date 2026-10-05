export type WeekdayAndHm = {
  weekday: number;
  hm: string;
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function weekdayAndHm(date: Date, timeZone: string): WeekdayAndHm {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekdayName =
    parts.find((part) => part.type === 'weekday')?.value ?? 'Sun';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return {
    weekday: WEEKDAY_MAP[weekdayName] ?? 0,
    hm: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
  };
}

export function clinicDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function clockMinute(date: Date, timeZone: string): number {
  return Number(weekdayAndHm(date, timeZone).hm.slice(3));
}

export function isHmWithinWindow(
  startHm: string,
  endHm: string,
  windowStart: string,
  windowEnd: string,
): boolean {
  return startHm >= windowStart && endHm <= windowEnd && startHm < endHm;
}
