import type { IsoDate } from '../engine';
import type { Favorite, Food, FoodUnitOverride, LogEntry, Meal, Unit } from './types';

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

  insertEntry(entry: LogEntry): Promise<void>;
  deleteEntry(id: string): Promise<boolean>;
  listEntriesByDate(localDate: IsoDate): Promise<LogEntry[]>;
  listEntriesByDateMeal(localDate: IsoDate, meal: Meal): Promise<LogEntry[]>;
  /** Newest logged_at per food_id, limit N — backs listRecents. */
  listRecentFoodIds(limit: number): Promise<string[]>;

  upsertFavorite(fav: Favorite): Promise<void>;
  removeFavorite(foodId: string): Promise<void>;
  listFavorites(): Promise<Favorite[]>;

  getMarkedComplete(localDate: IsoDate): Promise<boolean>;
  setMarkedComplete(localDate: IsoDate, value: boolean): Promise<void>;
}
