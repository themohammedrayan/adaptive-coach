import { fallbackAnswer } from '../../../supabase/functions/_shared/chatLogic';
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
    reasons: [],
    ...overrides,
  };
}

describe('fallbackAnswer — v2 (deterministic, no LLM)', () => {
  it('never attempts the question itself, only recites payload-grounded state', () => {
    const answer = fallbackAnswer(payload());
    expect(answer.answer).toMatch(/can't answer that specific question/i);
    expect(answer.answer).toContain('1975');
    expect(answer.answer).toContain('11 of 14');
    expect(answer.answer).toContain('2010');
    expect(answer.answer).toContain('2050');
  });

  it('is a plain deterministic function of the payload (no randomness)', () => {
    const p = payload();
    expect(fallbackAnswer(p)).toEqual(fallbackAnswer(p));
  });
});
