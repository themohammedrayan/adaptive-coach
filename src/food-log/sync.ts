import type { FoodLogRemoteStore } from './remote';
import { KV, type FoodLogStore } from './store';

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
    const pending = await store.listPendingPush();
    if (pending.foods.length > 0) {
      await remote.pushFoods(pending.foods);
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

    const lastPulledAt = await store.getKV(KV.lastPulledAt);

    const remoteFoods = await remote.pullFoodsSince(lastPulledAt);
    for (const row of remoteFoods) {
      const local = await store.getFood(row.id);
      if (local?.pendingPush) continue; // local unpushed edit wins over the pull
      await store.upsertFood({ ...row, pendingPush: false });
      pulled += 1;
    }

    const remoteEntries = await remote.pullEntriesSince(lastPulledAt);
    for (const row of remoteEntries) {
      const local = await store.getEntry(row.id);
      if (local?.pendingPush) continue;
      await store.upsertEntry({ ...row, pendingPush: false });
      pulled += 1;
    }

    const remoteFavorites = await remote.pullFavoritesSince(lastPulledAt);
    for (const row of remoteFavorites) {
      const local = await store.getFavorite(row.foodId);
      if (local?.pendingPush) continue;
      await store.upsertFavorite({ ...row, pendingPush: false });
      pulled += 1;
    }

    await store.setKV(KV.lastPulledAt, nowUtc);
  } catch (e) {
    remoteError = e instanceof Error ? e.message : String(e); // offline is normal; retry next sync
  }

  await store.setKV(KV.lastSyncAt, nowUtc);
  return { ran: true, pushed, pulled, remoteError };
}
