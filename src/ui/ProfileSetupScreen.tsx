import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getChallengeRuntime } from '../challenges/runtime';
import { getDataSyncRuntime } from '../data-sync/runtime';
import { ACTIVITY_LEVELS, refreshDashboardSnapshot } from '../dashboard';
import { getDashboardRuntime } from '../dashboard/runtime';
import type { PersonProfile } from '../dashboard/types';
import type { Mode } from '../engine';
import { getFoodLogRuntime } from '../food-log/runtime';
import { upsertGoal } from '../goals/api';
import { createMetricGoal } from '../goals/crud';
import { AppButton, Card, Chip, Field, Row } from './kit';
import { space, type, useTheme } from './theme';

/**
 * First-run onboarding only: captures the person-level Profile (sex/age/
 * height/activity) and creates the first (primary) weight Challenge in one
 * screen, so a first-time user gets a working dashboard immediately. Editing
 * bio details afterward is a separate, smaller form (ProfileScreen); editing
 * an existing challenge's goal isn't done in place — restart it (same goal,
 * fresh clock) or delete and create a new one from the Challenges tab.
 */
export function ProfileSetupScreen({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [sex, setSex] = useState<PersonProfile['sex']>('male');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [horizonDays, setHorizonDays] = useState('180');
  const [activityFactor, setActivityFactor] = useState(ACTIVITY_LEVELS[2].value);
  const [weightInput, setWeightInput] = useState('');
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const rt = await getDataSyncRuntime();
        const recent = await rt.listRecentWeights(1);
        if (recent.length > 0) setCurrentWeightKg(recent[0].valueSI);
      } catch {
        // Falls back to the manual weight-input field below — no dedicated UI needed.
      }
    })();
  }, []);

  // With no weigh-in yet, the inline field supplies the starting weight.
  const inlineWeight = Number(weightInput.replace(',', '.'));
  const effectiveWeight =
    currentWeightKg ??
    (weightInput !== '' && Number.isFinite(inlineWeight) && inlineWeight > 0 && inlineWeight <= 400
      ? inlineWeight
      : null);

  const goalN = Number(goalWeightKg);
  const mode: Mode | null =
    effectiveWeight === null || goalWeightKg === '' || !Number.isFinite(goalN)
      ? null
      : goalN < effectiveWeight
        ? 'lose'
        : goalN > effectiveWeight
          ? 'gain'
          : 'maintain';

  const save = async () => {
    setError(null);
    if (effectiveWeight === null) {
      setError('Enter your current weight to seed the starting point.');
      return;
    }
    const ageN = Number(age);
    const heightN = Number(heightCm);
    const horizonN = Number(horizonDays);
    if (!Number.isFinite(ageN) || ageN < 10 || ageN > 100) return setError('Age must be 10–100.');
    if (!Number.isFinite(heightN) || heightN < 100 || heightN > 250)
      return setError('Height must be 100–250 cm.');
    if (!Number.isFinite(goalN) || goalN < 30 || goalN > 300)
      return setError('Goal weight must be 30–300 kg.');
    // Master BRD §9 — v1 is weight-loss only; the engine has no gain-mode
    // safety caps (surplus ceiling, gain rate cap), so block that path.
    if (goalN >= effectiveWeight)
      return setError(
        'v1 supports weight loss only — set a goal below your current weight ' +
          `(${effectiveWeight.toFixed(1)} kg).`,
      );
    if (!Number.isFinite(horizonN) || horizonN < 7 || horizonN > 1095)
      return setError('Horizon must be 7–1095 days.');

    setBusy(true);
    try {
      const [dashRt, foodRt, dataRt, challengeRt] = await Promise.all([
        getDashboardRuntime(),
        getFoodLogRuntime(),
        getDataSyncRuntime(),
        getChallengeRuntime(),
      ]);
      if (currentWeightKg === null) {
        // First-run path: record the inline weigh-in before profile save.
        await dataRt.addWeightKg(effectiveWeight);
      }
      const today = foodRt.toLocalDate(foodRt.nowUtc());
      const nowUtc = new Date().toISOString();

      const profile: PersonProfile = { sex, age: ageN, heightCm: heightN, activityFactor };
      await dashRt.store.setProfile(profile);
      // Goals architecture decision — onboarding creates the goal directly
      // (Challenge + its wrapping `goals` row together) rather than a bare
      // Challenge, so nothing is ever left unwrapped.
      const { goal } = await createMetricGoal(
        challengeRt.store,
        { title: `${goalN}kg goal`, goalWeightKg: goalN, startWeightKg: effectiveWeight, horizonDays: horizonN },
        nowUtc,
        today,
      );
      try {
        await upsertGoal(goal);
      } catch {
        // offline — GoalsDataContext's backfill pass attaches a wrapping goal on the next successful load
      }
      await refreshDashboardSnapshot(
        {
          dashboardStore: dashRt.store,
          foodLogStore: foodRt.store,
          dataSyncStore: dataRt.store,
          challengeStore: challengeRt.store,
        },
        today,
        { force: true },
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={[type.title, { color: t.ink }]}>Set up your goal</Text>
          <Text style={[type.caption, { color: t.secondary }]}>
            A few details seed your first calorie and macro target — it self-corrects weekly from there.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Sex</Text>
          <Row>
            <Chip label="Male" active={sex === 'male'} onPress={() => setSex('male')} />
            <Chip label="Female" active={sex === 'female'} onPress={() => setSex('female')} />
          </Row>

          <Row gap={space.m}>
            <Field label="Age" placeholder="28" keyboardType="number-pad" value={age} onChangeText={setAge} style={styles.flex} />
            <Field label="Height (cm)" placeholder="175" keyboardType="decimal-pad" value={heightCm} onChangeText={setHeightCm} style={styles.flex} />
          </Row>

          <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Activity level</Text>
          <Row style={styles.wrap}>
            {ACTIVITY_LEVELS.map((level) => (
              <Chip
                key={level.label}
                label={level.label}
                active={activityFactor === level.value}
                onPress={() => setActivityFactor(level.value)}
              />
            ))}
          </Row>
        </Card>

        <Card style={styles.card}>
          {currentWeightKg === null && (
            <Field
              label="Current weight (kg)"
              placeholder="82.4"
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />
          )}
          <Row gap={space.m}>
            <Field label="Goal weight (kg)" placeholder="75" keyboardType="decimal-pad" value={goalWeightKg} onChangeText={setGoalWeightKg} style={styles.flex} />
            <Field label="Horizon (days)" placeholder="180" keyboardType="number-pad" value={horizonDays} onChangeText={setHorizonDays} style={styles.flex} />
          </Row>

          {effectiveWeight !== null && mode === 'lose' && (
            <Text style={[type.caption, { color: t.accent, fontWeight: '600' }]}>
              {effectiveWeight.toFixed(1)} kg now → {goalN} kg goal
            </Text>
          )}
          {effectiveWeight !== null && mode !== null && mode !== 'lose' && (
            <Text style={[type.caption, { color: t.warning }]}>
              v1 supports weight loss only — the goal must be below your current weight.
            </Text>
          )}
        </Card>

        {error !== null && (
          <Text style={[type.caption, { color: t.danger, textAlign: 'center' }]}>{error}</Text>
        )}

        <AppButton
          title="Start coaching"
          onPress={save}
          busy={busy}
          disabled={effectiveWeight === null}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: space.l, gap: space.l },
  intro: { gap: space.xs },
  card: { gap: space.m },
  wrap: { flexWrap: 'wrap' },
});
