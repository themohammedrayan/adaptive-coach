import { fallbackNote } from '../../../supabase/functions/_shared/coachNoteLogic';
import type { CoachPayload } from '../../../supabase/functions/_shared/types';

function basePayload(overrides: Partial<CoachPayload> = {}): CoachPayload {
  return {
    weekOf: '2026-07-15',
    goal: { startWeightKg: 100, goalWeightKg: 80, horizonDays: 180, daysElapsed: 21 },
    current: {
      targetKcal: 1975,
      prevTargetKcal: 1975,
      deltaKcal: 0,
      macros: { proteinG: 180, fatG: 60, carbG: 170, fiberG: 28 },
      tdeeEst: 2450,
      effectiveDeficit: 475,
      weeklyRateKg: -0.35,
      projectedFinishDate: '2026-12-30',
      boundHit: 'none',
    },
    trend: [],
    adherence: { loggedDays: 11, windowDays: 14, avgIntake: 2010, avgTarget: 2050 },
    reasons: [],
    goals: [],
    goalsAggregate: { activeCount: 0, blockedCount: 0, completedThisWeekCount: 0 },
    goalSignals: [],
    ...overrides,
  };
}

describe('fallbackNote — Coaching BRD §10/§11 AT3 (insufficient-data week)', () => {
  it('explains the hold and nudges logging when INSUFFICIENT_DATA is present', () => {
    const payload = basePayload({
      reasons: [{ code: 'INSUFFICIENT_DATA', loggedDays: 6, weighIns: 9 }],
      adherence: { loggedDays: 6, windowDays: 14, avgIntake: 1900, avgTarget: 2050 },
    });
    const note = fallbackNote(payload);
    expect(note.changeExplanation).toContain('6 of 14 days');
    expect(note.changeExplanation).toMatch(/kept your target where it was/);
    expect(note.suggestion).toMatch(/log a couple more days/i);
  });
});

describe('fallbackNote — AT2 support (target changed)', () => {
  it('cites the target delta correctly when TARGET_CHANGED is present', () => {
    const payload = basePayload({
      current: {
        ...basePayload().current,
        targetKcal: 1975,
        prevTargetKcal: 2100,
      },
      reasons: [{ code: 'TARGET_CHANGED', from: 2100, to: 1975, deltaKcal: -125 }],
    });
    const note = fallbackNote(payload);
    expect(note.changeExplanation).toContain('1975');
    expect(note.changeExplanation).toContain('2100');
    expect(note.changeExplanation).toContain('-125');
  });

  it('reports a held target when no TARGET_CHANGED reason exists', () => {
    const note = fallbackNote(basePayload({ reasons: [] }));
    expect(note.changeExplanation).toMatch(/held at 1975 kcal/);
  });
});

describe('fallbackNote — AT7 (stall week, gentle framing)', () => {
  it('flags a stall without scary framing when TREND_STALLED is present', () => {
    const payload = basePayload({
      current: { ...basePayload().current, effectiveDeficit: 10 },
      reasons: [{ code: 'TREND_STALLED', windowRateKg: -0.05 }],
    });
    const note = fallbackNote(payload);
    expect(note.stallRead).toContain('-0.05');
    expect(note.stallRead).not.toMatch(/danger|fail|bad/i);
  });

  it('confirms on-track when nothing is stalled', () => {
    const note = fallbackNote(basePayload({ reasons: [] }));
    expect(note.stallRead).toMatch(/tracking the plan/);
  });
});

describe('fallbackNote — BOUND_HIT suggestion', () => {
  it('mentions gradual adjustment when a safety bound was hit', () => {
    const payload = basePayload({ reasons: [{ code: 'BOUND_HIT', bound: 'moveLimit' }] });
    const note = fallbackNote(payload);
    expect(note.suggestion).toMatch(/adjust gradually/);
  });
});

describe('fallbackNote — weekly review numbers', () => {
  it('cites logged days, average intake, and average target', () => {
    const note = fallbackNote(basePayload());
    expect(note.weeklyReview).toContain('11 of 14');
    expect(note.weeklyReview).toContain('2010');
    expect(note.weeklyReview).toContain('2050');
  });
});

describe('fallbackNote — Goals BRD §H.4 (goalsNote)', () => {
  it('is empty when there are no active goals', () => {
    const note = fallbackNote(basePayload());
    expect(note.goalsNote).toBe('');
  });

  it('names a completed goal over a generic summary', () => {
    const note = fallbackNote(
      basePayload({
        goalsAggregate: { activeCount: 3, blockedCount: 1, completedThisWeekCount: 1 },
        goalSignals: [{ code: 'GOAL_COMPLETED', goalExternalId: 'g1', title: 'Read 12 books' }],
      }),
    );
    expect(note.goalsNote).toContain('Read 12 books');
  });

  it('names what a blocked goal is waiting on', () => {
    const note = fallbackNote(
      basePayload({
        goalsAggregate: { activeCount: 2, blockedCount: 1, completedThisWeekCount: 0 },
        goalSignals: [
          { code: 'GOAL_BLOCKED', goalExternalId: 'g2', title: 'Buy the bike', blockedByTitle: 'Clear credit card debt' },
        ],
      }),
    );
    expect(note.goalsNote).toContain('Buy the bike');
    expect(note.goalsNote).toContain('Clear credit card debt');
  });

  it('falls back to a generic active/blocked count with no signals', () => {
    const note = fallbackNote(basePayload({ goalsAggregate: { activeCount: 4, blockedCount: 2, completedThisWeekCount: 0 } }));
    expect(note.goalsNote).toContain('4 goals active');
    expect(note.goalsNote).toContain('2 blocked');
  });
});
