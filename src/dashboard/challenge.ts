import { addDays, DEFAULT_CONFIG, diffDays } from '../engine';
import type { EngineResult, IsoDate, Profile } from '../engine';

export interface ChallengeProgress {
  /** (startWeightKg - goalWeightKg) * kcalPerKg — the whole-challenge budget. */
  totalBudgetKcal: number;
  /** (startWeightKg - trendWeightKg) * kcalPerKg — weight-trend-implied deficit banked so far. */
  bankedKcal: number;
  remainingKcal: number;
  /** null when totalBudgetKcal === 0 (maintain-mode profile). */
  percentComplete: number | null;
  daysElapsed: number;
  /** Clamped to 0 past the deadline — a display value, not a divisor. */
  daysRemaining: number;
  horizonDays: number;
  deadlineDate: IsoDate;
  /** Weekly rate still needed to hit goalWeightKg by deadlineDate. */
  requiredWeeklyRateKg: number;
  /** null when the trend is stalled/gaining (projectedFinishDate is null). */
  onPace: boolean | null;
}

/**
 * Dashboard follow-up — day-by-day framing for a fixed weight challenge
 * (e.g. "lose 20kg in 180 days"). Profile.goalWeightKg/horizonDays/startDate
 * and EngineState.startWeightKg already fully model the challenge; this is
 * a presentation-layer view over them, mirroring coaching/goal.ts's
 * buildGoalSummary pattern one tier up (pure builder over Profile +
 * EngineState + today, not a new engine capability). onPace reuses the
 * engine's already-null-safe projectedFinishDate rather than re-deriving a
 * second pace comparison with its own sign-convention risk.
 */
export function buildChallengeProgress(
  profile: Profile,
  startWeightKg: number,
  result: EngineResult,
  today: IsoDate,
  kcalPerKg: number = DEFAULT_CONFIG.kcalPerKg,
): ChallengeProgress {
  const totalBudgetKcal = (startWeightKg - profile.goalWeightKg) * kcalPerKg;
  const bankedKcal = (startWeightKg - result.trendWeightKg) * kcalPerKg;
  const daysElapsed = Math.max(0, diffDays(today, profile.startDate));
  const daysRemaining = Math.max(0, profile.horizonDays - daysElapsed);
  const deadlineDate = addDays(profile.startDate, profile.horizonDays);
  const requiredWeeklyRateKg =
    ((profile.goalWeightKg - result.trendWeightKg) / Math.max(1, daysRemaining)) * 7;

  return {
    totalBudgetKcal,
    bankedKcal,
    remainingKcal: totalBudgetKcal - bankedKcal,
    percentComplete: totalBudgetKcal !== 0 ? bankedKcal / totalBudgetKcal : null,
    daysElapsed,
    daysRemaining,
    horizonDays: profile.horizonDays,
    deadlineDate,
    requiredWeeklyRateKg,
    onPace: result.projectedFinishDate !== null ? result.projectedFinishDate <= deadlineDate : null,
  };
}
