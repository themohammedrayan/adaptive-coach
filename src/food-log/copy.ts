import type { IsoDate } from '../engine';
import type { FoodLogStore } from './store';
import type { LogEntry, Meal } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Food-Log BRD §7/§10 AT7 — duplicates entries to a new date with fresh
 * timestamps (loggedAt = the moment of copying). Snapshot macro/kcal values
 * are copied as-is (BRD §5) — never recomputed against the food's current data.
 */
export async function copyDay(
  store: FoodLogStore,
  fromDate: IsoDate,
  toDate: IsoDate,
  nowUtc: string,
  genId: IdGenerator = defaultGenId,
): Promise<LogEntry[]> {
  return copyEntries(store, await store.listEntriesByDate(fromDate), toDate, nowUtc, genId);
}

export async function copyMeal(
  store: FoodLogStore,
  fromDate: IsoDate,
  meal: Meal,
  toDate: IsoDate,
  nowUtc: string,
  genId: IdGenerator = defaultGenId,
): Promise<LogEntry[]> {
  return copyEntries(
    store,
    await store.listEntriesByDateMeal(fromDate, meal),
    toDate,
    nowUtc,
    genId,
  );
}

async function copyEntries(
  store: FoodLogStore,
  source: LogEntry[],
  toDate: IsoDate,
  nowUtc: string,
  genId: IdGenerator,
): Promise<LogEntry[]> {
  const copies: LogEntry[] = source.map((e) => ({
    ...e,
    id: genId(),
    loggedAt: nowUtc,
    localDate: toDate,
    // Deliberately not copied: the photo belongs to the meal that was actually
    // eaten that day, not to a repeat of it on another day.
    photoPath: null,
    photoLocalUri: null,
    deletedAt: null,
    updatedAt: nowUtc,
    pendingPush: true,
  }));
  for (const entry of copies) await store.upsertEntry(entry);
  return copies;
}
