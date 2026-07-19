import { fallbackAnswer } from '../../../supabase/functions/_shared/chatLogic';
import type { CoachPayload, UnifiedCoachPayload } from '../../../supabase/functions/_shared/types';
import type { FinanceCoachPayload } from '../../../supabase/functions/_shared/financeTypes';

const HEALTH: CoachPayload = {
  weekOf: '2026-07-15',
  goal: { startWeightKg: 100, goalWeightKg: 80, horizonDays: 180, daysElapsed: 21 },
  current: {
    targetKcal: 1975,
    prevTargetKcal: 2100,
    deltaKcal: -125,
    macros: { proteinG: 180, fatG: 60, carbG: 170, fiberG: 28 },
    tdeeEst: 2450,
    effectiveDeficit: 475,
    weeklyRateKg: -0.35,
    projectedFinishDate: '2026-12-30',
    boundHit: 'moveLimit',
  },
  trend: [],
  adherence: { loggedDays: 11, windowDays: 14, avgIntake: 2010, avgTarget: 2050 },
  reasons: [],
  goals: [],
  goalsAggregate: { activeCount: 0, blockedCount: 0, completedThisWeekCount: 0 },
  goalSignals: [],
};

const FINANCE: FinanceCoachPayload = {
  today: '2026-07-15',
  currency: 'INR',
  netWorthMinor: 490_000,
  month: { incomeMinor: 0, expenseMinor: 10_000 },
  topExpenseCategories: [],
  accounts: [],
  goals: [],
  budgets: [],
  healthRead: { status: 'good', reasons: [] },
  projection: [],
};

function payload(overrides: Partial<UnifiedCoachPayload> = {}): UnifiedCoachPayload {
  return {
    today: '2026-07-15',
    health: HEALTH,
    finance: FINANCE,
    goals: [],
    goalsAggregate: { activeCount: 0, blockedCount: 0, completedThisWeekCount: 0 },
    goalSignals: [],
    ...overrides,
  };
}

describe('fallbackAnswer — coach-unification (deterministic, no LLM)', () => {
  it('never attempts the question itself, only recites payload-grounded state', () => {
    const answer = fallbackAnswer(payload());
    expect(answer.answer).toMatch(/can't answer that specific question/i);
    expect(answer.answer).toContain('1975');
    expect(answer.answer).toContain('11 of 14');
    expect(answer.answer).toContain('4900.00'); // netWorthMinor / 100
    expect(answer.answer).toContain('good');
  });

  it('is a plain deterministic function of the payload (no randomness)', () => {
    const p = payload();
    expect(fallbackAnswer(p)).toEqual(fallbackAnswer(p));
  });

  it('omits the health sentence when health is null (no weight goal with data yet)', () => {
    const answer = fallbackAnswer(payload({ health: null }));
    expect(answer.answer).not.toContain('1975');
    expect(answer.answer).toContain('good'); // finance is always present
  });

  it('mentions active/blocked goals when the aggregate is non-zero', () => {
    const answer = fallbackAnswer(payload({ goalsAggregate: { activeCount: 3, blockedCount: 1, completedThisWeekCount: 0 } }));
    expect(answer.answer).toContain('3 goals active');
    expect(answer.answer).toContain('1 blocked');
  });
});
