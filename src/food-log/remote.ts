import { supabase } from '../lib/supabase';
import { normalizeFoodName } from './foods';
import { overrideExternalId } from './store';
import type { Favorite, Food, FoodSource, FoodUnitOverride, LogEntry, Meal } from './types';

/**
 * Server column mapping for public.food_catalog — the shared, append-only food
 * library. Note what is absent: no `user_id`, and no `archived_at`. Ownership
 * lives in `created_by` and is provenance only, and archiving is a purely local
 * "hide from my list" that must never propagate (it would hide the food for
 * everyone).
 */
interface ServerFoodRow {
  catalog_id: string;
  created_by?: string | null;
  name: string;
  name_normalized: string;
  protein_per_100g: number | null;
  carb_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
  kcal_per_100g: number;
  default_unit_id: string;
  macros_complete: boolean;
  photo_path: string | null;
  source: string;
  created_at_utc: string;
  updated_at?: string;
}

interface ServerLogEntryRow {
  external_id: string;
  food_external_id: string;
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
  deleted_at: string | null;
  updated_at?: string;
}

interface ServerFavoriteRow {
  food_external_id: string;
  meal_hint: string | null;
  added_at: string;
  deleted_at: string | null;
  updated_at?: string;
}

interface ServerOverrideRow {
  external_id: string;
  food_catalog_id: string;
  unit_id: string;
  grams: number;
  deleted_at: string | null;
  updated_at?: string;
}

function foodToServer(f: Food): ServerFoodRow {
  return {
    catalog_id: f.id,
    name: f.name,
    name_normalized: normalizeFoodName(f.name),
    protein_per_100g: f.proteinPer100g,
    carb_per_100g: f.carbPer100g,
    fat_per_100g: f.fatPer100g,
    fiber_per_100g: f.fiberPer100g,
    kcal_per_100g: f.kcalPer100g,
    default_unit_id: f.defaultUnitId,
    macros_complete: f.macrosComplete,
    photo_path: f.photoPath,
    source: f.source,
    created_at_utc: f.createdAt,
  };
}

function foodFromServer(r: ServerFoodRow): Food {
  return {
    id: r.catalog_id,
    name: r.name,
    proteinPer100g: r.protein_per_100g,
    carbPer100g: r.carb_per_100g,
    fatPer100g: r.fat_per_100g,
    fiberPer100g: r.fiber_per_100g,
    kcalPer100g: Number(r.kcal_per_100g),
    defaultUnitId: r.default_unit_id,
    macrosComplete: r.macros_complete,
    source: (r.source as FoodSource) ?? 'manual',
    createdBy: r.created_by ?? null,
    photoPath: r.photo_path,
    photoLocalUri: null,
    createdAt: r.created_at_utc,
    // Server-side has no archived_at. sync.ts preserves whatever the local row
    // says so a pull can't un-hide a food you archived.
    archivedAt: null,
    updatedAt: r.updated_at ?? r.created_at_utc,
    pendingPush: false,
  };
}

function entryToServer(e: LogEntry): ServerLogEntryRow {
  return {
    external_id: e.id,
    food_external_id: e.foodId,
    meal: e.meal,
    quantity: e.quantity,
    unit_id: e.unitId,
    grams: e.grams,
    logged_at: e.loggedAt,
    local_date: e.localDate,
    kcal: e.kcal,
    protein: e.protein,
    carb: e.carb,
    fat: e.fat,
    fiber: e.fiber,
    photo_path: e.photoPath,
    deleted_at: e.deletedAt,
  };
}

function entryFromServer(r: ServerLogEntryRow): LogEntry {
  return {
    id: r.external_id,
    foodId: r.food_external_id,
    meal: r.meal as Meal,
    quantity: Number(r.quantity),
    unitId: r.unit_id,
    grams: Number(r.grams),
    loggedAt: r.logged_at,
    localDate: r.local_date,
    kcal: Number(r.kcal),
    protein: r.protein === null ? null : Number(r.protein),
    carb: r.carb === null ? null : Number(r.carb),
    fat: r.fat === null ? null : Number(r.fat),
    fiber: r.fiber === null ? null : Number(r.fiber),
    photoPath: r.photo_path ?? null,
    photoLocalUri: null,
    deletedAt: r.deleted_at,
    updatedAt: r.updated_at ?? r.logged_at,
    pendingPush: false,
  };
}

function favoriteToServer(f: Favorite): ServerFavoriteRow {
  return {
    food_external_id: f.foodId,
    meal_hint: f.mealHint,
    added_at: f.addedAt,
    deleted_at: f.deletedAt,
  };
}

function favoriteFromServer(r: ServerFavoriteRow): Favorite {
  return {
    foodId: r.food_external_id,
    mealHint: r.meal_hint as Meal | null,
    addedAt: r.added_at,
    deletedAt: r.deleted_at,
    updatedAt: r.updated_at ?? r.added_at,
    pendingPush: false,
  };
}

function overrideToServer(o: FoodUnitOverride): ServerOverrideRow {
  return {
    external_id: overrideExternalId(o.foodId, o.unitId),
    food_catalog_id: o.foodId,
    unit_id: o.unitId,
    grams: o.grams,
    deleted_at: o.deletedAt,
  };
}

function overrideFromServer(r: ServerOverrideRow): FoodUnitOverride {
  return {
    foodId: r.food_catalog_id,
    unitId: r.unit_id,
    grams: Number(r.grams),
    deletedAt: r.deleted_at,
    updatedAt: r.updated_at ?? '1970-01-01T00:00:00.000Z',
    pendingPush: false,
  };
}

/** Supabase push/pull for the food-log tables; faked in tests. */
export interface FoodLogRemoteStore {
  /**
   * Upserts catalog rows. `myUserId` is the authenticated user; rows authored by
   * anyone else are skipped rather than attempted, because the server's
   * `catalog update own` policy would reject them and the resulting error would
   * wedge pendingPush forever.
   */
  pushFoods(rows: Food[], myUserId: string | null): Promise<void>;
  pullFoodsSince(sinceIso: string | null): Promise<Food[]>;
  pushEntries(rows: LogEntry[]): Promise<void>;
  pullEntriesSince(sinceIso: string | null): Promise<LogEntry[]>;
  pushFavorites(rows: Favorite[]): Promise<void>;
  pullFavoritesSince(sinceIso: string | null): Promise<Favorite[]>;
  pushOverrides(rows: FoodUnitOverride[]): Promise<void>;
  pullOverridesSince(sinceIso: string | null): Promise<FoodUnitOverride[]>;
  /** auth.uid(), or null when signed out. */
  currentUserId(): Promise<string | null>;
}

/** One pull page. Large enough that a personal catalog arrives in a single sync. */
const PULL_PAGE_SIZE = 1000;

export class SupabaseRemote implements FoodLogRemoteStore {
  async currentUserId(): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  }

  async pushFoods(rows: Food[], myUserId: string | null): Promise<void> {
    const mine = rows.filter((f) => f.createdBy === null || f.createdBy === myUserId);
    if (mine.length === 0) return;
    const { error } = await supabase
      .from('food_catalog')
      .upsert(mine.map(foodToServer), { onConflict: 'catalog_id' });
    if (error) throw new Error(error.message);
  }

  /**
   * No user filter — this omission is what makes the catalog universal: every
   * food anyone has contributed arrives here. Ordered and paged so that a
   * catalog larger than one page still drains, one sync at a time, as the caller
   * advances the cursor to the last row's updated_at.
   */
  async pullFoodsSince(sinceIso: string | null): Promise<Food[]> {
    let query = supabase.from('food_catalog').select('*');
    if (sinceIso !== null) query = query.gt('updated_at', sinceIso);
    const { data, error } = await query.order('updated_at', { ascending: true }).limit(PULL_PAGE_SIZE);
    if (error) throw new Error(error.message);
    return (data as ServerFoodRow[]).map(foodFromServer);
  }

  async pushEntries(rows: LogEntry[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('log_entries')
      .upsert(rows.map(entryToServer), { onConflict: 'user_id,external_id' });
    if (error) throw new Error(error.message);
  }

  async pullEntriesSince(sinceIso: string | null): Promise<LogEntry[]> {
    let query = supabase.from('log_entries').select('*');
    if (sinceIso !== null) query = query.gt('updated_at', sinceIso);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as ServerLogEntryRow[]).map(entryFromServer);
  }

  async pushFavorites(rows: Favorite[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('favorites')
      .upsert(rows.map(favoriteToServer), { onConflict: 'user_id,food_external_id' });
    if (error) throw new Error(error.message);
  }

  async pullFavoritesSince(sinceIso: string | null): Promise<Favorite[]> {
    let query = supabase.from('favorites').select('*');
    if (sinceIso !== null) query = query.gt('updated_at', sinceIso);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as ServerFavoriteRow[]).map(favoriteFromServer);
  }

  async pushOverrides(rows: FoodUnitOverride[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('food_unit_overrides')
      .upsert(rows.map(overrideToServer), { onConflict: 'user_id,external_id' });
    if (error) throw new Error(error.message);
  }

  async pullOverridesSince(sinceIso: string | null): Promise<FoodUnitOverride[]> {
    let query = supabase.from('food_unit_overrides').select('*');
    if (sinceIso !== null) query = query.gt('updated_at', sinceIso);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as ServerOverrideRow[]).map(overrideFromServer);
  }
}
