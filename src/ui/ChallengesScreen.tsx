import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import {
  deleteChallenge,
  listChallenges,
  pauseChallenge,
  restartChallenge,
  resumeChallenge,
  setPrimaryChallenge,
  type Challenge,
} from '../challenges';
import { getChallengeRuntime } from '../challenges/runtime';
import { buildMeasurementSeries, deviceLocalDate } from '../data-sync';
import { getDataSyncRuntime } from '../data-sync/runtime';
import { buildChallengeProgress, type ChallengeProgress } from '../dashboard';
import { ChallengeCard } from '../dashboard/components/ChallengeCard';
import { getDashboardRuntime } from '../dashboard/runtime';
import { addDays, computeTrend, DEFAULT_CONFIG, trendAt } from '../engine';
import { AppButton, Card, Chip, EmptyState, FAB, Overline, Row } from './kit';
import { radius, space, type, useTheme } from './theme';

interface Section {
  title: string;
  data: Challenge[];
}

/**
 * Challenges tab — create/pause/resume/set-primary/restart/delete for
 * weight challenges. Only the primary active challenge drives the engine's
 * daily prescription (its onPace/projectedFinishDate); every other active
 * challenge tracks its own kcal-banked progress against the same shared
 * weight trend, purely for display.
 */
export function ChallengesScreen() {
  const t = useTheme();
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [progressById, setProgressById] = useState<Map<string, ChallengeProgress>>(new Map());
  const [actionChallenge, setActionChallenge] = useState<Challenge | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [challengeRt, dataRt, dashRt] = await Promise.all([
      getChallengeRuntime(),
      getDataSyncRuntime(),
      getDashboardRuntime(),
    ]);
    const today = deviceLocalDate(new Date().toISOString());

    const [active, paused] = await Promise.all([
      listChallenges(challengeRt.store, 'weight', ['active']),
      listChallenges(challengeRt.store, 'weight', ['paused']),
    ]);

    // The shared weight trend every challenge's kcal-banked figure is measured
    // against — same EWMA the engine uses, computed independently of any one
    // challenge's own startDate so it reads the same for all of them.
    const range = { start: addDays(today, -365), end: today };
    const weightRows = await dataRt.store.listByType('weight', range);
    const measurements = buildMeasurementSeries(weightRows, range, 'earliest');
    const trendPoints = computeTrend(measurements, { end: today }, DEFAULT_CONFIG.ewmaHalfLifeDays);
    const cachedResult = await dashRt.store.getLastResult();

    const next = new Map<string, ChallengeProgress>();
    for (const c of [...active, ...paused]) {
      const trendWeightKg = trendAt(trendPoints, today) ?? c.startWeightKg;
      const projectedFinishDate = c.isPrimary ? cachedResult?.result.projectedFinishDate ?? null : null;
      next.set(
        c.id,
        buildChallengeProgress(c.goalWeightKg, c.startDate, c.horizonDays, c.startWeightKg, trendWeightKg, projectedFinishDate, today),
      );
    }
    setProgressById(next);
    setSections(
      [
        { title: 'Active', data: active },
        { title: 'Paused', data: paused },
      ].filter((s) => s.data.length > 0),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nowUtc = () => new Date().toISOString();
  const today = () => deviceLocalDate(new Date().toISOString());

  const doAction = async (action: (store: Awaited<ReturnType<typeof getChallengeRuntime>>['store']) => Promise<unknown>) => {
    const rt = await getChallengeRuntime();
    await action(rt.store);
    setActionChallenge(null);
    await load();
  };

  const onPause = (c: Challenge) => doAction((store) => pauseChallenge(store, c.id, nowUtc()));
  const onResume = (c: Challenge) => doAction((store) => resumeChallenge(store, c.id, nowUtc()));
  const onSetPrimary = (c: Challenge) => doAction((store) => setPrimaryChallenge(store, c.id, nowUtc()));

  const onRestart = (c: Challenge) => {
    Alert.alert(
      'Restart this challenge?',
      'Day count and kcal bank reset to today, using your current trend weight as the new starting point. The goal stays the same.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: () => {
            void (async () => {
              const dataRt = await getDataSyncRuntime();
              const t = today();
              const recent = await dataRt.listRecentWeights(1);
              const currentWeightKg = recent[0]?.valueSI ?? c.startWeightKg;
              await doAction((store) => restartChallenge(store, c.id, nowUtc(), t, currentWeightKg));
            })();
          },
        },
      ],
    );
  };

  const onDelete = (c: Challenge) => {
    Alert.alert('Delete this challenge?', `Goal: ${c.goalWeightKg}kg`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void doAction((store) => deleteChallenge(store, c.id, nowUtc())),
      },
    ]);
  };

  if (!loaded) return null;

  return (
    <View style={styles.flex}>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => <Overline style={styles.sectionTitle}>{section.title}</Overline>}
        ListEmptyComponent={<EmptyState message="No challenges yet — tap + to create one." />}
        renderItem={({ item }) => {
          const progress = progressById.get(item.id);
          return (
            <Pressable onLongPress={() => setActionChallenge(item)}>
              <Card style={styles.card}>
                <Row style={styles.cardHeader}>
                  <Text style={[type.heading, { color: t.ink }]}>{item.goalWeightKg}kg goal</Text>
                  {item.isPrimary && <Chip label="Primary" active onPress={() => {}} />}
                </Row>
                {progress && <ChallengeCard progress={progress} />}
              </Card>
            </Pressable>
          );
        }}
      />

      <FAB icon="plus" accessibilityLabel="Create challenge" onPress={() => router.push('/create-challenge')} />

      <Modal
        visible={actionChallenge !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActionChallenge(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setActionChallenge(null)} />
        <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <View style={[styles.handle, { backgroundColor: t.wash }]} />
          {actionChallenge !== null && (
            <View style={styles.sheetBody}>
              <Text style={[type.heading, { color: t.ink }]}>{actionChallenge.goalWeightKg}kg goal</Text>
              {actionChallenge.status === 'active' ? (
                <AppButton title="Pause" onPress={() => onPause(actionChallenge)} variant="secondary" />
              ) : (
                <AppButton title="Resume" onPress={() => onResume(actionChallenge)} variant="secondary" />
              )}
              {actionChallenge.status === 'active' && !actionChallenge.isPrimary && (
                <AppButton title="Set as primary" onPress={() => onSetPrimary(actionChallenge)} variant="secondary" />
              )}
              <AppButton title="Restart" onPress={() => onRestart(actionChallenge)} variant="secondary" />
              <AppButton title="Delete" onPress={() => onDelete(actionChallenge)} variant="danger" />
              <AppButton title="Cancel" onPress={() => setActionChallenge(null)} variant="ghost" />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, paddingTop: space.s, gap: space.m },
  sectionTitle: { marginTop: space.s, marginBottom: space.xs },
  card: { gap: space.m, marginBottom: space.m },
  cardHeader: { justifyContent: 'space-between' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: radius.card + 8,
    borderTopRightRadius: radius.card + 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: space.s },
  sheetBody: { padding: space.l, gap: space.m },
});
