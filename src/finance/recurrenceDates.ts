import type { IsoDate } from '../engine';
import type { RecurringTransaction } from './types';

/**
 * Occurrence-date math for recurrence rules, shared by the two consumers that
 * walk the same grid in opposite directions: `materializeDueRecurrences`
 * (behind `today`, writes real rows) and `projectCashflow` (ahead of `today`,
 * ephemeral). Keeping one generator means a rule can never fire on one date
 * when materialized and a different date when forecast.
 *
 * Pure: every date is a `YYYY-MM-DD` string and all arithmetic goes through
 * `Date.UTC`, so nothing here reads the clock or a timezone.
 */

function parseDateParts(date: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function toIso(y: number, m: number, d: number): IsoDate {
  const dt = new Date(Date.UTC(y, m - 1, d));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addDays(date: IsoDate, days: number): IsoDate {
  const { y, m, d } = parseDateParts(date);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Advances by whole months, clamping to the target month's length — a rule on the 31st fires Feb 28. */
function addMonthsClamped(date: IsoDate, months: number, dayOfMonth: number): IsoDate {
  const { y, m } = parseDateParts(date);
  const totalMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(totalMonthIndex / 12);
  const targetMonth = ((totalMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(dayOfMonth, daysInTargetMonth);
  return toIso(targetYear, targetMonth + 1, clampedDay);
}

/** The next occurrence strictly after `from`, per the rule's frequency and interval. */
export function advanceOccurrence(rule: RecurringTransaction, from: IsoDate): IsoDate {
  switch (rule.frequency) {
    case 'daily':
      return addDays(from, rule.interval);
    case 'weekly':
      return addDays(from, 7 * rule.interval);
    case 'monthly': {
      const day = rule.dayOfMonth ?? parseDateParts(rule.startDate).d;
      return addMonthsClamped(from, rule.interval, day);
    }
  }
}

/**
 * Guards a pure loop against a malformed rule, not an expected real-world path.
 * It matters more for forecasting than for materialization: a forward horizon
 * has no equivalent of `today` to bound it naturally.
 */
const MAX_OCCURRENCES_PER_RULE = 10_000;

/**
 * Occurrence dates in `(fromExclusive, throughInclusive]`, capped by the rule's
 * own `endDate`. Pass `fromExclusive: null` to begin at `rule.startDate`.
 *
 * `fromExclusive` must itself be an occurrence date (or null) — the walk
 * advances from it, so an off-grid value yields an off-grid sequence.
 */
export function occurrenceDatesBetween(
  rule: RecurringTransaction,
  fromExclusive: IsoDate | null,
  throughInclusive: IsoDate,
): IsoDate[] {
  const dates: IsoDate[] = [];
  const through =
    rule.endDate !== null && rule.endDate < throughInclusive ? rule.endDate : throughInclusive;
  if (through < rule.startDate) return dates;

  let cursor = fromExclusive === null ? rule.startDate : advanceOccurrence(rule, fromExclusive);

  let guard = 0;
  while (cursor <= through && guard < MAX_OCCURRENCES_PER_RULE) {
    dates.push(cursor);
    cursor = advanceOccurrence(rule, cursor);
    guard += 1;
  }
  return dates;
}
