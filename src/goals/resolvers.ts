import { addDays, computeTrend, DEFAULT_CONFIG, diffDays, trendAt } from '../engine';
import type { IsoDate } from '../engine';
import { financeGoalProgress } from '../finance/goals';
import type { Goal, GoalProgress, ProgressStatus, ResolverContext } from './types';

const EPSILON = 0.001;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function noData(today: IsoDate, detail: GoalProgress['detail'] = {}): GoalProgress {
  return { pct: null, status: 'no_data', numerator: null, denominator: null, asOf: today, detail };
}

/** Goals BRD §E.5 — shared elapsed-fraction helper used by fund/milestone/habit. */
export function expectedPctByNow(start: IsoDate, end: IsoDate, asOf: IsoDate): number {
  const totalDays = diffDays(end, start);
  if (totalDays <= 0) return 1;
  return clamp01(diffDays(asOf, start) / totalDays);
}

/** Goals BRD §D.4 — single pass over the whole resolved list, never inside a resolver. */
export function applyBlocking(
  goals: Goal[],
  progressByGoalId: Map<string, GoalProgress>,
): Map<string, GoalProgress> {
  const next = new Map(progressByGoalId);
  for (const g of goals) {
    if (g.blockedByGoalId === null) continue;
    const predecessor = next.get(g.blockedByGoalId);
    // A missing predecessor (soft-deleted, or not in the active list passed
    // in) is treated the same as "not completed" — fail closed, not open.
    if (predecessor === undefined || predecessor.status !== 'completed') {
      const current = next.get(g.id);
      if (current !== undefined) next.set(g.id, { ...current, status: 'blocked' });
    }
  }
  return next;
}

/** Goals BRD §E.1 — defers to Engine's own boundHit heuristic, not expectedPctByNow (§E.5's carve-out). */
async function resolveMetricGoal(goal: Goal, ctx: ResolverContext): Promise<GoalProgress> {
  if (goal.sourceBinding.type !== 'metric') return noData(ctx.today, { sourceMissing: true });
  const challenge = await ctx.challengeStore.get(goal.sourceBinding.challengeId);
  if (challenge === null || challenge.status === 'deleted') {
    // Distinct from the outer catch-all's sourceMissing: this one is a
    // confirmed absence (the challenge really is gone), not "the resolver
    // threw for some unrelated reason" — safe for loadResolvedGoals to act
    // on by auto-archiving the goal, where the ambiguous catch-all isn't.
    return noData(ctx.today, { sourceMissing: true, confirmedMissing: true });
  }

  const trend = computeTrend(ctx.measurements, { end: ctx.today }, DEFAULT_CONFIG.ewmaHalfLifeDays);
  const trendKg = trendAt(trend, ctx.today) ?? challenge.startWeightKg;
  const span = challenge.startWeightKg - challenge.goalWeightKg;
  const pct = span !== 0 ? clamp01((challenge.startWeightKg - trendKg) / span) : null;
  const daysElapsed = diffDays(ctx.today, challenge.startDate);

  const lastResult = ctx.lastEngineResult(challenge);
  let status: ProgressStatus;
  let projectedFinishDate: IsoDate | null = null;
  if (lastResult !== null) {
    projectedFinishDate = lastResult.projectedFinishDate;
    status =
      lastResult.boundHit === 'insufficientData'
        ? 'no_data'
        : lastResult.boundHit === 'none'
          ? 'on_track'
          : 'behind';
  } else {
    // Non-primary challenges have no live EngineResult of their own
    // (src/dashboard/challenge.ts) — read pace directly instead.
    status = 'on_track';
  }
  if (pct !== null && pct >= 1) status = 'completed';

  return {
    pct,
    status,
    numerator: trendKg,
    denominator: challenge.goalWeightKg,
    asOf: ctx.today,
    detail: { trendKg, daysElapsed, projectedFinishDate },
  };
}

/** Goals BRD §E.2 — thin wrapper; financeGoalProgress() is unchanged, imported not reimplemented. */
async function resolveFundGoal(goal: Goal, ctx: ResolverContext): Promise<GoalProgress> {
  if (goal.sourceBinding.type !== 'fund') return noData(ctx.today, { sourceMissing: true });
  const financeGoal = await ctx.financeGoalStore.getByExternalId(goal.sourceBinding.financeGoalExternalId);
  if (financeGoal === null) return noData(ctx.today, { sourceMissing: true, confirmedMissing: true });

  // Goals BRD §I AT1 — a valuation-mode account with no entry yet reads
  // null (src/finance/netWorth.ts's accountBalanceAsOf), which is "no
  // linked-account activity", not a determinable zero (a ledger account's
  // balance is never null — it always resolves to at least its opening
  // balance) — distinct from AT2's "account doesn't exist at all".
  const balance = ctx.accountBalanceAsOf(financeGoal.linkedAccountExternalId, ctx.today);
  if (balance === null) return noData(ctx.today);

  const { pct, savedMinor, remainingMinor } = financeGoalProgress(financeGoal, balance);

  let status: ProgressStatus = 'on_track';
  if (goal.targetDate !== null) {
    const expected = expectedPctByNow(goal.createdAt.slice(0, 10), goal.targetDate, ctx.today);
    status = pct < expected - EPSILON ? 'behind' : pct > expected + EPSILON ? 'ahead' : 'on_track';
  }
  if (pct >= 1) status = 'completed';

  return {
    pct,
    status,
    numerator: savedMinor,
    denominator: financeGoal.targetAmountMinor,
    asOf: ctx.today,
    detail: { remainingMinor },
  };
}

/** Goals BRD §E.3 — rolling window (windowStart..today) has already fully elapsed, so "expected" is always 1: this window's target should already be met to read on_track. */
async function resolveHabitGoal(goal: Goal, ctx: ResolverContext): Promise<GoalProgress> {
  if (goal.sourceBinding.type !== 'habit') return noData(ctx.today, { sourceMissing: true });
  const habit = await ctx.habitStore.getByExternalId(goal.sourceBinding.habitExternalId);
  if (habit === null) return noData(ctx.today, { sourceMissing: true, confirmedMissing: true });

  const windowStart = addDays(ctx.today, -habit.windowDays);
  const count = await ctx.habitLogStore.countInRange(habit.externalId, windowStart, ctx.today);
  // Goals BRD §I AT1 — zero logs in the window reads as no_data (neutral
  // empty state), not "behind" (which would read as a day-one failure).
  if (count === 0) return noData(ctx.today);
  const pct = clamp01(count / habit.targetCount);

  let status: ProgressStatus = pct < 1 - EPSILON ? 'behind' : 'on_track';
  if (pct >= 1) status = 'completed';

  return {
    pct,
    status,
    numerator: count,
    denominator: habit.targetCount,
    asOf: ctx.today,
    detail: { windowDays: habit.windowDays },
  };
}

/** Goals BRD §E.4 — flat checklist, no sub-tasks. */
async function resolveMilestoneGoal(goal: Goal, ctx: ResolverContext): Promise<GoalProgress> {
  const items = await ctx.milestoneItemStore.listByGoal(goal.externalId);
  if (items.length === 0) return noData(ctx.today);

  const done = items.filter((i) => i.checkedAt !== null).length;
  const pct = done / items.length;
  let status: ProgressStatus = pct >= 1 ? 'completed' : 'on_track';
  if (goal.targetDate !== null && status !== 'completed') {
    const expected = expectedPctByNow(goal.createdAt.slice(0, 10), goal.targetDate, ctx.today);
    if (pct < expected - EPSILON) status = 'behind';
  }

  return { pct, status, numerator: done, denominator: items.length, asOf: ctx.today, detail: {} };
}

/** Goals BRD §C.2 — the entire resolver seam. Never throws (AT2) — an unexpected failure reads as a missing source. */
export async function resolveGoalProgress(goal: Goal, ctx: ResolverContext): Promise<GoalProgress> {
  try {
    switch (goal.sourceBinding.type) {
      case 'metric':
        return await resolveMetricGoal(goal, ctx);
      case 'fund':
        return await resolveFundGoal(goal, ctx);
      case 'habit':
        return await resolveHabitGoal(goal, ctx);
      case 'milestone':
        return await resolveMilestoneGoal(goal, ctx);
    }
  } catch {
    return noData(ctx.today, { sourceMissing: true });
  }
}
