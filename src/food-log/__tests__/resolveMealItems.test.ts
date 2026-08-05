import { DEFAULT_UNITS } from '../constants';
import { resolveMealItems, type ParsedMealItem } from '../resolveMealItems';
import type { Food, FoodUnitOverride } from '../types';

const NOW = '2026-07-15T10:00:00.000Z';

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: 'catalog-dal',
    name: 'Dal',
    proteinPer100g: 9,
    carbPer100g: 20,
    fatPer100g: 0.5,
    fiberPer100g: 5,
    kcalPer100g: 120.5,
    defaultUnitId: 'katori',
    macrosComplete: true,
    source: 'manual',
    createdBy: 'user-me',
    photoPath: null,
    photoLocalUri: null,
    createdAt: NOW,
    archivedAt: null,
    updatedAt: NOW,
    pendingPush: false,
    ...overrides,
  };
}

function item(overrides: Partial<ParsedMealItem> = {}): ParsedMealItem {
  return {
    matchedCatalogId: null,
    name: 'Dal',
    quantity: 1,
    unitId: 'katori',
    gramsPerUnit: null,
    proteinPer100g: 9,
    carbPer100g: 20,
    fatPer100g: 0.5,
    fiberPer100g: 5,
    kcalPer100g: null,
    confidence: 'medium',
    ...overrides,
  };
}

const deps = (catalog: Food[], overrides: FoodUnitOverride[] = []) => ({
  catalog,
  units: DEFAULT_UNITS,
  overrides,
  fallbackUnitId: 'gram',
});

describe('resolveMealItems — matching', () => {
  it('an exact name hit in the catalog matches, so nothing new is created', () => {
    const dal = food();
    const [resolved] = resolveMealItems([item({ name: 'dal' })], deps([dal]));

    expect(resolved.kind).toBe('matched');
    expect(resolved.kind === 'matched' && resolved.food.id).toBe('catalog-dal');
  });

  it("honours the model's matchedCatalogId when that id really exists", () => {
    const dal = food();
    const [resolved] = resolveMealItems(
      [item({ name: 'Yellow lentils', matchedCatalogId: 'catalog-dal' })],
      deps([dal]),
    );

    expect(resolved.kind).toBe('matched');
    expect(resolved.kind === 'matched' && resolved.food.id).toBe('catalog-dal');
  });

  it('degrades a hallucinated matchedCatalogId to a new-food draft instead of logging the wrong macros', () => {
    const [resolved] = resolveMealItems(
      [item({ name: 'Sambhar', matchedCatalogId: 'catalog-does-not-exist' })],
      deps([food()]),
    );

    expect(resolved.kind).toBe('new');
    expect(resolved.kind === 'new' && resolved.draft.name).toBe('Sambhar');
    expect(resolved.kind === 'new' && resolved.draft.source).toBe('coach');
  });

  it('an unrecognised food is a new draft needing approval', () => {
    const [resolved] = resolveMealItems([item({ name: 'Poha' })], deps([food()]));
    expect(resolved.kind).toBe('new');
  });

  it('the name hit wins over a conflicting matchedCatalogId', () => {
    const dal = food();
    const rice = food({ id: 'catalog-rice', name: 'Rice' });
    const [resolved] = resolveMealItems(
      [item({ name: 'Rice', matchedCatalogId: 'catalog-dal' })],
      deps([dal, rice]),
    );

    expect(resolved.kind === 'matched' && resolved.food.id).toBe('catalog-rice');
  });

  it('resolves every item in a multi-food sentence independently', () => {
    const resolved = resolveMealItems(
      [item({ name: 'Dal' }), item({ name: 'Poha' }), item({ name: 'Rice', matchedCatalogId: 'catalog-rice' })],
      deps([food(), food({ id: 'catalog-rice', name: 'Rice' })]),
    );

    expect(resolved.map((r) => r.kind)).toEqual(['matched', 'new', 'matched']);
  });
});

describe('resolveMealItems — grams', () => {
  it('uses the unit default when the user has no override', () => {
    const [resolved] = resolveMealItems([item({ quantity: 2, unitId: 'katori' })], deps([food()]));
    const katori = DEFAULT_UNITS.find((u) => u.id === 'katori')!;
    expect(resolved.grams).toBe(2 * katori.defaultGrams);
  });

  it("the user's own gram override beats whatever the model thought a katori weighs", () => {
    const dal = food();
    const override: FoodUnitOverride = {
      foodId: dal.id,
      unitId: 'katori',
      grams: 120,
      deletedAt: null,
      updatedAt: NOW,
      pendingPush: false,
    };

    const [resolved] = resolveMealItems(
      [item({ quantity: 1, unitId: 'katori', gramsPerUnit: 300 })],
      deps([dal], [override]),
    );

    expect(resolved.grams).toBe(120);
  });

  it('a soft-deleted override is ignored and the unit default applies again', () => {
    const dal = food();
    const override: FoodUnitOverride = {
      foodId: dal.id,
      unitId: 'katori',
      grams: 120,
      deletedAt: NOW,
      updatedAt: NOW,
      pendingPush: false,
    };

    const [resolved] = resolveMealItems([item({ quantity: 1, unitId: 'katori' })], deps([dal], [override]));

    expect(resolved.grams).toBe(DEFAULT_UNITS.find((u) => u.id === 'katori')!.defaultGrams);
  });

  it('falls back to the fallback unit when the model names one that is not in the library', () => {
    const [resolved] = resolveMealItems([item({ unitId: 'handful' })], deps([food()]));
    expect(resolved.unitId).toBe('gram');
  });
});
