import { offsetLocalDate } from '../dates';
import { addLogEntry } from '../entries';
import { addFavorite, listFavorites, listRecents, removeFavorite } from '../favorites';
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

const dalInput = {
  name: 'Dal',
  proteinPer100g: 9,
  carbPer100g: 20,
  fatPer100g: 0.5,
  fiberPer100g: 5,
  defaultUnitId: 'katori',
};

describe('favorites', () => {
  it('adds, lists, and removes favorites, resolved to Food records', async () => {
    const store = new MemoryStore();
    const rice = await createFood(store, riceInput, '2026-07-14T00:00:00.000Z');
    await addFavorite(store, rice.id, 'lunch', '2026-07-14T00:00:00.000Z');

    let favs = await listFavorites(store);
    expect(favs).toHaveLength(1);
    expect(favs[0].name).toBe('Rice');

    await removeFavorite(store, rice.id);
    favs = await listFavorites(store);
    expect(favs).toHaveLength(0);
  });
});

describe('listRecents', () => {
  it('returns distinct foods ordered by most recently logged, deduped', async () => {
    const store = new MemoryStore();
    const rice = await createFood(store, riceInput, '2026-07-14T00:00:00.000Z');
    const dal = await createFood(store, dalInput, '2026-07-14T00:00:00.000Z');

    await addLogEntry(
      store,
      { foodId: rice.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: '2026-07-15T07:00:00.000Z' },
      IST,
    );
    await addLogEntry(
      store,
      { foodId: dal.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: '2026-07-15T08:00:00.000Z' },
      IST,
    );
    await addLogEntry(
      store,
      { foodId: rice.id, meal: 'dinner', quantity: 1, unitId: 'katori', loggedAt: '2026-07-15T13:00:00.000Z' },
      IST,
    );

    const recents = await listRecents(store, 5);
    expect(recents.map((f) => f.name)).toEqual(['Rice', 'Dal']); // rice re-logged most recently
  });

  it('respects the limit', async () => {
    const store = new MemoryStore();
    const rice = await createFood(store, riceInput, '2026-07-14T00:00:00.000Z');
    const dal = await createFood(store, dalInput, '2026-07-14T00:00:00.000Z');
    await addLogEntry(
      store,
      { foodId: rice.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: '2026-07-15T07:00:00.000Z' },
      IST,
    );
    await addLogEntry(
      store,
      { foodId: dal.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: '2026-07-15T08:00:00.000Z' },
      IST,
    );
    expect(await listRecents(store, 1)).toHaveLength(1);
  });
});
