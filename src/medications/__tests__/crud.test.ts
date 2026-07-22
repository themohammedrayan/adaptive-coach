import { archiveMedication, buildMedication, editMedication, setDoseStatus } from '../crud';
import type { MedicationDose } from '../types';

const NOW = '2026-07-20T08:00:00.000Z';
let counter = 0;
const genId = () => `id-${++counter}`;

beforeEach(() => {
  counter = 0;
});

describe('buildMedication', () => {
  it('defaults daysOfWeek to every day and reminderEnabled to true', () => {
    const med = buildMedication({ name: 'Metformin', dose: '500 mg', timesOfDay: [480], startDate: '2026-07-20' }, NOW, genId);
    expect(med).toEqual({
      id: 'id-1',
      externalId: 'id-1',
      name: 'Metformin',
      dose: '500 mg',
      notes: null,
      timesOfDay: [480],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: '2026-07-20',
      endDate: null,
      reminderEnabled: true,
      archivedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('sorts timesOfDay and honors explicit overrides', () => {
    const med = buildMedication(
      {
        name: 'Lisinopril',
        dose: '10 mg',
        timesOfDay: [1200, 420],
        daysOfWeek: [1, 3, 5],
        startDate: '2026-07-20',
        endDate: '2026-08-20',
        reminderEnabled: false,
        notes: 'With food',
      },
      NOW,
      genId,
    );
    expect(med.timesOfDay).toEqual([420, 1200]);
    expect(med.daysOfWeek).toEqual([1, 3, 5]);
    expect(med.endDate).toBe('2026-08-20');
    expect(med.reminderEnabled).toBe(false);
    expect(med.notes).toBe('With food');
  });
});

describe('editMedication', () => {
  it('replaces fields and bumps updatedAt, keeping id/externalId/createdAt/archivedAt', () => {
    const med = buildMedication({ name: 'Metformin', dose: '500 mg', timesOfDay: [480], startDate: '2026-07-20' }, NOW, genId);
    const later = '2026-07-21T09:00:00.000Z';
    const edited = editMedication(med, { name: 'Metformin XR', dose: '750 mg', timesOfDay: [540], startDate: '2026-07-20' }, later);
    expect(edited.id).toBe(med.id);
    expect(edited.createdAt).toBe(NOW);
    expect(edited.name).toBe('Metformin XR');
    expect(edited.dose).toBe('750 mg');
    expect(edited.timesOfDay).toEqual([540]);
    expect(edited.updatedAt).toBe(later);
  });
});

describe('archiveMedication', () => {
  it('sets archivedAt and bumps updatedAt', () => {
    const med = buildMedication({ name: 'Metformin', dose: '500 mg', timesOfDay: [480], startDate: '2026-07-20' }, NOW, genId);
    const archived = archiveMedication(med, '2026-07-22T00:00:00.000Z');
    expect(archived.archivedAt).toBe('2026-07-22T00:00:00.000Z');
    expect(archived.updatedAt).toBe('2026-07-22T00:00:00.000Z');
  });
});

describe('setDoseStatus', () => {
  it('creates a fresh taken dose when none exists, with takenAt set from nowIso', () => {
    const result = setDoseStatus('m1', '2026-07-20', 480, 'taken', null, NOW, genId);
    expect(result).toEqual({
      id: 'id-1',
      externalId: 'id-1',
      medicationExternalId: 'm1',
      scheduledDate: '2026-07-20',
      scheduledMinute: 480,
      status: 'taken',
      takenAt: NOW,
      snoozedUntil: null,
      updatedAt: NOW,
    });
  });

  it('sets snoozedUntil 15 minutes after nowIso for a snoozed dose', () => {
    const result = setDoseStatus('m1', '2026-07-20', 480, 'snoozed', null, NOW, genId);
    expect(result?.snoozedUntil).toBe('2026-07-20T08:15:00.000Z');
    expect(result?.takenAt).toBeNull();
  });

  it('leaves both timestamps null for a skipped dose', () => {
    const result = setDoseStatus('m1', '2026-07-20', 480, 'skipped', null, NOW, genId);
    expect(result?.takenAt).toBeNull();
    expect(result?.snoozedUntil).toBeNull();
  });

  it('swaps status in place when an existing dose has a different status', () => {
    const existing: MedicationDose = {
      id: 'd1',
      externalId: 'd1',
      medicationExternalId: 'm1',
      scheduledDate: '2026-07-20',
      scheduledMinute: 480,
      status: 'skipped',
      takenAt: null,
      snoozedUntil: null,
      updatedAt: '2026-07-20T07:00:00.000Z',
    };
    const result = setDoseStatus('m1', '2026-07-20', 480, 'taken', existing, NOW, genId);
    expect(result?.status).toBe('taken');
    expect(result?.takenAt).toBe(NOW);
    expect(result?.medicationExternalId).toBe('m1');
    expect(result?.scheduledMinute).toBe(480);
  });

  it('returns null (clear to pending) when re-tapping the same status', () => {
    const existing: MedicationDose = {
      id: 'd1',
      externalId: 'd1',
      medicationExternalId: 'm1',
      scheduledDate: '2026-07-20',
      scheduledMinute: 480,
      status: 'taken',
      takenAt: '2026-07-20T07:00:00.000Z',
      snoozedUntil: null,
      updatedAt: '2026-07-20T07:00:00.000Z',
    };
    expect(setDoseStatus('m1', '2026-07-20', 480, 'taken', existing, NOW, genId)).toBeNull();
  });
});
