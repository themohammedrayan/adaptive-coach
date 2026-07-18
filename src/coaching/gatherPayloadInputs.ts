import type { BodyMetricsStore } from '../data-sync';
import { buildMeasurementSeries } from '../data-sync';
import { addDays, computeTrend, dateRange, DEFAULT_CONFIG } from '../engine';
import type { Measurement, IsoDate, Profile, TrendPoint } from '../engine';
import { dailyTotals } from '../food-log';
import type { DailyTotals, FoodLogStore } from '../food-log';

export interface PayloadInputDeps {
  foodLogStore: FoodLogStore;
  dataSyncStore: BodyMetricsStore;
}

export interface PayloadInputs {
  last14: DailyTotals[];
  measurements: Measurement[];
  trend: TrendPoint[];
}

/**
 * Coaching BRD §4 sibling — gathers the last-14-days food totals, weight
 * measurements, and EWMA trend that both a fresh weekly recompute
 * (dashboard/refreshSnapshot.ts) and an ad-hoc chat turn (coach-chat/
 * askCoach.ts) need to build a CoachPayload from, so both do it from one
 * shared code path instead of two independently-maintained copies.
 */
export async function gatherPayloadInputs(
  deps: PayloadInputDeps,
  profile: Profile,
  today: IsoDate,
): Promise<PayloadInputs> {
  const last14 = await Promise.all(
    dateRange(addDays(today, -13), today).map((date) => dailyTotals(deps.foodLogStore, date)),
  );

  const range = { start: profile.startDate, end: today };
  const weightRows = await deps.dataSyncStore.listByType('weight', range);
  const measurements = buildMeasurementSeries(weightRows, range, 'earliest');
  const trend = computeTrend(
    measurements,
    { start: addDays(today, -13), end: today },
    DEFAULT_CONFIG.ewmaHalfLifeDays,
  );

  return { last14, measurements, trend };
}
