import type { IsoDate } from '../engine';

export type Granularity = 'day' | 'month' | 'year';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Day prefixes ('YYYY-MM-DD'), oldest first, for the n days ending with `today`. */
export function lastNDays(today: IsoDate, n: number): IsoDate[] {
  const [y, m, d] = today.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const out: IsoDate[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base - i * 86_400_000);
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

/** Month prefixes ('YYYY-MM'), oldest first, for the n months ending with the month containing `today`. */
export function lastNMonthPrefixes(today: IsoDate, n: number): string[] {
  const [y, m] = today.split('-').map(Number);
  const prefixes: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const totalMonthIndex = m - 1 - i;
    const year = y + Math.floor(totalMonthIndex / 12);
    const month = ((totalMonthIndex % 12) + 12) % 12;
    prefixes.push(`${year}-${String(month + 1).padStart(2, '0')}`);
  }
  return prefixes;
}

/** Year prefixes ('YYYY'), oldest first, for the n years ending with the year containing `today`. */
export function lastNYearPrefixes(today: IsoDate, n: number): string[] {
  const y = Number(today.slice(0, 4));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(String(y - i));
  return out;
}

/** The last calendar day (IsoDate) of each given 'YYYY-MM' prefix. */
export function monthEndDatesForPrefixes(prefixes: string[]): IsoDate[] {
  return prefixes.map((prefix) => {
    const [y, m] = prefix.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${prefix}-${String(lastDay).padStart(2, '0')}`;
  });
}

/** December 31 of each given 'YYYY' prefix. */
export function yearEndDatesForPrefixes(prefixes: string[]): IsoDate[] {
  return prefixes.map((y) => `${y}-12-31`);
}

/** The period prefix containing `today` at the given granularity — 'this day/month/year'. */
export function currentPeriodPrefix(today: IsoDate, granularity: Granularity): string {
  if (granularity === 'day') return today;
  if (granularity === 'year') return today.slice(0, 4);
  return today.slice(0, 7);
}

/** Period prefixes for the last `count` periods at the given granularity, plus the matching sample date for each (used to sample a point-in-time value like net worth). */
export function periodsFor(
  today: IsoDate,
  granularity: Granularity,
  count: number,
): { prefixes: string[]; sampleDates: IsoDate[] } {
  if (granularity === 'day') {
    const days = lastNDays(today, count);
    return { prefixes: days, sampleDates: days };
  }
  if (granularity === 'year') {
    const years = lastNYearPrefixes(today, count);
    return { prefixes: years, sampleDates: yearEndDatesForPrefixes(years) };
  }
  const months = lastNMonthPrefixes(today, count);
  return { prefixes: months, sampleDates: monthEndDatesForPrefixes(months) };
}

/** Short x-axis label for a period prefix/date, formatted per granularity: day → 'MM-DD', month → 'Mon', year → 'YYYY'. */
export function formatPeriodLabel(value: string, granularity: Granularity): string {
  if (granularity === 'day') return value.slice(5);
  if (granularity === 'year') return value.slice(0, 4);
  const monthIndex = Number(value.slice(5, 7)) - 1;
  return MONTH_ABBR[monthIndex] ?? value.slice(5);
}

/**
 * Calendar-grid layout for a 'YYYY-MM' month. Monday-first, matching the
 * Calendar module's week view. `leadingBlanks` is how many empty cells precede
 * the 1st; trailing blanks are the caller's business (they depend on row count).
 */
export function monthGridDates(monthPrefix: string): { leadingBlanks: number; dates: IsoDate[] } {
  const [y, m] = monthPrefix.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // getUTCDay is Sunday-first (0); shift so Monday is 0.
  const leadingBlanks = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dates: IsoDate[] = [];
  for (let d = 1; d <= daysInMonth; d++) dates.push(`${monthPrefix}-${String(d).padStart(2, '0')}`);
  return { leadingBlanks, dates };
}

/** 'Aug 6' — unpadded day label for the cash-flow banner. */
export function formatDayLabel(date: IsoDate): string {
  const monthIndex = Number(date.slice(5, 7)) - 1;
  return `${MONTH_ABBR[monthIndex] ?? date.slice(5, 7)} ${Number(date.slice(8, 10))}`;
}

/** 'Aug 2026' — month-grid header. */
export function formatMonthLabel(monthPrefix: string): string {
  const monthIndex = Number(monthPrefix.slice(5, 7)) - 1;
  return `${MONTH_ABBR[monthIndex] ?? monthPrefix.slice(5, 7)} ${monthPrefix.slice(0, 4)}`;
}
