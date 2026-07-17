import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ACTIVITY_LEVELS,
  configureNotificationHandler,
  refreshDashboardSnapshot,
  scheduleReminders,
  type DashboardSnapshot,
  type ReminderConfig,
} from '../dashboard';
import { projectedFinishCopy } from '../dashboard/copy';
import { getDashboardRuntime } from '../dashboard/runtime';
import { getDataSyncRuntime } from '../data-sync/runtime';
import { getFoodLogRuntime } from '../food-log/runtime';
import { supabase } from '../lib/supabase';
import { AppButton, AppSwitch, Card, Overline, ProgressBar, Row } from './kit';
import { ProfileSetupScreen } from './ProfileSetupScreen';
import { space, type, useTheme } from './theme';

function fmtTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Profile tab — read view over existing stores: goal progress (EngineState
 * start weight → latest weigh-in → goal), profile details, reminder
 * toggles, sign-out. Editing reuses ProfileSetupScreen prefilled; all
 * numbers come from engine state/snapshot, never computed here beyond
 * display math.
 */
export function ProfileScreen() {
  const t = useTheme();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [reminders, setReminders] = useState<ReminderConfig | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [dashRt, foodRt, dataRt] = await Promise.all([
      getDashboardRuntime(),
      getFoodLogRuntime(),
      getDataSyncRuntime(),
    ]);
    const today = foodRt.toLocalDate(foodRt.nowUtc());
    const snap = await refreshDashboardSnapshot(
      { dashboardStore: dashRt.store, foodLogStore: foodRt.store, dataSyncStore: dataRt.store },
      today,
    );
    setSnapshot(snap);
    const recent = await dataRt.listRecentWeights(1);
    setCurrentWeightKg(recent.length > 0 ? recent[0].valueSI : null);
    setReminders(await dashRt.store.getReminderConfig());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const updateReminders = async (next: ReminderConfig) => {
    setReminders(next);
    try {
      const dashRt = await getDashboardRuntime();
      await dashRt.store.setReminderConfig(next);
      configureNotificationHandler();
      await scheduleReminders(next);
      setReminderError(null);
    } catch (e) {
      // Permission denial must be visible, not silent (Dashboard BRD §B2).
      setReminderError(e instanceof Error ? e.message : String(e));
    }
  };

  if (snapshot === null || snapshot.profile === null) return null;
  const profile = snapshot.profile;

  if (editing) {
    return (
      <ProfileSetupScreen
        initial={profile}
        onCancel={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          void load();
        }}
      />
    );
  }

  const startWeight = snapshot.engineState?.startWeightKg ?? null;
  const progressPct =
    startWeight !== null && currentWeightKg !== null && startWeight > profile.goalWeightKg
      ? (startWeight - currentWeightKg) / (startWeight - profile.goalWeightKg)
      : 0;
  const activityLabel =
    ACTIVITY_LEVELS.find((l) => l.value === profile.activityFactor)?.label ??
    `×${profile.activityFactor}`;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card style={styles.card}>
        <Overline>Goal</Overline>
        <Row style={styles.spaceBetween}>
          <WeightStat label="Start" value={startWeight} t={t} />
          <WeightStat label="Now" value={currentWeightKg} t={t} emphasize />
          <WeightStat label="Goal" value={profile.goalWeightKg} t={t} />
        </Row>
        <ProgressBar pct={progressPct} />
        <Text style={[type.caption, { color: t.secondary }]}>
          {projectedFinishCopy(snapshot.result?.projectedFinishDate ?? null)}
        </Text>
        <AppButton title="Edit goal" onPress={() => setEditing(true)} variant="secondary" small />
      </Card>

      <Card style={styles.card}>
        <Overline>Details</Overline>
        <DetailRow label="Sex" value={profile.sex === 'male' ? 'Male' : 'Female'} t={t} />
        <DetailRow label="Age" value={String(profile.age)} t={t} />
        <DetailRow label="Height" value={`${profile.heightCm} cm`} t={t} />
        <DetailRow label="Activity" value={activityLabel} t={t} />
        <DetailRow label="Started" value={profile.startDate} t={t} />
        <DetailRow label="Horizon" value={`${profile.horizonDays} days`} t={t} />
      </Card>

      {reminders !== null && (
        <Card style={styles.card}>
          <Overline>Reminders</Overline>
          <ToggleRow
            label="Morning weigh-in"
            sub={fmtTime(reminders.morningWeighIn.hour, reminders.morningWeighIn.minute)}
            value={reminders.morningWeighIn.enabled}
            onChange={(v) =>
              updateReminders({ ...reminders, morningWeighIn: { ...reminders.morningWeighIn, enabled: v } })
            }
            t={t}
          />
          <ToggleRow
            label="Evening food log"
            sub={fmtTime(reminders.eveningLog.hour, reminders.eveningLog.minute)}
            value={reminders.eveningLog.enabled}
            onChange={(v) =>
              updateReminders({ ...reminders, eveningLog: { ...reminders.eveningLog, enabled: v } })
            }
            t={t}
          />
          <ToggleRow
            label="Coach note ready"
            sub="After each weekly recompute"
            value={reminders.coachNoteReady.enabled}
            onChange={(v) => updateReminders({ ...reminders, coachNoteReady: { enabled: v } })}
            t={t}
          />
          {reminderError !== null && (
            <Text style={[type.caption, { color: t.warning }]}>
              Reminders unavailable: {reminderError}
            </Text>
          )}
        </Card>
      )}

      <AppButton title="Sign out" onPress={() => supabase.auth.signOut()} variant="danger" />
    </ScrollView>
  );
}

function WeightStat({
  label,
  value,
  t,
  emphasize = false,
}: {
  label: string;
  value: number | null;
  t: ReturnType<typeof useTheme>;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[type.caption, { color: t.muted }]}>{label}</Text>
      <Text
        style={{
          fontSize: emphasize ? 24 : 18,
          fontWeight: emphasize ? '800' : '600',
          color: emphasize ? t.accent : t.ink,
        }}
      >
        {value === null ? '—' : `${value.toFixed(1)}`}
        <Text style={[type.caption, { color: t.muted }]}> kg</Text>
      </Text>
    </View>
  );
}

function DetailRow({ label, value, t }: { label: string; value: string; t: ReturnType<typeof useTheme> }) {
  return (
    <Row style={styles.spaceBetween}>
      <Text style={[type.body, { color: t.secondary }]}>{label}</Text>
      <Text style={[type.body, { color: t.ink, fontWeight: '500' }]}>{value}</Text>
    </Row>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
  t,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <Row style={styles.spaceBetween}>
      <View style={{ gap: 1 }}>
        <Text style={[type.body, { color: t.ink }]}>{label}</Text>
        <Text style={[type.caption, { color: t.muted }]}>{sub}</Text>
      </View>
      <AppSwitch value={value} onChange={onChange} />
    </Row>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.l, gap: space.l, paddingBottom: space.xl },
  card: { gap: space.m },
  spaceBetween: { justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 2, flex: 1 },
});
