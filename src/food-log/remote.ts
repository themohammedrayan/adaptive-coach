import { supabase } from '../lib/supabase';
import type { Favorite, Food, LogEntry, Meal } from './types';

/** Server column mapping for public.foods (user_id defaults to auth.uid()). */
interface ServerFoodRow {
  external_id: string;
  name: string;
  protein_per_100g: number | null;
  carb_per_100g: number | null;
  fat_per_100g: number | null;
  fiber_per_100g: number | null;
  kcal_per_100g: number;
  default_unit_id: string;
  macros_complete: boolean;
  created_at_utc: string;
  archived_at: string | null;
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

function foodToServer(f: Food): ServerFoodRow {
  return {
    external_id: f.id,
    name: f.name,
    protein_per_100g: f.proteinPer100g,
    carb_per_100g: f.carbPer100g,
    fat_per_100g: f.fatPer100g,
    fiber_per_100g: f.fiberPer100g,
    kcal_per_100g: f.kcalPer100g,
    default_unit_id: f.defaultUnitId,
    macros_complete: f.macrosComplete,
    created_at_utc: f.createdAt,
    archived_at: f.archivedAt,
  };
}

function foodFromServer(r: ServerFoodRow): Food {
  return {
    id: r.external_id,
    name: r.name,
    proteinPer100g: r.protein_per_100g,
    carbPer100g: r.carb_per_100g,
    fatPer100g: r.fat_per_100g,
    fiberPer100g: r.fiber_per_100g,
    kcalPer100g: Number(r.kcal_per_100g),
    defaultUnitId: r.default_unit_id,
    macrosComplete: r.macros_complete,
    isCustom: true,
    createdAt: r.created_at_utc,
    archivedAt: r.archived_at,
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

/** Supabase push/pull for the three food-log tables; faked in tests. */
export interface FoodLogRemoteStore {
  pushFoods(rows: Food[]): Promise<void>;
  pullFoodsSince(sinceIso: string | null): Promise<Food[]>;
  pushEntries(rows: LogEntry[]): Promise<void>;
  pullEntriesSince(sinceIso: string | null): Promise<LogEntry[]>;
  pushFavorites(rows: Favorite[]): Promise<void>;
  pullFavoritesSince(sinceIso: string | null): Promise<Favorite[]>;
}

export class SupabaseRemote implements FoodLogRemoteStore {
  async pushFoods(rows: Food[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('foods')
      .upsert(rows.map(foodToServer), { onConflict: 'user_id,external_id' });
    if (error) throw new Error(error.message);
  }

  async pullFoodsSince(sinceIso: string | null): Promise<Food[]> {
    let query = supabase.from('foods').select('*');
    if (sinceIso !== null) query = query.gt('updated_at', sinceIso);
    const { data, error } = await query;
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
}
