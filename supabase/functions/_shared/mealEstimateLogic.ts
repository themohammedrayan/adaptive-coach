import type { MealEstimate, RawMealEstimate } from './types';

const MAX_NAME_CHARS = 100;
/** ≈ pure fat's ~884 kcal/100g, a generous ceiling covering oils/nuts. */
const MAX_KCAL_PER_100G = 900;
const MAX_ESTIMATED_GRAMS = 2000;

/**
 * Food-Log BRD §4 sibling — Deno-side duplicate of src/food-log/macros.ts's
 * deriveKcalPer100g. Keep these two in sync by hand (same convention as
 * _shared/types.ts's duplication of src/coaching/types.ts).
 */
export function deriveKcalPer100g(proteinG: number, carbG: number, fatG: number): number {
  return 4 * proteinG + 4 * carbG + 9 * fatG;
}

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && n >= min && n <= max;
}

/**
 * v2 — there is no prior payload of true numbers to trace new numbers back
 * to here (unlike validateNote/validateChatAnswer), so this is a
 * plausibility/physical-consistency guard instead: macro ranges, a mass
 * constraint (protein+carb+fat can't exceed 100g per 100g of food), and a
 * derived-kcal ceiling. Returns null (never a fabricated fallback — there's
 * no deterministic way to guess a meal's macros) when the raw estimate
 * fails any check.
 */
export function validateMealEstimate(raw: RawMealEstimate, model: string): MealEstimate | null {
  if (typeof raw.name !== 'string' || raw.name.trim().length === 0 || raw.name.length > MAX_NAME_CHARS) {
    return null;
  }

  const macros = [raw.proteinPer100g, raw.carbPer100g, raw.fatPer100g];
  for (const m of macros) {
    if (m !== null && (typeof m !== 'number' || !inRange(m, 0, 100))) return null;
  }
  if (raw.fiberPer100g !== null && (typeof raw.fiberPer100g !== 'number' || !inRange(raw.fiberPer100g, 0, 100))) {
    return null;
  }

  const macrosComplete = raw.proteinPer100g !== null && raw.carbPer100g !== null && raw.fatPer100g !== null;
  if (macrosComplete) {
    const sum = (raw.proteinPer100g as number) + (raw.carbPer100g as number) + (raw.fatPer100g as number);
    if (sum > 100) return null; // physical mass constraint — leaves room for water/ash/fiber
  }

  if (raw.estimatedGrams !== null && (typeof raw.estimatedGrams !== 'number' || !inRange(raw.estimatedGrams, 1, MAX_ESTIMATED_GRAMS))) {
    return null;
  }

  if (!['low', 'medium', 'high'].includes(raw.confidence)) return null;

  // Kcal-only estimates (macros unknown) have nothing to derive kcal from —
  // the model is never asked for kcal directly, so kcalPer100g stays null
  // and the review form asks the user to type calories, same as manual
  // "kcal only" entry.
  let kcalPer100g: number | null = null;
  if (macrosComplete) {
    kcalPer100g = deriveKcalPer100g(
      raw.proteinPer100g as number,
      raw.carbPer100g as number,
      raw.fatPer100g as number,
    );
    if (!inRange(kcalPer100g, 0, MAX_KCAL_PER_100G)) return null;
  }

  return {
    name: raw.name,
    proteinPer100g: raw.proteinPer100g,
    carbPer100g: raw.carbPer100g,
    fatPer100g: raw.fatPer100g,
    fiberPer100g: raw.fiberPer100g,
    estimatedGrams: raw.estimatedGrams,
    confidence: raw.confidence,
    kcalPer100g,
    macrosComplete,
    source: 'model',
    model,
  };
}
