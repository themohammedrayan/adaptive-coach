import { offsetLocalDate } from '../dates';
import { addLogEntry, deleteLogEntry, editLogEntry, listLogEntries } from '../entries';
import { archiveFood, createFood } from '../foods';
import { MemoryStore } from '../store.memory';

const IST = offsetLocalDate(330);

const riceInput = {
  name: 'Rice',
  proteinPer100g: 2.7,
  carbPer100g: 28,
  fatPer100g: 0.3,
  fiberPer100g: 0.4,
  defaultUnitId: 'katori',
};

describe('addLogEntry — snapshot immutability (Food-Log BRD §5, §10 AT4)', () => {
  it('editing a food after logging does not change the earlier entry', async () => {
    const store = new MemoryStore();
    const food = await createFood(store, riceInput, '2026-07-15T00:00:00.000Z');

    const entry = await addLogEntry(
      store,
      {
        foodId: food.id,
        meal: 'lunch',
        quantity: 1,
        unitId: 'katori',
        loggedAt: '2026-07-15T12:00:00.000Z',
      },
      IST,
    );
    const originalKcal = entry.kcal;
    const originalProtein = entry.protein;

    await store.upsertFood({
      ...food,
      proteinPer100g: 99,
      carbPer100g: 99,
      fatPer100g: 99,
      kcalPer100g: 999,
    });

    const [reloaded] = await listLogEntries(store, entry.localDate);
    expect(reloaded.kcal).toBe(originalKcal);
    expect(reloaded.protein).toBe(originalProtein);
  });
});

describe('addLogEntry — grams resolution and local-day mapping', () => {
  it('resolves grams via the unit default and maps loggedAt to the local calendar day', async () => {
    const store = new MemoryStore();
    const food = await createFood(store, riceInput, '2026-07-15T00:00:00.000Z');
    const entry = await addLogEntry(
      store,
      {
        foodId: food.id,
        meal: 'breakfast',
        quantity: 1,
        unitId: 'katori',
        loggedAt: '2026-07-15T20:00:00.000Z', // 20:00 UTC + 5:30 -> next local day
      },
      IST,
    );
    expect(entry.grams).toBe(150);
    expect(entry.localDate).toBe('2026-07-16');
  });

  it('throws for an unknown food', async () => {
    const store = new MemoryStore();
    await expect(
      addLogEntry(
        store,
        {
          foodId: 'nope',
          meal: 'lunch',
          quantity: 1,
          unitId: 'katori',
          loggedAt: '2026-07-15T12:00:00.000Z',
        },
        IST,
      ),
    ).rejects.toThrow();
  });
});

describe('deleteLogEntry', () => {
  it('removes an entry; returns false for an unknown id', async () => {
    const store = new MemoryStore();
    const food = await createFood(store, riceInput, '2026-07-15T00:00:00.000Z');
    const entry = await addLogEntry(
      store,
      {
        foodId: food.id,
        meal: 'lunch',
        quantity: 1,
        unitId: 'katori',
        loggedAt: '2026-07-15T12:00:00.000Z',
      },
      IST,
    );
    expect(await deleteLogEntry(store, entry.id)).toBe(true);
    expect(await listLogEntries(store, entry.localDate)).toHaveLength(0);
    expect(await deleteLogEntry(store, 'missing')).toBe(false);
  });
});

describe('editLogEntry — rescales the snapshot, preserves identity (Food-Log BRD §5)', () => {
  const logRice = async (store: MemoryStore) => {
    const food = await createFood(store, riceInput, '2026-07-15T00:00:00.000Z');
    const entry = await addLogEntry(
      store,
      {
        foodId: food.id,
        meal: 'lunch',
        quantity: 1,
        unitId: 'katori',
        loggedAt: '2026-07-15T12:00:00.000Z',
      },
      IST,
    );
    return { food, entry };
  };

  it('scales kcal and macros by the grams ratio when quantity changes', async () => {
    const store = new MemoryStore();
    const { entry } = await logRice(store);

    const updated = await editLogEntry(store, entry, { quantity: 2, unitId: 'katori' });

    expect(updated.grams).toBe(300);
    expect(updated.kcal).toBeCloseTo(entry.kcal * 2);
    expect(updated.protein).toBeCloseTo((entry.protein as number) * 2);
    expect(updated.fiber).toBeCloseTo((entry.fiber as number) * 2);
  });

  it('resolves grams for a changed unit', async () => {
    const store = new MemoryStore();
    const { entry } = await logRice(store);

    const updated = await editLogEntry(store, entry, { quantity: 3, unitId: 'tbsp' });

    expect(updated.grams).toBe(45); // 3 × 15g tbsp
    expect(updated.kcal).toBeCloseTo(entry.kcal * (45 / 150));
  });

  it('keeps id, meal, loggedAt and localDate; the store holds one updated row', async () => {
    const store = new MemoryStore();
    const { entry } = await logRice(store);

    const updated = await editLogEntry(store, entry, { quantity: 2, unitId: 'katori' });

    expect(updated.id).toBe(entry.id);
    expect(updated.meal).toBe(entry.meal);
    expect(updated.loggedAt).toBe(entry.loggedAt);
    expect(updated.localDate).toBe(entry.localDate);
    const rows = await listLogEntries(store, entry.localDate);
    expect(rows).toHaveLength(1);
    expect(rows[0].grams).toBe(300);
  });

  it('does not re-read the Food — editing after the food changed still scales the old snapshot', async () => {
    const store = new MemoryStore();
    const { food, entry } = await logRice(store);

    await store.upsertFood({ ...food, proteinPer100g: 99, carbPer100g: 99, fatPer100g: 99, kcalPer100g: 999 });
    const updated = await editLogEntry(store, entry, { quantity: 2, unitId: 'katori' });

    expect(updated.kcal).toBeCloseTo(entry.kcal * 2);
    expect(updated.protein).toBeCloseTo((entry.protein as number) * 2);
  });

  it('kcal-only entries keep null macros after an edit', async () => {
    const store = new MemoryStore();
    const food = await createFood(
      store,
      {
        name: 'Mystery curry',
        proteinPer100g: null,
        carbPer100g: null,
        fatPer100g: null,
        fiberPer100g: null,
        kcalPer100g: 240,
        defaultUnitId: 'katori',
      },
      '2026-07-15T00:00:00.000Z',
    );
    const entry = await addLogEntry(
      store,
      {
        foodId: food.id,
        meal: 'dinner',
        quantity: 1,
        unitId: 'katori',
        loggedAt: '2026-07-15T14:00:00.000Z',
      },
      IST,
    );

    const updated = await editLogEntry(store, entry, { quantity: 2, unitId: 'katori' });

    expect(updated.kcal).toBeCloseTo(entry.kcal * 2);
    expect(updated.protein).toBeNull();
    expect(updated.carb).toBeNull();
    expect(updated.fat).toBeNull();
    expect(updated.fiber).toBeNull();
  });
});

describe('archiveFood retains history — Food-Log BRD §10 AT8', () => {
  it('a logged entry survives archiving its food', async () => {
    const store = new MemoryStore();
    const food = await createFood(store, riceInput, '2026-07-15T00:00:00.000Z');
    const entry = await addLogEntry(
      store,
      {
        foodId: food.id,
        meal: 'lunch',
        quantity: 1,
        unitId: 'katori',
        loggedAt: '2026-07-15T12:00:00.000Z',
      },
      IST,
    );

    await archiveFood(store, food.id, '2026-07-16T00:00:00.000Z');

    const [reloaded] = await listLogEntries(store, entry.localDate);
    expect(reloaded).toBeDefined();
    expect(reloaded.kcal).toBe(entry.kcal);
  });
});
