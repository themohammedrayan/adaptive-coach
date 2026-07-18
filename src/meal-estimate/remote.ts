import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { EstimateMealInput, MealEstimate } from './types';

/**
 * v2 — distinguishable from a transport failure so the UI can branch to
 * manual entry instead of showing a generic error.
 */
export class EstimateUnavailableError extends Error {
  constructor() {
    super('estimate_unavailable');
    this.name = 'EstimateUnavailableError';
  }
}

/**
 * v2 — calls the estimate-meal Edge Function. Unlike coach-note/coach-chat,
 * a 422 { error: 'estimate_unavailable' } is an expected outcome (the model
 * failed or its output didn't pass the plausibility guard), not a bug —
 * surfaced as EstimateUnavailableError so callers can fall back to manual
 * entry rather than showing a generic error.
 */
export async function estimateMeal(input: EstimateMealInput): Promise<MealEstimate> {
  const { data, error } = await supabase.functions.invoke<{ estimate: MealEstimate }>('estimate-meal', {
    body: input,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error === 'estimate_unavailable') throw new EstimateUnavailableError();
    }
    throw error;
  }
  if (!data) throw new Error('estimate-meal: empty response');
  return data.estimate;
}
