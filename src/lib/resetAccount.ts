import type { ChallengeStore } from '../challenges/store';
import type { DashboardStore } from '../dashboard/store';
import type { ReminderKind } from '../dashboard/types';
import type { BodyMetricsStore } from '../data-sync/store';
import type { FoodLogStore } from '../food-log/store';

/** Every table that carries a user_id column for this user's data (Master BRD — single user, full wipe on reset). */
export const RESET_REMOTE_TABLES = [
  'log_entries',
  'foods',
  'favorites',
  'body_metrics',
  'coach_chat_turns',
  'coach_notes',
] as const;

export interface ResetAuth {
  getUserId(): Promise<string | null>;
  signOut(): Promise<void>;
}

export interface ResetRemote {
  /** Deletes every row this user owns from `table`. Throws on failure. */
  deleteAllFrom(table: string, userId: string): Promise<void>;
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
  cancelAllReminders: () => Promise<void>,
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
    Promise.all(
      (Object.keys(REMINDER_IDS) as ReminderKind[]).map((kind) => cancelReminder(kind)),
    ).then(() => undefined);

  await resetUserDataCore(auth, remote, stores, cancelAllReminders);
}
