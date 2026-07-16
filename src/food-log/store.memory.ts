import type { IsoDate } from '../engine';
import { DEFAULT_UNITS } from './constants';
import type { FoodLogStore } from './store';
import type { Favorite, Food, FoodUnitOverride, LogEntry, Meal, Unit } from './types';

function overrideKey(foodId: string, unitId: string): string {
  return `${foodId}:${unitId}`;
}

/** In-memory store for tests (and web runtime). Mirrors the SQLite implementation's semantics. */
export class MemoryStore implements FoodLogStore {
  foods = new Map<string, Food>();
  units = new Map<string, Unit>(DEFAULT_UNITS.map((u) => [u.id, u]));
  overrides = new Map<string, FoodUnitOverride>();
  entries = new Map<string, LogEntry>();
  favorites = new Map<string, Favorite>();
  dailyFlags = new Map<IsoDate, boolean>();

  async upsertFood(food: Food): Promise<void> {
    this.foods.set(food.id, food);
  }

  async getFood(id: string): Promise<Food | null> {
    return this.foods.get(id) ?? null;
  }

  async listFoods(includeArchived = false): Promise<Food[]> {
    return [...this.foods.values()].filter((f) => includeArchived || f.archivedAt === null);
  }

  async listUnits(): Promise<Unit[]> {
    return [...this.units.values()];
  }

  async getUnit(id: string): Promise<Unit | null> {
    return this.units.get(id) ?? null;
  }

  async upsertOverride(o: FoodUnitOverride): Promise<void> {
    this.overrides.set(overrideKey(o.foodId, o.unitId), o);
  }

  async getOverride(foodId: string, unitId: string): Promise<FoodUnitOverride | null> {
    return this.overrides.get(overrideKey(foodId, unitId)) ?? null;
  }

  async insertEntry(entry: LogEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async deleteEntry(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async listEntriesByDate(localDate: IsoDate): Promise<LogEntry[]> {
    return [...this.entries.values()]
      .filter((e) => e.localDate === localDate)
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }

  async listEntriesByDateMeal(localDate: IsoDate, meal: Meal): Promise<LogEntry[]> {
    return (await this.listEntriesByDate(localDate)).filter((e) => e.meal === meal);
  }

  async listRecentFoodIds(limit: number): Promise<string[]> {
    const latestByFood = new Map<string, string>();
    for (const e of this.entries.values()) {
      const prev = latestByFood.get(e.foodId);
      if (!prev || e.loggedAt > prev) latestByFood.set(e.foodId, e.loggedAt);
    }
    return [...latestByFood.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, limit)
      .map(([foodId]) => foodId);
  }

  async upsertFavorite(fav: Favorite): Promise<void> {
    this.favorites.set(fav.foodId, fav);
  }

  async removeFavorite(foodId: string): Promise<void> {
    this.favorites.delete(foodId);
  }

  async listFavorites(): Promise<Favorite[]> {
    return [...this.favorites.values()].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  }

  async getMarkedComplete(localDate: IsoDate): Promise<boolean> {
    return this.dailyFlags.get(localDate) ?? false;
  }

  async setMarkedComplete(localDate: IsoDate, value: boolean): Promise<void> {
    this.dailyFlags.set(localDate, value);
  }
}
