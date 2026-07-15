import { addDays } from './dates';
import type { BoundHit, EngineConfig, IsoDate } from './types';

/**
 * Engine BRD §5.4 — signed energy balance needed to reach the goal in the
 * remaining time. Negative = deficit (loss); positive = surplus (gain seam,
 * not exercised in v1).
 */
export function requiredBalance(
  trendWeightKg: number,
  goalWeightKg: number,
  daysRemaining: number,
  kcalPerKg: number,
): number {
  return ((goalWeightKg - trendWeightKg) * kcalPerKg) / Math.max(1, daysRemaining);
}

export interface TargetResult {
  targetKcal: number;
  rawTargetKcal: number;
  boundHit: BoundHit;
  /** tdeeUsed − target: what the prescription actually achieves (> 0 = losing). */
  effectiveDeficit: number;
}

/**
 * Engine BRD §5.5 — clamps in fixed order: loss-rate cap → move limit →
 * calorie floor. The floor is applied last and always wins, even over the
 * move limit.
 */
export function computeTarget(
  tdeeUsed: number,
  reqBalance: number,
  trendWeightKg: number,
  prevTargetKcal: number | null,
  calorieFloorKcal: number,
  cfg: EngineConfig,
): TargetResult {
  const rawTarget = tdeeUsed + reqBalance;
  let target = rawTarget;
  let boundHit: BoundHit = 'none';

  const maxDeficit = (cfg.maxLossRateFrac * trendWeightKg * cfg.kcalPerKg) / 7;
  if (target < tdeeUsed - maxDeficit) {
    target = tdeeUsed - maxDeficit;
    boundHit = 'lossRateCap';
  }

  if (prevTargetKcal !== null) {
    const lo = prevTargetKcal - cfg.moveLimitKcal;
    const hi = prevTargetKcal + cfg.moveLimitKcal;
    if (target < lo) {
      target = lo;
      boundHit = 'moveLimit';
    } else if (target > hi) {
      target = hi;
      boundHit = 'moveLimit';
    }
  }

  if (target < calorieFloorKcal) {
    target = calorieFloorKcal;
    boundHit = 'calorieFloor';
  }

  const targetKcal = Math.round(target);
  return {
    targetKcal,
    rawTargetKcal: rawTarget,
    boundHit,
    effectiveDeficit: tdeeUsed - targetKcal,
  };
}

/**
 * Engine BRD §5.6 — projected finish on the current pace; null when stalled
 * or gaining (the coach flags that instead of the UI showing a scary date).
 */
export function projectFinish(
  trendWeightKg: number,
  goalWeightKg: number,
  effectiveDeficit: number,
  today: IsoDate,
  kcalPerKg: number,
): IsoDate | null {
  const remainingKg = trendWeightKg - goalWeightKg;
  if (remainingKg <= 0) return today;
  if (effectiveDeficit <= 0) return null;
  return addDays(today, Math.ceil((remainingKg * kcalPerKg) / effectiveDeficit));
}
