import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '../../finance/api';
import { readFinanceCache, writeFinanceCache } from '../../finance/cache';
import { defaultGenId } from '../../finance/ids';
import { materializeDueRecurrences } from '../../finance/recurrence';
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
import { enqueueOutbox, flushOutbox } from '../../finance/outbox';
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
  refresh: () => Promise<void>;
  saveAccount: (account: Account) => Promise<void>;
  archiveAccount: (externalId: string) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  saveValuation: (valuation: AccountValuation) => Promise<void>;
  saveTransaction: (txn: Transaction) => Promise<void>;
  deleteTransaction: (externalId: string) => Promise<void>;
  saveRecurringTransaction: (rule: RecurringTransaction) => Promise<void>;
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
  const today = deviceLocalDate(new Date().toISOString());

  const applyAndCache = useCallback((updater: (prev: FinanceData) => FinanceData) => {
    setData((prev) => {
      const next = updater(prev);
      void writeFinanceCache({ ...next, cachedAt: new Date().toISOString() });
      return next;
    });
  }, []);

  const materializeRecurring = useCallback(async (rules: RecurringTransaction[], asOfToday: string) => {
    const { drafts, updatedLastMaterializedDate } = materializeDueRecurrences(rules, asOfToday);
    if (drafts.length === 0) return { transactions: [] as Transaction[], rules };

    const nowIso = new Date().toISOString();
    const materialized: Transaction[] = drafts.map((d) => ({
      id: defaultGenId(),
      externalId: defaultGenId(),
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
        await enqueueOutbox({ entityType: 'transaction', externalId: txn.externalId, payload: txn, queuedAt: nowIso });
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
        await enqueueOutbox({ entityType: 'recurringTransaction', externalId: rule.externalId, payload: rule, queuedAt: nowIso });
      }
    }
    return { transactions: materialized, rules: updatedRules };
  }, []);

  const load = useCallback(async () => {
    const cached = await readFinanceCache();
    if (cached !== null) setData(cached);
    try {
      await flushOutbox();
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
  }, [applyAndCache, materializeRecurring]);

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
        await enqueueOutbox({
          entityType: 'account',
          externalId: account.externalId,
          payload: account,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache],
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
          await enqueueOutbox({
            entityType: 'account',
            externalId,
            payload: { ...account, archivedAt: nowIso },
            queuedAt: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.accounts],
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
        await enqueueOutbox({
          entityType: 'category',
          externalId: category.externalId,
          payload: category,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache],
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
        await enqueueOutbox({
          entityType: 'valuation',
          externalId: valuation.externalId,
          payload: valuation,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache],
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
        await enqueueOutbox({
          entityType: 'transaction',
          externalId: txn.externalId,
          payload: txn,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache],
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
          await enqueueOutbox({
            entityType: 'transaction',
            externalId,
            payload: txn,
            queuedAt: nowIso,
            deletedAtIso: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.transactions],
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
        await enqueueOutbox({
          entityType: 'recurringTransaction',
          externalId: rule.externalId,
          payload: rule,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache],
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
        await enqueueOutbox({
          entityType: 'budget',
          externalId: budget.externalId,
          payload: budget,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache],
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
          await enqueueOutbox({
            entityType: 'budget',
            externalId,
            payload: { ...budget, archivedAt: nowIso },
            queuedAt: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.budgets],
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
        await enqueueOutbox({
          entityType: 'iou',
          externalId: iou.externalId,
          payload: iou,
          queuedAt: new Date().toISOString(),
        });
      }
    },
    [applyAndCache],
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
          await enqueueOutbox({
            entityType: 'iou',
            externalId,
            payload: { ...iou, settledAt: nowIso },
            queuedAt: nowIso,
          });
        }
      }
    },
    [applyAndCache, data.ious],
  );

  const value: FinanceDataValue = {
    ...data,
    loading,
    today,
    refresh: load,
    saveAccount,
    archiveAccount,
    saveCategory,
    saveValuation,
    saveTransaction,
    deleteTransaction,
    saveRecurringTransaction,
    saveBudget,
    archiveBudget,
    saveIou,
    settleIou,
  };

  return <FinanceDataCtx.Provider value={value}>{children}</FinanceDataCtx.Provider>;
}
