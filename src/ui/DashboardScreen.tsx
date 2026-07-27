import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getChallengeRuntime } from '../challenges/runtime';
import { buildMeasurementSeries, KV } from '../data-sync';
import type { BodyMetricRow, MetricType } from '../data-sync';
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
import { syncWallpaperSnapshot } from '../wallpaper';
import type { Tab } from './health/HealthApp';
import { AppButton, Card, Overline, Row, SegmentedControl } from './kit';
import { space, type, useTheme } from './theme';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' },
];

export function DashboardScreen({
  onOpenHealth,
  onOpenFinance,
}: {
  onOpenHealth?: (tab?: Tab) => void;
  onOpenFinance?: () => void;
}) {
  const t = useTheme();
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    const [dashRt, foodRt, dataRt, challengeRt] = await Promise.all([
      getDashboardRuntime(),
      getFoodLogRuntime(),
      getDataSyncRuntime(),
      getChallengeRuntime(),
    ]);
    const today = foodRt.toLocalDate(foodRt.nowUtc());
    setToday(today);
    const snap = await refreshDashboardSnapshot(
      {
        dashboardStore: dashRt.store,
        foodLogStore: foodRt.store,
        dataSyncStore: dataRt.store,
        challengeStore: challengeRt.store,
      },
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

    const [leanMassRows, boneMassRows, bodyWaterRows, grantedTypesRaw]: [
      BodyMetricRow[],
      BodyMetricRow[],
      BodyMetricRow[],
      string | null,
    ] = await Promise.all([
      dataRt.store.listByType('lean_mass', dateRangeSpec),
      dataRt.store.listByType('bone_mass', dateRangeSpec),
      dataRt.store.listByType('body_water', dateRangeSpec),
      dataRt.store.getKV(KV.grantedTypes),
    ]);
    const grantedTypes: MetricType[] | null = grantedTypesRaw !== null ? JSON.parse(grantedTypesRaw) : null;
    setBodyComposition(
      buildBodyCompositionSummary(
        {
          weight: weightRows,
          lean_mass: leanMassRows,
          bone_mass: boneMassRows,
          body_water: bodyWaterRows,
        },
        dateRangeSpec,
        grantedTypes,
      ),
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const { snap, today } = await loadSnapshot();
      if (snap.profile !== null) {
        await loadCharts(snap.primaryChallenge?.startDate ?? today, today, range);
      }
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [loadSnapshot, loadCharts, range]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (snapshot?.profile === null || snapshot === null) return;
    const foodRt = getFoodLogRuntime();
    const anchor = snapshot.primaryChallenge?.startDate;
    void foodRt.then((rt) => {
      const today = rt.toLocalDate(rt.nowUtc());
      return loadCharts(anchor ?? today, today, range);
    });
  }, [range, snapshot, loadCharts]);

  useEffect(() => {
    if (snapshot === null || snapshot.result === null || today === null) return;
    const primary = snapshot.primaryChallenge;
    if (primary === null) return;
    const progress = buildChallengeProgress(
      primary.goalWeightKg,
      primary.startDate,
      primary.horizonDays,
      primary.startWeightKg,
      snapshot.liveTrendWeightKg ?? snapshot.result.trendWeightKg,
      snapshot.result.projectedFinishDate,
      today,
    );
    void syncWallpaperSnapshot(progress, today);
  }, [snapshot, today]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (snapshot === null) {
    return (
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.noChallenge}>
          <Text style={[type.caption, { color: t.muted, textAlign: 'center' }]}>
            {loadError !== null ? `Couldn't load your dashboard: ${loadError}` : 'Loading…'}
          </Text>
          {loadError !== null && <AppButton title="Retry" onPress={() => void load()} variant="secondary" small />}
        </View>
      </ScrollView>
    );
  }

  // Profile creation is handled by the app-level onboarding gate.
  if (snapshot.profile === null) return null;

  const todayTotals = snapshot.last14[snapshot.last14.length - 1] ?? null;
  const consumed = todayTotals ? toMacros(todayTotals) : { proteinG: 0, carbG: 0, fatG: 0, fiberG: 0 };
  const adherence = buildAdherenceSummary(snapshot.last14, snapshot.result?.targetKcal ?? null);
  const primary = snapshot.primaryChallenge;
  const challenge =
    snapshot.result !== null && primary !== null && today !== null
      ? buildChallengeProgress(
          primary.goalWeightKg,
          primary.startDate,
          primary.horizonDays,
          primary.startWeightKg,
          snapshot.liveTrendWeightKg ?? snapshot.result.trendWeightKg,
          snapshot.result.projectedFinishDate,
          today,
        )
      : null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={styles.card}>
        <Row style={styles.cardHeader}>
          <Overline>Today</Overline>
          {isEmptyConsumption(consumed) && onOpenHealth !== undefined && (
            <AppButton title="Log food" onPress={() => onOpenHealth('food')} variant="ghost" small />
          )}
        </Row>
        {snapshot.result !== null ? (
          <MacroRings target={snapshot.result.macros} consumed={consumed} />
        ) : primary === null ? (
          <View style={styles.noChallenge}>
            <Text style={[type.caption, { color: t.muted, textAlign: 'center' }]}>
              No active weight goal — create one from the Goals tab to get a daily target.
            </Text>
          </View>
        ) : (
          <Text style={[type.caption, { color: t.muted, textAlign: 'center' }]}>
            Building your target — check back after logging a few days.
          </Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Overline>Weight trend</Overline>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
        <WeightTrendChart
          raw={weightSeries.raw}
          trend={weightSeries.trend}
          goalWeight={primary?.goalWeightKg ?? null}
          projectedFinish={snapshot.result?.projectedFinishDate ?? null}
          range={range}
        />
      </Card>

      {challenge !== null && (
        <Card style={styles.card}>
          <Overline>Challenge</Overline>
          <ChallengeCard progress={challenge} />
        </Card>
      )}

      <Card style={styles.card}>
        <Overline>Last 14 days</Overline>
        <AdherenceStrip days={adherence.days} avgIntake={adherence.avgIntake} avgTarget={adherence.avgTarget} />
      </Card>

      {bodyFatSeries.length > 0 && (
        <Card style={styles.card}>
          <Overline>Body fat</Overline>
          <BodyFatTrend series={bodyFatSeries} />
        </Card>
      )}

      {bodyComposition.some((e) => e.latestValue !== null) && (
        <Card style={styles.card}>
          <Overline>Body composition</Overline>
          <BodyCompositionCard entries={bodyComposition} />
        </Card>
      )}

      <Card style={styles.card}>
        <Row style={styles.cardHeader}>
          <Overline>Coach</Overline>
          {onOpenHealth !== undefined && coachNote !== null && (
            <AppButton title="All notes" onPress={() => onOpenHealth('coach')} variant="ghost" small />
          )}
        </Row>
        <LatestCoachNote note={coachNote} />
      </Card>

      {(onOpenHealth !== undefined || onOpenFinance !== undefined) && (
        <Card style={styles.card}>
          <Overline>Open</Overline>
          <Row gap={space.m}>
            {onOpenHealth !== undefined && (
              <View style={styles.openButton}>
                <AppButton title="Health" onPress={() => onOpenHealth()} variant="secondary" />
              </View>
            )}
            {onOpenFinance !== undefined && (
              <View style={styles.openButton}>
                <AppButton title="Finance" onPress={onOpenFinance} variant="secondary" />
              </View>
            )}
          </Row>
        </Card>
      )}

      {remindersWarning !== null && (
        <Text style={[type.caption, { color: t.warning, textAlign: 'center' }]}>
          Reminders unavailable: {remindersWarning}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.l, paddingTop: space.s, gap: space.m, paddingBottom: space.xl },
  card: { gap: space.m },
  cardHeader: { justifyContent: 'space-between' },
  noChallenge: { alignItems: 'center', gap: space.s },
  openButton: { flex: 1 },
});
