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
  };
  await store.insertEntry(entry);
  return entry;
}

export async function deleteLogEntry(store: FoodLogStore, entryId: string): Promise<boolean> {
  return store.deleteEntry(entryId);
}

export async function listLogEntries(
  store: FoodLogStore,
  localDate: IsoDate,
): Promise<LogEntry[]> {
  return store.listEntriesByDate(localDate);
}
