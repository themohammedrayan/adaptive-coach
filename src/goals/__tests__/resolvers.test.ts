import { MemoryStore } from '../../challenges';
import type { Challenge } from '../../challenges';
import type { FinanceGoal } from '../../finance/types';
import { applyBlocking, expectedPctByNow, resolveGoalProgress } from '../resolvers';
import type { Goal, GoalProgress, ResolverContext } from '../types';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    externalId: 'goal-1',
    type: 'metric',
    title: 'Test goal',
    status: 'active',
    priority: 0,
    blockedByGoalId: null,
    sourceBinding: { type: 'metric', challengeId: 'c1' },
    targetDate: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'c1',
    domain: 'weight',
    status: 'active',
    isPrimary: true,
    startDate: '2026-06-01',
    goalWeightKg: 70,
    horizonDays: 180,
    startWeightKg: 80,
    mode: 'lose',
    prevTargetKcal: null,
    lastRecomputeDate: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeFinanceGoal(overrides: Partial<FinanceGoal> = {}): FinanceGoal {
  return {
    id: 'fg1',
    externalId: 'fg1',
    name: 'House fund',
    targetAmountMinor: 1_000_000,
    currency: 'INR',
    linkedAccountExternalId: 'acc-house',
    targetDate: null,
    status: 'active',
    archivedAt: null,
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  return {
    today: '2026-07-19',
    challengeStore: new MemoryStore(),
    measurements: [],
    lastEngineResult: () => null,
    financeGoalStore: { getByExternalId: async () => null },
    accountBalanceAsOf: () => null,
    habitStore: { getByExternalId: async () => null },
    habitLogStore: { countInRange: async () => 0 },
    milestoneItemStore: { listByGoal: async () => [] },
    ...overrides,
  };
}

describe('resolveGoalProgress — metric', () => {
  it('returns no_data with sourceMissing when the challenge is missing', async () => {
    const goal = makeGoal();
    const progress = await resolveGoalProgress(goal, makeContext());
    expect(progress).toEqual({
      pct: null,
      status: 'no_data',
      numerator: null,
      denominator: null,
      asOf: '2026-07-19',
      detail: { sourceMissing: true },
    });
  });

  it('returns no_data with sourceMissing when the challenge is deleted', async () => {
    const store = new MemoryStore();
    await store.upsert(makeChallenge({ status: 'deleted' }));
    const goal = makeGoal();
    const progress = await resolveGoalProgress(goal, makeContext({ challengeStore: store }));
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
  });

  it('reads on_track/behind/no_data from the primary challenge\'s boundHit', async () => {
    const store = new MemoryStore();
    await store.upsert(makeChallenge());
    const goal = makeGoal();
    const measurements = [{ date: '2026-06-01', weightKg: 75, source: 'manual' as const }];

    const onTrack = await resolveGoalProgress(
      goal,
      makeContext({
        challengeStore: store,
        measurements,
        lastEngineResult: () => ({ boundHit: 'none', projectedFinishDate: '2026-12-01' }),
      }),
    );
    expect(onTrack.status).toBe('on_track');
    expect(onTrack.detail.projectedFinishDate).toBe('2026-12-01');

    const behind = await resolveGoalProgress(
      goal,
      makeContext({
        challengeStore: store,
        measurements,
        lastEngineResult: () => ({ boundHit: 'moveLimit', projectedFinishDate: null }),
      }),
    );
    expect(behind.status).toBe('behind');

    const noData = await resolveGoalProgress(
      goal,
      makeContext({
        challengeStore: store,
        measurements,
        lastEngineResult: () => ({ boundHit: 'insufficientData', projectedFinishDate: null }),
      }),
    );
    expect(noData.status).toBe('no_data');
  });

  it('falls back to on_track (no boundHit) for a non-primary challenge with no live EngineResult', async () => {
    const store = new MemoryStore();
    await store.upsert(makeChallenge({ isPrimary: false }));
    const goal = makeGoal();
    const progress = await resolveGoalProgress(
      goal,
      makeContext({
        challengeStore: store,
        measurements: [{ date: '2026-06-01', weightKg: 75, source: 'manual' }],
        lastEngineResult: () => null,
      }),
    );
    expect(progress.status).toBe('on_track');
    expect(progress.pct).toBeCloseTo(0.5, 5);
  });

  it('marks completed once trend reaches the goal weight, regardless of boundHit', async () => {
    const store = new MemoryStore();
    await store.upsert(makeChallenge());
    const goal = makeGoal();
    const progress = await resolveGoalProgress(
      goal,
      makeContext({
        challengeStore: store,
        measurements: [{ date: '2026-06-01', weightKg: 70, source: 'manual' }],
        lastEngineResult: () => ({ boundHit: 'none', projectedFinishDate: null }),
      }),
    );
    expect(progress.pct).toBe(1);
    expect(progress.status).toBe('completed');
  });
});

describe('resolveGoalProgress — fund', () => {
  const fundGoal = makeGoal({ type: 'fund', sourceBinding: { type: 'fund', financeGoalExternalId: 'fg1' } });

  it('returns no_data with sourceMissing when the finance goal is missing', async () => {
    const progress = await resolveGoalProgress(fundGoal, makeContext());
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
  });

  it('computes on_track with no target date and completed once fully funded', async () => {
    const ctx = makeContext({
      financeGoalStore: { getByExternalId: async () => makeFinanceGoal() },
      accountBalanceAsOf: () => 250_000,
    });
    const partial = await resolveGoalProgress(fundGoal, ctx);
    expect(partial.pct).toBe(0.25);
    expect(partial.status).toBe('on_track');
    expect(partial.numerator).toBe(250_000);
    expect(partial.denominator).toBe(1_000_000);

    const full = await resolveGoalProgress(
      fundGoal,
      makeContext({
        financeGoalStore: { getByExternalId: async () => makeFinanceGoal() },
        accountBalanceAsOf: () => 1_000_000,
      }),
    );
    expect(full.status).toBe('completed');
  });

  it('reads behind/ahead against a linear pace when a target date is set', async () => {
    const goalWithDeadline = makeGoal({
      type: 'fund',
      sourceBinding: { type: 'fund', financeGoalExternalId: 'fg1' },
      createdAt: '2026-01-01T00:00:00.000Z',
      targetDate: '2027-01-01',
    });
    // Halfway through the year, funded far below the halfway pace.
    const behind = await resolveGoalProgress(
      goalWithDeadline,
      makeContext({
        today: '2026-07-01',
        financeGoalStore: { getByExternalId: async () => makeFinanceGoal() },
        accountBalanceAsOf: () => 100_000,
      }),
    );
    expect(behind.status).toBe('behind');

    const ahead = await resolveGoalProgress(
      goalWithDeadline,
      makeContext({
        today: '2026-07-01',
        financeGoalStore: { getByExternalId: async () => makeFinanceGoal() },
        accountBalanceAsOf: () => 900_000,
      }),
    );
    expect(ahead.status).toBe('ahead');
  });
});

describe('resolveGoalProgress — habit', () => {
  const habitGoal = makeGoal({ type: 'habit', sourceBinding: { type: 'habit', habitExternalId: 'h1' } });
  const habit = { id: 'h1', externalId: 'h1', name: 'Read', cadenceKind: 'count_per_window' as const, targetCount: 5, windowDays: 7, archivedAt: null, updatedAt: '' };

  it('returns no_data with sourceMissing when the habit is missing', async () => {
    const progress = await resolveGoalProgress(habitGoal, makeContext());
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
  });

  it('reads behind when the rolling-window count is short of target, completed once met', async () => {
    const behind = await resolveGoalProgress(
      habitGoal,
      makeContext({
        habitStore: { getByExternalId: async () => habit },
        habitLogStore: { countInRange: async () => 2 },
      }),
    );
    expect(behind.pct).toBe(0.4);
    expect(behind.status).toBe('behind');
    expect(behind.detail.windowDays).toBe(7);

    const completed = await resolveGoalProgress(
      habitGoal,
      makeContext({
        habitStore: { getByExternalId: async () => habit },
        habitLogStore: { countInRange: async () => 5 },
      }),
    );
    expect(completed.status).toBe('completed');
  });
});

describe('resolveGoalProgress — milestone', () => {
  const milestoneGoal = makeGoal({ type: 'milestone', sourceBinding: { type: 'milestone' } });
  const item = (id: string, checked: boolean) => ({
    id,
    externalId: id,
    goalExternalId: milestoneGoal.externalId,
    title: id,
    sortOrder: 0,
    checkedAt: checked ? '2026-07-01T00:00:00.000Z' : null,
    updatedAt: '',
  });

  it('returns no_data when there are no items', async () => {
    const progress = await resolveGoalProgress(milestoneGoal, makeContext());
    expect(progress.status).toBe('no_data');
  });

  it('reads pct from checked-vs-total items, completed at 100%', async () => {
    const partial = await resolveGoalProgress(
      milestoneGoal,
      makeContext({ milestoneItemStore: { listByGoal: async () => [item('a', true), item('b', false)] } }),
    );
    expect(partial.pct).toBe(0.5);
    expect(partial.status).toBe('on_track');

    const complete = await resolveGoalProgress(
      milestoneGoal,
      makeContext({ milestoneItemStore: { listByGoal: async () => [item('a', true), item('b', true)] } }),
    );
    expect(complete.status).toBe('completed');
  });

  it('reads behind when a target date has passed with items still unchecked', async () => {
    const overdueGoal = makeGoal({
      type: 'milestone',
      sourceBinding: { type: 'milestone' },
      createdAt: '2026-01-01T00:00:00.000Z',
      targetDate: '2026-02-01',
    });
    const progress = await resolveGoalProgress(
      overdueGoal,
      makeContext({
        today: '2026-07-19',
        milestoneItemStore: { listByGoal: async () => [item('a', false), item('b', false)] },
      }),
    );
    expect(progress.status).toBe('behind');
  });
});

describe('applyBlocking', () => {
  function progress(status: GoalProgress['status']): GoalProgress {
    return { pct: 0, status, numerator: null, denominator: null, asOf: '2026-07-19', detail: {} };
  }

  it('leaves an unblocked goal untouched', () => {
    const goals = [makeGoal({ id: 'a', blockedByGoalId: null })];
    const map = new Map([['a', progress('on_track')]]);
    expect(applyBlocking(goals, map).get('a')?.status).toBe('on_track');
  });

  it('blocks a goal whose predecessor is not completed', () => {
    const goals = [makeGoal({ id: 'a' }), makeGoal({ id: 'b', blockedByGoalId: 'a' })];
    const map = new Map([
      ['a', progress('behind')],
      ['b', progress('on_track')],
    ]);
    expect(applyBlocking(goals, map).get('b')?.status).toBe('blocked');
  });

  it('leaves a goal unblocked once its predecessor is completed', () => {
    const goals = [makeGoal({ id: 'a' }), makeGoal({ id: 'b', blockedByGoalId: 'a' })];
    const map = new Map([
      ['a', progress('completed')],
      ['b', progress('on_track')],
    ]);
    expect(applyBlocking(goals, map).get('b')?.status).toBe('on_track');
  });

  it('fails closed (blocks) when the predecessor is missing from the resolved list', () => {
    const goals = [makeGoal({ id: 'b', blockedByGoalId: 'missing' })];
    const map = new Map([['b', progress('on_track')]]);
    expect(applyBlocking(goals, map).get('b')?.status).toBe('blocked');
  });
});

describe('expectedPctByNow', () => {
  it('is 0 at the start and 1 at the end', () => {
    expect(expectedPctByNow('2026-01-01', '2027-01-01', '2026-01-01')).toBe(0);
    expect(expectedPctByNow('2026-01-01', '2027-01-01', '2027-01-01')).toBe(1);
  });

  it('is the elapsed fraction between start and end', () => {
    expect(expectedPctByNow('2026-01-01', '2026-01-11', '2026-01-06')).toBeCloseTo(0.5, 5);
  });

  it('clamps outside the [start, end] range', () => {
    expect(expectedPctByNow('2026-01-01', '2026-01-11', '2025-12-01')).toBe(0);
    expect(expectedPctByNow('2026-01-01', '2026-01-11', '2027-01-01')).toBe(1);
  });

  it('returns 1 when the range is zero or negative', () => {
    expect(expectedPctByNow('2026-01-01', '2026-01-01', '2026-01-01')).toBe(1);
    expect(expectedPctByNow('2026-01-11', '2026-01-01', '2026-01-05')).toBe(1);
  });
});
