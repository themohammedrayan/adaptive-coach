import AsyncStorage from '@react-native-async-storage/async-storage';
import {
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
    return JSON.parse(raw) as OutboxEntry[];
  } catch {
    return [];
  }
}

export async function enqueueOutbox(entry: OutboxEntry): Promise<void> {
  const entries = await readOutbox();
  const withoutDuplicate = entries.filter(
    (e) => !(e.entityType === entry.entityType && e.externalId === entry.externalId),
  );
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify([...withoutDuplicate, entry]));
}

async function removeFromOutbox(entityType: OutboxEntityType, externalId: string): Promise<void> {
  const entries = await readOutbox();
  const remaining = entries.filter((e) => !(e.entityType === entityType && e.externalId === externalId));
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(remaining));
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

/** Attempts to replay every queued write; entries that still fail (e.g. still offline) stay queued for the next flush. */
export async function flushOutbox(): Promise<void> {
  const entries = await readOutbox();
  for (const entry of entries) {
    try {
      await replayEntry(entry);
      await removeFromOutbox(entry.entityType, entry.externalId);
    } catch {
      // still offline or a transient failure — leave queued, retry next flush
    }
  }
}
