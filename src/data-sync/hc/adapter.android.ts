import {
  getChanges,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type { Permission, RecordType } from 'react-native-health-connect';
import type { HealthConnectAdapter } from '../sync';
import type { HCRecord, MetricType, SdkAvailability } from '../types';

/**
 * Data-Sync BRD §3 — record types we read, mapped to internal metric types.
 * Partial: circumference/tape measurements (Log Measurements screen) are
 * manual-only and have no Health Connect record type.
 */
const RECORD_TYPE_BY_METRIC: Partial<Record<MetricType, RecordType>> = {
  weight: 'Weight',
  body_fat: 'BodyFat',
  lean_mass: 'LeanBodyMass',
  bone_mass: 'BoneMass',
  body_water: 'BodyWaterMass',
  height: 'Height',
  bmr: 'BasalMetabolicRate',
};
const METRIC_BY_RECORD_TYPE = Object.fromEntries(
  Object.entries(RECORD_TYPE_BY_METRIC).map(([m, r]) => [r, m]),
) as Partial<Record<RecordType, MetricType>>;

/** Flatten one HC record into the adapter contract; null when unusable. */
function toHCRecord(record: {
  recordType?: string;
  time?: string;
  metadata?: { id?: string; dataOrigin?: string };
  [key: string]: unknown;
}): HCRecord | null {
  const metricType = record.recordType
    ? METRIC_BY_RECORD_TYPE[record.recordType as RecordType]
    : undefined;
  const externalId = record.metadata?.id;
  const time = record.time;
  if (!metricType || !externalId || !time) return null;

  const r = record as Record<string, { inKilograms?: number; inMeters?: number; inKilocaloriesPerDay?: number } | number | undefined>;
  let value: number | undefined;
  let unit: HCRecord['unit'];
  switch (metricType) {
    case 'weight':
      value = (r.weight as { inKilograms?: number } | undefined)?.inKilograms;
      unit = 'kg';
      break;
    case 'body_fat':
      value = r.percentage as number | undefined;
      unit = 'percent';
      break;
    case 'lean_mass':
    case 'bone_mass':
    case 'body_water':
      value = (r.mass as { inKilograms?: number } | undefined)?.inKilograms;
      unit = 'kg';
      break;
    case 'height':
      value = (r.height as { inMeters?: number } | undefined)?.inMeters;
      unit = 'm';
      break;
    case 'bmr':
      value = (r.basalMetabolicRate as { inKilocaloriesPerDay?: number } | undefined)
        ?.inKilocaloriesPerDay;
      unit = 'kcal_per_day';
      break;
    default:
      // Manual-only types (circumferences, etc.) never come from METRIC_BY_RECORD_TYPE.
      return null;
  }
  if (typeof value !== 'number') return null;

  return {
    externalId,
    dataOrigin: record.metadata?.dataOrigin ?? null,
    recordedAtUtc: time,
    metricType,
    value,
    unit,
  };
}

export function createHealthConnectAdapter(): HealthConnectAdapter {
  let initialized = false;
  const ensureInit = async () => {
    if (!initialized) {
      initialized = await initialize();
    }
    return initialized;
  };
  const recordTypes = Object.values(RECORD_TYPE_BY_METRIC);

  const mintChangesToken = async (): Promise<string | null> => {
    await ensureInit();
    try {
      return (await getChanges({ recordTypes })).nextChangesToken ?? null;
    } catch {
      return null;
    }
  };

  return {
    async getSdkStatus(): Promise<SdkAvailability> {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        return 'update_required';
      }
      return 'unavailable';
    },

    async ensurePermissions(types: MetricType[]): Promise<MetricType[]> {
      await ensureInit();
      // Manual-only types (circumferences, etc.) have no HC record type — never requested.
      const hcTypes = types.filter((t) => RECORD_TYPE_BY_METRIC[t] !== undefined);
      const wanted: Permission[] = hcTypes.map((t) => ({
        accessType: 'read',
        recordType: RECORD_TYPE_BY_METRIC[t] as RecordType,
      }));
      const has = (granted: { accessType?: string; recordType?: string }[], p: Permission) =>
        granted.some((g) => g.accessType === p.accessType && g.recordType === p.recordType);

      let granted = (await getGrantedPermissions()) as { accessType?: string; recordType?: string }[];
      if (!wanted.every((p) => has(granted, p))) {
        granted = (await requestPermission(wanted)) as { accessType?: string; recordType?: string }[];
      }
      return hcTypes.filter((t) =>
        has(granted, { accessType: 'read', recordType: RECORD_TYPE_BY_METRIC[t] as RecordType }),
      );
    },

    async read({ changesToken, sinceIso, untilIso }) {
      await ensureInit();

      const fullRead = async () => {
        const records: HCRecord[] = [];
        for (const recordType of recordTypes) {
          try {
            const res = await readRecords(recordType, {
              timeRangeFilter: { operator: 'between', startTime: sinceIso, endTime: untilIso },
            });
            for (const rec of res.records) {
              const mapped = toHCRecord({ ...rec, recordType });
              if (mapped) records.push(mapped);
            }
          } catch {
            // a single denied/unsupported type must not break the sync (partial grants are valid)
          }
        }
        // mint a fresh token so the next sync can be incremental
        const nextChangesToken = await mintChangesToken();
        return { records, deletedExternalIds: [], nextChangesToken };
      };

      if (!changesToken) return fullRead();

      // Incremental via the Changes API; expired tokens fall back to a full read (BRD §5).
      const records: HCRecord[] = [];
      const deletedExternalIds: string[] = [];
      let token = changesToken;
      try {
        for (;;) {
          const res = await getChanges({ changesToken: token });
          if (res.changesTokenExpired) return fullRead();
          for (const change of res.upsertionChanges) {
            const mapped = toHCRecord(change.record as Parameters<typeof toHCRecord>[0]);
            if (mapped) records.push(mapped);
          }
          for (const del of res.deletionChanges) deletedExternalIds.push(del.recordId);
          token = res.nextChangesToken;
          if (!res.hasMore) break;
        }
      } catch {
        return fullRead();
      }
      return { records, deletedExternalIds, nextChangesToken: token };
    },

    mintChangesToken,
  };
}
