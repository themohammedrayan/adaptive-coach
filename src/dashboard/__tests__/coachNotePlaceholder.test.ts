import type { EngineResult } from '../../engine';
import { buildPlaceholderCoachNote } from '../coachNotePlaceholder';

function result(overrides: Partial<EngineResult> = {}): EngineResult {
  return {
    targetKcal: 1900,
    macros: { proteinG: 140, fatG: 60, carbG: 180, fiberG: 27 },
    macroWarning: null,
    tdeeEst: 2200,
    tdeeUsed: 2200,
    energyBalancePerDay: -300,
    effectiveDeficit: 300,
    projectedFinishDate: '2026-09-01',
    trendWeightKg: 80,
    weeklyRateKg: -0.4,
    boundHit: 'none',
    dataStatus: { loggedDays: 10, weighIns: 12, coldStartWeight: 0 },
    reasons: [],
    ...overrides,
  };
}

describe('buildPlaceholderCoachNote', () => {
  it('uses the first reason as the headline when reasons exist', () => {
    const r = result({
      reasons: [{ code: 'TARGET_CHANGED', from: 2000, to: 1900, deltaKcal: -100 }],
    });
    const note = buildPlaceholderCoachNote(r, '2026-07-15');
    expect(note.headline).toBe('Target moved 2000 → 1900 kcal (-100).');
    expect(note.weekOf).toBe('2026-07-15');
    expect(note.reasons).toBe(r.reasons);
  });

  it('falls back to a generic "target held" headline with no reasons', () => {
    const note = buildPlaceholderCoachNote(result({ reasons: [] }), '2026-07-15');
    expect(note.headline).toBe('Target held at 1900 kcal.');
  });
});
