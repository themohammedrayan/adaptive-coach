import type { IsoDate } from '../engine';
import type { Favorite, Food, FoodUnitOverride, LogEntry, Meal, Unit } from './types';

/** KV keys for device-local sync state (never synced to the server). */
export const KV = {
  lastSyncAt: 'foodLog:lastSyncAt',
  lastPulledAt: 'foodLog:lastPulledAt',
  /**
   * Separate cursor for the shared food_catalog pull. It advances to the last
   * row received rather than to "now", because that table is paged and holds
   * other users' rows — one cursor for both would skip whatever didn't fit.
   */
  lastFoodsPulledAt: 'foodLog:lastFoodsPulledAt',
} as const;

export interface PendingPush {
  foods: Food[];
  entries: LogEntry[];
  favorites: Favorite[];
  overrides: FoodUnitOverride[];
}

export type PendingPushKind = keyof PendingPush;

/**
 * Overrides have a natural key (food + unit), but the server upserts on
 * `(user_id, external_id)` like every other table, so the id is derived rather
 * than stored — the same value on every device, so a re-sync updates the row
 * instead of duplicating it. Also the id form `markPushed('overrides', …)` takes.
 */
export function overrideExternalId(foodId: string, unitId: string): string {
  return `${foodId}::${unitId}`;
}

/** Inverse of overrideExternalId. Returns null for anything not in that form. */
export function parseOverrideExternalId(
  externalId: string,
): { foodId: string; unitId: string } | null {
  const sep = externalId.lastIndexOf('::');
  if (sep <= 0) return null;
  return { foodId: externalId.slice(0, sep), unitId: externalId.slice(sep + 2) };
}

/**
 * Local persistence contract. Implementations: SQLite (device), in-memory (tests/web).
 */
export interface FoodLogStore {
  upsertFood(food: Food): Promise<void>;
  getFood(id: string): Promise<Food | null>;
  listFoods(includeArchived?: boolean): Promise<Food[]>;

  listUnits(): Promise<Unit[]>;
  getUnit(id: string): Promise<Unit | null>;

  upsertOverride(o: FoodUnitOverride): Promise<void>;
  /** Including soft-deleted rows — used for sync's last-write-wins check. */
  getOverride(foodId: string, unitId: string): Promise<FoodUnitOverride | null>;
  /** Non-deleted overrides only. */
  listOverrides(): Promise<FoodUnitOverride[]>;

  /** Insert or replace by id — re-logging/re-editing the same id is always idempotent. */
  upsertEntry(entry: LogEntry): Promise<void>;
  /** By id, including soft-deleted rows — used for sync's last-write-wins check. */
  getEntry(id: string): Promise<LogEntry | null>;
  /** Marks deleted + pending push (not a hard delete — mirrors data-sync's softDelete). */
  deleteEntry(id: string, deletedAtUtc: string): Promise<boolean>;
  /** Non-deleted entries only. */
  listEntriesByDate(localDate: IsoDate): Promise<LogEntry[]>;
  listEntriesByDateMeal(localDate: IsoDate, meal: Meal): Promise<LogEntry[]>;
  /** Newest logged_at per food_id, limit N — backs listRecents. */
  listRecentFoodIds(limit: number): Promise<string[]>;

  upsertFavorite(fav: Favorite): Promise<void>;
  /** By foodId, including soft-deleted rows — used for sync's last-write-wins check. */
  getFavorite(foodId: string): Promise<Favorite | null>;
  removeFavorite(foodId: string, deletedAtUtc: string): Promise<void>;
  /** Non-deleted favorites only. */
  listFavorites(): Promise<Favorite[]>;

  getMarkedComplete(localDate: IsoDate): Promise<boolean>;
  setMarkedComplete(localDate: IsoDate, value: boolean): Promise<void>;

  listPendingPush(): Promise<PendingPush>;
  /** For 'overrides', ids are overrideExternalId() values. */
  markPushed(kind: PendingPushKind, ids: string[]): Promise<void>;
  getKV(key: string): Promise<string | null>;
  setKV(key: string, value: string): Promise<void>;

  /** Wipes foods, entries, favorites, overrides, daily flags, and sync KV — used by account reset. */
  clearAll(): Promise<void>;
}
