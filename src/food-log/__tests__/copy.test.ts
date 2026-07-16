import { copyDay, copyMeal } from '../copy';
import { offsetLocalDate } from '../dates';
import { addLogEntry, listLogEntries } from '../entries';
import { createFood } from '../foods';
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

describe('copyDay — Food-Log BRD §7, §10 AT7', () => {
  it('duplicates entries to today with fresh timestamps, source untouched', async () => {
    const store = new MemoryStore();
    const rice = await createFood(store, riceInput, '2026-07-14T00:00:00.000Z');
    await addLogEntry(
      store,
      { foodId: rice.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: '2026-07-14T07:00:00.000Z' },
      IST,
    );
    await addLogEntry(
      store,
      { foodId: rice.id, meal: 'dinner', quantity: 2, unitId: 'katori', loggedAt: '2026-07-14T13:00:00.000Z' },
      IST,
    );

    const copied = await copyDay(store, '2026-07-14', '2026-07-15', '2026-07-15T09:00:00.000Z');
    expect(copied).toHaveLength(2);
    for (const entry of copied) {
      expect(entry.localDate).toBe('2026-07-15');
      expect(entry.loggedAt).toBe('2026-07-15T09:00:00.000Z');
    }

    const yesterday = await listLogEntries(store, '2026-07-14');
    const today = await listLogEntries(store, '2026-07-15');
    expect(yesterday).toHaveLength(2); // source untouched
    expect(today).toHaveLength(2);
    expect(today.map((e) => e.kcal).sort()).toEqual(yesterday.map((e) => e.kcal).sort());
  });

  it('copied entries get fresh ids, distinct from the originals', async () => {
    const store = new MemoryStore();
    const rice = await createFood(store, riceInput, '2026-07-14T00:00:00.000Z');
    const original = await addLogEntry(
      store,
      { foodId: rice.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: '2026-07-14T07:00:00.000Z' },
      IST,
    );
    const [copied] = await copyDay(store, '2026-07-14', '2026-07-15', '2026-07-15T09:00:00.000Z');
    expect(copied.id).not.toBe(original.id);
  });
});

describe('copyMeal', () => {
  it('duplicates only the given meal', async () => {
    const store = new MemoryStore();
    const rice = await createFood(store, riceInput, '2026-07-14T00:00:00.000Z');
    await addLogEntry(
      store,
      { foodId: rice.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: '2026-07-14T07:00:00.000Z' },
      IST,
    );
    await addLogEntry(
      store,
      { foodId: rice.id, meal: 'dinner', quantity: 2, unitId: 'katori', loggedAt: '2026-07-14T13:00:00.000Z' },
      IST,
    );

    const copied = await copyMeal(store, '2026-07-14', 'lunch', '2026-07-15', '2026-07-15T09:00:00.000Z');
    expect(copied).toHaveLength(1);
    expect(copied[0].meal).toBe('lunch');
    expect(await listLogEntries(store, '2026-07-15')).toHaveLength(1);
  });
});
