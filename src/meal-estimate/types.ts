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
