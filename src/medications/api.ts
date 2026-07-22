import { supabase } from '../lib/supabase';
import type { DoseStatus, Medication, MedicationDose } from './types';

/* ------------------------------------------------------------ medications */

interface ServerMedicationRow {
  external_id: string;
  name: string;
  dose: string;
  notes: string | null;
  times_of_day: number[];
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  reminder_enabled: boolean;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
}

function medicationToServer(m: Medication) {
  return {
    external_id: m.externalId,
    name: m.name,
    dose: m.dose,
    notes: m.notes,
    times_of_day: m.timesOfDay,
    days_of_week: m.daysOfWeek,
    start_date: m.startDate,
    end_date: m.endDate,
    reminder_enabled: m.reminderEnabled,
    archived_at: m.archivedAt,
  };
}

function medicationFromServer(r: ServerMedicationRow): Medication {
  return {
    id: r.external_id,
    externalId: r.external_id,
    name: r.name,
    dose: r.dose,
    notes: r.notes,
    timesOfDay: r.times_of_day,
    daysOfWeek: r.days_of_week,
    startDate: r.start_date,
    endDate: r.end_date,
    reminderEnabled: r.reminder_enabled,
    archivedAt: r.archived_at,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export async function listMedications(): Promise<Medication[]> {
  const { data, error } = await supabase.from('medications').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerMedicationRow[]).map(medicationFromServer);
}

export async function upsertMedication(medication: Medication): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .upsert(medicationToServer(medication), { onConflict: 'user_id,external_id' });
  if (error) throw new Error(error.message);
}

export async function softDeleteMedication(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('medications')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------- medication_doses */

interface ServerMedicationDoseRow {
  external_id: string;
  medication_external_id: string;
  scheduled_date: string;
  scheduled_minute: number;
  status: DoseStatus;
  taken_at: string | null;
  snoozed_until: string | null;
  updated_at?: string;
}

function medicationDoseToServer(d: MedicationDose) {
  return {
    external_id: d.externalId,
    medication_external_id: d.medicationExternalId,
    scheduled_date: d.scheduledDate,
    scheduled_minute: d.scheduledMinute,
    status: d.status,
    taken_at: d.takenAt,
    snoozed_until: d.snoozedUntil,
    // Explicit — a re-log for a slot that was previously cleared (soft
    // deleted) must revive that same row, not collide with the slot's
    // uniqueness constraint. See setDoseStatus in ./crud.ts.
    deleted_at: null,
  };
}

function medicationDoseFromServer(r: ServerMedicationDoseRow): MedicationDose {
  return {
    id: r.external_id,
    externalId: r.external_id,
    medicationExternalId: r.medication_external_id,
    scheduledDate: r.scheduled_date,
    scheduledMinute: r.scheduled_minute,
    status: r.status,
    takenAt: r.taken_at,
    snoozedUntil: r.snoozed_until,
    updatedAt: r.updated_at ?? '',
  };
}

export async function listMedicationDoses(): Promise<MedicationDose[]> {
  const { data, error } = await supabase.from('medication_doses').select('*').is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (data as ServerMedicationDoseRow[]).map(medicationDoseFromServer);
}

/** Upserts keyed on the scheduled slot (not externalId) — see medicationDoseToServer's comment. */
export async function upsertMedicationDose(dose: MedicationDose): Promise<void> {
  const { error } = await supabase
    .from('medication_doses')
    .upsert(medicationDoseToServer(dose), {
      onConflict: 'user_id,medication_external_id,scheduled_date,scheduled_minute',
    });
  if (error) throw new Error(error.message);
}

export async function deleteMedicationDose(externalId: string, deletedAtIso: string): Promise<void> {
  const { error } = await supabase
    .from('medication_doses')
    .update({ deleted_at: deletedAtIso })
    .eq('external_id', externalId);
  if (error) throw new Error(error.message);
}
