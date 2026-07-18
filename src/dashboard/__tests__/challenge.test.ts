import { buildChallengeProgress } from '../challenge';

const KCAL_PER_KG = 7700;
const GOAL = 80;
const START_DATE = '2026-01-01';
const HORIZON_DAYS = 180;

describe('buildChallengeProgress', () => {
  it('computes total/banked/remaining kcal from weight-trend delta at 7700 kcal/kg', () => {
    const p = buildChallengeProgress(
      GOAL,
      START_DATE,
      HORIZON_DAYS,
      100,
      95,
      '2026-06-01',
      '2026-01-22',
      KCAL_PER_KG,
    );
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
      GOAL,
      START_DATE,
      HORIZON_DAYS,
      100,
      95,
      '2026-06-01',
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.onPace).toBe(true);
  });

  it('is behind pace when the projected finish date is after the deadline', () => {
    const p = buildChallengeProgress(
      GOAL,
      START_DATE,
      HORIZON_DAYS,
      100,
      95,
      '2026-09-01',
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.onPace).toBe(false);
  });

  it('onPace is null when the trend is stalled/gaining (projectedFinishDate null)', () => {
    const p = buildChallengeProgress(GOAL, START_DATE, HORIZON_DAYS, 100, 95, null, '2026-01-22', KCAL_PER_KG);
    expect(p.onPace).toBeNull();
  });

  it('percentComplete is null in maintain mode (totalBudgetKcal === 0)', () => {
    const p = buildChallengeProgress(
      100, // goalWeightKg === startWeightKg
      START_DATE,
      HORIZON_DAYS,
      100,
      100,
      '2026-06-01',
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.totalBudgetKcal).toBe(0);
    expect(p.percentComplete).toBeNull();
  });

  it('clamps daysRemaining to 0 past the deadline instead of going negative', () => {
    const p = buildChallengeProgress(
      GOAL,
      START_DATE,
      HORIZON_DAYS,
      100,
      95,
      '2026-06-01',
      '2027-01-01',
      KCAL_PER_KG,
    );
    expect(p.daysRemaining).toBe(0);
  });

  it('does not clamp percentComplete above 1 when ahead of goal', () => {
    // already past the 80kg goal
    const p = buildChallengeProgress(
      GOAL,
      START_DATE,
      HORIZON_DAYS,
      100,
      78,
      '2026-06-01',
      '2026-01-22',
      KCAL_PER_KG,
    );
    expect(p.percentComplete).toBeGreaterThan(1);
  });
});
