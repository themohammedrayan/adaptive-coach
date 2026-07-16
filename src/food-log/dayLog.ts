import type { DayLog } from '../engine';
import type { DailyTotals } from './types';

/**
 * Food-Log BRD §8 — adapts the local daily rollup to the Engine's DayLog input
 * contract. macrosIncomplete/markedComplete have no DayLog equivalent: the
 * Engine's missing-data gate uses only the `logged` (≥1 entry) rule in v1.
 */
export function toDayLog(totals: DailyTotals): DayLog {
  return {
    date: totals.localDate,
    kcal: totals.kcal,
    protein: totals.protein,
    carb: totals.carb,
    fat: totals.fat,
    fiber: totals.fiber,
    logged: totals.logged,
  };
}
