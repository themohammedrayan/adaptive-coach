import type { IsoDate } from '../engine';

export type DoseStatus = 'taken' | 'skipped' | 'snoozed';

/** A medication's own definition + schedule (name/dose/times/days/window), not a day's log. */
export interface Medication {
  id: string;
  externalId: string;
  name: string;
  dose: string;
  notes: string | null;
  /** Minutes since local midnight, sorted ascending. */
  timesOfDay: number[];
  /** 0=Sun..6=Sat. All 7 selected means "every day". */
  daysOfWeek: number[];
  startDate: IsoDate;
  endDate: IsoDate | null;
  reminderEnabled: boolean;
  /** Non-null means "stopped" — history/streak stay intact, just excluded from future schedules. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One acted-upon dose. Created on-demand — the first time the user taps
 * Take/Skip/Snooze for a scheduled slot — never pre-materialized. A slot
 * with no matching row is "pending" (see src/medications/schedule.ts).
 */
export interface MedicationDose {
  id: string;
  externalId: string;
  medicationExternalId: string;
  scheduledDate: IsoDate;
  /** Snapshot of which timesOfDay slot this is — a later schedule edit never rewrites history. */
  scheduledMinute: number;
  status: DoseStatus;
  takenAt: string | null;
  snoozedUntil: string | null;
  updatedAt: string;
}

/** Computed, never persisted — the expansion of a medication's schedule for one date. */
export interface ExpectedDose {
  medicationExternalId: string;
  scheduledDate: IsoDate;
  scheduledMinute: number;
  status: DoseStatus | 'pending';
  doseExternalId: string | null;
}
