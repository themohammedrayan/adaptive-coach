import * as SQLite from 'expo-sqlite';
import type { IsoDate } from '../engine';
import { DEFAULT_UNITS } from './constants';
import {
  parseOverrideExternalId,
  type FoodLogStore,
  type PendingPush,
  type PendingPushKind,
} from './store';
import type { Favorite, Food, FoodSource, FoodUnitOverride, LogEntry, Meal, Unit } from './types';

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
  source: string | null;
  created_by: string | null;
  photo_path: string | null;
  photo_local_uri: string | null;
  created_at: string;
  archived_at: string | null;
  updated_at: string;
  pending_push: number;
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
    source: (r.source as FoodSource | null) ?? 'manual',
    createdBy: r.created_by,
    photoPath: r.photo_path,
    photoLocalUri: r.photo_local_uri,
    createdAt: r.created_at,
    archivedAt: r.archived_at,
    updatedAt: r.updated_at,
    pendingPush: r.pending_push === 1,
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
  photo_path: string | null;
  photo_local_uri: string | null;
  deleted_at: string | null;
  updated_at: string;
  pending_push: number;
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
    photoPath: r.photo_path,
    photoLocalUri: r.photo_local_uri,
    deletedAt: r.deleted_at,
    updatedAt: r.updated_at,
    pendingPush: r.pending_push === 1,
  };
}

interface OverrideRow {
  food_id: string;
  unit_id: string;
  grams: number;
  deleted_at: string | null;
  updated_at: string;
  pending_push: number;
}

function overrideFromDb(r: OverrideRow): FoodUnitOverride {
  return {
    foodId: r.food_id,
    unitId: r.unit_id,
    grams: r.grams,
    deletedAt: r.deleted_at,
    updatedAt: r.updated_at,
    pendingPush: r.pending_push === 1,
  };
}

interface FavoriteRow {
  food_id: string;
  meal_hint: string | null;
  added_at: string;
  deleted_at: string | null;
  updated_at: string;
  pending_push: number;
}

function favoriteFromDb(r: FavoriteRow): Favorite {
  return {
    foodId: r.food_id,
    mealHint: r.meal_hint as Meal | null,
    addedAt: r.added_at,
    deletedAt: r.deleted_at,
    updatedAt: r.updated_at,
    pendingPush: r.pending_push === 1,
  };
}

/** Best-effort column add for installs from before sync support — expo-sqlite has no
 * `alter table ... add column if not exists`, so duplicate-column errors are swallowed. */
async function addColumnIfMissing(db: SQLite.SQLiteDatabase, table: string, ddl: string): Promise<void> {
  try {
    await db.execAsync(`alter table ${table} add column ${ddl}`);
  } catch {
    // column already exists
  }
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
        source text not null default 'manual',
        created_by text,
        photo_path text,
        photo_local_uri text,
        created_at text not null,
        archived_at text,
        updated_at text not null default '1970-01-01T00:00:00.000Z',
        pending_push integer not null default 1
      );
      create index if not exists foods_name_idx on foods (name);

      create table if not exists food_unit_overrides (
        food_id text not null references foods(id),
        unit_id text not null references units(id),
        grams real not null,
        deleted_at text,
        updated_at text not null default '1970-01-01T00:00:00.000Z',
        pending_push integer not null default 1,
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
        fiber real,
        photo_path text,
        photo_local_uri text,
        deleted_at text,
        updated_at text not null default '1970-01-01T00:00:00.000Z',
        pending_push integer not null default 1
      );
      create index if not exists log_entries_date_meal_idx on log_entries (local_date, meal);
      create index if not exists log_entries_food_idx on log_entries (food_id, logged_at desc);

      create table if not exists favorites (
        food_id text primary key references foods(id),
        meal_hint text,
        added_at text not null,
        deleted_at text,
        updated_at text not null default '1970-01-01T00:00:00.000Z',
        pending_push integer not null default 1
      );

      create table if not exists daily_flags (
        local_date text primary key,
        marked_complete integer not null default 0
      );

      create table if not exists kv (key text primary key, value text not null);
    `);
    // Installs from before sync support won't have these columns from create-table-if-not-exists.
    await addColumnIfMissing(db, 'foods', "updated_at text not null default '1970-01-01T00:00:00.000Z'");
    await addColumnIfMissing(db, 'foods', 'pending_push integer not null default 1');
    await addColumnIfMissing(db, 'log_entries', 'deleted_at text');
    await addColumnIfMissing(db, 'log_entries', "updated_at text not null default '1970-01-01T00:00:00.000Z'");
    await addColumnIfMissing(db, 'log_entries', 'pending_push integer not null default 1');
    await addColumnIfMissing(db, 'favorites', 'deleted_at text');
    await addColumnIfMissing(db, 'favorites', "updated_at text not null default '1970-01-01T00:00:00.000Z'");
    await addColumnIfMissing(db, 'favorites', 'pending_push integer not null default 1');
    // Shared-catalog + photo columns.
    await addColumnIfMissing(db, 'foods', "source text not null default 'manual'");
    await addColumnIfMissing(db, 'foods', 'created_by text');
    await addColumnIfMissing(db, 'foods', 'photo_path text');
    await addColumnIfMissing(db, 'foods', 'photo_local_uri text');
    await addColumnIfMissing(db, 'log_entries', 'photo_path text');
    await addColumnIfMissing(db, 'log_entries', 'photo_local_uri text');
    // Overrides used to be local-only, so pre-existing rows have no sync columns.
    // pending_push defaults to 1 so overrides recorded before this release are
    // pushed once and stop being lost on reinstall.
    await addColumnIfMissing(db, 'food_unit_overrides', 'deleted_at text');
    await addColumnIfMissing(
      db,
      'food_unit_overrides',
      "updated_at text not null default '1970-01-01T00:00:00.000Z'",
    );
    await addColumnIfMissing(db, 'food_unit_overrides', 'pending_push integer not null default 1');

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
          kcal_per_100g, default_unit_id, macros_complete, source, created_by, photo_path,
          photo_local_uri, created_at, archived_at, updated_at, pending_push)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         name = excluded.name,
         protein_per_100g = excluded.protein_per_100g,
         carb_per_100g = excluded.carb_per_100g,
         fat_per_100g = excluded.fat_per_100g,
         fiber_per_100g = excluded.fiber_per_100g,
         kcal_per_100g = excluded.kcal_per_100g,
         default_unit_id = excluded.default_unit_id,
         macros_complete = excluded.macros_complete,
         source = excluded.source,
         created_by = excluded.created_by,
         photo_path = excluded.photo_path,
         photo_local_uri = excluded.photo_local_uri,
         archived_at = excluded.archived_at,
         updated_at = excluded.updated_at,
         pending_push = excluded.pending_push`,
      food.id,
      food.name,
      food.proteinPer100g,
      food.carbPer100g,
      food.fatPer100g,
      food.fiberPer100g,
      food.kcalPer100g,
      food.defaultUnitId,
      food.macrosComplete ? 1 : 0,
      food.source,
      food.createdBy,
      food.photoPath,
      food.photoLocalUri,
      food.createdAt,
      food.archivedAt,
      food.updatedAt,
      food.pendingPush ? 1 : 0,
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
      `insert into food_unit_overrides (food_id, unit_id, grams, deleted_at, updated_at, pending_push)
       values (?, ?, ?, ?, ?, ?)
       on conflict (food_id, unit_id) do update set
         grams = excluded.grams,
         deleted_at = excluded.deleted_at,
         updated_at = excluded.updated_at,
         pending_push = excluded.pending_push`,
      o.foodId,
      o.unitId,
      o.grams,
      o.deletedAt,
      o.updatedAt,
      o.pendingPush ? 1 : 0,
    );
  }

  async getOverride(foodId: string, unitId: string): Promise<FoodUnitOverride | null> {
    const r = await this.db.getFirstAsync<OverrideRow>(
      'select * from food_unit_overrides where food_id = ? and unit_id = ?',
      foodId,
      unitId,
    );
    return r ? overrideFromDb(r) : null;
  }

  async listOverrides(): Promise<FoodUnitOverride[]> {
    const rows = await this.db.getAllAsync<OverrideRow>(
      'select * from food_unit_overrides where deleted_at is null',
    );
    return rows.map(overrideFromDb);
  }

  async upsertEntry(entry: LogEntry): Promise<void> {
    await this.db.runAsync(
      `insert into log_entries
         (id, food_id, meal, quantity, unit_id, grams, logged_at, local_date, kcal, protein, carb, fat, fiber,
          photo_path, photo_local_uri, deleted_at, updated_at, pending_push)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         food_id = excluded.food_id,
         meal = excluded.meal,
         quantity = excluded.quantity,
         unit_id = excluded.unit_id,
         grams = excluded.grams,
         logged_at = excluded.logged_at,
         local_date = excluded.local_date,
         kcal = excluded.kcal,
         protein = excluded.protein,
         carb = excluded.carb,
         fat = excluded.fat,
         fiber = excluded.fiber,
         photo_path = excluded.photo_path,
         photo_local_uri = excluded.photo_local_uri,
         deleted_at = excluded.deleted_at,
         updated_at = excluded.updated_at,
         pending_push = excluded.pending_push`,
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
      entry.photoPath,
      entry.photoLocalUri,
      entry.deletedAt,
      entry.updatedAt,
      entry.pendingPush ? 1 : 0,
    );
  }

  async getEntry(id: string): Promise<LogEntry | null> {
    const r = await this.db.getFirstAsync<EntryRow>('select * from log_entries where id = ?', id);
    return r ? entryFromDb(r) : null;
  }

  async deleteEntry(id: string, deletedAtUtc: string): Promise<boolean> {
    const res = await this.db.runAsync(
      'update log_entries set deleted_at = ?, updated_at = ?, pending_push = 1 where id = ? and deleted_at is null',
      deletedAtUtc,
      deletedAtUtc,
      id,
    );
    return res.changes > 0;
  }

  async listEntriesByDate(localDate: IsoDate): Promise<LogEntry[]> {
    const rows = await this.db.getAllAsync<EntryRow>(
      'select * from log_entries where local_date = ? and deleted_at is null order by logged_at asc',
      localDate,
    );
    return rows.map(entryFromDb);
  }

  async listEntriesByDateMeal(localDate: IsoDate, meal: Meal): Promise<LogEntry[]> {
    const rows = await this.db.getAllAsync<EntryRow>(
      'select * from log_entries where local_date = ? and meal = ? and deleted_at is null order by logged_at asc',
      localDate,
      meal,
    );
    return rows.map(entryFromDb);
  }

  async listRecentFoodIds(limit: number): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ food_id: string }>(
      `select food_id, max(logged_at) as latest
       from log_entries
       where deleted_at is null
       group by food_id
       order by latest desc
       limit ?`,
      limit,
    );
    return rows.map((r) => r.food_id);
  }

  async upsertFavorite(fav: Favorite): Promise<void> {
    await this.db.runAsync(
      `insert into favorites (food_id, meal_hint, added_at, deleted_at, updated_at, pending_push)
       values (?, ?, ?, ?, ?, ?)
       on conflict (food_id) do update set
         meal_hint = excluded.meal_hint,
         added_at = excluded.added_at,
         deleted_at = excluded.deleted_at,
         updated_at = excluded.updated_at,
         pending_push = excluded.pending_push`,
      fav.foodId,
      fav.mealHint,
      fav.addedAt,
      fav.deletedAt,
      fav.updatedAt,
      fav.pendingPush ? 1 : 0,
    );
  }

  async getFavorite(foodId: string): Promise<Favorite | null> {
    const r = await this.db.getFirstAsync<FavoriteRow>('select * from favorites where food_id = ?', foodId);
    return r ? favoriteFromDb(r) : null;
  }

  async removeFavorite(foodId: string, deletedAtUtc: string): Promise<void> {
    await this.db.runAsync(
      'update favorites set deleted_at = ?, updated_at = ?, pending_push = 1 where food_id = ? and deleted_at is null',
      deletedAtUtc,
      deletedAtUtc,
      foodId,
    );
  }

  async listFavorites(): Promise<Favorite[]> {
    const rows = await this.db.getAllAsync<FavoriteRow>(
      'select * from favorites where deleted_at is null order by added_at asc',
    );
    return rows.map(favoriteFromDb);
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

  async listPendingPush(): Promise<PendingPush> {
    const [foods, entries, favorites, overrides] = await Promise.all([
      this.db.getAllAsync<FoodRow>('select * from foods where pending_push = 1'),
      this.db.getAllAsync<EntryRow>('select * from log_entries where pending_push = 1'),
      this.db.getAllAsync<FavoriteRow>('select * from favorites where pending_push = 1'),
      this.db.getAllAsync<OverrideRow>('select * from food_unit_overrides where pending_push = 1'),
    ]);
    return {
      foods: foods.map(foodFromDb),
      entries: entries.map(entryFromDb),
      favorites: favorites.map(favoriteFromDb),
      overrides: overrides.map(overrideFromDb),
    };
  }

  async markPushed(kind: PendingPushKind, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    // Overrides are keyed on a pair, so they can't be cleared by a single `in`
    // list like the other three.
    if (kind === 'overrides') {
      for (const id of ids) {
        const parsed = parseOverrideExternalId(id);
        if (parsed === null) continue;
        await this.db.runAsync(
          'update food_unit_overrides set pending_push = 0 where food_id = ? and unit_id = ?',
          parsed.foodId,
          parsed.unitId,
        );
      }
      return;
    }

    const placeholders = ids.map(() => '?').join(',');
    const table = kind === 'foods' ? 'foods' : kind === 'entries' ? 'log_entries' : 'favorites';
    const idCol = kind === 'favorites' ? 'food_id' : 'id';
    await this.db.runAsync(`update ${table} set pending_push = 0 where ${idCol} in (${placeholders})`, ...ids);
  }

  async getKV(key: string): Promise<string | null> {
    const r = await this.db.getFirstAsync<{ value: string }>('select value from kv where key = ?', key);
    return r?.value ?? null;
  }

  async setKV(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'insert into kv (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
      key,
      value,
    );
  }

  async clearAll(): Promise<void> {
    await this.db.execAsync(`
      delete from log_entries;
      delete from favorites;
      delete from food_unit_overrides;
      delete from foods;
      delete from daily_flags;
      delete from kv;
    `);
  }
}
