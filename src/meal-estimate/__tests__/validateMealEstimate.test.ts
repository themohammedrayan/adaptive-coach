import { validateMealEstimate } from '../../../supabase/functions/_shared/mealEstimateLogic';
import type { RawMealEstimate } from '../../../supabase/functions/_shared/types';

function raw(overrides: Partial<RawMealEstimate> = {}): RawMealEstimate {
  return {
    name: 'Chicken curry',
    proteinPer100g: 15,
    carbPer100g: 8,
    fatPer100g: 10,
    fiberPer100g: 2,
    estimatedGrams: 350,
    confidence: 'medium',
    ...overrides,
  };
}

describe('validateMealEstimate — v2 plausibility guard', () => {
  it('accepts a plausible estimate and derives kcal as 4P+4C+9F', () => {
    const estimate = validateMealEstimate(raw(), 'gpt-5-mini');
    expect(estimate).not.toBeNull();
    expect(estimate?.kcalPer100g).toBe(4 * 15 + 4 * 8 + 9 * 10);
    expect(estimate?.macrosComplete).toBe(true);
    expect(estimate?.source).toBe('model');
    expect(estimate?.model).toBe('gpt-5-mini');
  });

  it('rejects when protein+carb+fat exceeds 100g per 100g of food', () => {
    const estimate = validateMealEstimate(
      raw({ proteinPer100g: 50, carbPer100g: 40, fatPer100g: 20 }),
      'gpt-5-mini',
    );
    expect(estimate).toBeNull();
  });

  it('rejects negative macros', () => {
    expect(validateMealEstimate(raw({ proteinPer100g: -5 }), 'gpt-5-mini')).toBeNull();
  });

  it('rejects a derived kcal outside the plausible ceiling', () => {
    // 100g protein + 0 carb + 0 fat alone is within mass bounds but let's
    // push fat high enough to blow past the 900 kcal/100g ceiling instead.
    const estimate = validateMealEstimate(
      raw({ proteinPer100g: 0, carbPer100g: 0, fatPer100g: 100 }),
      'gpt-5-mini',
    );
    // 9*100 = 900, exactly at the ceiling — still valid.
    expect(estimate).not.toBeNull();
    expect(estimate?.kcalPer100g).toBe(900);
  });

  it('rejects an empty name', () => {
    expect(validateMealEstimate(raw({ name: '' }), 'gpt-5-mini')).toBeNull();
  });

  it('rejects an out-of-range estimatedGrams', () => {
    expect(validateMealEstimate(raw({ estimatedGrams: 5000 }), 'gpt-5-mini')).toBeNull();
    expect(validateMealEstimate(raw({ estimatedGrams: 0 }), 'gpt-5-mini')).toBeNull();
  });

  it('accepts a macros-incomplete (kcal-only) estimate with a null kcalPer100g', () => {
    const estimate = validateMealEstimate(
      raw({ proteinPer100g: null, carbPer100g: null, fatPer100g: null }),
      'gpt-5-mini',
    );
    expect(estimate).not.toBeNull();
    expect(estimate?.macrosComplete).toBe(false);
    expect(estimate?.kcalPer100g).toBeNull();
  });

  it('accepts a null estimatedGrams and null fiber (unknown, not zero)', () => {
    const estimate = validateMealEstimate(raw({ estimatedGrams: null, fiberPer100g: null }), 'gpt-5-mini');
    expect(estimate).not.toBeNull();
    expect(estimate?.estimatedGrams).toBeNull();
    expect(estimate?.fiberPer100g).toBeNull();
  });

  it('rejects an invalid confidence value', () => {
    expect(
      validateMealEstimate({ ...raw(), confidence: 'certain' as RawMealEstimate['confidence'] }, 'gpt-5-mini'),
    ).toBeNull();
  });
});
