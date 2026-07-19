import type { IsoDate } from '../engine';
import { DEFAULT_UNITS } from './constants';
import type { FoodLogStore, PendingPush } from './store';
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
  kv = new Map<string, string>();

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

  async upsertEntry(entry: LogEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async getEntry(id: string): Promise<LogEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async deleteEntry(id: string, deletedAtUtc: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (entry === undefined || entry.deletedAt !== null) return false;
    this.entries.set(id, { ...entry, deletedAt: deletedAtUtc, updatedAt: deletedAtUtc, pendingPush: true });
    return true;
  }

  async listEntriesByDate(localDate: IsoDate): Promise<LogEntry[]> {
    return [...this.entries.values()]
      .filter((e) => e.localDate === localDate && e.deletedAt === null)
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }

  async listEntriesByDateMeal(localDate: IsoDate, meal: Meal): Promise<LogEntry[]> {
    return (await this.listEntriesByDate(localDate)).filter((e) => e.meal === meal);
  }

  async listRecentFoodIds(limit: number): Promise<string[]> {
    const latestByFood = new Map<string, string>();
    for (const e of this.entries.values()) {
      if (e.deletedAt !== null) continue;
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

  async getFavorite(foodId: string): Promise<Favorite | null> {
    return this.favorites.get(foodId) ?? null;
  }

  async removeFavorite(foodId: string, deletedAtUtc: string): Promise<void> {
    const fav = this.favorites.get(foodId);
    if (fav === undefined) return;
    this.favorites.set(foodId, { ...fav, deletedAt: deletedAtUtc, updatedAt: deletedAtUtc, pendingPush: true });
  }

  async listFavorites(): Promise<Favorite[]> {
    return [...this.favorites.values()]
      .filter((f) => f.deletedAt === null)
      .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  }

  async getMarkedComplete(localDate: IsoDate): Promise<boolean> {
    return this.dailyFlags.get(localDate) ?? false;
  }

  async setMarkedComplete(localDate: IsoDate, value: boolean): Promise<void> {
    this.dailyFlags.set(localDate, value);
  }

  async listPendingPush(): Promise<PendingPush> {
    return {
      foods: [...this.foods.values()].filter((f) => f.pendingPush),
      entries: [...this.entries.values()].filter((e) => e.pendingPush),
      favorites: [...this.favorites.values()].filter((f) => f.pendingPush),
    };
  }

  async markPushed(kind: 'foods' | 'entries' | 'favorites', ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    if (kind === 'foods') {
      for (const [id, food] of this.foods) if (idSet.has(id)) this.foods.set(id, { ...food, pendingPush: false });
    } else if (kind === 'entries') {
      for (const [id, entry] of this.entries)
        if (idSet.has(id)) this.entries.set(id, { ...entry, pendingPush: false });
    } else {
      for (const [id, fav] of this.favorites)
        if (idSet.has(id)) this.favorites.set(id, { ...fav, pendingPush: false });
    }
  }

  async getKV(key: string): Promise<string | null> {
    return this.kv.get(key) ?? null;
  }

  async setKV(key: string, value: string): Promise<void> {
    this.kv.set(key, value);
  }

  async clearAll(): Promise<void> {
    this.foods.clear();
    this.overrides.clear();
    this.entries.clear();
    this.favorites.clear();
    this.dailyFlags.clear();
    this.kv.clear();
  }
}
