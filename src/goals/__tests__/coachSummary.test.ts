import { buildCoachGoalContext } from '../coachSummary';
import type { Goal, GoalProgress } from '../types';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    externalId: 'goal-1',
    type: 'habit',
    title: 'Read',
    status: 'active',
    priority: 0,
    blockedByGoalId: null,
    sourceBinding: { type: 'habit', habitExternalId: 'h1' },
    targetDate: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function progress(status: GoalProgress['status'], pct: number | null = 0.5): GoalProgress {
  return { pct, status, numerator: null, denominator: null, asOf: '2026-07-19', detail: {} };
}

describe('buildCoachGoalContext', () => {
  it('maps each goal into a CoachGoalSummary with its resolved status/pct', () => {
    const goals = [makeGoal({ id: 'a', externalId: 'a', title: 'Read' })];
    const ctx = buildCoachGoalContext(goals, new Map([['a', progress('on_track', 0.4)]]), '2026-07-19');
    expect(ctx.goals).toEqual([
      { externalId: 'a', type: 'habit', title: 'Read', pct: 0.4, status: 'on_track', daysUntilTargetDate: null, blocked: false },
    ]);
  });

  it('caps at 10, sorted by priority ascending then updatedAt descending', () => {
    const goals = Array.from({ length: 12 }, (_, i) =>
      makeGoal({ id: `g${i}`, externalId: `g${i}`, priority: i, updatedAt: '2026-07-01T00:00:00.000Z' }),
    );
    const progressMap = new Map(goals.map((g) => [g.id, progress('on_track')]));
    const ctx = buildCoachGoalContext(goals, progressMap, '2026-07-19');
    expect(ctx.goals).toHaveLength(10);
    expect(ctx.goals[0].externalId).toBe('g0');
    expect(ctx.goals[9].externalId).toBe('g9');
  });

  it('derives goalsAggregate from the full active list, not just the capped top 10', () => {
    const goals = [
      makeGoal({ id: 'a', externalId: 'a' }),
      makeGoal({ id: 'b', externalId: 'b' }),
      makeGoal({ id: 'c', externalId: 'c' }),
    ];
    const progressMap = new Map([
      ['a', progress('on_track')],
      ['b', progress('blocked')],
      ['c', progress('completed')],
    ]);
    const ctx = buildCoachGoalContext(goals, progressMap, '2026-07-19');
    expect(ctx.goalsAggregate).toEqual({ activeCount: 3, blockedCount: 1, completedThisWeekCount: 1 });
  });

  it('emits a GOAL_COMPLETED signal for a completed goal', () => {
    const goals = [makeGoal({ id: 'a', externalId: 'a', title: 'Ship v1' })];
    const ctx = buildCoachGoalContext(goals, new Map([['a', progress('completed', 1)]]), '2026-07-19');
    expect(ctx.goalSignals).toEqual([{ code: 'GOAL_COMPLETED', goalExternalId: 'a', title: 'Ship v1' }]);
  });

  it('emits a GOAL_BLOCKED signal naming the predecessor title', () => {
    const goals = [
      makeGoal({ id: 'a', externalId: 'a', title: 'Clear debt' }),
      makeGoal({ id: 'b', externalId: 'b', title: 'Buy the bike', blockedByGoalId: 'a' }),
    ];
    const progressMap = new Map([
      ['a', progress('behind')],
      ['b', progress('blocked')],
    ]);
    const ctx = buildCoachGoalContext(goals, progressMap, '2026-07-19');
    expect(ctx.goalSignals).toContainEqual({
      code: 'GOAL_BLOCKED',
      goalExternalId: 'b',
      title: 'Buy the bike',
      blockedByTitle: 'Clear debt',
    });
  });

  it('emits a GOAL_DEADLINE_NEAR signal within the 7-day window, not before or after', () => {
    const near = makeGoal({ id: 'near', externalId: 'near', title: 'Near', targetDate: '2026-07-24' }); // 5 days out
    const far = makeGoal({ id: 'far', externalId: 'far', title: 'Far', targetDate: '2026-08-19' }); // 31 days out
    const overdue = makeGoal({ id: 'overdue', externalId: 'overdue', title: 'Overdue', targetDate: '2026-07-01' }); // past
    const progressMap = new Map([
      ['near', progress('on_track')],
      ['far', progress('on_track')],
      ['overdue', progress('behind')],
    ]);
    const ctx = buildCoachGoalContext([near, far, overdue], progressMap, '2026-07-19');
    expect(ctx.goalSignals).toEqual([{ code: 'GOAL_DEADLINE_NEAR', goalExternalId: 'near', title: 'Near', daysLeft: 5 }]);
  });
});
