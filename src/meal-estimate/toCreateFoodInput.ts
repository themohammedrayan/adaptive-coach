import type { CreateFoodInput } from '../food-log';
import type { MealEstimate } from './types';

/**
 * v2 — straightforward 1:1 mapping: both MealEstimate and CreateFoodInput
 * are already gram-canonical (per-100g). When macrosComplete is false,
 * kcalPer100g is null (the model was never asked for kcal directly) — the
 * caller's review form must ask the user to type it in, exactly like
 * manual "kcal only" entry already does; createFood() enforces this by
 * throwing if kcalPer100g is left undefined in that case.
 */
export function mealEstimateToCreateFoodInput(
  estimate: MealEstimate,
  defaultUnitId: string,
): CreateFoodInput {
  return {
    name: estimate.name,
    proteinPer100g: estimate.proteinPer100g,
    carbPer100g: estimate.carbPer100g,
    fatPer100g: estimate.fatPer100g,
    fiberPer100g: estimate.fiberPer100g,
    kcalPer100g: estimate.kcalPer100g ?? undefined,
    defaultUnitId,
  };
}
