import { createFood } from '../foods';
import { addLogEntry } from '../entries';
import { addFavorite } from '../favorites';
import type { FoodLogRemoteStore } from '../remote';
import { FOOD_LOG_SYNC_THROTTLE_MINUTES, foodLogSyncOnOpen, type FoodLogSyncDeps } from '../sync';
import { MemoryStore } from '../store.memory';
import type { Favorite, Food, LogEntry } from '../types';

const NOW = '2026-07-15T10:00:00.000Z';
const IST = (iso: string) => iso.slice(0, 10);

class FakeRemote implements FoodLogRemoteStore {
  pushedFoods: Food[][] = [];
  pushedEntries: LogEntry[][] = [];
  pushedFavorites: Favorite[][] = [];
  pullFoods: Food[] = [];
  pullEntries: LogEntry[] = [];
  pullFavorites: Favorite[] = [];
  failing = false;

  async pushFoods(rows: Food[]) {
    if (this.failing) throw new Error('network down');
    this.pushedFoods.push(rows);
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
});
