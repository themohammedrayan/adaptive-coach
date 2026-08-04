import { MemoryStore } from '../../challenges';
import type { Challenge } from '../../challenges';
import type { FinanceGoal } from '../../finance/types';
import { applyBlocking, resolveGoalProgress } from '../resolvers';
import type { Goal, GoalProgress, Habit, ResolverContext } from '../types';

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
    contributionAmountMinor: null,
    contributionCadence: null,
    contributionFlexible: true,
    status: 'active',
    archivedAt: null,
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const HABIT: Habit = {
  id: 'h1',
  externalId: 'h1',
  name: 'Read',
  cadenceKind: 'count_per_window',
  targetCount: 5,
  windowDays: 7,
  archivedAt: null,
  updatedAt: '',
};

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

describe('Goals BRD §I AT1 — no data yet', () => {
  it('habit: zero logs in the window reads no_data, not behind', async () => {
    const goal = makeGoal({ type: 'habit', sourceBinding: { type: 'habit', habitExternalId: 'h1' } });
    const progress = await resolveGoalProgress(
      goal,
      makeContext({ habitStore: { getByExternalId: async () => HABIT }, habitLogStore: { countInRange: async () => 0 } }),
    );
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBeUndefined();
  });

  it('milestone: zero items reads no_data', async () => {
    const goal = makeGoal({ type: 'milestone', sourceBinding: { type: 'milestone' } });
    const progress = await resolveGoalProgress(goal, makeContext({ milestoneItemStore: { listByGoal: async () => [] } }));
    expect(progress.status).toBe('no_data');
  });

  it('fund: no linked-account activity (null balance) reads no_data, distinct from a determinable zero', async () => {
    const goal = makeGoal({ type: 'fund', sourceBinding: { type: 'fund', financeGoalExternalId: 'fg1' } });
    const noActivity = await resolveGoalProgress(
      goal,
      makeContext({ financeGoalStore: { getByExternalId: async () => makeFinanceGoal() }, accountBalanceAsOf: () => null }),
    );
    expect(noActivity.status).toBe('no_data');
    expect(noActivity.detail.sourceMissing).toBeUndefined();

    const determinableZero = await resolveGoalProgress(
      goal,
      makeContext({ financeGoalStore: { getByExternalId: async () => makeFinanceGoal() }, accountBalanceAsOf: () => 0 }),
    );
    expect(determinableZero.status).not.toBe('no_data');
    expect(determinableZero.pct).toBe(0);
  });

  it('metric: below Engine\'s min-data thresholds reads no_data, not sourceMissing', async () => {
    const store = new MemoryStore();
    await store.upsert(makeChallenge());
    const goal = makeGoal();
    const progress = await resolveGoalProgress(
      goal,
      makeContext({
        challengeStore: store,
        lastEngineResult: () => ({ boundHit: 'insufficientData', projectedFinishDate: null }),
      }),
    );
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBeUndefined();
  });
});

describe('Goals BRD §I AT2 — deleted or missing source module', () => {
  it('metric: deleted challenge reads no_data with sourceMissing, never throws', async () => {
    const store = new MemoryStore();
    await store.upsert(makeChallenge({ status: 'deleted' }));
    const progress = await resolveGoalProgress(makeGoal(), makeContext({ challengeStore: store }));
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
    // confirmedMissing is what loadResolvedGoals.ts acts on to auto-archive
    // an orphaned goal — distinct from the catch-all below, which must NOT
    // set it (an unexpected error isn't proof the source is actually gone).
    expect(progress.detail.confirmedMissing).toBe(true);
  });

  it('fund: finance goal not found reads no_data with sourceMissing', async () => {
    const goal = makeGoal({ type: 'fund', sourceBinding: { type: 'fund', financeGoalExternalId: 'missing' } });
    const progress = await resolveGoalProgress(goal, makeContext());
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
    expect(progress.detail.confirmedMissing).toBe(true);
  });

  it('habit: soft-deleted/missing habit reads no_data with sourceMissing', async () => {
    const goal = makeGoal({ type: 'habit', sourceBinding: { type: 'habit', habitExternalId: 'missing' } });
    const progress = await resolveGoalProgress(goal, makeContext());
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
    expect(progress.detail.confirmedMissing).toBe(true);
  });

  it('never throws on an unexpected resolver failure — converts to no_data, but is not confirmedMissing', async () => {
    const goal = makeGoal({ type: 'fund', sourceBinding: { type: 'fund', financeGoalExternalId: 'fg1' } });
    const progress = await resolveGoalProgress(
      goal,
      makeContext({
        financeGoalStore: {
          getByExternalId: async () => {
            throw new Error('boom');
          },
        },
      }),
    );
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
    // An ambiguous failure (network blip, bug elsewhere) is not proof the
    // source is actually gone — must not trigger auto-archiving.
    expect(progress.detail.confirmedMissing).toBeUndefined();
  });
});

describe('Goals BRD §I AT4 — blocked goal', () => {
  it('applyBlocking forces status to blocked regardless of the resolver\'s own status', () => {
    const goals = [makeGoal({ id: 'a', status: 'active' }), makeGoal({ id: 'b', blockedByGoalId: 'a' })];
    const progressByGoalId = new Map<string, GoalProgress>([
      ['a', { pct: 0.5, status: 'behind', numerator: null, denominator: null, asOf: '2026-07-19', detail: {} }],
      ['b', { pct: 0.9, status: 'on_track', numerator: null, denominator: null, asOf: '2026-07-19', detail: {} }],
    ]);
    const result = applyBlocking(goals, progressByGoalId);
    // Even though b's own resolver read it as nearly complete, blocking wins.
    expect(result.get('b')?.status).toBe('blocked');
  });
});

describe('Goals BRD §I AT6 — cross-device metric with no local Challenge', () => {
  it('resolves through the same sourceMissing path as AT2 (missing Challenge), not a second one', async () => {
    // A goals row synced from another device, pointing at a challengeId that
    // was never created locally — structurally identical to AT2's "deleted"
    // case from the resolver's point of view: challengeStore.get() -> null.
    const goal = makeGoal({ sourceBinding: { type: 'metric', challengeId: 'never-synced-locally' } });
    const progress = await resolveGoalProgress(goal, makeContext({ challengeStore: new MemoryStore() }));
    expect(progress.status).toBe('no_data');
    expect(progress.detail.sourceMissing).toBe(true);
    expect(progress.detail.confirmedMissing).toBe(true);
  });
});
