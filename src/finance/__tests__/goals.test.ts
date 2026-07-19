import { financeGoalProgress } from '../goals';
import type { FinanceGoal } from '../types';

function goal(overrides: Partial<FinanceGoal>): FinanceGoal {
  return {
    id: 'g1',
    externalId: 'g1',
    name: 'House fund',
    targetAmountMinor: 1_000_000,
    currency: 'INR',
    linkedAccountExternalId: 'acc-house',
    targetDate: null,
    status: 'active',
    archivedAt: null,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('financeGoalProgress', () => {
  it('computes saved/pct/remaining from the linked account balance', () => {
    const progress = financeGoalProgress(goal({}), 250_000);
    expect(progress).toEqual({ savedMinor: 250_000, pct: 0.25, remainingMinor: 750_000 });
  });

  it('clamps a negative account balance to zero saved', () => {
    const progress = financeGoalProgress(goal({}), -500);
    expect(progress.savedMinor).toBe(0);
    expect(progress.pct).toBe(0);
  });

  it('clamps remaining to zero once the goal is met or exceeded', () => {
    const progress = financeGoalProgress(goal({ targetAmountMinor: 100_000 }), 150_000);
    expect(progress.pct).toBe(1.5);
    expect(progress.remainingMinor).toBe(0);
  });

  it('treats a zero target as fully funded with no divide-by-zero', () => {
    const progress = financeGoalProgress(goal({ targetAmountMinor: 0 }), 10_000);
    expect(progress.pct).toBe(0);
    expect(progress.remainingMinor).toBe(0);
  });
});
