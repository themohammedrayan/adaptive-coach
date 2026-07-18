import type { IsoDate } from '../engine';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** A reusable custom food. Nutrition is gram-canonical (per 100g). Food-Log BRD §2. */
export interface Food {
  id: string;
  name: string;
  /** Null only when macrosComplete=false (kcal-only quick food). */
  proteinPer100g: number | null;
  carbPer100g: number | null;
  fatPer100g: number | null;
  /** Always optional, independent of macrosComplete. */
  fiberPer100g: number | null;
  /** DERIVED = 4·protein + 4·carb + 9·fat when macros are known; else the user's direct input. */
  kcalPer100g: number;
  defaultUnitId: string;
  /** False for kcal-only quick entries — protein/carb/fat are unknown, not zero. */
  macrosComplete: boolean;
  isCustom: true;
  createdAt: string;
  archivedAt: string | null;
  /** Last local write; used for the Supabase pull's last-write-wins merge. */
  updatedAt: string;
  /** Outbox flag: row not yet upserted to Supabase. */
  pendingPush: boolean;
}

/** Global unit library with default gram weights. Food-Log BRD §3. */
export interface Unit {
  id: string;
  name: string;
  defaultGrams: number;
}

/** Per-food override of a unit's gram weight (a katori of dal ≠ a katori of rice). */
export interface FoodUnitOverride {
  foodId: string;
  unitId: string;
  grams: number;
}

/** Macros resolved for a given gram amount. Null fields mean "unknown", never zero. */
export interface EntryMacros {
  kcal: number;
  protein: number | null;
  carb: number | null;
  fat: number | null;
  fiber: number | null;
}

/** One logged instance. Macros are SNAPSHOTTED at log time (BRD §5) — never recomputed. */
export interface LogEntry extends EntryMacros {
  id: string;
  foodId: string;
  meal: Meal;
  quantity: number;
  unitId: string;
  /** Resolved grams = quantity × (override.grams ?? unit.defaultGrams). */
  grams: number;
  loggedAt: string;
  localDate: IsoDate;
  /** Soft delete — deleted rows stay for sync (mirrors data-sync's BodyMetricRow). */
  deletedAt: string | null;
  /** Last local write; used for the Supabase pull's last-write-wins merge. */
  updatedAt: string;
  /** Outbox flag: row not yet upserted to Supabase. */
  pendingPush: boolean;
}

export interface Favorite {
  foodId: string;
  mealHint: Meal | null;
  addedAt: string;
  /** Soft delete — deleted rows stay for sync. */
  deletedAt: string | null;
  /** Last local write; used for the Supabase pull's last-write-wins merge. */
  updatedAt: string;
  /** Outbox flag: row not yet upserted to Supabase. */
  pendingPush: boolean;
}

/**
 * Derived per day — this is what the Engine reads (via toDayLog, see dayLog.ts).
 * kcal is always Σ entry.kcal; protein/carb/fat/fiber sum only known macros
 * (nulls treated as 0), with macrosIncomplete flagging that divergence (BRD §4).
 */
export interface DailyTotals {
  localDate: IsoDate;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  fiber: number;
  entryCount: number;
  logged: boolean;
  /** User-set flag, not derived from entries and not used by the Engine's gate in v1. */
  markedComplete: boolean;
  /** True when at least one entry has macrosComplete=false. */
  macrosIncomplete: boolean;
}
