import type { EngineResult, IsoDate, TrendPoint } from '../engine';
import type { AdherenceInput, CoachPayload, GoalSummary } from './types';

/**
 * Coaching BRD §4/§10 — pure aggregation only, never invents a number.
 * Signature extends the BRD's suggested 3-arg form with `weekOf`, since
 * EngineResult carries no date of its own.
 */
export function assembleCoachPayload(
  result: EngineResult,
  adherence: AdherenceInput,
  goal: GoalSummary,
  weekOf: IsoDate,
  trend: TrendPoint[],
): CoachPayload {
  const changed = result.reasons.find(
    (r): r is Extract<EngineResult['reasons'][number], { code: 'TARGET_CHANGED' }> =>
      r.code === 'TARGET_CHANGED',
  );
  const prevTargetKcal = changed?.from ?? result.targetKcal;
  const deltaKcal = changed?.deltaKcal ?? 0;
  const loggedDays = adherence.days.filter((d) => d.logged).length;

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
  };
}
