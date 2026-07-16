import { validateNote } from '../../../supabase/functions/_shared/coachNoteLogic';
import type { CoachNoteContent, CoachPayload } from '../../../supabase/functions/_shared/types';

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

function validNote(): CoachNoteContent {
  return {
    changeExplanation: 'Your target moved to 1975 kcal (-125 from 2100).',
    weeklyReview: 'You logged 11 of 14 days, averaging 2010 kcal against a 2050 kcal target.',
    stallRead: 'Your trend is tracking the plan.',
    suggestion: 'We adjust gradually to keep things smooth.',
  };
}

describe('validateNote — Coaching BRD §11 AT8 (validation guard)', () => {
  it('accepts a note whose numbers all trace back to the payload', () => {
    expect(validateNote(validNote(), payload())).toBe(true);
  });

  it('rejects a note that invents a calorie figure not in the payload', () => {
    const note = validNote();
    note.changeExplanation = 'Your target moved to 1500 kcal, a big drop.';
    expect(validateNote(note, payload())).toBe(false);
  });

  it('rejects a note with an empty field', () => {
    const note = { ...validNote(), suggestion: '' };
    expect(validateNote(note, payload())).toBe(false);
  });

  it('rejects a note with a runaway-length field', () => {
    const note = { ...validNote(), weeklyReview: 'x'.repeat(600) };
    expect(validateNote(note, payload())).toBe(false);
  });

  it('tolerates rounded figures within a small tolerance', () => {
    const note = validNote();
    note.stallRead = 'Your rate is holding around -0.35 kg per week.';
    expect(validateNote(note, payload())).toBe(true);
  });

  it('accepts numbers drawn from goal/adherence fields, not just current', () => {
    const note = validNote();
    note.weeklyReview = 'Day 21 of your 180-day horizon, starting from 100kg toward 80kg.';
    expect(validateNote(note, payload())).toBe(true);
  });
});
