import type { FoodUnitOverride, Unit } from './types';

/** Food-Log BRD §3 — grams = quantity × (override.grams ?? unit.defaultGrams). */
export function computeGrams(
  unit: Unit,
  quantity: number,
  override: FoodUnitOverride | null,
): number {
  const perUnitGrams = override?.grams ?? unit.defaultGrams;
  return quantity * perUnitGrams;
}
