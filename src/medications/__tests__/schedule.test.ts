import { expectedDosesForDate, isMedicationActiveOn } from '../schedule';
import type { Medication, MedicationDose } from '../types';

function med(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'm1',
    externalId: 'm1',
    name: 'Metformin',
    dose: '500 mg',
    notes: null,
    timesOfDay: [480, 1200],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: '2026-07-01',
    endDate: null,
    reminderEnabled: true,
    archivedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function dose(overrides: Partial<MedicationDose> = {}): MedicationDose {
  return {
    id: 'd1',
    externalId: 'd1',
    medicationExternalId: 'm1',
    scheduledDate: '2026-07-20',
    scheduledMinute: 480,
    status: 'taken',
    takenAt: '2026-07-20T08:00:00.000Z',
    snoozedUntil: null,
    updatedAt: '2026-07-20T08:00:00.000Z',
    ...overrides,
  };
}

describe('isMedicationActiveOn', () => {
  it('is inactive before the start date', () => {
    expect(isMedicationActiveOn(med({ startDate: '2026-07-21' }), '2026-07-20')).toBe(false);
  });

  it('is inactive after the end date', () => {
    expect(isMedicationActiveOn(med({ endDate: '2026-07-19' }), '2026-07-20')).toBe(false);
  });

  it('is inactive when archived', () => {
    expect(isMedicationActiveOn(med({ archivedAt: '2026-07-15T00:00:00.000Z' }), '2026-07-20')).toBe(false);
  });

  it('is inactive on a weekday not selected', () => {
    // 2026-07-20 is a Monday (weekday 1); exclude it.
    const m = med({ daysOfWeek: [0, 2, 3, 4, 5, 6] });
    expect(isMedicationActiveOn(m, '2026-07-20')).toBe(false);
  });

  it('treats an all-7-day or empty daysOfWeek as active every day', () => {
    expect(isMedicationActiveOn(med({ daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }), '2026-07-20')).toBe(true);
    expect(isMedicationActiveOn(med({ daysOfWeek: [] }), '2026-07-20')).toBe(true);
  });

  it('is active within the start/end window on a selected weekday', () => {
    expect(isMedicationActiveOn(med(), '2026-07-20')).toBe(true);
  });
});

describe('expectedDosesForDate', () => {
  it('expands multiple times across multiple medications, sorted by minute', () => {
    const meds = [
      med({ externalId: 'm1', timesOfDay: [1200, 480] }),
      med({ externalId: 'm2', name: 'Lisinopril', timesOfDay: [420] }),
    ];
    const result = expectedDosesForDate(meds, [], '2026-07-20');
    expect(result.map((d) => [d.medicationExternalId, d.scheduledMinute])).toEqual([
      ['m2', 420],
      ['m1', 480],
      ['m1', 1200],
    ]);
    expect(result.every((d) => d.status === 'pending' && d.doseExternalId === null)).toBe(true);
  });

  it('matches an existing dose row to its slot by medication+minute, not array position', () => {
    const meds = [med({ timesOfDay: [480, 1200] })];
    const doses = [dose({ scheduledMinute: 1200, status: 'skipped', externalId: 'd-evening' })];
    const result = expectedDosesForDate(meds, doses, '2026-07-20');
    expect(result.find((d) => d.scheduledMinute === 480)?.status).toBe('pending');
    const evening = result.find((d) => d.scheduledMinute === 1200);
    expect(evening?.status).toBe('skipped');
    expect(evening?.doseExternalId).toBe('d-evening');
  });

  it('excludes medications not active on that date', () => {
    const meds = [med({ archivedAt: '2026-07-01T00:00:00.000Z' })];
    expect(expectedDosesForDate(meds, [], '2026-07-20')).toEqual([]);
  });

  it('ignores dose rows for a different date', () => {
    const meds = [med({ timesOfDay: [480] })];
    const doses = [dose({ scheduledDate: '2026-07-19', scheduledMinute: 480 })];
    const result = expectedDosesForDate(meds, doses, '2026-07-20');
    expect(result[0].status).toBe('pending');
  });
});
