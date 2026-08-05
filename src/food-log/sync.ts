import type { FoodLogRemoteStore } from './remote';
import { KV, overrideExternalId, type FoodLogStore } from './store';

export interface FoodLogSyncDeps {
  store: FoodLogStore;
  remote: FoodLogRemoteStore;
}

export interface FoodLogSyncResult {
  /** false when throttled — nothing was attempted. */
  ran: boolean;
  pushed: number;
  pulled: number;
  /** Push/pull failure (expected offline); local state is unaffected. */
  remoteError: string | null;
}

export const FOOD_LOG_SYNC_THROTTLE_MINUTES = 15;

/**
 * Food-Log Supabase sync-on-open — mirrors data-sync/sync.ts's outbox push +
 * remote pull, minus the Health Connect leg (food log has no external device
 * source). Remote failures are expected offline and never block local writes.
 *
 * The foods leg is the odd one out: it reads the shared, unfiltered
 * `food_catalog`, so it pulls foods authored by other users as well as your own,
 * and it keeps its own paging cursor (KV.lastFoodsPulledAt) because a shared
 * table can hand back more rows than one page.
 */
export async function foodLogSyncOnOpen(
  deps: FoodLogSyncDeps,
  nowUtc: string,
  opts?: { force?: boolean },
): Promise<FoodLogSyncResult> {
  const { store, remote } = deps;

  const lastSyncAt = await store.getKV(KV.lastSyncAt);
  if (
    !opts?.force &&
    lastSyncAt !== null &&
    Date.parse(nowUtc) - Date.parse(lastSyncAt) < FOOD_LOG_SYNC_THROTTLE_MINUTES * 60_000
  ) {
    return { ran: false, pushed: 0, pulled: 0, remoteError: null };
  }

  let pushed = 0;
  let pulled = 0;
  let remoteError: string | null = null;

  try {
    const myUserId = await remote.currentUserId();

    const pending = await store.listPendingPush();
    if (pending.foods.length > 0) {
      // Rows authored by someone else are filtered out inside pushFoods (the
      // catalog only lets you update your own), but they must still be cleared
      // locally or they'd be retried on every sync forever.
      await remote.pushFoods(pending.foods, myUserId);
      await store.markPushed('foods', pending.foods.map((f) => f.id));
      pushed += pending.foods.length;
    }
    if (pending.entries.length > 0) {
      await remote.pushEntries(pending.entries);
      await store.markPushed('entries', pending.entries.map((e) => e.id));
      pushed += pending.entries.length;
    }
    if (pending.favorites.length > 0) {
      await remote.pushFavorites(pending.favorites);
      await store.markPushed('favorites', pending.favorites.map((f) => f.foodId));
      pushed += pending.favorites.length;
    }
    if (pending.overrides.length > 0) {
      await remote.pushOverrides(pending.overrides);
      await store.markPushed(
        'overrides',
        pending.overrides.map((o) => overrideExternalId(o.foodId, o.unitId)),
      );
      pushed += pending.overrides.length;
    }

    const lastPulledAt = await store.getKV(KV.lastPulledAt);
    const lastFoodsPulledAt = await store.getKV(KV.lastFoodsPulledAt);

    const remoteFoods = await remote.pullFoodsSince(lastFoodsPulledAt);
    for (const row of remoteFoods) {
      const local = await store.getFood(row.id);
      if (local?.pendingPush) continue; // local unpushed edit wins over the pull
      await store.upsertFood({
        ...row,
        // archivedAt and photoLocalUri are device-local and have no server
        // column. Taking the pulled row's nulls verbatim would silently un-hide
        // every food the user archived.
        archivedAt: local?.archivedAt ?? null,
        photoLocalUri: local?.photoLocalUri ?? null,
        pendingPush: false,
      });
      pulled += 1;
    }
    // Advance to the last row we actually saw, so a catalog bigger than one page
    // keeps draining across syncs instead of skipping the remainder.
    const lastFood = remoteFoods[remoteFoods.length - 1];
    await store.setKV(KV.lastFoodsPulledAt, lastFood?.updatedAt ?? nowUtc);

    const remoteEntries = await remote.pullEntriesSince(lastPulledAt);
    for (const row of remoteEntries) {
      const local = await store.getEntry(row.id);
      if (local?.pendingPush) continue;
      await store.upsertEntry({
        ...row,
        photoLocalUri: local?.photoLocalUri ?? null,
        pendingPush: false,
      });
      pulled += 1;
    }

    const remoteFavorites = await remote.pullFavoritesSince(lastPulledAt);
    for (const row of remoteFavorites) {
      const local = await store.getFavorite(row.foodId);
      if (local?.pendingPush) continue;
      await store.upsertFavorite({ ...row, pendingPush: false });
      pulled += 1;
    }

    const remoteOverrides = await remote.pullOverridesSince(lastPulledAt);
    for (const row of remoteOverrides) {
      const local = await store.getOverride(row.foodId, row.unitId);
      if (local?.pendingPush) continue;
      await store.upsertOverride({ ...row, pendingPush: false });
      pulled += 1;
    }

    await store.setKV(KV.lastPulledAt, nowUtc);
  } catch (e) {
    remoteError = e instanceof Error ? e.message : String(e); // offline is normal; retry next sync
  }

  await store.setKV(KV.lastSyncAt, nowUtc);
  return { ran: true, pushed, pulled, remoteError };
}
