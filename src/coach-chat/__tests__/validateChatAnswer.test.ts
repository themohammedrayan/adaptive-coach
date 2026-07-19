import { validateChatAnswer } from '../../../supabase/functions/_shared/chatLogic';
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
  reasons: [{ code: 'TARGET_CHANGED', from: 2100, to: 1975, deltaKcal: -125 }],
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

describe('validateChatAnswer — coach-unification ad-hoc Q&A guard', () => {
  it('accepts an answer whose numbers all trace back to the health payload', () => {
    const answer = { answer: 'Your target moved to 1975 kcal (-125 from 2100) this week.' };
    expect(validateChatAnswer(answer, payload())).toBe(true);
  });

  it('accepts a finance figure in the payload\'s own raw minor units', () => {
    // The finance guard only allows raw minor-unit figures (pre-existing
    // behavior, unrelated to coach-unification) — a model citing net worth
    // in major units (e.g. "4900.00") would fail this guard and fall back.
    const answer = { answer: 'Your net worth is 490000 right now.' };
    expect(validateChatAnswer(answer, payload())).toBe(true);
  });

  it('accepts a numberless conversational answer (advice questions need no figures)', () => {
    const answer = { answer: 'Eating out occasionally is fine — just try to stay close to your target.' };
    expect(validateChatAnswer(answer, payload())).toBe(true);
  });

  it('rejects an answer that invents a figure not in the payload', () => {
    const answer = { answer: 'Your target is actually 1500 kcal now.' };
    expect(validateChatAnswer(answer, payload())).toBe(false);
  });

  it('rejects an empty answer', () => {
    expect(validateChatAnswer({ answer: '' }, payload())).toBe(false);
  });

  it('rejects a runaway-length answer', () => {
    expect(validateChatAnswer({ answer: 'x'.repeat(900) }, payload())).toBe(false);
  });

  it('tolerates rounded figures within the shared tolerance', () => {
    const answer = { answer: 'Your rate is holding around -0.35 kg per week.' };
    expect(validateChatAnswer(answer, payload())).toBe(true);
  });

  it('rejects a health-grounded figure when health is null', () => {
    const answer = { answer: 'Your target is 1975 kcal.' };
    expect(validateChatAnswer(answer, payload({ health: null }))).toBe(false);
  });

  it('accepts a figure drawn from goalsAggregate', () => {
    const answer = { answer: '4 goals active right now.' };
    expect(validateChatAnswer(answer, payload({ goalsAggregate: { activeCount: 4, blockedCount: 0, completedThisWeekCount: 0 } }))).toBe(true);
  });
});
