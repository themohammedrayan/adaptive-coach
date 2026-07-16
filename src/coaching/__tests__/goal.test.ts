import type { EngineState, Profile } from '../../engine';
import { buildGoalSummary } from '../goal';

const profile: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  activityFactor: 1.55,
  goalWeightKg: 80,
  horizonDays: 180,
  startDate: '2026-06-01',
  mode: 'lose',
};

const engineState: EngineState = {
  prevTargetKcal: 2100,
  mode: 'lose',
  lastRecomputeDate: '2026-07-08',
  startWeightKg: 100,
};

describe('buildGoalSummary', () => {
  it('derives daysElapsed from today vs profile.startDate', () => {
    const goal = buildGoalSummary(profile, engineState, '2026-07-15');
    expect(goal).toEqual({
      startWeightKg: 100,
      goalWeightKg: 80,
      horizonDays: 180,
      daysElapsed: 44,
    });
  });
});
