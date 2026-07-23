import { computeGrams } from '../grams';
import { MemoryStore } from '../store.memory';
import type { FoodUnitOverride, Unit } from '../types';
import { resolveGrams, setFoodUnitOverride } from '../units';

const katori: Unit = { id: 'katori', name: 'katori', defaultGrams: 150 };

describe('computeGrams — Food-Log BRD §10 AT2', () => {
  it('uses the unit default when there is no override', () => {
    expect(computeGrams(katori, 1, null)).toBe(150);
  });

  it('1 katori dal, override 120g → resolves from the override, not the default', () => {
    const override: FoodUnitOverride = { foodId: 'dal', unitId: 'katori', grams: 120 };
    expect(computeGrams(katori, 1, override)).toBe(120);
  });

  it('scales linearly with quantity', () => {
    const override: FoodUnitOverride = { foodId: 'dal', unitId: 'katori', grams: 120 };
    expect(computeGrams(katori, 2, override)).toBe(240);
  });
});

describe('resolveGrams / setFoodUnitOverride — Food-Log BRD §10 AT2 (store-aware)', () => {
  it('1 katori dal, override 120g → macros scale ×1.2 relative to the 100g default', async () => {
    const store = new MemoryStore();
    await setFoodUnitOverride(store, 'dal', 'katori', 120);
    const grams = await resolveGrams(store, 'dal', 'katori', 1);
    expect(grams).toBe(120);
    expect(grams / 100).toBeCloseTo(1.2);
  });

  it('falls back to the unit default when no override exists for this food', async () => {
    const store = new MemoryStore();
    const grams = await resolveGrams(store, 'rice', 'katori', 1);
    expect(grams).toBe(150); // DEFAULT_UNITS seed value
  });

  it('resolves ml at 1g per ml by default, for logging juices/liquids', async () => {
    const store = new MemoryStore();
    const grams = await resolveGrams(store, 'juice', 'ml', 250);
    expect(grams).toBe(250);
  });

  it('throws for an unknown unit id', async () => {
    const store = new MemoryStore();
    await expect(resolveGrams(store, 'rice', 'no-such-unit', 1)).rejects.toThrow();
  });
});
