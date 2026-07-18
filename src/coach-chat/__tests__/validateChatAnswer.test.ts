import { validateChatAnswer } from '../../../supabase/functions/_shared/chatLogic';
import type { CoachPayload } from '../../../supabase/functions/_shared/types';

function payload(overrides: Partial<CoachPayload> = {}): CoachPayload {
  return {
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
    ...overrides,
  };
}

describe('validateChatAnswer — v2 ad-hoc Q&A guard', () => {
  it('accepts an answer whose numbers all trace back to the payload', () => {
    const answer = { answer: 'Your target moved to 1975 kcal (-125 from 2100) this week.' };
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
});
