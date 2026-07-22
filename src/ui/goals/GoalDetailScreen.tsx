import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  deleteChallenge,
  pauseChallenge,
  restartChallenge,
  resumeChallenge,
  setPrimaryChallenge,
  type Challenge,
  type ChallengeStore,
} from '../../challenges';
import { getChallengeRuntime } from '../../challenges/runtime';
import { buildMeasurementSeries, deviceLocalDate } from '../../data-sync';
import { getDataSyncRuntime } from '../../data-sync/runtime';
import { buildChallengeProgress, type ChallengeProgress } from '../../dashboard';
import { ChallengeCard } from '../../dashboard/components/ChallengeCard';
import { getDashboardRuntime } from '../../dashboard/runtime';
import { addDays, computeTrend, DEFAULT_CONFIG, diffDays, trendAt } from '../../engine';
import * as financeApi from '../../finance/api';
import { formatMoneyMinor } from '../../finance/money';
import type { Account, FinanceGoal } from '../../finance/types';
import { buildMilestoneItem } from '../../goals/crud';
import type { GoalProgress } from '../../goals/types';
import { AppButton, Card, EmptyState, Field, ProgressBar, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { useGoalsData } from './GoalsDataContext';

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTheme();
  return (
    <Row style={styles.header}>
      <AppButton title="← Back" onPress={onBack} variant="ghost" small />
      <Text style={[type.heading, { color: t.ink, flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </Row>
  );
}

/** Goals BRD §G.5 — per-type progress + actions, reusing each domain's existing display/logic rather than rebuilding it. */
export function GoalDetailScreen({ goalId, onBack }: { goalId: string; onBack: () => void }) {
  const t = useTheme();
  const goalsData = useGoalsData();
  const goal = goalsData.goals.find((g) => g.id === goalId) ?? null;
  const progress = goalsData.progressByGoalId.get(goalId);

  if (goal === null) {
    return (
      <View style={styles.flex}>
        <Header title="Goal" onBack={onBack} />
        <EmptyState message="This goal is no longer available." />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Header title={goal.title} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.body}>
        {goal.sourceBinding.type === 'metric' && (
          <MetricDetail
            challengeId={goal.sourceBinding.challengeId}
            onChanged={goalsData.refresh}
            onDeleted={() => goalsData.archiveGoal(goal.externalId)}
          />
        )}
        {goal.sourceBinding.type === 'fund' && (
          <FundDetail
            financeGoalExternalId={goal.sourceBinding.financeGoalExternalId}
            progress={progress}
            targetDate={goal.targetDate}
          />
        )}
        {goal.sourceBinding.type === 'habit' && <HabitDetail habitExternalId={goal.sourceBinding.habitExternalId} />}
        {goal.sourceBinding.type === 'milestone' && <MilestoneDetail goalExternalId={goal.externalId} />}

        {(goal.type !== 'metric' || progress?.detail.sourceMissing === true) && goal.status === 'active' && (
          <AppButton
            title="Archive goal"
            onPress={() =>
              void goalsData
                .archiveGoal(goal.externalId)
                .catch((e) => Alert.alert('Archive failed', e instanceof Error ? e.message : String(e)))
            }
            variant="ghost"
            small
          />
        )}
        {progress?.status === 'no_data' && progress.detail.sourceMissing === true && (
          <Text style={[type.caption, { color: t.warning }]}>This goal's source is no longer available.</Text>
        )}
      </ScrollView>
    </View>
  );
}

/** Reuses src/challenges' own crud + src/dashboard's ChallengeCard — a metric goal's actions stay Challenge-specific (BRD AT5), not a generic goal-editing form. */
function MetricDetail({
  challengeId,
  onChanged,
  onDeleted,
}: {
  challengeId: string;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const t = useTheme();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeProgress, setChallengeProgress] = useState<ChallengeProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [challengeRt, dataRt, dashRt] = await Promise.all([getChallengeRuntime(), getDataSyncRuntime(), getDashboardRuntime()]);
      const c = await challengeRt.store.get(challengeId);
      setChallenge(c);
      if (c !== null) {
        const today = deviceLocalDate(new Date().toISOString());
        const weightRows = await dataRt.store.listByType('weight', { start: c.startDate, end: today });
        const measurements = buildMeasurementSeries(weightRows, { start: c.startDate, end: today }, 'earliest');
        const trendPoints = computeTrend(measurements, { end: today }, DEFAULT_CONFIG.ewmaHalfLifeDays);
        const trendWeightKg = trendAt(trendPoints, today) ?? c.startWeightKg;
        const cachedResult = await dashRt.store.getLastResult();
        const projectedFinishDate = c.isPrimary ? (cachedResult?.result.projectedFinishDate ?? null) : null;
        setChallengeProgress(
          buildChallengeProgress(c.goalWeightKg, c.startDate, c.horizonDays, c.startWeightKg, trendWeightKg, projectedFinishDate, today),
        );
      }
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [challengeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nowUtc = () => new Date().toISOString();

  const doAction = async (action: (store: ChallengeStore) => Promise<unknown>) => {
    try {
      const rt = await getChallengeRuntime();
      await action(rt.store);
      await load();
      await onChanged();
      setActionError(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!loaded) return null;
  if (challenge === null) {
    return (
      <EmptyState
        message={loadError !== null ? `Couldn't load this goal: ${loadError}` : "This weight goal's source is no longer available."}
      />
    );
  }

  return (
    <Card style={{ gap: space.m }}>
      <Text style={[type.body, { color: t.secondary }]}>
        {challenge.startWeightKg}kg → {challenge.goalWeightKg}kg
      </Text>
      {challengeProgress !== null && <ChallengeCard progress={challengeProgress} />}
      <Row style={styles.wrap} gap={space.s}>
        {challenge.status === 'active' ? (
          <AppButton title="Pause" onPress={() => void doAction((store) => pauseChallenge(store, challenge.id, nowUtc()))} variant="secondary" small />
        ) : (
          <AppButton title="Resume" onPress={() => void doAction((store) => resumeChallenge(store, challenge.id, nowUtc()))} variant="secondary" small />
        )}
        {challenge.status === 'active' && !challenge.isPrimary && (
          <AppButton
            title="Set primary"
            onPress={() => void doAction((store) => setPrimaryChallenge(store, challenge.id, nowUtc()))}
            variant="secondary"
            small
          />
        )}
        <AppButton
          title="Restart"
          onPress={() => {
            Alert.alert(
              'Restart this goal?',
              'Day count and kcal bank reset to today, using your current trend weight as the new starting point. The goal stays the same.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Restart',
                  onPress: () => {
                    void (async () => {
                      try {
                        const dataRt = await getDataSyncRuntime();
                        const t2 = deviceLocalDate(nowUtc());
                        const recent = await dataRt.listRecentWeights(1);
                        const currentWeightKg = recent[0]?.valueSI ?? challenge.startWeightKg;
                        await doAction((store) => restartChallenge(store, challenge.id, nowUtc(), t2, currentWeightKg));
                      } catch (e) {
                        setActionError(e instanceof Error ? e.message : String(e));
                      }
                    })();
                  },
                },
              ],
            );
          }}
          variant="secondary"
          small
        />
        <AppButton
          title="Delete"
          onPress={() => {
            Alert.alert('Delete this goal?', `Goal: ${challenge.goalWeightKg}kg`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  void doAction(async (store) => {
                    const result = await deleteChallenge(store, challenge.id, nowUtc());
                    // Deleting the Challenge doesn't touch the wrapping Goal row —
                    // cascade-archive it so it leaves the active Goals list instead
                    // of lingering there forever as a "source no longer available" entry.
                    await onDeleted();
                    return result;
                  }),
              },
            ]);
          }}
          variant="danger"
          small
        />
      </Row>
      {actionError !== null && <Text style={[type.caption, { color: t.danger }]}>{actionError}</Text>}
    </Card>
  );
}

function FundDetail({
  financeGoalExternalId,
  progress,
  targetDate,
}: {
  financeGoalExternalId: string;
  progress: GoalProgress | undefined;
  targetDate: string | null;
}) {
  const t = useTheme();
  const { today } = useGoalsData();
  const [financeGoal, setFinanceGoal] = useState<FinanceGoal | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [goals, accounts] = await Promise.all([financeApi.listGoals(), financeApi.listAccounts()]);
        const fg = goals.find((g) => g.externalId === financeGoalExternalId) ?? null;
        setFinanceGoal(fg);
        setAccount(fg !== null ? (accounts.find((a) => a.externalId === fg.linkedAccountExternalId) ?? null) : null);
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [financeGoalExternalId]);

  if (!loaded) return null;
  if (financeGoal === null) {
    return (
      <EmptyState
        message={loadError !== null ? `Couldn't load this goal: ${loadError}` : "This fund goal's source is no longer available."}
      />
    );
  }

  const pct = progress?.pct ?? 0;
  const savedMinor = typeof progress?.numerator === 'number' ? progress.numerator : 0;
  const daysLeft = targetDate !== null ? diffDays(targetDate, today) : null;

  return (
    <Card style={{ gap: space.m }}>
      <Text style={[type.caption, { color: t.muted }]}>
        {account?.name ?? 'Unknown account'}
        {daysLeft !== null ? ` · ${daysLeft >= 0 ? `${daysLeft} days left` : 'past target date'}` : ''}
      </Text>
      <ProgressBar pct={pct} color={pct >= 1 ? t.good : t.accent} />
      <Row style={styles.spread}>
        <Text style={[type.caption, { color: t.secondary }]}>{formatMoneyMinor(savedMinor, financeGoal.currency)} saved</Text>
        <Text style={[type.caption, { color: t.secondary }]}>Target {formatMoneyMinor(financeGoal.targetAmountMinor, financeGoal.currency)}</Text>
      </Row>
    </Card>
  );
}

function HabitDetail({ habitExternalId }: { habitExternalId: string }) {
  const t = useTheme();
  const { habits, habitLog, today, toggleHabitCheckIn } = useGoalsData();
  const habit = habits.find((h) => h.externalId === habitExternalId) ?? null;
  if (habit === null) return <EmptyState message="This habit's source is no longer available." />;

  const days = Array.from({ length: habit.windowDays }, (_, i) => addDays(today, -(habit.windowDays - 1 - i)));
  const loggedDates = new Set(habitLog.filter((e) => e.habitExternalId === habit.externalId).map((e) => e.occurredOn));
  const doneToday = loggedDates.has(today);

  return (
    <Card style={{ gap: space.m }}>
      <Text style={[type.caption, { color: t.secondary }]}>
        {habit.targetCount}x every {habit.windowDays} days
      </Text>
      <AppButton
        title={doneToday ? 'Checked in today ✓' : 'Check in today'}
        onPress={() => void toggleHabitCheckIn(habit, today).catch(() => {})}
        variant={doneToday ? 'secondary' : 'primary'}
      />
      <Row style={styles.wrap} gap={6}>
        {days.map((d) => (
          <View key={d} style={[styles.dot, { backgroundColor: loggedDates.has(d) ? t.good : t.wash }]} />
        ))}
      </Row>
    </Card>
  );
}

function MilestoneDetail({ goalExternalId }: { goalExternalId: string }) {
  const t = useTheme();
  const { milestoneItems, saveMilestoneItem, toggleMilestoneItemCheck } = useGoalsData();
  const [newTitle, setNewTitle] = useState('');
  const items = milestoneItems.filter((i) => i.goalExternalId === goalExternalId).sort((a, b) => a.sortOrder - b.sortOrder);

  const addItem = () => {
    const title = newTitle.trim();
    if (title === '') return;
    void saveMilestoneItem(buildMilestoneItem({ goalExternalId, title, sortOrder: items.length }, new Date().toISOString())).catch(
      () => {},
    );
    setNewTitle('');
  };

  return (
    <Card style={{ gap: space.m }}>
      {items.length === 0 && <EmptyState message="No checklist items yet — add one below." />}
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => void toggleMilestoneItemCheck(item).catch(() => {})}>
          <Row style={styles.spread}>
            <Text
              style={[
                type.body,
                { color: t.ink, textDecorationLine: item.checkedAt !== null ? 'line-through' : 'none', flex: 1 },
              ]}
            >
              {item.title}
            </Text>
            {item.checkedAt !== null && <Text style={{ color: t.good }}>✓</Text>}
          </Row>
        </Pressable>
      ))}
      <Row gap={space.s}>
        <Field placeholder="Add checklist item" value={newTitle} onChangeText={setNewTitle} style={styles.flex} onSubmitEditing={addItem} />
        <AppButton title="Add" onPress={addItem} variant="secondary" small />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.l, gap: space.m },
  header: {
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  headerSpacer: { width: 60 },
  wrap: { flexWrap: 'wrap' },
  spread: { justifyContent: 'space-between' },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
