import { useCallback, useEffect, useState } from 'react';
import { Button, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildMeasurementSeries } from '../data-sync';
import type { BodyMetricRow } from '../data-sync';
import { getDataSyncRuntime } from '../data-sync/runtime';
import {
  buildAdherenceSummary,
  buildBodyCompositionSummary,
  buildBodyFatSeries,
  buildChallengeProgress,
  buildWeightSeries,
  configureNotificationHandler,
  isEmptyConsumption,
  refreshDashboardSnapshot,
  scheduleReminders,
  toMacros,
  type BodyCompositionEntry,
  type DashboardSnapshot,
  type Point,
  type Range,
} from '../dashboard';
import { AdherenceStrip } from '../dashboard/components/AdherenceStrip';
import { BodyCompositionCard } from '../dashboard/components/BodyCompositionCard';
import { BodyFatTrend } from '../dashboard/components/BodyFatTrend';
import { ChallengeCard } from '../dashboard/components/ChallengeCard';
import { LatestCoachNote } from '../dashboard/components/LatestCoachNote';
import { MacroRings } from '../dashboard/components/MacroRings';
import { WeightTrendChart } from '../dashboard/components/WeightTrendChart';
import { getDashboardRuntime } from '../dashboard/runtime';
import { addDays } from '../engine';
import type { IsoDate } from '../engine';
import { getLatestCoachNote, type CoachNote } from '../coaching';
import { getFoodLogRuntime } from '../food-log/runtime';
import { ProfileSetupScreen } from './ProfileSetupScreen';

const RANGE_OPTIONS: Range[] = ['30', '90', 'all'];

export function DashboardScreen() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [range, setRange] = useState<Range>('30');
  const [weightSeries, setWeightSeries] = useState<{ raw: Point[]; trend: Point[] }>({
    raw: [],
    trend: [],
  });
  const [bodyFatSeries, setBodyFatSeries] = useState<Point[]>([]);
  const [bodyComposition, setBodyComposition] = useState<BodyCompositionEntry[]>([]);
  const [today, setToday] = useState<IsoDate | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [remindersWarning, setRemindersWarning] = useState<string | null>(null);
  const [coachNote, setCoachNote] = useState<CoachNote | null>(null);

  const loadSnapshot = useCallback(async () => {
    const [dashRt, foodRt, dataRt] = await Promise.all([
      getDashboardRuntime(),
      getFoodLogRuntime(),
      getDataSyncRuntime(),
    ]);
    const today = foodRt.toLocalDate(foodRt.nowUtc());
    setToday(today);
    const snap = await refreshDashboardSnapshot(
      { dashboardStore: dashRt.store, foodLogStore: foodRt.store, dataSyncStore: dataRt.store },
      today,
    );
    setSnapshot(snap);
    void getLatestCoachNote().then(setCoachNote).catch(() => {});

    if (snap.profile !== null) {
      configureNotificationHandler();
      try {
        await scheduleReminders(await dashRt.store.getReminderConfig());
        setRemindersWarning(null);
      } catch (e) {
        // Permission denial or scheduling failure must never affect the rest of the screen (BRD §B2)
        // — but it should be visible, not silent.
        setRemindersWarning(e instanceof Error ? e.message : String(e));
      }
    }
    return { snap, today };
  }, []);

  const loadCharts = useCallback(async (profileStartDate: string, today: string, selectedRange: Range) => {
    const dataRt = await getDataSyncRuntime();
    const start =
      selectedRange === '30'
        ? addDays(today, -29)
        : selectedRange === '90'
          ? addDays(today, -89)
          : profileStartDate;
    const dateRangeSpec = { start, end: today };

    const weightRows: BodyMetricRow[] = await dataRt.store.listByType('weight', dateRangeSpec);
    const measurements = buildMeasurementSeries(weightRows, dateRangeSpec, 'earliest');
    setWeightSeries(buildWeightSeries(measurements, dateRangeSpec));

    const bodyFatRows: BodyMetricRow[] = await dataRt.store.listByType('body_fat', dateRangeSpec);
    setBodyFatSeries(buildBodyFatSeries(bodyFatRows, dateRangeSpec));

    const [leanMassRows, boneMassRows, bodyWaterRows]: BodyMetricRow[][] = await Promise.all([
      dataRt.store.listByType('lean_mass', dateRangeSpec),
      dataRt.store.listByType('bone_mass', dateRangeSpec),
      dataRt.store.listByType('body_water', dateRangeSpec),
    ]);
    setBodyComposition(
      buildBodyCompositionSummary(
        {
          weight: weightRows,
          lean_mass: leanMassRows,
          bone_mass: boneMassRows,
          body_water: bodyWaterRows,
        },
        dateRangeSpec,
      ),
    );
  }, []);

  const load = useCallback(async () => {
    const { snap, today } = await loadSnapshot();
    if (snap.profile !== null) {
      await loadCharts(snap.profile.startDate, today, range);
    }
  }, [loadSnapshot, loadCharts, range]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (snapshot?.profile === null || snapshot === null) return;
    const foodRt = getFoodLogRuntime();
    void foodRt.then((rt) => loadCharts(snapshot.profile!.startDate, rt.toLocalDate(rt.nowUtc()), range));
  }, [range, snapshot, loadCharts]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (snapshot === null) return null;
  if (snapshot.profile === null) return <ProfileSetupScreen onDone={load} />;

  const todayTotals = snapshot.last14[snapshot.last14.length - 1] ?? null;
  const consumed = todayTotals ? toMacros(todayTotals) : { proteinG: 0, carbG: 0, fatG: 0, fiberG: 0 };
  const adherence = buildAdherenceSummary(snapshot.last14, snapshot.result?.targetKcal ?? null);
  const challenge =
    snapshot.result !== null && snapshot.engineState !== null && today !== null
      ? buildChallengeProgress(snapshot.profile, snapshot.engineState.startWeightKg, snapshot.result, today)
      : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((r) => (
          <Button key={r} title={r === 'all' ? 'All' : `${r}d`} onPress={() => setRange(r)} disabled={range === r} />
        ))}
      </View>

      <WeightTrendChart
        raw={weightSeries.raw}
        trend={weightSeries.trend}
        goalWeight={snapshot.profile.goalWeightKg}
        projectedFinish={snapshot.result?.projectedFinishDate ?? null}
        range={range}
      />

      {challenge !== null && <ChallengeCard progress={challenge} />}

      {snapshot.result !== null ? (
        <MacroRings target={snapshot.result.macros} consumed={consumed} />
      ) : (
        <Text style={styles.pending}>Building your target — check back after logging a few days.</Text>
      )}

      <AdherenceStrip days={adherence.days} avgIntake={adherence.avgIntake} avgTarget={adherence.avgTarget} />

      <BodyFatTrend series={bodyFatSeries} />

      <BodyCompositionCard entries={bodyComposition} />

      <LatestCoachNote note={coachNote} />

      {isEmptyConsumption(consumed) && (
        <Text style={styles.hint}>Nothing logged today yet — head to the Food Log tab.</Text>
      )}

      {remindersWarning !== null && (
        <Text style={styles.hint}>Reminders unavailable: {remindersWarning}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  rangeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  pending: { textAlign: 'center', color: '#999', marginVertical: 16 },
  hint: { textAlign: 'center', color: '#999', marginTop: 12, fontSize: 12 },
});
