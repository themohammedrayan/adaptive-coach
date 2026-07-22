import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayOverride, RoutineBlock } from './types';

const CACHE_KEY = 'calendar:cache:v1';

export interface CalendarCache {
  templateBlocks: RoutineBlock[];
  overrides: DayOverride[];
  cachedAt: string;
}

/**
 * Read-through AsyncStorage cache so Calendar paints instantly offline, then
 * reconciles once a live Supabase fetch comes back — same pattern as
 * src/goals/cache.ts (no local SQLite for this module either: data volume is
 * tiny and edits are rare, so best-effort write + reconcile is enough).
 */
export async function readCalendarCache(): Promise<CalendarCache | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as CalendarCache;
  } catch {
    return null;
  }
}

export async function writeCalendarCache(cache: CalendarCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/** Must be called from resetUserData() — nothing else clears this key. */
export async function clearCalendarCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
