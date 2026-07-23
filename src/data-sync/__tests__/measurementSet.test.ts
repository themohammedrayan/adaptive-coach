import { addManualMeasurementSet } from '../measurementSet';
import { offsetLocalDate } from '../normalize';
import { MemoryStore } from '../store.memory';

const NOW = '2026-07-23T10:00:00.000Z';
const IST = offsetLocalDate(330); // UTC+05:30

describe('addManualMeasurementSet', () => {
  it('logs one row per present field, sharing recordedAtUtc/localDate', async () => {
    const store = new MemoryStore();
    const rows = await addManualMeasurementSet(
      store,
      { recordedAtUtc: NOW, values: { weight: 82.4, waist: 91, body_fat: 21.5 } },
      IST,
      NOW,
    );

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.source).toBe('manual');
      expect(row.recordedAtUtc).toBe(NOW);
      expect(row.localDate).toBe(IST(NOW));
    }
    expect(rows.map((r) => r.metricType).sort()).toEqual(['body_fat', 'waist', 'weight']);
    expect(rows.find((r) => r.metricType === 'weight')?.valueSI).toBe(82.4);
  });

  it('skips fields that are undefined', async () => {
    const store = new MemoryStore();
    const rows = await addManualMeasurementSet(
      store,
      { recordedAtUtc: NOW, values: { weight: 82, waist: undefined, neck: undefined } },
      IST,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].metricType).toBe('weight');
  });

  it('logs nothing when no values are given', async () => {
    const store = new MemoryStore();
    const rows = await addManualMeasurementSet(store, { recordedAtUtc: NOW, values: {} }, IST, NOW);
    expect(rows).toHaveLength(0);
  });

  it('persists every row to the store, independently retrievable', async () => {
    const store = new MemoryStore();
    const rows = await addManualMeasurementSet(
      store,
      { recordedAtUtc: NOW, values: { chest: 100, hips: 95 } },
      IST,
      NOW,
    );
    for (const row of rows) {
      const stored = await store.get('manual', row.externalId);
      expect(stored).toEqual(row);
    }
  });
});
