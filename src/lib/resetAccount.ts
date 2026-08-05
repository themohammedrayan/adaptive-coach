import type { ChallengeStore } from '../challenges/store';
import type { DashboardStore } from '../dashboard/store';
import type { ReminderKind } from '../dashboard/types';
import { KV, type BodyMetricsStore } from '../data-sync/store';
import type { FoodLogStore } from '../food-log/store';

/**
 * Every table that carries a user_id column for this user's data (Master BRD —
 * single user, full wipe on reset).
 *
 * `food_catalog` is deliberately absent and must stay that way. Catalog rows are
 * not owned by the user who created them — they are the shared, append-only food
 * library, and a reset is meant to clear *your* log and library links, never the
 * definitions everyone reads. The table has no client DELETE policy either, so
 * adding it here would only make reset fail. See
 * supabase/migrations/20260805090000_create_food_catalog.sql.
 */
export const RESET_REMOTE_TABLES = [
  'log_entries',
  // Deprecated per-user food table, superseded by food_catalog. Still wiped so a
  // reset leaves nothing behind; nothing reads or writes it any more.
  'foods',
  'favorites',
  'food_unit_overrides',
  'body_metrics',
  'coach_chat_turns',
  'coach_notes',
  'finance_accounts',
  'finance_categories',
  'finance_transactions',
  'finance_valuations',
  'finance_recurring_transactions',
  'finance_goals',
  'finance_budgets',
  'finance_ious',
  'goals',
  'habits',
  'habit_log',
  'goal_milestone_items',
  'calendar_template_blocks',
  'calendar_overrides',
  'medications',
  'medication_doses',
] as const;

export interface ResetAuth {
  getUserId(): Promise<string | null>;
  signOut(): Promise<void>;
}

export interface ResetRemote {
  /** Deletes every row this user owns from `table`. Throws on failure. */
  deleteAllFrom(table: string, userId: string): Promise<void>;
}

export interface ResetHealthConnect {
  /**
   * Mints a fresh Health Connect sync baseline with no historical read, so
   * the next sync is incremental-only from "now" — must not resurrect
   * watch/scale data recorded before the reset. Returns null when no
   * baseline can be established (HC unavailable/no permission yet); the
   * next sync then falls back to its normal first-run backfill.
   */
  mintBaselineToken(): Promise<string | null>;
}

export interface ResetStores {
  dashboard: DashboardStore;
  foodLog: FoodLogStore;
  dataSync: BodyMetricsStore;
  challenge: ChallengeStore;
}

/**
 * Full account wipe: deletes every row this user owns on the server, clears
 * all local stores, cancels scheduled reminders, then signs out. Remote
 * deletes run first — auth.uid() must still resolve for RLS — so a network
 * failure aborts before any local data is touched, leaving it safe to retry.
 */
export async function resetUserDataCore(
  auth: ResetAuth,
  remote: ResetRemote,
  stores: ResetStores,
  hc: ResetHealthConnect,
  cancelAllReminders: () => Promise<void>,
  clearLocalCaches: () => Promise<void>,
): Promise<void> {
  const userId = await auth.getUserId();
  if (userId === null) throw new Error('resetUserData: no signed-in user');

  for (const table of RESET_REMOTE_TABLES) {
    await remote.deleteAllFrom(table, userId);
  }

  await Promise.all([
    stores.dashboard.clearAll(),
    stores.foodLog.clearAll(),
    stores.dataSync.clearAll(),
    stores.challenge.clearAll(),
  ]);

  // Health Connect itself isn't (and shouldn't be) touched by reset — it's
  // OS-level data outside this app's ownership. Establish a fresh baseline
  // right after wiping the local KV cursor above, so the next sync doesn't
  // fall back to a full historical re-backfill that would re-import
  // watch/scale data recorded before this reset.
  const baselineToken = await hc.mintBaselineToken();
  if (baselineToken !== null) await stores.dataSync.setKV(KV.hcChangesToken, baselineToken);

  // Finance has no full local store (decision: lightweight bolt-on), just a
  // cache + outbox — those AsyncStorage keys aren't caught by anything above.
  await clearLocalCaches();

  await cancelAllReminders();
  await auth.signOut();
}

/** App-side wiring — real Supabase client and device runtimes. */
export async function resetUserData(): Promise<void> {
  const { supabase } = await import('./supabase');
  const { getChallengeRuntime } = await import('../challenges/runtime');
  const { getDashboardRuntime } = await import('../dashboard/runtime');
  const { getDataSyncRuntime } = await import('../data-sync/runtime');
  const { getFoodLogRuntime } = await import('../food-log/runtime');
  const { cancelReminder } = await import('../dashboard/reminders');
  const { REMINDER_IDS } = await import('../dashboard/reminderSchedule');
  const { clearFinanceCache } = await import('../finance/cache');
  const { clearOutbox } = await import('../finance/outbox');
  const { clearGoalsCache } = await import('../goals/cache');
  const { clearCalendarCache } = await import('../calendar/cache');
  const { clearMedicationsCache } = await import('../medications/cache');
  const { cancelAllMedicationReminders } = await import('../medications/reminders');
  const { createHealthConnectAdapter } = await import('../data-sync/hc/adapter');

  const auth: ResetAuth = {
    getUserId: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  };

  const remote: ResetRemote = {
    deleteAllFrom: async (table, userId) => {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) throw new Error(`resetUserData: failed to clear ${table}: ${error.message}`);
    },
  };

  const hcAdapter = createHealthConnectAdapter();
  const hc: ResetHealthConnect = { mintBaselineToken: () => hcAdapter.mintChangesToken() };

  const [dashRt, foodRt, dataRt, challengeRt] = await Promise.all([
    getDashboardRuntime(),
    getFoodLogRuntime(),
    getDataSyncRuntime(),
    getChallengeRuntime(),
  ]);
  const stores: ResetStores = {
    dashboard: dashRt.store,
    foodLog: foodRt.store,
    dataSync: dataRt.store,
    challenge: challengeRt.store,
  };

  const cancelAllReminders = () =>
    Promise.all([
      ...(Object.keys(REMINDER_IDS) as ReminderKind[]).map((kind) => cancelReminder(kind)),
      cancelAllMedicationReminders(),
    ]).then(() => undefined);

  const clearLocalCaches = () =>
    Promise.all([clearFinanceCache(), clearOutbox(), clearGoalsCache(), clearCalendarCache(), clearMedicationsCache()]).then(
      () => undefined,
    );

  await resetUserDataCore(auth, remote, stores, hc, cancelAllReminders, clearLocalCaches);
}
