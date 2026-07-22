import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Medication, MedicationDose } from './types';

const CACHE_KEY = 'medications:cache:v1';

export interface MedicationsCache {
  medications: Medication[];
  doses: MedicationDose[];
  cachedAt: string;
}

/**
 * Read-through AsyncStorage cache so the Medications tab paints instantly
 * offline, then reconciles once a live Supabase fetch comes back — same
 * "no local SQLite" persistence shape as src/goals/cache.ts and
 * src/calendar/cache.ts.
 */
export async function readMedicationsCache(): Promise<MedicationsCache | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as MedicationsCache;
  } catch {
    return null;
  }
}

export async function writeMedicationsCache(cache: MedicationsCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/** Must be called from resetUserData() — nothing else clears this key. */
export async function clearMedicationsCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
