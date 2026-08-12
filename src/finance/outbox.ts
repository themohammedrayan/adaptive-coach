import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteAccount,
  deleteRecurringTransaction,
  deleteTransaction,
  upsertAccount,
  upsertBudget,
  upsertCategory,
  upsertGoal,
  upsertIou,
  upsertRecurringTransaction,
  upsertTransaction,
  upsertValuation,
} from './api';
import type {
  Account,
  AccountValuation,
  Budget,
  Category,
  FinanceGoal,
  Iou,
  RecurringTransaction,
  Transaction,
} from './types';

const OUTBOX_KEY = 'finance:outbox:v1';

export type OutboxEntityType =
  | 'account'
  | 'category'
  | 'transaction'
  | 'valuation'
  | 'recurringTransaction'
  | 'goal'
  | 'budget'
  | 'iou';

export type OutboxPayload =
  | Account
  | Category
  | Transaction
  | AccountValuation
  | RecurringTransaction
  | FinanceGoal
  | Budget
  | Iou;

export interface OutboxEntry {
  entityType: OutboxEntityType;
  externalId: string;
  payload: OutboxPayload;
  queuedAt: string;
  /** Present only when this entry replays a soft-delete instead of an upsert. */
  deletedAtIso?: string;
  /** Failed replay attempts since this entry was last (re)queued with fresh content. */
  attempts: number;
  /** Message from the most recent failed replay, for surfacing a poisoned entry. */
  lastError?: string;
}

/** Caller-supplied shape — `attempts`/`lastError` are outbox-internal bookkeeping, not something callers set. */
export type OutboxEntryInput = Omit<OutboxEntry, 'attempts' | 'lastError'>;

/** An entry that has failed to replay this many times stops being auto-retried and is surfaced separately. */
export const OUTBOX_POISON_THRESHOLD = 5;

export function isPoisoned(entry: OutboxEntry): boolean {
  return entry.attempts >= OUTBOX_POISON_THRESHOLD;
}

/**
 * A small pending-write queue keyed by external_id — idempotent upsert makes
 * replaying a queued write safe even if a previous attempt partially
 * succeeded. Paired with cache.ts as Finance's offline story; not a full
 * store/outbox abstraction like food-log/data-sync use.
 */
export async function readOutbox(): Promise<OutboxEntry[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw) as OutboxEntry[];
    // Entries queued before attempts-tracking existed have no `attempts` field.
    return parsed.map((e) => ({ ...e, attempts: e.attempts ?? 0 }));
  } catch {
    return [];
  }
}

async function writeOutbox(entries: OutboxEntry[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
}

/**
 * Re-queuing an entity that's already queued replaces its payload in place
 * (same array position) rather than moving it to the end, so a create that
 * gets re-edited while offline doesn't get sequenced behind entries that
 * depend on it. Fresh content means fresh attempts.
 */
export async function enqueueOutbox(entry: OutboxEntryInput): Promise<void> {
  const entries = await readOutbox();
  const idx = entries.findIndex((e) => e.entityType === entry.entityType && e.externalId === entry.externalId);
  const next: OutboxEntry = { ...entry, attempts: 0 };
  if (idx === -1) {
    await writeOutbox([...entries, next]);
  } else {
    const updated = [...entries];
    updated[idx] = next;
    await writeOutbox(updated);
  }
}

async function removeFromOutbox(entityType: OutboxEntityType, externalId: string): Promise<void> {
  const entries = await readOutbox();
  const remaining = entries.filter((e) => !(e.entityType === entityType && e.externalId === externalId));
  await writeOutbox(remaining);
}

async function recordFailure(entityType: OutboxEntityType, externalId: string, error: unknown): Promise<void> {
  const entries = await readOutbox();
  const idx = entries.findIndex((e) => e.entityType === entityType && e.externalId === externalId);
  if (idx === -1) return; // removed or replaced concurrently — nothing to record onto
  const updated = [...entries];
  updated[idx] = {
    ...updated[idx],
    attempts: updated[idx].attempts + 1,
    lastError: error instanceof Error ? error.message : String(error),
  };
  await writeOutbox(updated);
}

/** Must be called from resetUserData() — nothing else clears this key. */
export async function clearOutbox(): Promise<void> {
  await AsyncStorage.removeItem(OUTBOX_KEY);
}

async function replayEntry(entry: OutboxEntry): Promise<void> {
  if (entry.deletedAtIso !== undefined && entry.entityType === 'transaction') {
    return deleteTransaction(entry.externalId, entry.deletedAtIso);
  }
  if (entry.deletedAtIso !== undefined && entry.entityType === 'recurringTransaction') {
    return deleteRecurringTransaction(entry.externalId, entry.deletedAtIso);
  }
  if (entry.deletedAtIso !== undefined && entry.entityType === 'account') {
    return deleteAccount(entry.externalId, entry.deletedAtIso);
  }
  switch (entry.entityType) {
    case 'account':
      return upsertAccount(entry.payload as Account);
    case 'category':
      return upsertCategory(entry.payload as Category);
    case 'transaction':
      return upsertTransaction(entry.payload as Transaction);
    case 'valuation':
      return upsertValuation(entry.payload as AccountValuation);
    case 'recurringTransaction':
      return upsertRecurringTransaction(entry.payload as RecurringTransaction);
    case 'goal':
      return upsertGoal(entry.payload as FinanceGoal);
    case 'budget':
      return upsertBudget(entry.payload as Budget);
    // Settling rides this same path: settledAt is a field on the row, so the
    // queued payload already carries it and replays as an ordinary upsert.
    case 'iou':
      return upsertIou(entry.payload as Iou);
  }
}

let inFlightFlush: Promise<void> | null = null;

/**
 * Attempts to replay every queued write; entries that still fail (e.g. still
 * offline) stay queued for the next flush. Poisoned entries (failed
 * `OUTBOX_POISON_THRESHOLD` times) are skipped — they'd otherwise retry
 * forever with no visible outcome — but stay in the queue so their count is
 * still surfaced.
 *
 * Single-flight: `load()` calls this on every refresh, so a slow flush and a
 * concurrent one must not both walk the same snapshot of entries and race
 * on removal — callers overlapping in time share one in-progress flush.
 */
export function flushOutbox(): Promise<void> {
  if (inFlightFlush !== null) return inFlightFlush;
  inFlightFlush = doFlush().finally(() => {
    inFlightFlush = null;
  });
  return inFlightFlush;
}

async function doFlush(): Promise<void> {
  const entries = await readOutbox();
  for (const entry of entries) {
    if (isPoisoned(entry)) continue;
    try {
      await replayEntry(entry);
      await removeFromOutbox(entry.entityType, entry.externalId);
    } catch (e) {
      // still offline or a transient failure — leave queued, retry next flush
      await recordFailure(entry.entityType, entry.externalId, e);
    }
  }
}
