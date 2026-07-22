import { buildMedicationAdherence, currentStreak, type DayAdherence } from '../adherence';
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

describe('buildMedicationAdherence', () => {
  it('reports pct null and zero counts when nothing was due', () => {
    const result = buildMedicationAdherence([], [], ['2026-07-20']);
    expect(result).toEqual([{ date: '2026-07-20', expected: 0, taken: 0, skipped: 0, pct: null }]);
  });

  it('counts taken/skipped correctly and computes pct', () => {
    const meds = [med({ timesOfDay: [480, 1200] })];
    const doses = [
      dose({ scheduledMinute: 480, status: 'taken' }),
      dose({ id: 'd2', externalId: 'd2', scheduledMinute: 1200, status: 'skipped' }),
    ];
    const result = buildMedicationAdherence(meds, doses, ['2026-07-20']);
    expect(result[0]).toEqual({ date: '2026-07-20', expected: 2, taken: 1, skipped: 1, pct: 0.5 });
  });

  it('preserves the input window order', () => {
    const dates = ['2026-07-18', '2026-07-19', '2026-07-20'];
    const result = buildMedicationAdherence([], [], dates);
    expect(result.map((d) => d.date)).toEqual(dates);
  });
});

describe('currentStreak', () => {
  function day(overrides: Partial<DayAdherence>): DayAdherence {
    return { date: '2026-07-20', expected: 0, taken: 0, skipped: 0, pct: null, ...overrides };
  }

  it('is 0 when the most recent due day was not fully taken', () => {
    const days = [day({ date: '2026-07-19', expected: 2, taken: 2, pct: 1 }), day({ date: '2026-07-20', expected: 2, taken: 1, pct: 0.5 })];
    expect(currentStreak(days)).toBe(0);
  });

  it('counts back consecutive fully-taken days and stops at the first shortfall', () => {
    const days = [
      day({ date: '2026-07-17', expected: 1, taken: 0, pct: 0 }),
      day({ date: '2026-07-18', expected: 1, taken: 1, pct: 1 }),
      day({ date: '2026-07-19', expected: 1, taken: 1, pct: 1 }),
      day({ date: '2026-07-20', expected: 1, taken: 1, pct: 1 }),
    ];
    expect(currentStreak(days)).toBe(3);
  });

  it('does not break the streak on a day with nothing due', () => {
    const days = [
      day({ date: '2026-07-18', expected: 1, taken: 1, pct: 1 }),
      day({ date: '2026-07-19', expected: 0, taken: 0, pct: null }),
      day({ date: '2026-07-20', expected: 1, taken: 1, pct: 1 }),
    ];
    expect(currentStreak(days)).toBe(2);
  });

  it('is 0 for an all-empty window', () => {
    const days = [day({ date: '2026-07-19' }), day({ date: '2026-07-20' })];
    expect(currentStreak(days)).toBe(0);
  });
});
