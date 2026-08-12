import type { IsoDate } from '../engine';
import { occurrenceDatesBetween } from './recurrenceDates';
import type { RecurringTransaction } from './types';

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

/**
 * Deterministic id for a materialized occurrence, keyed by (rule, date) —
 * the same identity `cashflow.ts`'s forecast-side dedupe already uses. Makes
 * re-materializing the same occurrence (e.g. after a crash between the
 * transaction upsert and the lastMaterializedDate write) resolve to a no-op
 * update instead of a duplicate row, regardless of write-order or timing.
 */
export function materializedTransactionExternalId(ruleExternalId: string, txnDate: IsoDate): string {
  return `rec-${ruleExternalId}-${txnDate}`;
}

/**
 * Pure: given recurrence rules and today's date, produces the transaction
 * drafts due since each rule's last materialization.
 *
 * Deliberately stops at `today` — this side of the grid becomes real rows.
 * `projectCashflow` walks the same generator forward for the forecast side.
 */
export function materializeDueRecurrences(rules: RecurringTransaction[], today: IsoDate): MaterializeResult {
  const drafts: RecurrenceDraft[] = [];
  const updatedLastMaterializedDate: Record<string, IsoDate> = {};

  for (const rule of rules) {
    if (!rule.active) continue;
    const occurrences = occurrenceDatesBetween(rule, rule.lastMaterializedDate, today);
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
