import { diffDays } from '../engine';
import type { IsoDate } from '../engine';
import type { GoalSummary } from './types';

/**
 * Coaching BRD §4 — the `goal` block of the payload. Takes the primary
 * challenge's goal fields as explicit scalars (rather than a Profile/
 * EngineState object) so it works the same regardless of where those fields
 * are stored — today that's a Challenge row, not a singleton Profile.
 */
export function buildGoalSummary(
  startWeightKg: number,
  goalWeightKg: number,
  horizonDays: number,
  challengeStartDate: IsoDate,
  today: IsoDate,
): GoalSummary {
  return {
    startWeightKg,
    goalWeightKg,
    horizonDays,
    daysElapsed: diffDays(today, challengeStartDate),
  };
}
