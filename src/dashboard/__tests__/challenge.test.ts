import type { EngineResult, Profile } from '../../engine';
import { buildChallengeProgress } from '../challenge';

const KCAL_PER_KG = 7700;

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    sex: 'male',
    age: 30,
    heightCm: 178,
    activityFactor: 1.5,
    goalWeightKg: 80,
    horizonDays: 180,
    startDate: '2026-01-01',
    mode: 'lose',
    ...overrides,
  };
}

function result(overrides: Partial<EngineResult> = {}): EngineResult {
  return {
    targetKcal: 1975,
    macros: { proteinG: 180, fatG: 60, carbG: 170, fiberG: 28 },
    macroWarning: null,
    tdeeEst: 2450,
    tdeeUsed: 2450,
    energyBalancePerDay: -475,
    effectiveDeficit: 475,
    projectedFinishDate: '2026-06-01',
    trendWeightKg: 95,
    weeklyRateKg: -0.35,
    boundHit: 'none',
    dataStatus: { loggedDays: 11, weighIns: 12, coldStartWeight: 0 },
    reasons: [],
    ...overrides,
  };
}

describe('buildChallengeProgress', () => {
  it('computes total/banked/remaining kcal from weight-trend delta at 7700 kcal/kg', () => {
    const p = buildChallengeProgress(profile(), 100, result({ trendWeightKg: 95 }), '2026-01-22', KCAL_PER_KG);
    expect(p.totalBudgetKcal).toBe((100 - 80) * KCAL_PER_KG);
    expect(p.bankedKcal).toBe((100 - 95) * KCAL_PER_KG);
    expect(p.remainingKcal).toBe(p.totalBudgetKcal - p.bankedKcal);
    expect(p.percentComplete).toBeCloseTo((100 - 95) / (100 - 80));
    expect(p.daysElapsed).toBe(21);
    expect(p.daysRemaining).toBe(159);
    expect(p.deadlineDate).toBe('2026-06-30');
  });

  it('is on pace when the projected finish date is on/before the deadline', () => {
    const p = buildChallengeProgress(
      profile(),
      100,
      result({ trendWeightKg: 95, projectedFinishDate: '2026-06-01' }),
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.onPace).toBe(true);
  });

  it('is behind pace when the projected finish date is after the deadline', () => {
    const p = buildChallengeProgress(
      profile(),
      100,
      result({ trendWeightKg: 95, projectedFinishDate: '2026-09-01' }),
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.onPace).toBe(false);
  });

  it('onPace is null when the trend is stalled/gaining (projectedFinishDate null)', () => {
    const p = buildChallengeProgress(
      profile(),
      100,
      result({ trendWeightKg: 95, projectedFinishDate: null }),
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.onPace).toBeNull();
  });

  it('percentComplete is null in maintain mode (totalBudgetKcal === 0)', () => {
    const p = buildChallengeProgress(
      profile({ goalWeightKg: 100, mode: 'maintain' }),
      100,
      result({ trendWeightKg: 100 }),
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.totalBudgetKcal).toBe(0);
    expect(p.percentComplete).toBeNull();
  });

  it('clamps daysRemaining to 0 past the deadline instead of going negative', () => {
    const p = buildChallengeProgress(profile(), 100, result({ trendWeightKg: 95 }), '2027-01-01', KCAL_PER_KG);
    expect(p.daysRemaining).toBe(0);
  });

  it('does not clamp percentComplete above 1 when ahead of goal', () => {
    const p = buildChallengeProgress(
      profile(),
      100,
      result({ trendWeightKg: 78 }), // already past the 80kg goal
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.percentComplete).toBeGreaterThan(1);
  });
});
