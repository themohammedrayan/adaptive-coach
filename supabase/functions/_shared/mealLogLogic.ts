import { deriveKcalPer100g } from './mealEstimateLogic.ts';
import { KNOWN_UNIT_IDS } from './mealLogPrompt.ts';
import type { MealLogResult, ParsedMealItem, RawMealLog, RawParsedMealItem } from './types.ts';

const MAX_NAME_CHARS = 100;
const MAX_CLARIFICATION_CHARS = 200;
const MAX_ITEMS = 12;
/** ≈ pure fat's ~884 kcal/100g, a generous ceiling covering oils/nuts. */
const MAX_KCAL_PER_100G = 900;
/** Countable units — 100 rotis is already well past anything a person eats. */
const MAX_QUANTITY = 100;
/**
 * Weighed units are quantities of mass/volume, not counts, so they need a
 * ceiling of a different order: "250 gram cooked rice" is an everyday portion.
 * Sharing the countable ceiling rejected every weighed portion over 100 g/ml —
 * and since one bad item fails the whole parse, that surfaced to the user as
 * "the coach couldn't make sense of that" for a perfectly clear sentence.
 */
const MAX_QUANTITY_BY_UNIT: Record<string, number> = { gram: 5000, ml: 5000 };
const MAX_GRAMS_PER_UNIT = 2000;

function inRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

function nullOrInRange(n: unknown, min: number, max: number): boolean {
  return n === null || inRange(n, min, max);
}

/**
 * Per-item sibling of validateMealEstimate's plausibility guard.
 *
 * Same reasoning: there is no payload of true numbers to trace these back to
 * (unlike validateNote/validateChatAnswer), so this checks physical consistency
 * instead — macro ranges, the mass constraint that protein+carb+fat can't exceed
 * 100g per 100g of food, a derived-kcal ceiling, and a sane portion.
 *
 * It also enforces the one rule the catalog depends on: `matchedCatalogId` must
 * be a string the caller actually supplied. A model that invents an id would
 * otherwise silently attach one food's macros to another's name.
 */
function validateItem(raw: RawParsedMealItem, allowedCatalogIds: Set<string>): ParsedMealItem | null {
  if (typeof raw.name !== 'string' || raw.name.trim().length === 0 || raw.name.length > MAX_NAME_CHARS) {
    return null;
  }

  if (raw.matchedCatalogId !== null) {
    if (typeof raw.matchedCatalogId !== 'string') return null;
    if (!allowedCatalogIds.has(raw.matchedCatalogId)) return null;
  }

  // Unit first: it decides which quantity ceiling applies.
  if (typeof raw.unitId !== 'string' || !(KNOWN_UNIT_IDS as readonly string[]).includes(raw.unitId)) return null;
  const maxQuantity = MAX_QUANTITY_BY_UNIT[raw.unitId] ?? MAX_QUANTITY;
  if (!inRange(raw.quantity, 0, maxQuantity) || raw.quantity <= 0) return null;
  if (!nullOrInRange(raw.gramsPerUnit, 1, MAX_GRAMS_PER_UNIT)) return null;

  for (const m of [raw.proteinPer100g, raw.carbPer100g, raw.fatPer100g, raw.fiberPer100g]) {
    if (!nullOrInRange(m, 0, 100)) return null;
  }

  const macrosComplete =
    raw.proteinPer100g !== null && raw.carbPer100g !== null && raw.fatPer100g !== null;

  if (macrosComplete) {
    const sum = (raw.proteinPer100g as number) + (raw.carbPer100g as number) + (raw.fatPer100g as number);
    if (sum > 100) return null; // physical mass constraint — room left for water/ash/fiber
    const derived = deriveKcalPer100g(
      raw.proteinPer100g as number,
      raw.carbPer100g as number,
      raw.fatPer100g as number,
    );
    if (!inRange(derived, 0, MAX_KCAL_PER_100G)) return null;
  } else if (!nullOrInRange(raw.kcalPer100g, 0, MAX_KCAL_PER_100G)) {
    // Only range-checked when it will actually be used. With macros known the
    // model's kcal figure is discarded outright, so an absurd one there is
    // noise, not grounds for rejecting an otherwise fine item.
    return null;
  }

  if (!['low', 'medium', 'high'].includes(raw.confidence)) return null;

  // A brand-new food the app must create needs *something* to compute from:
  // either full macros or an explicit kcal figure. A matched item doesn't —
  // it reuses the catalog food's saved numbers.
  if (raw.matchedCatalogId === null && !macrosComplete && raw.kcalPer100g === null) return null;

  return {
    matchedCatalogId: raw.matchedCatalogId,
    name: raw.name,
    quantity: raw.quantity,
    unitId: raw.unitId,
    gramsPerUnit: raw.gramsPerUnit,
    proteinPer100g: raw.proteinPer100g,
    carbPer100g: raw.carbPer100g,
    fatPer100g: raw.fatPer100g,
    fiberPer100g: raw.fiberPer100g,
    // kcal is DERIVED whenever macros are known — never the model's own figure.
    kcalPer100g: macrosComplete ? null : raw.kcalPer100g,
    confidence: raw.confidence,
  };
}

/**
 * Validates a whole parse. One bad item fails the entire response rather than
 * being dropped: a silently shortened list would look to the user like the
 * coach simply didn't hear part of what they ate, which is worse than falling
 * back to manual entry.
 */
export function validateMealLog(
  raw: RawMealLog,
  allowedCatalogIds: string[],
  model: string,
): MealLogResult | null {
  if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > MAX_ITEMS) return null;

  if (
    raw.clarification !== null &&
    (typeof raw.clarification !== 'string' || raw.clarification.length > MAX_CLARIFICATION_CHARS)
  ) {
    return null;
  }

  const allowed = new Set(allowedCatalogIds);
  const items: ParsedMealItem[] = [];
  for (const rawItem of raw.items) {
    const item = validateItem(rawItem, allowed);
    if (item === null) return null;
    items.push(item);
  }

  return { items, clarification: raw.clarification, model };
}
