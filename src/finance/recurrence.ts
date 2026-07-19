import type { IsoDate } from '../engine';
import type { RecurringTransaction } from './types';

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

function addMonthsClamped(date: IsoDate, months: number, dayOfMonth: number): IsoDate {
  const { y, m } = parseDateParts(date);
  const totalMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(totalMonthIndex / 12);
  const targetMonth = ((totalMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(dayOfMonth, daysInTargetMonth);
  return toIso(targetYear, targetMonth + 1, clampedDay);
}

function advanceOccurrence(rule: RecurringTransaction, from: IsoDate): IsoDate {
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

const MAX_OCCURRENCES_PER_RULE = 10_000; // guards a pure loop against a malformed rule, not an expected real-world path

function occurrenceDatesInRange(rule: RecurringTransaction, today: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  const cappedToday = rule.endDate !== null && rule.endDate < today ? rule.endDate : today;
  if (cappedToday < rule.startDate) return dates;

  let cursor = rule.lastMaterializedDate === null ? rule.startDate : advanceOccurrence(rule, rule.lastMaterializedDate);

  let guard = 0;
  while (cursor <= cappedToday && guard < MAX_OCCURRENCES_PER_RULE) {
    dates.push(cursor);
    cursor = advanceOccurrence(rule, cursor);
    guard += 1;
  }
  return dates;
}

export interface RecurrenceDraft {
  ruleExternalId: string;
  type: RecurringTransaction['type'];
  accountExternalId: string;
  counterAccountExternalId: string | null;
  categoryExternalId: string | null;
  amountMinor: number;
  currency: string;
  note: string | null;
  txnDate: IsoDate;
}

export interface MaterializeResult {
  drafts: RecurrenceDraft[];
  /** New `lastMaterializedDate` per rule external_id — only present for rules that produced at least one draft. */
  updatedLastMaterializedDate: Record<string, IsoDate>;
}

/** Pure: given recurrence rules and today's date, produces the transaction drafts due since each rule's last materialization. */
export function materializeDueRecurrences(rules: RecurringTransaction[], today: IsoDate): MaterializeResult {
  const drafts: RecurrenceDraft[] = [];
  const updatedLastMaterializedDate: Record<string, IsoDate> = {};

  for (const rule of rules) {
    if (!rule.active) continue;
    const occurrences = occurrenceDatesInRange(rule, today);
    if (occurrences.length === 0) continue;
    for (const occ of occurrences) {
      drafts.push({
        ruleExternalId: rule.externalId,
        type: rule.type,
        accountExternalId: rule.accountExternalId,
        counterAccountExternalId: rule.counterAccountExternalId,
        categoryExternalId: rule.categoryExternalId,
        amountMinor: rule.amountMinor,
        currency: rule.currency,
        note: rule.note,
        txnDate: occ,
      });
    }
    updatedLastMaterializedDate[rule.externalId] = occurrences[occurrences.length - 1];
  }

  return { drafts, updatedLastMaterializedDate };
}
