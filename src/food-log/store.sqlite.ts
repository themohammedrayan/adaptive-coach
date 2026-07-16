import * as SQLite from 'expo-sqlite';
import type { IsoDate } from '../engine';
import { DEFAULT_UNITS } from './constants';
import type { FoodLogStore } from './store';
import type { Favorite, Food, FoodUnitOverride, LogEntry, Meal, Unit } from './types';

interface FoodRow {
  id: string;
  name: string;
  protein_per_100g: number | null;
  carb_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
  kcal_per_100g: number;
  default_unit_id: string;
  macros_complete: number;
  is_custom: number;
  created_at: string;
  archived_at: string | null;
}

function foodFromDb(r: FoodRow): Food {
  return {
    id: r.id,
    name: r.name,
    proteinPer100g: r.protein_per_100g,
    carbPer100g: r.carb_per_100g,
    fatPer100g: r.fat_per_100g,
    fiberPer100g: r.fiber_per_100g,
    kcalPer100g: r.kcal_per_100g,
    defaultUnitId: r.default_unit_id,
    macrosComplete: r.macros_complete === 1,
    isCustom: true,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
  };
}

interface EntryRow {
  id: string;
  food_id: string;
  meal: string;
  quantity: number;
  unit_id: string;
  grams: number;
  logged_at: string;
  local_date: string;
  kcal: number;
  protein: number | null;
  carb: number | null;
  fat: number | null;
  fiber: number | null;
}

function entryFromDb(r: EntryRow): LogEntry {
  return {
    id: r.id,
    foodId: r.food_id,
    meal: r.meal as Meal,
    quantity: r.quantity,
    unitId: r.unit_id,
    grams: r.grams,
    loggedAt: r.logged_at,
    localDate: r.local_date,
    kcal: r.kcal,
    protein: r.protein,
    carb: r.carb,
    fat: r.fat,
    fiber: r.fiber,
  };
}

export class SQLiteStore implements FoodLogStore {
  private constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(name = 'adaptive-coach.db'): Promise<SQLiteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync(`
      pragma journal_mode = wal;

      create table if not exists units (
        id text primary key,
        name text not null,
        default_grams real not null
      );

      create table if not exists foods (
        id text primary key,
        name text not null,
        protein_per_100g real,
        carb_per_100g real,
        fat_per_100g real,
        fiber_per_100g real,
        kcal_per_100g real not null,
        default_unit_id text not null references units(id),
        macros_complete integer not null default 1,
        is_custom integer not null default 1,
        created_at text not null,
        archived_at text
      );
      create index if not exists foods_name_idx on foods (name);

      create table if not exists food_unit_overrides (
        food_id text not null references foods(id),
        unit_id text not null references units(id),
        grams real not null,
        primary key (food_id, unit_id)
      );

      create table if not exists log_entries (
        id text primary key,
        food_id text not null references foods(id),
        meal text not null,
        quantity real not null,
        unit_id text not null references units(id),
        grams real not null,
        logged_at text not null,
        local_date text not null,
        kcal real not null,
        protein real,
        carb real,
        fat real,
        fiber real
      );
      create index if not exists log_entries_date_meal_idx on log_entries (local_date, meal);
      create index if not exists log_entries_food_idx on log_entries (food_id, logged_at desc);

      create table if not exists favorites (
        food_id text primary key references foods(id),
        meal_hint text,
        added_at text not null
      );

      create table if not exists daily_flags (
        local_date text primary key,
        marked_complete integer not null default 0
      );
    `);
    const store = new SQLiteStore(db);
    await store.seedUnits();
    return store;
  }

  private async seedUnits(): Promise<void> {
    for (const u of DEFAULT_UNITS) {
      await this.db.runAsync(
        'insert or ignore into units (id, name, default_grams) values (?, ?, ?)',
        u.id,
        u.name,
        u.defaultGrams,
      );
    }
  }

  async upsertFood(food: Food): Promise<void> {
    await this.db.runAsync(
      `insert into foods
         (id, name, protein_per_100g, carb_per_100g, fat_per_100g, fiber_per_100g,
          kcal_per_100g, default_unit_id, macros_complete, is_custom, created_at, archived_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         name = excluded.name,
         protein_per_100g = excluded.protein_per_100g,
         carb_per_100g = excluded.carb_per_100g,
         fat_per_100g = excluded.fat_per_100g,
         fiber_per_100g = excluded.fiber_per_100g,
         kcal_per_100g = excluded.kcal_per_100g,
         default_unit_id = excluded.default_unit_id,
         macros_complete = excluded.macros_complete,
         archived_at = excluded.archived_at`,
      food.id,
      food.name,
      food.proteinPer100g,
      food.carbPer100g,
      food.fatPer100g,
      food.fiberPer100g,
      food.kcalPer100g,
      food.defaultUnitId,
      food.macrosComplete ? 1 : 0,
      food.isCustom ? 1 : 0,
      food.createdAt,
      food.archivedAt,
    );
  }

  async getFood(id: string): Promise<Food | null> {
    const r = await this.db.getFirstAsync<FoodRow>('select * from foods where id = ?', id);
    return r ? foodFromDb(r) : null;
  }

  async listFoods(includeArchived = false): Promise<Food[]> {
    const rows = includeArchived
      ? await this.db.getAllAsync<FoodRow>('select * from foods order by name asc')
      : await this.db.getAllAsync<FoodRow>(
          'select * from foods where archived_at is null order by name asc',
        );
    return rows.map(foodFromDb);
  }

  async listUnits(): Promise<Unit[]> {
    const rows = await this.db.getAllAsync<{ id: string; name: string; default_grams: number }>(
      'select * from units',
    );
    return rows.map((r) => ({ id: r.id, name: r.name, defaultGrams: r.default_grams }));
  }

  async getUnit(id: string): Promise<Unit | null> {
    const r = await this.db.getFirstAsync<{ id: string; name: string; default_grams: number }>(
      'select * from units where id = ?',
      id,
    );
    return r ? { id: r.id, name: r.name, defaultGrams: r.default_grams } : null;
  }

  async upsertOverride(o: FoodUnitOverride): Promise<void> {
    await this.db.runAsync(
      `insert into food_unit_overrides (food_id, unit_id, grams) values (?, ?, ?)
       on conflict (food_id, unit_id) do update set grams = excluded.grams`,
      o.foodId,
      o.unitId,
      o.grams,
    );
  }

  async getOverride(foodId: string, unitId: string): Promise<FoodUnitOverride | null> {
    const r = await this.db.getFirstAsync<{ food_id: string; unit_id: string; grams: number }>(
      'select * from food_unit_overrides where food_id = ? and unit_id = ?',
      foodId,
      unitId,
    );
    return r ? { foodId: r.food_id, unitId: r.unit_id, grams: r.grams } : null;
  }

  async insertEntry(entry: LogEntry): Promise<void> {
    await this.db.runAsync(
      `insert into log_entries
         (id, food_id, meal, quantity, unit_id, grams, logged_at, local_date, kcal, protein, carb, fat, fiber)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.id,
      entry.foodId,
      entry.meal,
      entry.quantity,
      entry.unitId,
      entry.grams,
      entry.loggedAt,
      entry.localDate,
      entry.kcal,
      entry.protein,
      entry.carb,
      entry.fat,
      entry.fiber,
    );
  }

  async deleteEntry(id: string): Promise<boolean> {
    const res = await this.db.runAsync('delete from log_entries where id = ?', id);
    return res.changes > 0;
  }

  async listEntriesByDate(localDate: IsoDate): Promise<LogEntry[]> {
    const rows = await this.db.getAllAsync<EntryRow>(
      'select * from log_entries where local_date = ? order by logged_at asc',
      localDate,
    );
    return rows.map(entryFromDb);
  }

  async listEntriesByDateMeal(localDate: IsoDate, meal: Meal): Promise<LogEntry[]> {
    const rows = await this.db.getAllAsync<EntryRow>(
      'select * from log_entries where local_date = ? and meal = ? order by logged_at asc',
      localDate,
      meal,
    );
    return rows.map(entryFromDb);
  }

  async listRecentFoodIds(limit: number): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ food_id: string }>(
      `select food_id, max(logged_at) as latest
       from log_entries
       group by food_id
       order by latest desc
       limit ?`,
      limit,
    );
    return rows.map((r) => r.food_id);
  }

  async upsertFavorite(fav: Favorite): Promise<void> {
    await this.db.runAsync(
      `insert into favorites (food_id, meal_hint, added_at) values (?, ?, ?)
       on conflict (food_id) do update set meal_hint = excluded.meal_hint`,
      fav.foodId,
      fav.mealHint,
      fav.addedAt,
    );
  }

  async removeFavorite(foodId: string): Promise<void> {
    await this.db.runAsync('delete from favorites where food_id = ?', foodId);
  }

  async listFavorites(): Promise<Favorite[]> {
    const rows = await this.db.getAllAsync<{
      food_id: string;
      meal_hint: string | null;
      added_at: string;
    }>('select * from favorites order by added_at asc');
    return rows.map((r) => ({
      foodId: r.food_id,
      mealHint: r.meal_hint as Meal | null,
      addedAt: r.added_at,
    }));
  }

  async getMarkedComplete(localDate: IsoDate): Promise<boolean> {
    const r = await this.db.getFirstAsync<{ marked_complete: number }>(
      'select marked_complete from daily_flags where local_date = ?',
      localDate,
    );
    return r ? r.marked_complete === 1 : false;
  }

  async setMarkedComplete(localDate: IsoDate, value: boolean): Promise<void> {
    await this.db.runAsync(
      `insert into daily_flags (local_date, marked_complete) values (?, ?)
       on conflict (local_date) do update set marked_complete = excluded.marked_complete`,
      localDate,
      value ? 1 : 0,
    );
  }
}
