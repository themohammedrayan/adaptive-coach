import type { Challenge } from '../challenges';
import { getChallengeRuntime } from '../challenges/runtime';
import { buildMeasurementSeries } from '../data-sync';
import { getDataSyncRuntime } from '../data-sync/runtime';
import { getDashboardRuntime } from '../dashboard/runtime';
import { addDays } from '../engine';
import type { IsoDate } from '../engine';
import * as financeApi from '../finance/api';
import { accountBalanceAsOf as computeAccountBalanceAsOf } from '../finance/netWorth';
import * as api from './api';
import { buildGoal } from './crud';
import { applyBlocking, resolveGoalProgress } from './resolvers';
import type { Goal, GoalProgress, Habit, HabitLogEntry, MilestoneItem, ResolverContext } from './types';

export interface ResolvedGoalsSnapshot {
  goals: Goal[];
  habits: Habit[];
  habitLog: HabitLogEntry[];
  milestoneItems: MilestoneItem[];
  progressByGoalId: Map<string, GoalProgress>;
}

/**
 * The one shared fetch-backfill-resolve-block pipeline behind both the
 * Goals UI (src/ui/goals/GoalsDataContext.tsx) and the unified coach
 * (src/coach-chat/askCoach.ts) — pulled out so neither has to duplicate the
 * ResolverContext assembly (Goals BRD §C.1) or the Challenge-backfill pass.
 * Performs writes (the backfill upsert) as a best-effort side effect, same
 * as the context's own mutation handlers — Goals architecture decision, no
 * outbox.
 */
export async function loadResolvedGoals(today: IsoDate): Promise<ResolvedGoalsSnapshot> {
  const nowIso = new Date().toISOString();
  const [goals, habits, habitLog, milestoneItems, challengeRt, dashRt, dataRt, accounts, transactions, valuations, financeGoals] =
    await Promise.all([
      api.listGoals(),
      api.listHabits(),
      api.listHabitLogEntries(),
      api.listMilestoneItems(),
      getChallengeRuntime(),
      getDashboardRuntime(),
      getDataSyncRuntime(),
      financeApi.listAccounts(),
      financeApi.listTransactions(),
      financeApi.listValuations(),
      financeApi.listGoals(),
    ]);

  const challenges = await challengeRt.store.list('weight');
  const cachedResult = await dashRt.store.getLastResult();

  // Backfill: any Challenge that predates this module (or was created
  // before a goals row could be attached) gets one now, so nothing is ever
  // silently absent from the Goals list.
  const boundChallengeIds = new Set(
    goals.flatMap((g) => (g.sourceBinding.type === 'metric' ? [g.sourceBinding.challengeId] : [])),
  );
  const backfilled: Goal[] = [];
  for (const c of challenges) {
    if (boundChallengeIds.has(c.id)) continue;
    const goal = buildGoal({ type: 'metric', title: 'Weight goal', sourceBinding: { type: 'metric', challengeId: c.id } }, nowIso);
    try {
      await api.upsertGoal(goal);
      backfilled.push(goal);
    } catch {
      // offline — picked up again on the next successful load
    }
  }
  const allGoals = [...goals, ...backfilled];

  const earliestStart = challenges.reduce<string | null>(
    (min, c) => (min === null || c.startDate < min ? c.startDate : min),
    null,
  );
  const measurementRange = { start: earliestStart ?? addDays(today, -365), end: today };
  const weightRows = await dataRt.store.listByType('weight', measurementRange);
  const measurements = buildMeasurementSeries(weightRows, measurementRange, 'earliest');

  const resolverCtx: ResolverContext = {
    today,
    challengeStore: challengeRt.store,
    measurements,
    lastEngineResult: (challenge: Challenge) => {
      if (!challenge.isPrimary || cachedResult === null) return null;
      return { boundHit: cachedResult.result.boundHit, projectedFinishDate: cachedResult.result.projectedFinishDate };
    },
    financeGoalStore: {
      getByExternalId: async (id) => financeGoals.find((g) => g.externalId === id) ?? null,
    },
    accountBalanceAsOf: (accountExternalId, asOfDate) => {
      const account = accounts.find((a) => a.externalId === accountExternalId);
      return account === undefined ? null : computeAccountBalanceAsOf(account, transactions, valuations, asOfDate);
    },
    habitStore: {
      getByExternalId: async (id) => habits.find((h) => h.externalId === id) ?? null,
    },
    habitLogStore: {
      countInRange: async (habitExternalId, start, end) =>
        habitLog.filter((e) => e.habitExternalId === habitExternalId && e.occurredOn >= start && e.occurredOn <= end).length,
    },
    milestoneItemStore: {
      listByGoal: async (goalExternalId) => milestoneItems.filter((i) => i.goalExternalId === goalExternalId),
    },
  };

  const activeGoals = allGoals.filter((g) => g.status === 'active');
  const progressEntries = await Promise.all(
    activeGoals.map(async (g) => [g.id, await resolveGoalProgress(g, resolverCtx)] as const),
  );
  const progressByGoalId = applyBlocking(activeGoals, new Map(progressEntries));

  return { goals: allGoals, habits, habitLog, milestoneItems, progressByGoalId };
}
