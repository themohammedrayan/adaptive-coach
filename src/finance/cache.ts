import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Account,
  AccountValuation,
  Budget,
  Category,
  FinanceGoal,
  Iou,
  RecurringTransaction,
  Transaction,
} from './types';

const CACHE_KEY = 'finance:cache:v1';

export interface FinanceCache {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  valuations: AccountValuation[];
  recurringTransactions: RecurringTransaction[];
  goals: FinanceGoal[];
  budgets: Budget[];
  ious: Iou[];
  cachedAt: string;
}

/**
 * Read-through AsyncStorage cache so Finance screens can paint instantly
 * offline, then reconcile once a live Supabase fetch comes back. Not a full
 * store/runtime abstraction — just enough for the app to be usable with no
 * signal (decision: Finance skips the sqlite/runtime layer other modules use).
 */
export async function readFinanceCache(): Promise<FinanceCache | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as FinanceCache;
  } catch {
    return null;
  }
}

export async function writeFinanceCache(cache: FinanceCache): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/** Must be called from resetUserData() — nothing else clears this key. */
export async function clearFinanceCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}
