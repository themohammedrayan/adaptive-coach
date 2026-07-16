import type { EntryMacros, Food } from './types';

/** Food-Log BRD §4 — kcal is always derived, never stored independently. Fiber is excluded. */
export function deriveKcalPer100g(proteinG: number, carbG: number, fatG: number): number {
  return 4 * proteinG + 4 * carbG + 9 * fatG;
}

/**
 * Food-Log BRD §4 — entry.macros = food.per100g × grams / 100; entry.kcal = 4P+4C+9F.
 * When the food is kcal-only (macros unknown), the entry's macros stay null — never
 * zero — and kcal scales directly from food.kcalPer100g (the user's direct input).
 */
export function computeEntryMacros(food: Food, grams: number): EntryMacros {
  const fiber = food.fiberPer100g !== null ? (food.fiberPer100g * grams) / 100 : null;

  if (
    !food.macrosComplete ||
    food.proteinPer100g === null ||
    food.carbPer100g === null ||
    food.fatPer100g === null
  ) {
    return { kcal: (food.kcalPer100g * grams) / 100, protein: null, carb: null, fat: null, fiber };
  }

  const protein = (food.proteinPer100g * grams) / 100;
  const carb = (food.carbPer100g * grams) / 100;
  const fat = (food.fatPer100g * grams) / 100;
  return { kcal: 4 * protein + 4 * carb + 9 * fat, protein, carb, fat, fiber };
}

/**
 * Food-Log BRD §4 — pure sum of entries at full precision (rounding is display-only).
 * By construction, day == Σ meals == Σ entries, always. Null macros (kcal-only
 * entries) count as 0 toward the macro totals but flip macrosIncomplete — the
 * caller uses that to show "macros incomplete" rather than a silently wrong total.
 */
export function sumEntryMacros(entries: EntryMacros[]): {
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  macrosIncomplete: boolean;
} {
  let kcal = 0;
  let protein = 0;
  let carb = 0;
  let fat = 0;
  let fiber = 0;
  let macrosIncomplete = false;

  for (const e of entries) {
    kcal += e.kcal;
    if (e.protein === null || e.carb === null || e.fat === null) {
      macrosIncomplete = true;
    } else {
      protein += e.protein;
      carb += e.carb;
      fat += e.fat;
    }
    if (e.fiber !== null) fiber += e.fiber;
  }

  return { kcal, protein, carb, fat, fiber, macrosIncomplete };
}
