import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Goal, Habit, HabitLogEntry, MilestoneItem } from './types';

const CACHE_KEY = 'goals:cache:v1';

export interface GoalsCache {
  goals: Goal[];
  habits: Habit[];
  habitLog: HabitLogEntry[];
  milestoneItems: MilestoneItem[];
  cachedAt: string;
}

/**
 * Read-through AsyncStorage cache so Goals screens paint instantly offline,
 * then reconcile once a live Supabase fetch comes back — same pattern as
 * src/finance/cache.ts, since these tables share Finance's "no local SQLite"
 * persistence shape (Goals architecture decision — see docs/brd-goals.md §F.4).
 */
export async function readGoalsCache(): Promise<GoalsCache | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as GoalsCache;
  } catch {
    return null;
  }
}

export async function writeGoalsCache(cache: GoalsCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/** Must be called from resetUserData() — nothing else clears this key. */
export async function clearGoalsCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
