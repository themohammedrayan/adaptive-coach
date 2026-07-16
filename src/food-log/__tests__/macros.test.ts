import { computeEntryMacros, deriveKcalPer100g, sumEntryMacros } from '../macros';
import type { Food } from '../types';

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: 'f1',
    name: 'Rice',
    proteinPer100g: 2.7,
    carbPer100g: 28,
    fatPer100g: 0.3,
    fiberPer100g: 0.4,
    kcalPer100g: deriveKcalPer100g(2.7, 28, 0.3),
    defaultUnitId: 'katori',
    macrosComplete: true,
    isCustom: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  };
}

describe('computeEntryMacros — Food-Log BRD §10 AT1', () => {
  it('food defined per-100g, log 150g → macros ×1.5', () => {
    const f = food();
    const macros = computeEntryMacros(f, 150);
    expect(macros.protein).toBeCloseTo(2.7 * 1.5);
    expect(macros.carb).toBeCloseTo(28 * 1.5);
    expect(macros.fat).toBeCloseTo(0.3 * 1.5);
    expect(macros.fiber).toBeCloseTo(0.4 * 1.5);
    expect(macros.kcal).toBeCloseTo(4 * macros.protein! + 4 * macros.carb! + 9 * macros.fat!);
  });

  it('scales at 100g exactly to the per-100g values', () => {
    const f = food();
    const macros = computeEntryMacros(f, 100);
    expect(macros.protein).toBeCloseTo(2.7);
    expect(macros.kcal).toBeCloseTo(f.kcalPer100g);
  });
});

describe('computeEntryMacros — kcal-only quick food (macrosComplete=false)', () => {
  it('macros are null, calories still scale from kcalPer100g', () => {
    const f = food({
      proteinPer100g: null,
      carbPer100g: null,
      fatPer100g: null,
      fiberPer100g: null,
      kcalPer100g: 300,
      macrosComplete: false,
    });
    const macros = computeEntryMacros(f, 200);
    expect(macros.kcal).toBeCloseTo(600);
    expect(macros.protein).toBeNull();
    expect(macros.carb).toBeNull();
    expect(macros.fat).toBeNull();
    expect(macros.fiber).toBeNull();
  });

  it('fiber can be known even when macros are not', () => {
    const f = food({
      proteinPer100g: null,
      carbPer100g: null,
      fatPer100g: null,
      fiberPer100g: 2,
      kcalPer100g: 300,
      macrosComplete: false,
    });
    const macros = computeEntryMacros(f, 100);
    expect(macros.fiber).toBeCloseTo(2);
  });
});

describe('sumEntryMacros', () => {
  it('sums known macros and flags macrosIncomplete when any entry has null macros', () => {
    const complete = computeEntryMacros(food(), 100);
    const incomplete = computeEntryMacros(
      food({
        proteinPer100g: null,
        carbPer100g: null,
        fatPer100g: null,
        kcalPer100g: 300,
        macrosComplete: false,
      }),
      100,
    );
    const totals = sumEntryMacros([complete, incomplete]);
    expect(totals.kcal).toBeCloseTo(complete.kcal + incomplete.kcal);
    expect(totals.protein).toBeCloseTo(complete.protein!);
    expect(totals.macrosIncomplete).toBe(true);
  });

  it('macrosIncomplete is false when every entry has full macros', () => {
    const a = computeEntryMacros(food(), 100);
    const b = computeEntryMacros(food(), 50);
    const totals = sumEntryMacros([a, b]);
    expect(totals.macrosIncomplete).toBe(false);
  });
});
