import { diffDays } from '../engine';
import type { EngineState, IsoDate, Profile } from '../engine';
import type { GoalSummary } from './types';

/** Coaching BRD §4 — the `goal` block of the payload. */
export function buildGoalSummary(profile: Profile, engineState: EngineState, today: IsoDate): GoalSummary {
  return {
    startWeightKg: engineState.startWeightKg,
    goalWeightKg: profile.goalWeightKg,
    horizonDays: profile.horizonDays,
    daysElapsed: diffDays(today, profile.startDate),
  };
}
