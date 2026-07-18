import type { IsoDate } from '../engine';
import type { Favorite, Food, FoodUnitOverride, LogEntry, Meal, Unit } from './types';

/** KV keys for device-local sync state (never synced to the server). */
export const KV = {
  lastSyncAt: 'foodLog:lastSyncAt',
  lastPulledAt: 'foodLog:lastPulledAt',
} as const;

export interface PendingPush {
  foods: Food[];
  entries: LogEntry[];
  favorites: Favorite[];
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
  getOverride(foodId: string, unitId: string): Promise<FoodUnitOverride | null>;

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
  markPushed(kind: 'foods' | 'entries' | 'favorites', ids: string[]): Promise<void>;
  getKV(key: string): Promise<string | null>;
  setKV(key: string, value: string): Promise<void>;
}
