import type { EngineConfig, Macros } from './types';

export interface MacroSplit {
  macros: Macros;
  /** Non-null when the target is below a viable split (calorie floor should have caught it). */
  warning: string | null;
}

/**
 * Engine BRD §5.7 — protein by bodyweight, fat by floor/percent, carbs take
 * the remainder. When carbs land below the minimum: lower fat toward its g/kg
 * floor first, then pin carbs at the minimum (protein is never sacrificed).
 * Fiber is a constraint, not part of the kcal sum.
 */
export function splitMacros(
  targetKcal: number,
  trendWeightKg: number,
  cfg: EngineConfig,
): MacroSplit {
  const proteinG = cfg.proteinGPerKg * trendWeightKg;
  const fatFloorG = cfg.fatGPerKgFloor * trendWeightKg;

  let fatG = Math.max(fatFloorG, (cfg.fatMinPct * targetKcal) / 9);
  let carbG = (targetKcal - proteinG * 4 - fatG * 9) / 4;
  let warning: string | null = null;

  if (carbG < cfg.carbMinG) {
    fatG = Math.max(fatFloorG, (targetKcal - proteinG * 4 - cfg.carbMinG * 4) / 9);
    carbG = (targetKcal - proteinG * 4 - fatG * 9) / 4;
    if (carbG < cfg.carbMinG - 1e-9) {
      carbG = cfg.carbMinG;
      warning =
        'Target is below a viable macro split (protein and fat floors exceed it); ' +
        'the calorie floor should have prevented this.';
    }
  }

  return {
    macros: {
      proteinG: Math.round(proteinG),
      fatG: Math.round(fatG),
      carbG: Math.round(carbG),
      fiberG: Math.round((cfg.fiberGPer1000Kcal * targetKcal) / 1000),
    },
    warning,
  };
}
