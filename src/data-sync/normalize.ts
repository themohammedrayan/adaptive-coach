import { deviceLocalDate, offsetLocalDate, type InstantToLocalDate } from '../lib/dates';
import type { BodyMetricRow, HCRecord, HCUnit } from './types';

export type { InstantToLocalDate };
export { deviceLocalDate, offsetLocalDate };

const KG_PER_LB = 0.45359237;

function toSI(value: number, unit: HCUnit): number {
  switch (unit) {
    case 'kg':
    case 'percent':
    case 'cm':
    case 'kcal_per_day':
      return value;
    case 'lb':
      return value * KG_PER_LB;
    case 'fraction': // HC BodyFat is 0–1
      return value * 100;
    case 'm':
      return value * 100;
  }
}

/**
 * Data-Sync BRD §6 — HC record → BodyMetricRow. Returns null for records that
 * must be ignored (future-dated, BRD §10 clock-skew guard).
 */
export function normalizeRecord(
  rec: HCRecord,
  toLocalDate: InstantToLocalDate,
  nowUtc: string,
): BodyMetricRow | null {
  if (Date.parse(rec.recordedAtUtc) > Date.parse(nowUtc)) return null;
  return {
    id: `health_connect:${rec.externalId}`,
    metricType: rec.metricType,
    valueSI: toSI(rec.value, rec.unit),
    source: 'health_connect',
    externalId: rec.externalId,
    dataOrigin: rec.dataOrigin,
    recordedAtUtc: rec.recordedAtUtc,
    localDate: toLocalDate(rec.recordedAtUtc),
    ingestedAt: nowUtc,
    deletedAt: null,
    pendingPush: true,
  };
}
