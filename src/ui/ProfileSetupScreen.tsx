import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ACTIVITY_LEVELS, refreshDashboardSnapshot } from '../dashboard';
import { getDashboardRuntime } from '../dashboard/runtime';
import { getDataSyncRuntime } from '../data-sync/runtime';
import type { Mode, Profile } from '../engine';
import { getFoodLogRuntime } from '../food-log/runtime';

/**
 * One-time Profile capture (Dashboard BRD's user-approved glue — see the
 * module plan's Context section). Requires an existing weigh-in, since
 * that value seeds EngineState.startWeightKg; on save it also runs the
 * first forced recompute so a real target appears immediately.
 */
export function ProfileSetupScreen({ onDone }: { onDone: () => void }) {
  const [sex, setSex] = useState<Profile['sex']>('male');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [horizonDays, setHorizonDays] = useState('180');
  const [activityFactor, setActivityFactor] = useState(ACTIVITY_LEVELS[2].value);
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
  const mode: Mode | null =
    currentWeightKg === null || goalWeightKg === '' || !Number.isFinite(goalN)
      ? null
      : goalN < currentWeightKg
        ? 'lose'
        : goalN > currentWeightKg
          ? 'gain'
          : 'maintain';

  const save = async () => {
    setError(null);
    if (currentWeightKg === null) {
      setError('Log a weigh-in on the Weight tab first.');
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
    if (goalN >= currentWeightKg)
      return setError(
        'v1 supports weight loss only — set a goal below your current weight ' +
          `(${currentWeightKg.toFixed(1)} kg).`,
      );
    if (!Number.isFinite(horizonN) || horizonN < 7 || horizonN > 1095)
      return setError('Horizon must be 7–1095 days.');

    setBusy(true);
    try {
      const [dashRt, foodRt, dataRt] = await Promise.all([
        getDashboardRuntime(),
        getFoodLogRuntime(),
        getDataSyncRuntime(),
      ]);
      const today = foodRt.toLocalDate(foodRt.nowUtc());

      const profile: Profile = {
        sex,
        age: ageN,
        heightCm: heightN,
        activityFactor,
        goalWeightKg: goalN,
        horizonDays: horizonN,
        startDate: today,
        mode: mode ?? 'maintain',
      };
      await dashRt.store.setProfile(profile);
      await dashRt.store.setEngineState({
        prevTargetKcal: null,
        mode: profile.mode,
        lastRecomputeDate: null,
        startWeightKg: currentWeightKg,
      });
      await refreshDashboardSnapshot(
        { dashboardStore: dashRt.store, foodLogStore: foodRt.store, dataSyncStore: dataRt.store },
        today,
        { force: true },
      );
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set up your goal</Text>

      <View style={styles.row}>
        <TouchableOpacity onPress={() => setSex('male')}>
          <Text style={[styles.chip, sex === 'male' && styles.chipActive]}>Male</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSex('female')}>
          <Text style={[styles.chip, sex === 'female' && styles.chipActive]}>Female</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Age"
        keyboardType="number-pad"
        value={age}
        onChangeText={setAge}
      />
      <TextInput
        style={styles.input}
        placeholder="Height (cm)"
        keyboardType="decimal-pad"
        value={heightCm}
        onChangeText={setHeightCm}
      />
      <TextInput
        style={styles.input}
        placeholder="Goal weight (kg)"
        keyboardType="decimal-pad"
        value={goalWeightKg}
        onChangeText={setGoalWeightKg}
      />
      <TextInput
        style={styles.input}
        placeholder="Horizon (days)"
        keyboardType="number-pad"
        value={horizonDays}
        onChangeText={setHorizonDays}
      />

      <Text style={styles.label}>Activity level</Text>
      <View style={styles.row}>
        {ACTIVITY_LEVELS.map((level) => (
          <TouchableOpacity key={level.label} onPress={() => setActivityFactor(level.value)}>
            <Text style={[styles.chip, activityFactor === level.value && styles.chipActive]}>
              {level.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {currentWeightKg !== null && mode === 'lose' && (
        <Text style={styles.mode}>
          Current: {currentWeightKg.toFixed(1)}kg → Mode: {mode}
        </Text>
      )}
      {currentWeightKg !== null && mode !== null && mode !== 'lose' && (
        <Text style={styles.warning}>
          v1 supports weight loss only — the goal must be below your current weight.
        </Text>
      )}
      {currentWeightKg === null && (
        <Text style={styles.warning}>
          Log a weigh-in on the Weight tab first — it seeds your starting point.
        </Text>
      )}

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <Button title={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy || currentWeightKg === null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  label: { fontSize: 13, color: '#666', marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#e8f0fe', borderColor: '#1a56db', color: '#1a56db' },
  mode: { fontSize: 13, color: '#047857', fontWeight: '600' },
  warning: { fontSize: 13, color: '#b45309' },
  error: { fontSize: 13, color: '#c00' },
});
