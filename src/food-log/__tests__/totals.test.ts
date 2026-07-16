import { offsetLocalDate } from '../dates';
import { addLogEntry } from '../entries';
import { createFood } from '../foods';
import { MemoryStore } from '../store.memory';
import { dailyTotals, mealSubtotal, setMarkedComplete } from '../totals';

const IST = offsetLocalDate(330);
const DATE = '2026-07-15';

const riceInput = {
  name: 'Rice',
  proteinPer100g: 2.7,
  carbPer100g: 28,
  fatPer100g: 0.3,
  fiberPer100g: 0.4,
  defaultUnitId: 'katori',
};

const dalInput = {
  name: 'Dal',
  proteinPer100g: 9,
  carbPer100g: 20,
  fatPer100g: 0.5,
  fiberPer100g: 5,
  defaultUnitId: 'katori',
};

async function seedThreeEntries(store: MemoryStore) {
  const rice = await createFood(store, riceInput, '2026-07-14T00:00:00.000Z');
  const dal = await createFood(store, dalInput, '2026-07-14T00:00:00.000Z');
  await addLogEntry(
    store,
    { foodId: rice.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: `${DATE}T07:00:00.000Z` },
    IST,
  );
  await addLogEntry(
    store,
    { foodId: dal.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: `${DATE}T07:05:00.000Z` },
    IST,
  );
  await addLogEntry(
    store,
    { foodId: rice.id, meal: 'dinner', quantity: 2, unitId: 'katori', loggedAt: `${DATE}T13:00:00.000Z` },
    IST,
  );
}

describe('mealSubtotal / dailyTotals — Food-Log BRD §10 AT3', () => {
  it('day == Σ meals == Σ entries, with kcal = 4P+4C+9F at every level, no drift', async () => {
    const store = new MemoryStore();
    await seedThreeEntries(store);

    const lunch = await mealSubtotal(store, DATE, 'lunch');
    const dinner = await mealSubtotal(store, DATE, 'dinner');
    const day = await dailyTotals(store, DATE);

    expect(lunch.entryCount).toBe(2);
    expect(dinner.entryCount).toBe(1);
    expect(day.entryCount).toBe(3);

    expect(day.kcal).toBeCloseTo(lunch.kcal + dinner.kcal);
    expect(day.protein).toBeCloseTo(lunch.protein + dinner.protein);
    expect(day.carb).toBeCloseTo(lunch.carb + dinner.carb);
    expect(day.fat).toBeCloseTo(lunch.fat + dinner.fat);

    expect(day.kcal).toBeCloseTo(4 * day.protein + 4 * day.carb + 9 * day.fat);
    expect(lunch.kcal).toBeCloseTo(4 * lunch.protein + 4 * lunch.carb + 9 * lunch.fat);
  });
});

describe('dailyTotals — macros-incomplete flag (Food-Log BRD §10 AT5)', () => {
  it('a kcal-only entry still counts calories but flags macrosIncomplete', async () => {
    const store = new MemoryStore();
    const snack = await createFood(
      store,
      {
        name: 'Mystery bar',
        proteinPer100g: null,
        carbPer100g: null,
        fatPer100g: null,
        fiberPer100g: null,
        kcalPer100g: 300,
        defaultUnitId: 'piece',
      },
      '2026-07-14T00:00:00.000Z',
    );
    await addLogEntry(
      store,
      { foodId: snack.id, meal: 'snack', quantity: 1, unitId: 'piece', loggedAt: `${DATE}T07:00:00.000Z` },
      IST,
    );

    const day = await dailyTotals(store, DATE);
    expect(day.kcal).toBeGreaterThan(0);
    expect(day.macrosIncomplete).toBe(true);
  });

  it('macrosIncomplete is false when every entry has full macros', async () => {
    const store = new MemoryStore();
    await seedThreeEntries(store);
    const day = await dailyTotals(store, DATE);
    expect(day.macrosIncomplete).toBe(false);
  });
});

describe('dailyTotals — logged flag (Food-Log BRD §8, §10 AT6)', () => {
  it('≥1 entry → logged=true', async () => {
    const store = new MemoryStore();
    await seedThreeEntries(store);
    expect((await dailyTotals(store, DATE)).logged).toBe(true);
  });

  it('empty day → logged=false', async () => {
    const store = new MemoryStore();
    expect((await dailyTotals(store, '2026-07-20')).logged).toBe(false);
  });
});

describe('setMarkedComplete', () => {
  it('persists independently of entries and is not derived from them', async () => {
    const store = new MemoryStore();
    expect((await dailyTotals(store, DATE)).markedComplete).toBe(false);
    await setMarkedComplete(store, DATE, true);
    expect((await dailyTotals(store, DATE)).markedComplete).toBe(true);
  });
});
