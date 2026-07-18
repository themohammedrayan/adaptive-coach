import { mealEstimateToCreateFoodInput } from '../toCreateFoodInput';
import type { MealEstimate } from '../types';

function estimate(overrides: Partial<MealEstimate> = {}): MealEstimate {
  return {
    name: 'Chicken curry',
    proteinPer100g: 15,
    carbPer100g: 8,
    fatPer100g: 10,
    fiberPer100g: 2,
    estimatedGrams: 350,
    confidence: 'medium',
    kcalPer100g: 4 * 15 + 4 * 8 + 9 * 10,
    macrosComplete: true,
    source: 'model',
    model: 'gpt-5-mini',
    ...overrides,
  };
}

describe('mealEstimateToCreateFoodInput — v2', () => {
  it('maps a macros-complete estimate 1:1 (both shapes are gram-canonical)', () => {
    const input = mealEstimateToCreateFoodInput(estimate(), 'katori');
    expect(input).toEqual({
      name: 'Chicken curry',
      proteinPer100g: 15,
      carbPer100g: 8,
      fatPer100g: 10,
      fiberPer100g: 2,
      kcalPer100g: 182,
      defaultUnitId: 'katori',
    });
  });

  it('leaves kcalPer100g undefined for a macros-incomplete estimate, for the review form to fill in', () => {
    const input = mealEstimateToCreateFoodInput(
      estimate({ proteinPer100g: null, carbPer100g: null, fatPer100g: null, kcalPer100g: null, macrosComplete: false }),
      'katori',
    );
    expect(input.kcalPer100g).toBeUndefined();
    expect(input.proteinPer100g).toBeNull();
  });

  it('passes through a null fiber and null estimatedGrams unchanged', () => {
    const input = mealEstimateToCreateFoodInput(estimate({ fiberPer100g: null }), 'katori');
    expect(input.fiberPer100g).toBeNull();
  });
});
