import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getChallengeRuntime } from '../../challenges/runtime';
import * as financeApi from '../../finance/api';
import * as api from '../../goals/api';
import { readGoalsCache, writeGoalsCache } from '../../goals/cache';
import {
  createMetricGoal as createMetricGoalCrud,
  toggleHabitLogEntry,
  toggleMilestoneItem as toggleMilestoneItemCrud,
  type CreateMetricGoalInput,
} from '../../goals/crud';
import { loadResolvedGoals, type ResolvedGoalsSnapshot } from '../../goals/loadResolvedGoals';
import type { Goal, Habit, HabitLogEntry, MilestoneItem } from '../../goals/types';
import { deviceLocalDate } from '../../lib/dates';

type GoalsData = ResolvedGoalsSnapshot;

const EMPTY_DATA: GoalsData = {
  goals: [],
  habits: [],
  habitLog: [],
  milestoneItems: [],
  progressByGoalId: new Map(),
};

interface GoalsDataValue extends GoalsData {
  loading: boolean;
  today: string;
  refresh: () => Promise<void>;
  saveGoal: (goal: Goal) => Promise<void>;
  archiveGoal: (externalId: string) => Promise<void>;
  saveHabit: (habit: Habit) => Promise<void>;
  toggleHabitCheckIn: (habit: Habit, occurredOn: string) => Promise<void>;
  saveMilestoneItem: (item: MilestoneItem) => Promise<void>;
  toggleMilestoneItemCheck: (item: MilestoneItem) => Promise<void>;
  createMetricGoal: (input: CreateMetricGoalInput) => Promise<void>;
}

const GoalsDataCtx = createContext<GoalsDataValue | null>(null);

export function useGoalsData(): GoalsDataValue {
  const ctx = useContext(GoalsDataCtx);
  if (ctx === null) throw new Error('useGoalsData must be used within GoalsDataProvider');
  return ctx;
}

/**
 * Mirrors FinanceDataContext.tsx's shape (cache-then-fetch-then-reconcile,
 * best-effort writes with no outbox — see Goals architecture decision in
 * docs/brd-goals.md's implementation plan) but also assembles a
 * ResolverContext (Goals BRD §C.1) and resolves every active goal's
 * GoalProgress + applyBlocking() on every load, since progress is always
 * derived live and never cached onto a `goals` row (§B.1).
 */
export function GoalsDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GoalsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const today = deviceLocalDate(new Date().toISOString());

  const load = useCallback(async () => {
    const cached = await readGoalsCache();
    if (cached !== null) {
      setData((prev) => ({
        ...prev,
        goals: cached.goals,
        habits: cached.habits,
        habitLog: cached.habitLog,
        milestoneItems: cached.milestoneItems,
      }));
    }

    try {
      const snapshot = await loadResolvedGoals(today);
      setData(snapshot);
      await writeGoalsCache({
        goals: snapshot.goals,
        habits: snapshot.habits,
        habitLog: snapshot.habitLog,
        milestoneItems: snapshot.milestoneItems,
        cachedAt: new Date().toISOString(),
      });
    } catch {
      // offline — whatever was cached stands
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistAndReload = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } finally {
        // Always reconcile from server/cache, success or failure — but let
        // a write failure propagate so callers (e.g. CreateGoalScreen's
        // submit handlers) can tell it didn't actually save.
        await load();
      }
    },
    [load],
  );

  const saveGoal = useCallback((goal: Goal) => persistAndReload(() => api.upsertGoal(goal)), [persistAndReload]);

  const archiveGoal = useCallback(
    (externalId: string) => {
      const nowIso = new Date().toISOString();
      const goal = data.goals.find((g) => g.externalId === externalId);
      return persistAndReload(async () => {
        await api.archiveGoal(externalId, nowIso);
        // A fund goal is also tracked as its own row in finance_goals (Finance's
        // read-only Fund Goals list and its coach payload both read that row's
        // status directly) — cascade so the two don't drift out of sync. Not
        // atomic with the write above: if this second call fails, finance_goals
        // stays stale until the next successful archive retry.
        if (goal?.sourceBinding.type === 'fund') {
          await financeApi.archiveGoal(goal.sourceBinding.financeGoalExternalId, nowIso);
        }
      });
    },
    [persistAndReload, data.goals],
  );

  const saveHabit = useCallback((habit: Habit) => persistAndReload(() => api.upsertHabit(habit)), [persistAndReload]);

  const toggleHabitCheckIn = useCallback(
    (habit: Habit, occurredOn: string) => {
      const existing = data.habitLog.find((e) => e.habitExternalId === habit.externalId && e.occurredOn === occurredOn) ?? null;
      const toggled = toggleHabitLogEntry(habit.externalId, occurredOn, existing, new Date().toISOString());
      return persistAndReload(async () => {
        if (toggled === null) {
          if (existing !== null) await api.deleteHabitLogEntry(existing.externalId, new Date().toISOString());
        } else {
          await api.upsertHabitLogEntry(toggled);
        }
      });
    },
    [data.habitLog, persistAndReload],
  );

  const saveMilestoneItem = useCallback(
    (item: MilestoneItem) => persistAndReload(() => api.upsertMilestoneItem(item)),
    [persistAndReload],
  );

  const toggleMilestoneItemCheck = useCallback(
    (item: MilestoneItem) => persistAndReload(() => api.upsertMilestoneItem(toggleMilestoneItemCrud(item, new Date().toISOString()))),
    [persistAndReload],
  );

  const createMetricGoal = useCallback(
    async (input: CreateMetricGoalInput) => {
      const challengeRt = await getChallengeRuntime();
      const nowUtc = new Date().toISOString();
      const startDate = deviceLocalDate(nowUtc);
      const { goal } = await createMetricGoalCrud(challengeRt.store, input, nowUtc, startDate);
      await persistAndReload(() => api.upsertGoal(goal));
    },
    [persistAndReload],
  );

  const value: GoalsDataValue = {
    ...data,
    loading,
    today,
    refresh: load,
    saveGoal,
    archiveGoal,
    saveHabit,
    toggleHabitCheckIn,
    saveMilestoneItem,
    toggleMilestoneItemCheck,
    createMetricGoal,
  };

  return <GoalsDataCtx.Provider value={value}>{children}</GoalsDataCtx.Provider>;
}
