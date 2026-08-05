import type { IsoDate } from '../engine';
import type { InstantToLocalDate } from './dates';
import { computeEntryMacros } from './macros';
import type { FoodLogStore } from './store';
import type { LogEntry, Meal } from './types';
import { resolveGrams } from './units';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface AddLogEntryInput {
  foodId: string;
  meal: Meal;
  quantity: number;
  unitId: string;
  loggedAt: string;
  /** Path in the private `meal-photos` bucket, when the photo is already uploaded. */
  photoPath?: string | null;
  /** Device-local image URI, when the upload hasn't landed yet. */
  photoLocalUri?: string | null;
}

/**
 * Food-Log BRD §9 — resolves grams, snapshots macros at log time; never
 * recomputed later (BRD §5). Editing the underlying Food afterward does not
 * change this entry.
 */
export async function addLogEntry(
  store: FoodLogStore,
  input: AddLogEntryInput,
  toLocalDate: InstantToLocalDate,
  genId: IdGenerator = defaultGenId,
): Promise<LogEntry> {
  const food = await store.getFood(input.foodId);
  if (food === null) throw new Error(`Unknown food: ${input.foodId}`);

  const grams = await resolveGrams(store, input.foodId, input.unitId, input.quantity);
  const macros = computeEntryMacros(food, grams);

  const entry: LogEntry = {
    id: genId(),
    foodId: input.foodId,
    meal: input.meal,
    quantity: input.quantity,
    unitId: input.unitId,
    grams,
    loggedAt: input.loggedAt,
    localDate: toLocalDate(input.loggedAt),
    ...macros,
    photoPath: input.photoPath ?? null,
    photoLocalUri: input.photoLocalUri ?? null,
    deletedAt: null,
    updatedAt: input.loggedAt,
    pendingPush: true,
  };
  await store.upsertEntry(entry);
  return entry;
}

export interface EditLogEntryInput {
  quantity: number;
  unitId: string;
}

/**
 * Food-Log BRD §5 — an entry's macros are a snapshot; editing quantity/unit
 * rescales that snapshot by the grams ratio rather than re-reading the Food,
 * so a food edited after logging still never rewrites what was logged.
 */
export async function editLogEntry(
  store: FoodLogStore,
  entry: LogEntry,
  input: EditLogEntryInput,
  nowUtc: string = new Date().toISOString(),
): Promise<LogEntry> {
  const grams = await resolveGrams(store, entry.foodId, input.unitId, input.quantity);
  const ratio = grams / entry.grams;

  const updated: LogEntry = {
    ...entry,
    quantity: input.quantity,
    unitId: input.unitId,
    grams,
    kcal: entry.kcal * ratio,
    protein: entry.protein === null ? null : entry.protein * ratio,
    carb: entry.carb === null ? null : entry.carb * ratio,
    fat: entry.fat === null ? null : entry.fat * ratio,
    fiber: entry.fiber === null ? null : entry.fiber * ratio,
    updatedAt: nowUtc,
    pendingPush: true,
  };
  // Same id, different values — an upsert-by-id, not delete+insert (the row must never
  // pass through a soft-deleted state, or a concurrent sync could push it as deleted).
  await store.upsertEntry(updated);
  return updated;
}

export async function deleteLogEntry(
  store: FoodLogStore,
  entryId: string,
  nowUtc: string = new Date().toISOString(),
): Promise<boolean> {
  return store.deleteEntry(entryId, nowUtc);
}

export async function listLogEntries(
  store: FoodLogStore,
  localDate: IsoDate,
): Promise<LogEntry[]> {
  return store.listEntriesByDate(localDate);
}
