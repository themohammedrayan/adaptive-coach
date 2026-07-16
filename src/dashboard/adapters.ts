import type { Macros } from '../engine';
import type { DailyTotals } from '../food-log';

/** Dashboard BRD §A2.2 — bridges Food-Log's DailyTotals shape to the Engine's Macros shape. */
export function toMacros(t: Pick<DailyTotals, 'protein' | 'carb' | 'fat' | 'fiber'>): Macros {
  return { proteinG: t.protein, carbG: t.carb, fatG: t.fat, fiberG: t.fiber };
}

/** Drives MacroRings' greyed-not-broken empty state (BRD §A2.2). */
export function isEmptyConsumption(m: Macros): boolean {
  return m.proteinG === 0 && m.carbG === 0 && m.fatG === 0 && m.fiberG === 0;
}
