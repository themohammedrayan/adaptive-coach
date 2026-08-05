import { archiveFood, createFood } from '../foods';
import { addLogEntry } from '../entries';
import { addFavorite } from '../favorites';
import type { FoodLogRemoteStore } from '../remote';
import { FOOD_LOG_SYNC_THROTTLE_MINUTES, foodLogSyncOnOpen, type FoodLogSyncDeps } from '../sync';
import { KV } from '../store';
import { MemoryStore } from '../store.memory';
import type { Favorite, Food, FoodUnitOverride, LogEntry } from '../types';

const NOW = '2026-07-15T10:00:00.000Z';
const IST = (iso: string) => iso.slice(0, 10);
const MY_USER_ID = 'user-me';
const OTHER_USER_ID = 'user-someone-else';

class FakeRemote implements FoodLogRemoteStore {
  pushedFoods: Food[][] = [];
  pushedEntries: LogEntry[][] = [];
  pushedFavorites: Favorite[][] = [];
  pushedOverrides: FoodUnitOverride[][] = [];
  pullFoods: Food[] = [];
  pullEntries: LogEntry[] = [];
  pullFavorites: Favorite[] = [];
  pullOverrides: FoodUnitOverride[] = [];
  failing = false;
  userId: string | null = MY_USER_ID;

  async currentUserId() {
    return this.userId;
  }
  /** Mirrors SupabaseRemote: rows authored by someone else are never sent. */
  async pushFoods(rows: Food[], myUserId: string | null) {
    if (this.failing) throw new Error('network down');
    this.pushedFoods.push(rows.filter((f) => f.createdBy === null || f.createdBy === myUserId));
  }
  async pullFoodsSince() {
    if (this.failing) throw new Error('network down');
    return this.pullFoods;
  }
  async pushEntries(rows: LogEntry[]) {
    if (this.failing) throw new Error('network down');
    this.pushedEntries.push(rows);
  }
  async pullEntriesSince() {
    if (this.failing) throw new Error('network down');
    return this.pullEntries;
  }
  async pushFavorites(rows: Favorite[]) {
    if (this.failing) throw new Error('network down');
    this.pushedFavorites.push(rows);
  }
  async pullFavoritesSince() {
    if (this.failing) throw new Error('network down');
    return this.pullFavorites;
  }
  async pushOverrides(rows: FoodUnitOverride[]) {
    if (this.failing) throw new Error('network down');
    this.pushedOverrides.push(rows);
  }
  async pullOverridesSince() {
    if (this.failing) throw new Error('network down');
    return this.pullOverrides;
  }
}

function makeDeps(): { deps: FoodLogSyncDeps; store: MemoryStore; remote: FakeRemote } {
  const store = new MemoryStore();
  const remote = new FakeRemote();
  return { deps: { store, remote }, store, remote };
}

const riceInput = {
  name: 'Rice',
  proteinPer100g: 2.7,
  carbPer100g: 28,
  fatPer100g: 0.3,
  fiberPer100g: 0.4,
  defaultUnitId: 'katori',
};

describe('foodLogSyncOnOpen — throttle', () => {
  it(`throttles within ${FOOD_LOG_SYNC_THROTTLE_MINUTES} minutes; force bypasses`, async () => {
    const { deps } = makeDeps();
    await foodLogSyncOnOpen(deps, NOW);
    const again = await foodLogSyncOnOpen(deps, '2026-07-15T10:10:00.000Z');
    expect(again.ran).toBe(false);
    const forced = await foodLogSyncOnOpen(deps, '2026-07-15T10:10:00.000Z', { force: true });
    expect(forced.ran).toBe(true);
    const later = await foodLogSyncOnOpen(deps, '2026-07-15T10:26:00.000Z');
    expect(later.ran).toBe(true);
  });
});

describe('foodLogSyncOnOpen — outbox push', () => {
  it('pushes pending foods, entries, and favorites, then clears the outbox', async () => {
    const { deps, store, remote } = makeDeps();
    const food = await createFood(store, riceInput, NOW);
    const entry = await addLogEntry(store, { foodId: food.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: NOW }, IST);
    await addFavorite(store, food.id, null, NOW);

    const res = await foodLogSyncOnOpen(deps, NOW);
    expect(res.pushed).toBe(3); // food + entry + favorite
    expect(remote.pushedFoods[0].map((f) => f.id)).toEqual([food.id]);
    expect(remote.pushedEntries[0].map((e) => e.id)).toEqual([entry.id]);
    expect(remote.pushedFavorites[0].map((f) => f.foodId)).toEqual([food.id]);

    const pending = await store.listPendingPush();
    expect(pending.foods).toHaveLength(0);
    expect(pending.entries).toHaveLength(0);
    expect(pending.favorites).toHaveLength(0);
  });

  it('a soft-deleted entry is pushed as a deletion, not removed from the outbox check', async () => {
    const { deps, store, remote } = makeDeps();
    const food = await createFood(store, riceInput, NOW);
    const entry = await addLogEntry(store, { foodId: food.id, meal: 'lunch', quantity: 1, unitId: 'katori', loggedAt: NOW }, IST);
    await foodLogSyncOnOpen(deps, NOW); // first sync clears the initial outbox

    await store.deleteEntry(entry.id, '2026-07-15T11:00:00.000Z');
    const res = await foodLogSyncOnOpen(deps, '2026-07-15T10:31:00.000Z', { force: true });
    expect(res.pushed).toBe(1);
    expect(remote.pushedEntries.at(-1)![0].deletedAt).toBe('2026-07-15T11:00:00.000Z');
  });

  it('remote failure leaves the outbox intact and is reported, not thrown', async () => {
    const { deps, store, remote } = makeDeps();
    remote.failing = true;
    await createFood(store, riceInput, NOW);
    const res = await foodLogSyncOnOpen(deps, NOW);
    expect(res.remoteError).toBe('network down');
    const pending = await store.listPendingPush();
    expect(pending.foods).toHaveLength(1); // retried next sync
  });
});

describe('foodLogSyncOnOpen — pull', () => {
  it('pull upserts remote rows but never clobbers a pending local edit', async () => {
    const { deps, store, remote } = makeDeps();
    const food = await createFood(store, riceInput, NOW); // still pendingPush locally

    remote.pullFoods = [{ ...food, name: 'Stale server name', pendingPush: false }];
    // push fails so `food` stays pending, but the pull still runs
    remote.pushFoods = async () => {
      throw new Error('push down');
    };

    const res = await foodLogSyncOnOpen(deps, NOW);
    expect(res.remoteError).toBe('push down');
    expect((await store.getFood(food.id))!.name).toBe('Rice'); // not clobbered by the stale pull
  });

  it('pull upserts a favorite that only exists remotely', async () => {
    const { deps, store, remote } = makeDeps();
    remote.pullFavorites = [
      { foodId: 'remote-food', mealHint: null, addedAt: NOW, deletedAt: null, updatedAt: NOW, pendingPush: false },
    ];
    await foodLogSyncOnOpen(deps, NOW);
    const favs = await store.listFavorites();
    expect(favs.map((f) => f.foodId)).toEqual(['remote-food']);
  });

  it('pulls overrides so a reinstall gets back how big your katori is', async () => {
    const { deps, store, remote } = makeDeps();
    remote.pullOverrides = [
      { foodId: 'dal', unitId: 'katori', grams: 120, deletedAt: null, updatedAt: NOW, pendingPush: false },
    ];
    await foodLogSyncOnOpen(deps, NOW);
    expect((await store.getOverride('dal', 'katori'))!.grams).toBe(120);
  });
});

describe('foodLogSyncOnOpen — shared catalog', () => {
  it('ingests a food authored by another user, because the catalog is universal', async () => {
    const { deps, store, remote } = makeDeps();
    remote.pullFoods = [
      {
        id: 'catalog-poha',
        name: 'Poha',
        proteinPer100g: 2.6,
        carbPer100g: 26,
        fatPer100g: 4.5,
        fiberPer100g: 1,
        kcalPer100g: 155,
        defaultUnitId: 'katori',
        macrosComplete: true,
        source: 'manual',
        createdBy: OTHER_USER_ID,
        photoPath: null,
        photoLocalUri: null,
        createdAt: NOW,
        archivedAt: null,
        updatedAt: NOW,
        pendingPush: false,
      },
    ];

    await foodLogSyncOnOpen(deps, NOW);

    const poha = await store.getFood('catalog-poha');
    expect(poha!.name).toBe('Poha');
    expect(poha!.createdBy).toBe(OTHER_USER_ID);
  });

  it("never pushes another user's catalog row back, and still clears it from the outbox", async () => {
    const { deps, store, remote } = makeDeps();
    const mine = await createFood(store, { ...riceInput, createdBy: MY_USER_ID }, NOW);
    const theirs = await createFood(store, { ...riceInput, name: 'Poha', createdBy: OTHER_USER_ID }, NOW);

    await foodLogSyncOnOpen(deps, NOW);

    expect(remote.pushedFoods[0].map((f) => f.id)).toEqual([mine.id]);
    // Left pending it would be retried on every sync for the rest of time.
    const pending = await store.listPendingPush();
    expect(pending.foods).toHaveLength(0);
    expect((await store.getFood(theirs.id))!.pendingPush).toBe(false);
  });

  it('a pull never un-hides a food the user archived — archivedAt is local-only', async () => {
    const { deps, store, remote } = makeDeps();
    const food = await createFood(store, { ...riceInput, createdBy: MY_USER_ID }, NOW);
    await foodLogSyncOnOpen(deps, NOW);
    await archiveFood(store, food.id, '2026-07-15T11:00:00.000Z');

    // The server has no archived_at column, so every pulled row says null.
    remote.pullFoods = [{ ...food, archivedAt: null, pendingPush: false }];
    await foodLogSyncOnOpen(deps, '2026-07-15T10:31:00.000Z', { force: true });

    expect((await store.getFood(food.id))!.archivedAt).toBe('2026-07-15T11:00:00.000Z');
    expect(await store.listFoods()).toHaveLength(0);
  });

  it('advances the catalog cursor to the last row seen, so a paged catalog keeps draining', async () => {
    const { deps, store, remote } = makeDeps();
    remote.pullFoods = [
      { ...(await createFood(store, riceInput, NOW)), updatedAt: '2026-07-15T09:00:00.000Z', pendingPush: false },
      { ...(await createFood(store, { ...riceInput, name: 'Dal' }, NOW)), updatedAt: '2026-07-15T09:30:00.000Z', pendingPush: false },
    ];

    await foodLogSyncOnOpen(deps, NOW);

    expect(await store.getKV(KV.lastFoodsPulledAt)).toBe('2026-07-15T09:30:00.000Z');
  });

  it('falls back to now for the catalog cursor when the pull came back empty', async () => {
    const { deps, store } = makeDeps();
    await foodLogSyncOnOpen(deps, NOW);
    expect(await store.getKV(KV.lastFoodsPulledAt)).toBe(NOW);
  });
});
