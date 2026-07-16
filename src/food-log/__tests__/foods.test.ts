import { archiveFood, createFood, searchFoods } from '../foods';
import { MemoryStore } from '../store.memory';

const NOW = '2026-07-15T10:00:00.000Z';

const riceInput = {
  name: 'Rice',
  proteinPer100g: 2.7,
  carbPer100g: 28,
  fatPer100g: 0.3,
  fiberPer100g: 0.4,
  defaultUnitId: 'katori',
};

describe('createFood — kcal derivation', () => {
  it('derives kcalPer100g = 4P + 4C + 9F when macros are known', async () => {
    const store = new MemoryStore();
    const food = await createFood(store, riceInput, NOW);
    expect(food.macrosComplete).toBe(true);
    expect(food.kcalPer100g).toBeCloseTo(4 * 2.7 + 4 * 28 + 9 * 0.3);
  });

  it('kcal-only food: macrosComplete=false, kcalPer100g is the direct input', async () => {
    const store = new MemoryStore();
    const food = await createFood(
      store,
      {
        name: 'Mystery snack',
        proteinPer100g: null,
        carbPer100g: null,
        fatPer100g: null,
        fiberPer100g: null,
        kcalPer100g: 450,
        defaultUnitId: 'piece',
      },
      NOW,
    );
    expect(food.macrosComplete).toBe(false);
    expect(food.kcalPer100g).toBe(450);
  });

  it('throws when macros are unknown and kcalPer100g is not provided', async () => {
    const store = new MemoryStore();
    await expect(
      createFood(
        store,
        {
          name: 'Bad input',
          proteinPer100g: null,
          carbPer100g: null,
          fatPer100g: null,
          fiberPer100g: null,
          defaultUnitId: 'piece',
        },
        NOW,
      ),
    ).rejects.toThrow();
  });
});

describe('archiveFood — Food-Log BRD §10 AT8', () => {
  it('sets archivedAt and excludes the food from listFoods by default', async () => {
    const store = new MemoryStore();
    const food = await createFood(store, riceInput, NOW);
    await archiveFood(store, food.id, '2026-07-16T00:00:00.000Z');
    expect(await store.listFoods(false)).toHaveLength(0);
    const archived = await store.listFoods(true);
    expect(archived[0].archivedAt).toBe('2026-07-16T00:00:00.000Z');
  });

  it('archiving a food that does not exist is a no-op', async () => {
    const store = new MemoryStore();
    await expect(archiveFood(store, 'missing', NOW)).resolves.toBeUndefined();
  });
});

describe('searchFoods', () => {
  it('filters by case-insensitive substring match on non-archived foods', async () => {
    const store = new MemoryStore();
    await createFood(store, riceInput, NOW);
    await createFood(
      store,
      { name: 'Dal', proteinPer100g: 9, carbPer100g: 20, fatPer100g: 0.5, fiberPer100g: 5, defaultUnitId: 'katori' },
      NOW,
    );
    const results = await searchFoods(store, 'rice');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Rice');
  });

  it('empty query returns all non-archived foods', async () => {
    const store = new MemoryStore();
    await createFood(store, riceInput, NOW);
    expect(await searchFoods(store, '')).toHaveLength(1);
  });
});
