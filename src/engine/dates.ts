import type { IsoDate } from './types';

const MS_PER_DAY = 86_400_000;

/** Parse 'YYYY-MM-DD' to a UTC-midnight epoch so calendar math never touches timezones. */
export function parseIso(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toIso(epochMs: number): IsoDate {
  const dt = new Date(epochMs);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return toIso(parseIso(date) + n * MS_PER_DAY);
}

/** Whole days from b to a (a − b). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((parseIso(a) - parseIso(b)) / MS_PER_DAY);
}

/** Inclusive daily grid; empty when start > end. */
export function dateRange(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let t = parseIso(start); t <= parseIso(end); t += MS_PER_DAY) out.push(toIso(t));
  return out;
}
