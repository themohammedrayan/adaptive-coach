import type { IsoDate } from '../engine';
import type { DoseStatus, Medication, MedicationDose } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export interface BuildMedicationInput {
  name: string;
  dose: string;
  notes?: string | null;
  timesOfDay: number[];
  daysOfWeek?: number[];
  startDate: IsoDate;
  endDate?: IsoDate | null;
  reminderEnabled?: boolean;
}

export function buildMedication(
  input: BuildMedicationInput,
  nowIso: string,
  genId: IdGenerator = defaultGenId,
): Medication {
  const id = genId();
  return {
    id,
    externalId: id,
    name: input.name,
    dose: input.dose,
    notes: input.notes ?? null,
    timesOfDay: [...input.timesOfDay].sort((a, b) => a - b),
    daysOfWeek: input.daysOfWeek ?? ALL_DAYS,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    reminderEnabled: input.reminderEnabled ?? true,
    archivedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function editMedication(existing: Medication, patch: BuildMedicationInput, nowIso: string): Medication {
  return {
    ...existing,
    name: patch.name,
    dose: patch.dose,
    notes: patch.notes ?? null,
    timesOfDay: [...patch.timesOfDay].sort((a, b) => a - b),
    daysOfWeek: patch.daysOfWeek ?? ALL_DAYS,
    startDate: patch.startDate,
    endDate: patch.endDate ?? null,
    reminderEnabled: patch.reminderEnabled ?? true,
    updatedAt: nowIso,
  };
}

/** Soft "stop" — preserves history/streak, just excluded from future schedules and reminders. */
export function archiveMedication(med: Medication, nowIso: string): Medication {
  return { ...med, archivedAt: nowIso, updatedAt: nowIso };
}

const SNOOZE_MINUTES = 15;

/**
 * Next state for tapping Take/Skip/Snooze on one scheduled slot:
 * - no existing (visible) row -> a fresh dose with the tapped status.
 * - existing row with a *different* status -> a dose for the same slot with
 *   the status swapped. The caller upserts this keyed on the *slot*
 *   (medicationExternalId+scheduledDate+scheduledMinute), not externalId —
 *   see src/medications/api.ts — so a re-log after a prior clear revives
 *   that slot's row (even soft-deleted) instead of colliding with the
 *   table's slot-uniqueness constraint.
 * - existing row with the *same* status -> `null`, meaning "clear it back
 *   to pending" (caller soft-deletes `existing`).
 */
export function setDoseStatus(
  medicationExternalId: string,
  scheduledDate: IsoDate,
  scheduledMinute: number,
  status: DoseStatus,
  existing: MedicationDose | null,
  nowIso: string,
  genId: IdGenerator = defaultGenId,
): MedicationDose | null {
  if (existing !== null && existing.status === status) return null;

  const id = genId();
  return {
    id,
    externalId: id,
    medicationExternalId,
    scheduledDate,
    scheduledMinute,
    status,
    takenAt: status === 'taken' ? nowIso : null,
    snoozedUntil: status === 'snoozed' ? addMinutesIso(nowIso, SNOOZE_MINUTES) : null,
    updatedAt: nowIso,
  };
}

function addMinutesIso(nowIso: string, minutes: number): string {
  return new Date(Date.parse(nowIso) + minutes * 60_000).toISOString();
}
