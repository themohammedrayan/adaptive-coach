import type { Mode } from '../engine';

/** Same rule ProfileSetupScreen has always used to derive a challenge's direction. */
export function deriveMode(startWeightKg: number, goalWeightKg: number): Mode {
  if (goalWeightKg < startWeightKg) return 'lose';
  if (goalWeightKg > startWeightKg) return 'gain';
  return 'maintain';
}

/** Days needed to close |start-goal| at the given weekly rate. Minimum 1 day. */
export function horizonDaysFromWeeklyRate(
  startWeightKg: number,
  goalWeightKg: number,
  weeklyRateKg: number,
): number {
  const totalKg = Math.abs(goalWeightKg - startWeightKg);
  if (totalKg === 0 || weeklyRateKg <= 0) return 1;
  return Math.max(1, Math.ceil((totalKg / weeklyRateKg) * 7));
}

/** The weekly rate implied by closing |start-goal| over horizonDays. */
export function weeklyRateFromHorizonDays(
  startWeightKg: number,
  goalWeightKg: number,
  horizonDays: number,
): number {
  const totalKg = Math.abs(goalWeightKg - startWeightKg);
  return (totalKg / Math.max(1, horizonDays)) * 7;
}
