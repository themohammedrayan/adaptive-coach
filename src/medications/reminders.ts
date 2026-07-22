import { SchedulableTriggerInputTypes } from 'expo-notifications';
import type { IsoDate } from '../engine';
import { defaultAdapter, type MedicationNotificationsAdapter } from './notifications';
import type { Medication } from './types';

/** Self-describing id prefix — no separate id list to persist or drift out of sync with what's actually scheduled. */
export const MEDICATION_REMINDER_PREFIX = 'medication-dose-';

function dailyId(medicationExternalId: string, minute: number): string {
  return `${MEDICATION_REMINDER_PREFIX}${medicationExternalId}-${minute}`;
}

function weeklyId(medicationExternalId: string, minute: number, weekday: number): string {
  return `${MEDICATION_REMINDER_PREFIX}${medicationExternalId}-${minute}-w${weekday}`;
}

function isDaily(daysOfWeek: number[]): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.length === 7;
}

function isSchedulable(med: Medication, today: IsoDate): boolean {
  if (med.archivedAt !== null) return false;
  if (!med.reminderEnabled) return false;
  if (med.endDate !== null && med.endDate < today) return false;
  return true;
}

export interface MedicationScheduleContext {
  today: IsoDate;
}

/**
 * Cancels every currently-scheduled reminder tagged with the medication
 * prefix, then reschedules from scratch off `medications`: a DAILY trigger
 * per dose time when every day is selected, otherwise one WEEKLY trigger
 * per selected weekday (expo-notifications' weekday is 1-7, 1=Sunday — our
 * daysOfWeek is 0=Sun..6=Sat, so weekday = day + 1). Archived, reminders-off,
 * and already-ended medications get no schedule. Re-run whenever the
 * Medications screen loads or a medication is saved — same "re-armed on
 * open" limitation src/dashboard/reminders.ts already accepts (no
 * background job re-syncs this while the app is closed).
 */
export async function rebuildMedicationRemindersCore(
  medications: Medication[],
  ctx: MedicationScheduleContext,
  adapter: MedicationNotificationsAdapter,
): Promise<void> {
  const scheduled = await adapter.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(MEDICATION_REMINDER_PREFIX))
      .map((n) => adapter.cancelScheduledNotificationAsync(n.identifier)),
  );

  for (const med of medications) {
    if (!isSchedulable(med, ctx.today)) continue;
    const body = `Time to take ${med.name} (${med.dose}).`;

    for (const minute of med.timesOfDay) {
      const hour = Math.floor(minute / 60);
      const clockMinute = minute % 60;

      if (isDaily(med.daysOfWeek)) {
        await adapter.scheduleNotificationAsync({
          identifier: dailyId(med.externalId, minute),
          content: { title: 'Medication reminder', body },
          trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute: clockMinute },
        });
        continue;
      }

      for (const day of med.daysOfWeek) {
        await adapter.scheduleNotificationAsync({
          identifier: weeklyId(med.externalId, minute, day),
          content: { title: 'Medication reminder', body },
          trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute: clockMinute },
        });
      }
    }
  }
}

export async function rebuildMedicationReminders(medications: Medication[], today: IsoDate): Promise<void> {
  return rebuildMedicationRemindersCore(medications, { today }, defaultAdapter);
}

/** Cancels every medication reminder outright, no reschedule — used by resetUserData. */
export async function cancelAllMedicationRemindersCore(adapter: MedicationNotificationsAdapter): Promise<void> {
  const scheduled = await adapter.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(MEDICATION_REMINDER_PREFIX))
      .map((n) => adapter.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function cancelAllMedicationReminders(): Promise<void> {
  return cancelAllMedicationRemindersCore(defaultAdapter);
}
