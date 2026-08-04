import { contributionOutlook, financeGoalProgress } from '../goals';
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
    contributionAmountMinor: null,
    contributionCadence: null,
    contributionFlexible: true,
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

describe('contributionOutlook', () => {
  it('is null when no plan is set, rather than inventing a schedule', () => {
    expect(contributionOutlook(goal({}), 0, '2026-08-15')).toBeNull();
  });

  it('is null when only one half of the plan is present', () => {
    expect(contributionOutlook(goal({ contributionAmountMinor: 500000 }), 0, '2026-08-15')).toBeNull();
    expect(contributionOutlook(goal({ contributionCadence: 'monthly' }), 0, '2026-08-15')).toBeNull();
  });

  it('divides what is left by the contribution, rounding up', () => {
    // ₹60,000 target, ₹10,000 saved, ₹5,000/month → 10 payments.
    const outlook = contributionOutlook(
      goal({ targetAmountMinor: 6_000_000, contributionAmountMinor: 500_000, contributionCadence: 'monthly' }),
      1_000_000,
      '2026-08-15',
    )!;
    expect(outlook.paymentsLeft).toBe(10);
    expect(outlook.projectedCompletionDate).toBe('2027-06-15');
  });

  it('rounds a part-payment up to a whole one', () => {
    // ₹1,000 left at ₹300 a month is four payments, not three and a third.
    const outlook = contributionOutlook(
      goal({ targetAmountMinor: 100_000, contributionAmountMinor: 30_000, contributionCadence: 'monthly' }),
      0,
      '2026-08-15',
    )!;
    expect(outlook.paymentsLeft).toBe(4);
  });

  it('reports zero payments and today once the target is met', () => {
    const outlook = contributionOutlook(
      goal({ targetAmountMinor: 100_000, contributionAmountMinor: 30_000, contributionCadence: 'monthly' }),
      150_000,
      '2026-08-15',
    )!;
    expect(outlook.paymentsLeft).toBe(0);
    expect(outlook.projectedCompletionDate).toBe('2026-08-15');
  });

  it('advances weekly and daily cadences by the right stride', () => {
    const base = { targetAmountMinor: 40_000, contributionAmountMinor: 10_000 } as const;
    expect(
      contributionOutlook(goal({ ...base, contributionCadence: 'weekly' }), 0, '2026-08-15')!
        .projectedCompletionDate,
    ).toBe('2026-09-12'); // 4 weeks
    expect(
      contributionOutlook(goal({ ...base, contributionCadence: 'daily' }), 0, '2026-08-15')!
        .projectedCompletionDate,
    ).toBe('2026-08-19'); // 4 days
  });

  it('clamps the completion date into a short month', () => {
    // Starting Dec 31, two monthly payments lands on Feb 28.
    const outlook = contributionOutlook(
      goal({ targetAmountMinor: 20_000, contributionAmountMinor: 10_000, contributionCadence: 'monthly' }),
      0,
      '2026-12-31',
    )!;
    expect(outlook.projectedCompletionDate).toBe('2027-02-28');
  });

  it('says nothing about a target date when the goal has none', () => {
    const outlook = contributionOutlook(
      goal({ targetAmountMinor: 20_000, contributionAmountMinor: 10_000, contributionCadence: 'monthly' }),
      0,
      '2026-08-15',
    )!;
    expect(outlook.onTrackForTargetDate).toBeNull();
  });

  it('compares the plan against the target date in both directions', () => {
    const base = {
      targetAmountMinor: 20_000,
      contributionAmountMinor: 10_000,
      contributionCadence: 'monthly',
    } as const;
    // Two monthly payments from Aug 15 → Oct 15.
    expect(contributionOutlook(goal({ ...base, targetDate: '2026-12-01' }), 0, '2026-08-15')!.onTrackForTargetDate).toBe(true);
    expect(contributionOutlook(goal({ ...base, targetDate: '2026-09-01' }), 0, '2026-08-15')!.onTrackForTargetDate).toBe(false);
  });

  it('caps an unreachable goal rather than projecting forever', () => {
    const outlook = contributionOutlook(
      goal({ targetAmountMinor: 100_000_000_000, contributionAmountMinor: 100, contributionCadence: 'monthly' }),
      0,
      '2026-08-15',
    )!;
    expect(outlook.paymentsLeft).toBe(1200);
  });
});
