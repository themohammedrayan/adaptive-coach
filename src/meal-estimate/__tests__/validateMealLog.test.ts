import { validateMealLog } from '../../../supabase/functions/_shared/mealLogLogic';
import type { RawMealLog, RawParsedMealItem } from '../../../supabase/functions/_shared/types';

const CATALOG_IDS = ['catalog-dal', 'catalog-rice'];

function item(overrides: Partial<RawParsedMealItem> = {}): RawParsedMealItem {
  return {
    matchedCatalogId: null,
    name: 'Poha',
    quantity: 1,
    unitId: 'katori',
    gramsPerUnit: 150,
    proteinPer100g: 2.6,
    carbPer100g: 26,
    fatPer100g: 4.5,
    fiberPer100g: 1,
    kcalPer100g: null,
    confidence: 'medium',
    ...overrides,
  };
}

function log(overrides: Partial<RawMealLog> = {}): RawMealLog {
  return { items: [item()], clarification: null, ...overrides };
}

describe('validateMealLog — per-item plausibility guard', () => {
  it('accepts a plausible parse and reports the model', () => {
    const result = validateMealLog(log(), CATALOG_IDS, 'gpt-5-mini');
    expect(result).not.toBeNull();
    expect(result?.items).toHaveLength(1);
    expect(result?.model).toBe('gpt-5-mini');
  });

  it('accepts a matched item that carries no macros of its own', () => {
    const result = validateMealLog(
      log({
        items: [
          item({
            matchedCatalogId: 'catalog-dal',
            name: 'Dal',
            proteinPer100g: null,
            carbPer100g: null,
            fatPer100g: null,
            fiberPer100g: null,
          }),
        ],
      }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result).not.toBeNull();
    expect(result?.items[0].matchedCatalogId).toBe('catalog-dal');
  });

  it('rejects a catalog id the client never supplied, so invented ids cannot reach the log', () => {
    const result = validateMealLog(
      log({ items: [item({ matchedCatalogId: 'catalog-invented' })] }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result).toBeNull();
  });

  it('rejects a new food with neither macros nor calories — nothing to compute from', () => {
    const result = validateMealLog(
      log({
        items: [
          item({
            matchedCatalogId: null,
            proteinPer100g: null,
            carbPer100g: null,
            fatPer100g: null,
            kcalPer100g: null,
          }),
        ],
      }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result).toBeNull();
  });

  it('rejects when protein+carb+fat exceeds 100g per 100g of food', () => {
    const result = validateMealLog(
      log({ items: [item({ proteinPer100g: 50, carbPer100g: 40, fatPer100g: 20 })] }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result).toBeNull();
  });

  it('rejects an unknown unit id', () => {
    const result = validateMealLog(log({ items: [item({ unitId: 'handful' })] }), CATALOG_IDS, 'gpt-5-mini');
    expect(result).toBeNull();
  });

  it('rejects a non-positive quantity', () => {
    const result = validateMealLog(log({ items: [item({ quantity: 0 })] }), CATALOG_IDS, 'gpt-5-mini');
    expect(result).toBeNull();
  });

  it('discards a model-supplied kcal when macros are known — the client derives 4P+4C+9F', () => {
    const result = validateMealLog(
      log({ items: [item({ kcalPer100g: 9999 })] }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result?.items[0].kcalPer100g).toBeNull();
  });

  it('keeps a kcal-only item, where there are no macros to derive from', () => {
    const result = validateMealLog(
      log({
        items: [
          item({
            proteinPer100g: null,
            carbPer100g: null,
            fatPer100g: null,
            kcalPer100g: 450,
          }),
        ],
      }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result?.items[0].kcalPer100g).toBe(450);
  });

  it('one bad item fails the whole parse, rather than silently dropping what the user said', () => {
    const result = validateMealLog(
      log({ items: [item({ name: 'Dal' }), item({ unitId: 'handful' })] }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result).toBeNull();
  });

  it('rejects an empty item list', () => {
    expect(validateMealLog(log({ items: [] }), CATALOG_IDS, 'gpt-5-mini')).toBeNull();
  });

  it('passes a clarification through untouched', () => {
    const result = validateMealLog(
      log({ clarification: 'How big was the katori?' }),
      CATALOG_IDS,
      'gpt-5-mini',
    );
    expect(result?.clarification).toBe('How big was the katori?');
  });
});
