import type { IsoDate } from '../engine';
import { sumEntryMacros } from './macros';
import type { FoodLogStore } from './store';
import type { DailyTotals, Meal } from './types';

/** Food-Log BRD §4/§9 — Σ entries in (localDate, meal), at full precision. */
export async function mealSubtotal(
  store: FoodLogStore,
  localDate: IsoDate,
  meal: Meal,
): Promise<ReturnType<typeof sumEntryMacros> & { entryCount: number }> {
  const entries = await store.listEntriesByDateMeal(localDate, meal);
  return { ...sumEntryMacros(entries), entryCount: entries.length };
}

/**
 * Food-Log BRD §4/§8/§9 — Σ all entries in localDate. logged = entryCount ≥ 1
 * (feeds the Engine's missing-data gate). markedComplete is a separate
 * user-set flag, not used by the Engine's gate in v1.
 */
export async function dailyTotals(store: FoodLogStore, localDate: IsoDate): Promise<DailyTotals> {
  const entries = await store.listEntriesByDate(localDate);
  const sums = sumEntryMacros(entries);
  const markedComplete = await store.getMarkedComplete(localDate);
  return {
    localDate,
    ...sums,
    entryCount: entries.length,
    logged: entries.length >= 1,
    markedComplete,
  };
}

export async function setMarkedComplete(
  store: FoodLogStore,
  localDate: IsoDate,
  value: boolean,
): Promise<void> {
  await store.setMarkedComplete(localDate, value);
}
