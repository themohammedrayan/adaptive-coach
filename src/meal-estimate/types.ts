import type { ParsedMealItem } from '../food-log/resolveMealItems';

/** v2 — AI meal estimation. RN-side mirror of supabase/functions/_shared/types.ts's MealEstimate. */
export interface MealEstimate {
  name: string;
  proteinPer100g: number | null;
  carbPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  estimatedGrams: number | null;
  confidence: 'low' | 'medium' | 'high';
  /** Server-derived as 4*protein + 4*carb + 9*fat; null when macros aren't all known. */
  kcalPer100g: number | null;
  macrosComplete: boolean;
  source: 'model';
  model: string;
}

export interface EstimateMealInput {
  /** At least one of description/imageBase64 is required. */
  description?: string;
  imageBase64?: string;
}

/** One entry of the grounding shortlist sent to log-meal so it matches instead of inventing. */
export interface CatalogEntry {
  catalogId: string;
  name: string;
}

export interface LogMealInput {
  /** At least one of message/imageBase64 is required. */
  message?: string;
  imageBase64?: string;
  catalog: CatalogEntry[];
}

/**
 * Conversational meal logging result. RN-side mirror of
 * supabase/functions/_shared/types.ts's MealLogResult. Every item has passed the
 * server's plausibility guard, and `matchedCatalogId` is guaranteed to be an id
 * that was in the `catalog` we sent — resolveMealItems still re-checks it
 * against the local store before trusting it.
 */
export interface MealLogResult {
  items: ParsedMealItem[];
  /** One short question when a portion was genuinely ambiguous, else null. */
  clarification: string | null;
  model: string;
}

export type { ParsedMealItem };
