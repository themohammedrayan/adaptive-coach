import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createChallenge, horizonDaysFromWeeklyRate, weeklyRateFromHorizonDays } from '../challenges';
import { getChallengeRuntime } from '../challenges/runtime';
import { deviceLocalDate } from '../data-sync';
import { getDataSyncRuntime } from '../data-sync/runtime';
import { AppButton, Card, Field, Row, SegmentedControl } from './kit';
import { space, type, useTheme } from './theme';

type InputMode = 'deadline' | 'pace';

const MODE_OPTIONS: { value: InputMode; label: string }[] = [
  { value: 'deadline', label: 'By date' },
  { value: 'pace', label: 'By weekly pace' },
];

/**
 * Pushed from the Challenges tab's FAB. A goal weight plus either a deadline
 * (days) or a weekly pace — whichever isn't chosen is derived and shown back
 * for confirmation before saving.
 */
export function CreateChallengeScreen() {
  const t = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>('deadline');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [horizonDays, setHorizonDays] = useState('180');
  const [weeklyRateKg, setWeeklyRateKg] = useState('0.5');
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const rt = await getDataSyncRuntime();
      const recent = await rt.listRecentWeights(1);
      if (recent.length > 0) setCurrentWeightKg(recent[0].valueSI);
    })();
  }, []);

  const goalN = Number(goalWeightKg);
  const horizonN = Number(horizonDays);
  const rateN = Number(weeklyRateKg);
  const goalValid = Number.isFinite(goalN) && goalN >= 30 && goalN <= 300;

  const derived =
    currentWeightKg !== null && goalValid
      ? mode === 'deadline'
        ? Number.isFinite(horizonN) && horizonN > 0
          ? { horizonDays: horizonN, weeklyRateKg: weeklyRateFromHorizonDays(currentWeightKg, goalN, horizonN) }
          : null
        : Number.isFinite(rateN) && rateN > 0
          ? { horizonDays: horizonDaysFromWeeklyRate(currentWeightKg, goalN, rateN), weeklyRateKg: rateN }
          : null
      : null;

  const save = async () => {
    setError(null);
    if (currentWeightKg === null) {
      setError('Log a weigh-in first so the challenge has a starting point.');
      return;
    }
    if (!goalValid) return setError('Goal weight must be 30–300 kg.');
    if (goalN === currentWeightKg) return setError('Goal weight must differ from your current weight.');
    if (derived === null) {
      return setError(mode === 'deadline' ? 'Horizon must be a positive number of days.' : 'Weekly pace must be positive.');
    }
    if (derived.horizonDays < 7 || derived.horizonDays > 1095) {
      return setError('The resulting horizon must be 7–1095 days — adjust the pace or deadline.');
    }

    setBusy(true);
    try {
      const challengeRt = await getChallengeRuntime();
      const nowUtc = new Date().toISOString();
      const today = deviceLocalDate(nowUtc);
      await createChallenge(
        challengeRt.store,
        { domain: 'weight', goalWeightKg: goalN, startWeightKg: currentWeightKg, horizonDays: derived.horizonDays },
        nowUtc,
        today,
      );
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={() => router.back()} variant="ghost" small />
        <Text style={[type.heading, { color: t.ink }]}>New challenge</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Field
              label="Goal weight (kg)"
              placeholder="75"
              keyboardType="decimal-pad"
              value={goalWeightKg}
              onChangeText={setGoalWeightKg}
            />
            {currentWeightKg !== null && (
              <Text style={[type.caption, { color: t.muted }]}>Current weight: {currentWeightKg.toFixed(1)} kg</Text>
            )}
          </Card>

          <Card style={styles.card}>
            <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
            {mode === 'deadline' ? (
              <Field
                label="Horizon (days)"
                placeholder="180"
                keyboardType="number-pad"
                value={horizonDays}
                onChangeText={setHorizonDays}
              />
            ) : (
              <Field
                label="Weekly pace (kg/week)"
                placeholder="0.5"
                keyboardType="decimal-pad"
                value={weeklyRateKg}
                onChangeText={setWeeklyRateKg}
              />
            )}
            {derived !== null && (
              <Row gap={space.m}>
                <Text style={[type.caption, { color: t.accent, fontWeight: '600' }]}>
                  {derived.horizonDays} days · ~{derived.weeklyRateKg.toFixed(2)} kg/week
                </Text>
              </Row>
            )}
          </Card>

          {error !== null && <Text style={[type.caption, { color: t.danger, textAlign: 'center' }]}>{error}</Text>}

          <AppButton title="Create challenge" onPress={save} busy={busy} disabled={currentWeightKg === null} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  headerSpacer: { width: 60 },
  container: { padding: space.l, gap: space.l },
  card: { gap: space.m },
});
