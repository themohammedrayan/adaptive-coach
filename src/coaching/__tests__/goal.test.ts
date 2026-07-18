import { buildGoalSummary } from '../goal';

describe('buildGoalSummary', () => {
  it('derives daysElapsed from today vs the challenge startDate', () => {
    const goal = buildGoalSummary(100, 80, 180, '2026-06-01', '2026-07-15');
    expect(goal).toEqual({
      startWeightKg: 100,
      goalWeightKg: 80,
      horizonDays: 180,
      daysElapsed: 44,
    });
  });
});
