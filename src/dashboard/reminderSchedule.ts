import { addDays } from '../engine';
import type { IsoDate } from '../engine';
import type { ReminderKind } from './types';

export const REMINDER_IDS: Record<ReminderKind, string> = {
  morningWeighIn: 'dashboard-reminder-morning-weighin',
  eveningLog: 'dashboard-reminder-evening-log',
  /** Identifier unused for scheduling — this reminder is event-driven, not a repeating trigger. */
  coachNoteReady: 'dashboard-reminder-coach-note',
};

function localDateTime(date: IsoDate, hour: number, minute: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

/**
 * Dashboard BRD §B2/§C AT6 — the evening reminder's next trigger instant,
 * as a one-shot date (not a repeating trigger, so it can be suppressed
 * per day). Fires tonight at the configured time if that's still ahead
 * and the day isn't logged yet; otherwise tomorrow (suppressing tonight
 * when already logged, or catching up if today's time already passed).
 * Re-armed every time scheduleReminders runs (BRD-sanctioned v1 limit:
 * suppression only refreshes on app open — no background check installed).
 */
export function nextEveningTrigger(
  today: IsoDate,
  hour: number,
  minute: number,
  alreadyLoggedToday: boolean,
  nowUtc: string,
): Date {
  const todayAt = localDateTime(today, hour, minute);
  const fireTonight = !alreadyLoggedToday && todayAt.getTime() > new Date(nowUtc).getTime();
  return fireTonight ? todayAt : localDateTime(addDays(today, 1), hour, minute);
}
