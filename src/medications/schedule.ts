import { dayOfWeek } from '../calendar/resolve';
import type { IsoDate } from '../engine';
import type { ExpectedDose, Medication, MedicationDose } from './types';

/** Whether `med` has a dose due on `date` at all — ignores archived meds, the start/end window, and weekday selection. */
export function isMedicationActiveOn(med: Medication, date: IsoDate): boolean {
  if (med.archivedAt !== null) return false;
  if (date < med.startDate) return false;
  if (med.endDate !== null && date > med.endDate) return false;
  if (med.daysOfWeek.length > 0 && med.daysOfWeek.length < 7 && !med.daysOfWeek.includes(dayOfWeek(date))) return false;
  return true;
}

function byMinute(a: ExpectedDose, b: ExpectedDose): number {
  return a.scheduledMinute - b.scheduledMinute;
}

/**
 * Expands every active medication's timesOfDay into that date's expected
 * slots, then left-joins against whatever dose rows already exist for that
 * date — an unmatched slot is 'pending'. Never reads or writes a store;
 * `doses` is the caller's already-fetched (non-deleted) rows.
 */
export function expectedDosesForDate(
  medications: Medication[],
  doses: MedicationDose[],
  date: IsoDate,
): ExpectedDose[] {
  const dayDoses = doses.filter((d) => d.scheduledDate === date);
  const out: ExpectedDose[] = [];
  for (const med of medications) {
    if (!isMedicationActiveOn(med, date)) continue;
    for (const minute of med.timesOfDay) {
      const match = dayDoses.find(
        (d) => d.medicationExternalId === med.externalId && d.scheduledMinute === minute,
      );
      out.push({
        medicationExternalId: med.externalId,
        scheduledDate: date,
        scheduledMinute: minute,
        status: match?.status ?? 'pending',
        doseExternalId: match?.externalId ?? null,
      });
    }
  }
  return out.sort(byMinute);
}
