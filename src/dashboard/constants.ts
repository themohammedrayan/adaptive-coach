import type { ReminderConfig } from './types';

/** Dashboard BRD §B2 — default times: morning weigh-in ~07:00, evening log ~21:00. */
export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  morningWeighIn: { enabled: true, hour: 7, minute: 0 },
  eveningLog: { enabled: true, hour: 21, minute: 0 },
  coachNoteReady: { enabled: true },
};

/** Labeled activity-factor presets for Profile setup (not a free-typed float). */
export const ACTIVITY_LEVELS: { label: string; value: number }[] = [
  { label: 'Sedentary', value: 1.2 },
  { label: 'Light', value: 1.375 },
  { label: 'Moderate', value: 1.55 },
  { label: 'Active', value: 1.725 },
  { label: 'Very Active', value: 1.9 },
];
