import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '../../finance/api';
import { readFinanceCache, writeFinanceCache } from '../../finance/cache';
import { materializedTransactionExternalId, materializeDueRecurrences } from '../../finance/recurrence';
import type {
  Account,
  AccountValuation,
  Budget,
  Category,
  FinanceGoal,
  Iou,
  RecurringTransaction,
  Transaction,
} from '../../finance/types';
import { enqueueOutbox, flushOutbox, isPoisoned, readOutbox } from '../../finance/outbox';
import { deviceLocalDate } from '../../lib/dates';

interface FinanceData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  valuations: AccountValuation[];
  recurringTransactions: RecurringTransaction[];
  goals: FinanceGoal[];
  budgets: Budget[];
  ious: Iou[];
}

const EMPTY_DATA: FinanceData = {
  accounts: [],
  categories: [],
  transactions: [],
  valuations: [],
  recurringTransactions: [],
  goals: [],
  budgets: [],
  ious: [],
};

interface FinanceDataValue extends FinanceData {
  loading: boolean;
  today: string;
  /** Queued writes waiting to sync — surfaced as a small banner so a stuck offline write isn't invisible. */
  pendingOutboxCount: number;
  /** Writes that failed to replay OUTBOX_POISON_THRESHOLD times — no longer auto-retried, surfaced separately. */
  poisonedOutboxCount: number;
  refresh: () => Promise<void>;
  saveAccount: (account: Account) => Promise<void>;
  archiveAccount: (externalId: string) => Promise<void>;
  deleteAccount: (externalId: string) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  saveValuation: (valuation: AccountValuation) => Promise<void>;
  saveTransaction: (txn: Transaction) => Promise<void>;
  deleteTransaction: (externalId: string) => Promise<void>;
  saveRecurringTransaction: (rule: RecurringTransaction) => Promise<void>;
  deleteRecurringTransaction: (externalId: string) => Promise<void>;
  saveBudget: (budget: Budget) => Promise<void>;
  archiveBudget: (externalId: string) => Promise<void>;
  saveIou: (iou: Iou) => Promise<void>;
  settleIou: (externalId: string) => Promise<void>;
}

const FinanceDataCtx = createContext<FinanceDataValue | null>(null);

export function useFinanceData(): FinanceDataValue {
  const ctx = useContext(FinanceDataCtx);
  if (ctx === null) throw new Error('useFinanceData must be used within FinanceDataProvider');
  return ctx;
}

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FinanceData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [poisonedOutboxCount, setPoisonedOutboxCount] = useState(0);
  const today = deviceLocalDate(new Date().toISOString());

  const applyAndCache = useCallback((updater: (prev: FinanceData) => FinanceData) => {
    setData((prev) => {
      const next = updater(prev);
      void writeFinanceCache({ ...next, cachedAt: new Date().toISOString() });
      return next;
    });
  }, []);

  const refreshOutboxCount = useCallback(async () => {
    const entries = await readOutbox();
    const poisoned = entries.filter(isPoisoned).length;
    setPendingOutboxCount(entries.length - poisoned);
    setPoisonedOutboxCount(poisoned);
  }, []);

  /** Every mutation's failure path queues through here instead of calling enqueueOutbox directly, so the pending-count banner never drifts from the real queue. */
  const enqueue = useCallback(
    async (entry: Parameters<typeof enqueueOutbox>[0]) => {
      await enqueueOutbox(entry);
      await refreshOutboxCount();
    },
    [refreshOutboxCount],
  );

  const materializeRecurring = useCallback(async (rules: RecurringTransaction[], asOfToday: string) => {
    const { drafts, updatedLastMaterializedDate } = materializeDueRecurrences(rules, asOfToday);
    if (drafts.length === 0) return { transactions: [] as Transaction[], rules };

    const nowIso = new Date().toISOString();
    const materialized: Transaction[] = drafts.map((d) => ({
      id: materializedTransactionExternalId(d.ruleExternalId, d.txnDate),
      externalId: materializedTransactionExternalId(d.ruleExternalId, d.txnDate),
      type: d.type as Transaction['type'],
      accountExternalId: d.accountExternalId,
      counterAccountExternalId: d.counterAccountExternalId,
      categoryExternalId: d.categoryExternalId,
      amountMinor: d.amountMinor,
      currency: d.currency,
      note: d.note,
      txnDate: d.txnDate,
      source: 'recurring',
      recurrenceExternalId: d.ruleExternalId,
      updatedAt: nowIso,
    }));

    for (const txn of materialized) {
      try {
        await api.upsertTransaction(txn);
      } catch {
        await enqueue({ entityType: 'transaction', externalId: txn.externalId, payload: txn, queuedAt: nowIso });
      }
    }
    const updatedRules = rules.map((r) =>
      r.externalId in updatedLastMaterializedDate
        ? { ...r, lastMaterializedDate: updatedLastMaterializedDate[r.externalId] }
        : r,
    );
    for (const rule of updatedRules) {
      const newDate = updatedLastMaterializedDate[rule.externalId];
      if (newDate === undefined) continue;
      try {
        await api.updateRecurringLastMaterializedDate(rule.externalId, newDate);
      } catch {
        await enqueue({ entityType: 'recurringTransaction', externalId: rule.externalId, payload: rule, queuedAt: nowIso });
      }
    }
    return { transactions: materialized, rules: updatedRules };
  }, [enqueue]);

  const load = useCallback(async () => {
    const cached = await readFinanceCache();
    if (cached !== null) setData(cached);
    try {
      await flushOutbox();
      await refreshOutboxCount();
      const [accounts, categories, transactions, valuations, recurringTransactions, goals, budgets, ious] =
        await Promise.all([
          api.listAccounts(),
          api.listCategories(),
          api.listTransactions(),
          api.listValuations(),
          api.listRecurringTransactions(),
          api.listGoals(),
          api.listBudgets(),
          api.listIous(),
        ]);
      const materializedToday = deviceLocalDate(new Date().toISOString());
      const { transactions: newTxns, rules: updatedRules } = await materializeRecurring(
        recurringTransactions,
        materializedToday,
      );
      applyAndCache(() => ({
        accounts,
        categories,
        transactions: [...newTxns, ...transactions],
        valuations,
        recurringTransactions: updatedRules,
        goals,
        budgets,
        ious,
      }));
    } catch {
      // offline — whatever was cached stands
    } finally {
      setLoading(false);
    }
  }, [applyAndCache, materializeRecurring, refreshOutboxCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAccount = useCallback(
    async (account: Account) => {
      applyAndCache((prev) => ({
        ...prev,
        accounts: [...prev.accounts.filter((a) => a.externalId !== account.externalId), account],
      }));
      try {
        await api.upsertAccount(account);
      } catch {
        await enqueue({
          entityType: 'account',
          externalId: account.externalId,
          payload: account,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache, enqueue],
  );

  const archiveAccount = useCallback(
    async (externalId: string) => {
      const nowIso = new Date().toISOString();
      applyAndCache((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.externalId === externalId ? { ...a, archivedAt: nowIso } : a)),
      }));
      try {
        await api.archiveAccount(externalId, nowIso);
      } catch {
        const account = data.accounts.find((a) => a.externalId === externalId);
        if (account !== undefined) {
          await enqueue({
            entityType: 'account',
            externalId,
            payload: { ...account, archivedAt: nowIso },
            queuedAt: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.accounts, enqueue],
  );

  /**
   * Deleting an account also removes every transaction that touches it (either
   * side of a transfer) and any recurring rule that would keep generating new
   * ones — otherwise the rule silently resurrects "Unknown account" entries on
   * the next materialization run.
   */
  const deleteAccount = useCallback(
    async (externalId: string) => {
      const nowIso = new Date().toISOString();
      const touchesAccount = (accountExternalId: string, counterAccountExternalId: string | null) =>
        accountExternalId === externalId || counterAccountExternalId === externalId;

      const account = data.accounts.find((a) => a.externalId === externalId);
      const orphanedTxns = data.transactions.filter((tx) =>
        touchesAccount(tx.accountExternalId, tx.counterAccountExternalId),
      );
      const orphanedRules = data.recurringTransactions.filter((r) =>
        touchesAccount(r.accountExternalId, r.counterAccountExternalId),
      );

      applyAndCache((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((a) => a.externalId !== externalId),
        transactions: prev.transactions.filter((tx) => !touchesAccount(tx.accountExternalId, tx.counterAccountExternalId)),
        recurringTransactions: prev.recurringTransactions.filter(
          (r) => !touchesAccount(r.accountExternalId, r.counterAccountExternalId),
        ),
      }));

      for (const tx of orphanedTxns) {
        try {
          await api.deleteTransaction(tx.externalId, nowIso);
        } catch {
          await enqueue({ entityType: 'transaction', externalId: tx.externalId, payload: tx, queuedAt: nowIso, deletedAtIso: nowIso });
        }
      }
      for (const rule of orphanedRules) {
        try {
          await api.deleteRecurringTransaction(rule.externalId, nowIso);
        } catch {
          await enqueue({
            entityType: 'recurringTransaction',
            externalId: rule.externalId,
            payload: rule,
            queuedAt: nowIso,
            deletedAtIso: nowIso,
          });
        }
      }

      try {
        await api.deleteAccount(externalId, nowIso);
      } catch {
        if (account !== undefined) {
          await enqueue({
            entityType: 'account',
            externalId,
            payload: account,
            queuedAt: nowIso,
            deletedAtIso: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.accounts, data.transactions, data.recurringTransactions, enqueue],
  );

  const saveCategory = useCallback(
    async (category: Category) => {
      applyAndCache((prev) => ({
        ...prev,
        categories: [...prev.categories.filter((c) => c.externalId !== category.externalId), category],
      }));
      try {
        await api.upsertCategory(category);
      } catch {
        await enqueue({
          entityType: 'category',
          externalId: category.externalId,
          payload: category,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache, enqueue],
  );

  const saveValuation = useCallback(
    async (valuation: AccountValuation) => {
      applyAndCache((prev) => ({
        ...prev,
        valuations: [
          ...prev.valuations.filter(
            (v) => !(v.accountExternalId === valuation.accountExternalId && v.asOfDate === valuation.asOfDate),
          ),
          valuation,
        ],
      }));
      try {
        await api.upsertValuation(valuation);
      } catch {
        await enqueue({
          entityType: 'valuation',
          externalId: valuation.externalId,
          payload: valuation,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache, enqueue],
  );

  const saveTransaction = useCallback(
    async (txn: Transaction) => {
      applyAndCache((prev) => ({
        ...prev,
        transactions: [txn, ...prev.transactions.filter((t) => t.externalId !== txn.externalId)],
      }));
      try {
        await api.upsertTransaction(txn);
      } catch {
        await enqueue({
          entityType: 'transaction',
          externalId: txn.externalId,
          payload: txn,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache, enqueue],
  );

  const deleteTransaction = useCallback(
    async (externalId: string) => {
      const nowIso = new Date().toISOString();
      const txn = data.transactions.find((t) => t.externalId === externalId);
      applyAndCache((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.externalId !== externalId),
      }));
      try {
        await api.deleteTransaction(externalId, nowIso);
      } catch {
        if (txn !== undefined) {
          await enqueue({
            entityType: 'transaction',
            externalId,
            payload: txn,
            queuedAt: nowIso,
            deletedAtIso: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.transactions, enqueue],
  );

  const saveRecurringTransaction = useCallback(
    async (rule: RecurringTransaction) => {
      applyAndCache((prev) => ({
        ...prev,
        recurringTransactions: [
          ...prev.recurringTransactions.filter((r) => r.externalId !== rule.externalId),
          rule,
        ],
      }));
      try {
        await api.upsertRecurringTransaction(rule);
      } catch {
        await enqueue({
          entityType: 'recurringTransaction',
          externalId: rule.externalId,
          payload: rule,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache, enqueue],
  );

  const deleteRecurringTransaction = useCallback(
    async (externalId: string) => {
      const nowIso = new Date().toISOString();
      const rule = data.recurringTransactions.find((r) => r.externalId === externalId);
      applyAndCache((prev) => ({
        ...prev,
        recurringTransactions: prev.recurringTransactions.filter((r) => r.externalId !== externalId),
      }));
      try {
        await api.deleteRecurringTransaction(externalId, nowIso);
      } catch {
        if (rule !== undefined) {
          await enqueue({
            entityType: 'recurringTransaction',
            externalId,
            payload: rule,
            queuedAt: nowIso,
            deletedAtIso: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.recurringTransactions, enqueue],
  );

  const saveBudget = useCallback(
    async (budget: Budget) => {
      applyAndCache((prev) => ({
        ...prev,
        budgets: [...prev.budgets.filter((b) => b.externalId !== budget.externalId), budget],
      }));
      try {
        await api.upsertBudget(budget);
      } catch {
        await enqueue({
          entityType: 'budget',
          externalId: budget.externalId,
          payload: budget,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache, enqueue],
  );

  const archiveBudget = useCallback(
    async (externalId: string) => {
      const nowIso = new Date().toISOString();
      applyAndCache((prev) => ({
        ...prev,
        budgets: prev.budgets.map((b) => (b.externalId === externalId ? { ...b, archivedAt: nowIso } : b)),
      }));
      try {
        await api.archiveBudget(externalId, nowIso);
      } catch {
        const budget = data.budgets.find((b) => b.externalId === externalId);
        if (budget !== undefined) {
          await enqueue({
            entityType: 'budget',
            externalId,
            payload: { ...budget, archivedAt: nowIso },
            queuedAt: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.budgets, enqueue],
  );

  const saveIou = useCallback(
    async (iou: Iou) => {
      applyAndCache((prev) => ({
        ...prev,
        ious: [...prev.ious.filter((i) => i.externalId !== iou.externalId), iou],
      }));
      try {
        await api.upsertIou(iou);
      } catch {
        await enqueue({
          entityType: 'iou',
          externalId: iou.externalId,
          payload: iou,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache, enqueue],
  );

  const settleIou = useCallback(
    async (externalId: string) => {
      const nowIso = new Date().toISOString();
      applyAndCache((prev) => ({
        ...prev,
        ious: prev.ious.map((i) => (i.externalId === externalId ? { ...i, settledAt: nowIso } : i)),
      }));
      try {
        await api.settleIou(externalId, nowIso);
      } catch {
        const iou = data.ious.find((i) => i.externalId === externalId);
        if (iou !== undefined) {
          await enqueue({
            entityType: 'iou',
            externalId,
            payload: { ...iou, settledAt: nowIso },
            queuedAt: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.ious, enqueue],
  );

  const value: FinanceDataValue = {
    ...data,
    loading,
    today,
    pendingOutboxCount,
    poisonedOutboxCount,
    refresh: load,
    saveAccount,
    archiveAccount,
    deleteAccount,
    saveCategory,
    saveValuation,
    saveTransaction,
    deleteTransaction,
    saveRecurringTransaction,
    deleteRecurringTransaction,
    saveBudget,
    archiveBudget,
    saveIou,
    settleIou,
  };

  return <FinanceDataCtx.Provider value={value}>{children}</FinanceDataCtx.Provider>;
}
