import type { CoachGoalSummary, CoachGoalsAggregate, GoalSignal } from '../coaching';
import { diffDays } from '../engine';
import type { IsoDate } from '../engine';
import type { Goal, GoalProgress } from './types';

const MAX_GOALS = 10;
const DEADLINE_NEAR_DAYS = 7;

export interface CoachGoalContext {
  goals: CoachGoalSummary[];
  goalsAggregate: CoachGoalsAggregate;
  goalSignals: GoalSignal[];
}

/**
 * Goals BRD §H.2/§H.3 — maps a resolved goal list + its progress into the
 * narration-ready shapes a CoachPayload/UnifiedCoachPayload carries. Pure:
 * takes already-resolved GoalProgress in, never calls a resolver itself.
 */
export function buildCoachGoalContext(
  activeGoals: Goal[],
  progressByGoalId: Map<string, GoalProgress>,
  today: IsoDate,
): CoachGoalContext {
  const capped = activeGoals
    .slice()
    .sort((a, b) => a.priority - b.priority || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_GOALS);

  const goals: CoachGoalSummary[] = capped.map((g) => {
    const progress = progressByGoalId.get(g.id);
    return {
      externalId: g.externalId,
      type: g.type,
      title: g.title,
      pct: progress?.pct ?? null,
      status: progress?.status ?? 'no_data',
      daysUntilTargetDate: g.targetDate !== null ? diffDays(g.targetDate, today) : null,
      blocked: progress?.status === 'blocked',
    };
  });

  const goalsAggregate: CoachGoalsAggregate = {
    activeCount: activeGoals.length,
    blockedCount: [...progressByGoalId.values()].filter((p) => p.status === 'blocked').length,
    // Goals BRD §H.2 note (assembleCoachPayload.ts) applies here too — no
    // per-goal completion timestamp exists, so this approximates to
    // "currently completed" rather than a true weekly-transition count.
    completedThisWeekCount: [...progressByGoalId.values()].filter((p) => p.status === 'completed').length,
  };

  const titleById = new Map(activeGoals.map((g) => [g.id, g.title]));
  const goalSignals: GoalSignal[] = [];
  for (const g of activeGoals) {
    const progress = progressByGoalId.get(g.id);
    if (progress?.status === 'completed') {
      goalSignals.push({ code: 'GOAL_COMPLETED', goalExternalId: g.externalId, title: g.title });
      continue;
    }
    if (progress?.status === 'blocked' && g.blockedByGoalId !== null) {
      goalSignals.push({
        code: 'GOAL_BLOCKED',
        goalExternalId: g.externalId,
        title: g.title,
        blockedByTitle: titleById.get(g.blockedByGoalId) ?? 'another goal',
      });
    }
    if (g.targetDate !== null) {
      const daysLeft = diffDays(g.targetDate, today);
      if (daysLeft >= 0 && daysLeft <= DEADLINE_NEAR_DAYS) {
        goalSignals.push({ code: 'GOAL_DEADLINE_NEAR', goalExternalId: g.externalId, title: g.title, daysLeft });
      }
    }
  }

  return { goals, goalsAggregate, goalSignals };
}
