import type { CoachGoalSummary, CoachGoalsAggregate, CoachPayload, GoalSignal } from '../coaching';
import type { IsoDate } from '../engine';
import type { FinanceCoachPayload } from '../finance';
import type { UnifiedCoachPayload } from './types';

/**
 * Coach-unification — the one place a UnifiedCoachPayload is assembled.
 * Purely combines already-built pieces (health's CoachPayload via the
 * existing assembleCoachPayload, finance's FinanceCoachPayload via the
 * existing assembleFinanceCoachPayload, goal data via the Goals resolvers)
 * — never invents a number, same as its two predecessors.
 */
export function assembleUnifiedCoachPayload(
  today: IsoDate,
  health: CoachPayload | null,
  finance: FinanceCoachPayload,
  goals: CoachGoalSummary[],
  goalsAggregate: CoachGoalsAggregate,
  goalSignals: GoalSignal[],
): UnifiedCoachPayload {
  return { today, health, finance, goals, goalsAggregate, goalSignals };
}
