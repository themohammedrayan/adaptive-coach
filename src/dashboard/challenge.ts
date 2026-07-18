import { addDays, DEFAULT_CONFIG, diffDays } from '../engine';
import type { IsoDate } from '../engine';

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
 * (e.g. "lose 20kg in 180 days"). All goal fields are passed explicitly
 * (rather than reading a Profile/Challenge object) so this works the same
 * way whether the caller is describing the primary challenge (which has a
 * live EngineResult/projectedFinishDate) or any other active weight
 * challenge (which shares the same trendWeightKg but has no prescription of
 * its own — pass null for projectedFinishDate in that case). onPace reuses
 * the engine's already-null-safe projectedFinishDate rather than re-deriving
 * a second pace comparison with its own sign-convention risk.
 */
export function buildChallengeProgress(
  goalWeightKg: number,
  challengeStartDate: IsoDate,
  horizonDays: number,
  startWeightKg: number,
  trendWeightKg: number,
  projectedFinishDate: IsoDate | null,
  today: IsoDate,
  kcalPerKg: number = DEFAULT_CONFIG.kcalPerKg,
): ChallengeProgress {
  const totalBudgetKcal = (startWeightKg - goalWeightKg) * kcalPerKg;
  const bankedKcal = (startWeightKg - trendWeightKg) * kcalPerKg;
  const daysElapsed = Math.max(0, diffDays(today, challengeStartDate));
  const daysRemaining = Math.max(0, horizonDays - daysElapsed);
  const deadlineDate = addDays(challengeStartDate, horizonDays);
  const requiredWeeklyRateKg = ((goalWeightKg - trendWeightKg) / Math.max(1, daysRemaining)) * 7;

  return {
    totalBudgetKcal,
    bankedKcal,
    remainingKcal: totalBudgetKcal - bankedKcal,
    percentComplete: totalBudgetKcal !== 0 ? bankedKcal / totalBudgetKcal : null,
    daysElapsed,
    daysRemaining,
    horizonDays,
    deadlineDate,
    requiredWeeklyRateKg,
    onPace: projectedFinishDate !== null ? projectedFinishDate <= deadlineDate : null,
  };
}
