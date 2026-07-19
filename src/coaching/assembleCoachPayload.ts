import type { EngineResult, IsoDate, TrendPoint } from '../engine';
import type { AdherenceInput, CoachGoalSummary, CoachGoalsAggregate, CoachPayload, GoalSignal, GoalSummary } from './types';

/**
 * Coaching BRD §4/§10 — pure aggregation only, never invents a number.
 * Signature extends the BRD's suggested 3-arg form with `weekOf`, since
 * EngineResult carries no date of its own. `goals`/`goalSignals` (Goals BRD
 * §H.2/§H.3) are optional and default to empty — the weekly coach-note
 * trigger (src/dashboard/refreshSnapshot.ts) has no live Goals context in
 * v1 (BRD §B.5/§H.6, an accepted gap; the on-demand chat surface is the
 * escape hatch), while a caller with goal data (e.g. the unified coach-chat
 * payload assembly) supplies the real thing.
 */
export function assembleCoachPayload(
  result: EngineResult,
  adherence: AdherenceInput,
  goal: GoalSummary,
  weekOf: IsoDate,
  trend: TrendPoint[],
  goals: CoachGoalSummary[] = [],
  goalSignals: GoalSignal[] = [],
): CoachPayload {
  const changed = result.reasons.find(
    (r): r is Extract<EngineResult['reasons'][number], { code: 'TARGET_CHANGED' }> =>
      r.code === 'TARGET_CHANGED',
  );
  const prevTargetKcal = changed?.from ?? result.targetKcal;
  const deltaKcal = changed?.deltaKcal ?? 0;
  const loggedDays = adherence.days.filter((d) => d.logged).length;

  // Goals BRD §H.2 — no per-goal completion timestamp reaches this capped
  // summary, so "this week" approximates to "currently completed among the
  // goals passed in" rather than a true weekly-transition count.
  const goalsAggregate: CoachGoalsAggregate = {
    activeCount: goals.length,
    blockedCount: goals.filter((g) => g.blocked).length,
    completedThisWeekCount: goals.filter((g) => g.status === 'completed').length,
  };

  return {
    weekOf,
    goal,
    current: {
      targetKcal: result.targetKcal,
      prevTargetKcal,
      deltaKcal,
      macros: result.macros,
      tdeeEst: result.tdeeEst,
      effectiveDeficit: result.effectiveDeficit,
      weeklyRateKg: result.weeklyRateKg,
      projectedFinishDate: result.projectedFinishDate,
      boundHit: result.boundHit,
    },
    trend: trend.map((p) => ({ date: p.date, trendKg: p.trendKg })),
    adherence: {
      loggedDays,
      windowDays: adherence.days.length,
      avgIntake: adherence.avgIntake,
      avgTarget: adherence.avgTarget,
    },
    reasons: result.reasons,
    goals,
    goalsAggregate,
    goalSignals,
  };
}
