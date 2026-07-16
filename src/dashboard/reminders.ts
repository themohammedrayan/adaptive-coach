import { SchedulableTriggerInputTypes } from 'expo-notifications';
import type { IsoDate } from '../engine';
import { dailyTotals } from '../food-log';
import { getFoodLogRuntime } from '../food-log/runtime';
import { defaultAdapter, type NotificationsAdapter } from './notifications';
import { nextEveningTrigger, REMINDER_IDS } from './reminderSchedule';
import { getDashboardRuntime } from './runtime';
import type { CoachNote, ReminderConfig, ReminderKind } from './types';

export interface ScheduleContext {
  today: IsoDate;
  alreadyLoggedToday: boolean;
  nowUtc: string;
}

/** Dashboard BRD §B3. */
export async function ensureNotificationPermission(): Promise<boolean> {
  return ensureNotificationPermissionCore(defaultAdapter);
}

export async function ensureNotificationPermissionCore(
  adapter: NotificationsAdapter,
): Promise<boolean> {
  const current = await adapter.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await adapter.requestPermissionsAsync();
  return requested.granted;
}

/** Dashboard BRD §B3 — (re)schedules all enabled reminders, persisting the config. */
export async function scheduleReminders(config: ReminderConfig): Promise<void> {
  const foodRt = await getFoodLogRuntime();
  const today = foodRt.toLocalDate(foodRt.nowUtc());
  const alreadyLoggedToday = (await dailyTotals(foodRt.store, today)).logged;
  await (await getDashboardRuntime()).store.setReminderConfig(config);
  return scheduleRemindersCore(
    config,
    { today, alreadyLoggedToday, nowUtc: foodRt.nowUtc() },
    defaultAdapter,
  );
}

export async function scheduleRemindersCore(
  config: ReminderConfig,
  ctx: ScheduleContext,
  adapter: NotificationsAdapter,
): Promise<void> {
  // Dashboard BRD §B2.1 — morning weigh-in, simple daily repeating trigger.
  await adapter.cancelScheduledNotificationAsync(REMINDER_IDS.morningWeighIn);
  if (config.morningWeighIn.enabled) {
    await adapter.scheduleNotificationAsync({
      identifier: REMINDER_IDS.morningWeighIn,
      content: { title: 'Morning weigh-in', body: "Log today's weight to keep the trend accurate." },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: config.morningWeighIn.hour,
        minute: config.morningWeighIn.minute,
      },
    });
  }

  // Dashboard BRD §B2.2/§C AT6 — evening log, one-shot so it can be suppressed per day.
  await adapter.cancelScheduledNotificationAsync(REMINDER_IDS.eveningLog);
  if (config.eveningLog.enabled) {
    const date = nextEveningTrigger(
      ctx.today,
      config.eveningLog.hour,
      config.eveningLog.minute,
      ctx.alreadyLoggedToday,
      ctx.nowUtc,
    );
    await adapter.scheduleNotificationAsync({
      identifier: REMINDER_IDS.eveningLog,
      content: { title: 'Did you log today?', body: 'A quick log keeps your trend honest.' },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

/** Dashboard BRD §B3/§C AT5 — cancels only the given reminder, leaving the others untouched. */
export async function cancelReminder(kind: ReminderKind): Promise<void> {
  return cancelReminderCore(kind, defaultAdapter);
}

export async function cancelReminderCore(
  kind: ReminderKind,
  adapter: NotificationsAdapter,
): Promise<void> {
  await adapter.cancelScheduledNotificationAsync(REMINDER_IDS[kind]);
}

/** Dashboard BRD §B2.3/§B3 — event-driven, fired from refreshSnapshot.ts on a fresh recompute. */
export async function notifyCoachNoteReady(note: CoachNote): Promise<void> {
  const config = await (await getDashboardRuntime()).store.getReminderConfig();
  return notifyCoachNoteReadyCore(note, config, defaultAdapter);
}

export async function notifyCoachNoteReadyCore(
  note: CoachNote,
  config: ReminderConfig,
  adapter: NotificationsAdapter,
): Promise<void> {
  if (!config.coachNoteReady.enabled) return;
  const granted = await ensureNotificationPermissionCore(adapter);
  if (!granted) return;
  await adapter.scheduleNotificationAsync({
    identifier: REMINDER_IDS.coachNoteReady,
    content: { title: 'Your weekly note is ready', body: note.headline },
    trigger: null, // deliver immediately — the recompute event already happened
  });
}
