import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDataSyncRuntime } from '../../data-sync/runtime';
import * as financeApi from '../../finance/api';
import { defaultGenId } from '../../finance/ids';
import { parseMoneyInput } from '../../finance/money';
import type { Account } from '../../finance/types';
import { buildGoal, buildHabit } from '../../goals/crud';
import type { GoalType } from '../../goals/types';
import { AppButton, Card, Chip, Field, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { useGoalsData } from './GoalsDataContext';

const TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'metric', label: 'Weight' },
  { value: 'fund', label: 'Fund' },
  { value: 'habit', label: 'Habit' },
  { value: 'milestone', label: 'Milestone' },
];

/** Goals BRD §G.5 — type picker, then a per-type form. */
export function CreateGoalScreen({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [goalType, setGoalType] = useState<GoalType>('metric');

  return (
    <View style={styles.flex}>
      <Text style={[type.title, { color: t.ink, paddingHorizontal: space.l, paddingTop: space.m }]}>New goal</Text>
      <View style={styles.picker}>
        <Row style={styles.wrap} gap={space.s}>
          {TYPE_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={goalType === o.value} onPress={() => setGoalType(o.value)} />
          ))}
        </Row>
      </View>
      {goalType === 'metric' && <MetricForm onDone={onDone} />}
      {goalType === 'fund' && <FundForm onDone={onDone} />}
      {goalType === 'habit' && <HabitForm onDone={onDone} />}
      {goalType === 'milestone' && <MilestoneForm onDone={onDone} />}
    </View>
  );
}

function MetricForm({ onDone }: { onDone: () => void }) {
  const { createMetricGoal } = useGoalsData();
  const [title, setTitle] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [horizonDays, setHorizonDays] = useState('180');
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

  const submit = async () => {
    setError(null);
    if (currentWeightKg === null) return setError('Log a weigh-in first so this goal has a starting point.');
    if (!Number.isFinite(goalN) || goalN < 30 || goalN > 300) return setError('Goal weight must be 30–300 kg.');
    if (goalN >= currentWeightKg) return setError('v1 supports weight loss only — set a goal below your current weight.');
    if (!Number.isFinite(horizonN) || horizonN < 7 || horizonN > 1095) return setError('Horizon must be 7–1095 days.');

    setBusy(true);
    try {
      await createMetricGoal({
        title: title.trim() === '' ? `${goalN}kg goal` : title.trim(),
        goalWeightKg: goalN,
        startWeightKg: currentWeightKg,
        horizonDays: horizonN,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell error={error} onSubmit={submit} busy={busy} submitLabel="Create goal" disabled={currentWeightKg === null}>
      <Field label="Title (optional)" placeholder="Lose 10kg" value={title} onChangeText={setTitle} />
      {currentWeightKg !== null && <Caption>Current weight: {currentWeightKg.toFixed(1)} kg</Caption>}
      <Row gap={space.m}>
        <Field label="Goal weight (kg)" placeholder="75" keyboardType="decimal-pad" value={goalWeightKg} onChangeText={setGoalWeightKg} style={styles.flex} />
        <Field label="Horizon (days)" placeholder="180" keyboardType="number-pad" value={horizonDays} onChangeText={setHorizonDays} style={styles.flex} />
      </Row>
    </FormShell>
  );
}

function FundForm({ onDone }: { onDone: () => void }) {
  const { saveGoal } = useGoalsData();
  const [name, setName] = useState('');
  const [targetAmountInput, setTargetAmountInput] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linkedAccountExternalId, setLinkedAccountExternalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = (await financeApi.listAccounts()).filter((a) => a.archivedAt === null);
      setAccounts(list);
      setLinkedAccountExternalId(list[0]?.externalId ?? null);
    })();
  }, []);

  const submit = async () => {
    setError(null);
    const targetAmountMinor = parseMoneyInput(targetAmountInput);
    if (name.trim() === '') return setError('Enter a goal name.');
    if (targetAmountMinor === null || targetAmountMinor <= 0) return setError('Enter a target amount.');
    if (linkedAccountExternalId === null) return setError('Add an account first to link this goal to it.');

    setBusy(true);
    try {
      const account = accounts.find((a) => a.externalId === linkedAccountExternalId);
      const nowIso = new Date().toISOString();
      const financeGoalExternalId = defaultGenId();
      await financeApi.upsertGoal({
        id: financeGoalExternalId,
        externalId: financeGoalExternalId,
        name: name.trim(),
        targetAmountMinor,
        currency: account?.currency ?? 'INR',
        linkedAccountExternalId,
        targetDate: targetDate.trim() === '' ? null : targetDate.trim(),
        status: 'active',
        archivedAt: null,
        updatedAt: nowIso,
      });
      await saveGoal(
        buildGoal(
          {
            type: 'fund',
            title: name.trim(),
            sourceBinding: { type: 'fund', financeGoalExternalId },
            targetDate: targetDate.trim() === '' ? null : targetDate.trim(),
          },
          nowIso,
        ),
      );
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell error={error} onSubmit={submit} busy={busy} submitLabel="Create goal" disabled={accounts.length === 0}>
      <Field placeholder="Goal name (e.g. House down payment)" value={name} onChangeText={setName} />
      <Field placeholder="Target amount" keyboardType="decimal-pad" value={targetAmountInput} onChangeText={setTargetAmountInput} />
      {accounts.length === 0 ? (
        <Caption>Add an account first to link this goal to it.</Caption>
      ) : (
        <Row style={styles.wrap} gap={space.s}>
          {accounts.map((a) => (
            <Chip key={a.externalId} label={a.name} active={linkedAccountExternalId === a.externalId} onPress={() => setLinkedAccountExternalId(a.externalId)} />
          ))}
        </Row>
      )}
      <Field placeholder="Target date (YYYY-MM-DD, optional)" value={targetDate} onChangeText={setTargetDate} />
    </FormShell>
  );
}

function HabitForm({ onDone }: { onDone: () => void }) {
  const { saveHabit, saveGoal } = useGoalsData();
  const [name, setName] = useState('');
  const [targetCount, setTargetCount] = useState('5');
  const [windowDays, setWindowDays] = useState('7');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const targetCountN = Number(targetCount);
  const windowDaysN = Number(windowDays);

  const submit = async () => {
    setError(null);
    if (name.trim() === '') return setError('Enter a habit name.');
    if (!Number.isInteger(targetCountN) || targetCountN < 1) return setError('Target count must be a positive whole number.');
    if (!Number.isInteger(windowDaysN) || windowDaysN < 1) return setError('Window days must be a positive whole number.');

    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const habit = buildHabit({ name: name.trim(), targetCount: targetCountN, windowDays: windowDaysN }, nowIso);
      await saveHabit(habit);
      await saveGoal(buildGoal({ type: 'habit', title: name.trim(), sourceBinding: { type: 'habit', habitExternalId: habit.externalId } }, nowIso));
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell error={error} onSubmit={submit} busy={busy} submitLabel="Create goal">
      <Field placeholder="Habit name (e.g. Read)" value={name} onChangeText={setName} />
      <Row gap={space.m}>
        <Field label="Times" placeholder="5" keyboardType="number-pad" value={targetCount} onChangeText={setTargetCount} style={styles.flex} />
        <Field label="Per days" placeholder="7" keyboardType="number-pad" value={windowDays} onChangeText={setWindowDays} style={styles.flex} />
      </Row>
    </FormShell>
  );
}

function MilestoneForm({ onDone }: { onDone: () => void }) {
  const { saveGoal } = useGoalsData();
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (title.trim() === '') return setError('Enter a title.');

    setBusy(true);
    try {
      await saveGoal(
        buildGoal(
          {
            type: 'milestone',
            title: title.trim(),
            sourceBinding: { type: 'milestone' },
            targetDate: targetDate.trim() === '' ? null : targetDate.trim(),
          },
          new Date().toISOString(),
        ),
      );
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormShell error={error} onSubmit={submit} busy={busy} submitLabel="Create goal">
      <Field placeholder="Title (e.g. Ship v1)" value={title} onChangeText={setTitle} />
      <Field placeholder="Target date (YYYY-MM-DD, optional)" value={targetDate} onChangeText={setTargetDate} />
      <Caption>Add checklist items from the goal's detail screen once it's created.</Caption>
    </FormShell>
  );
}

function Caption({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[type.caption, { color: t.muted }]}>{children}</Text>;
}

function FormShell({
  children,
  error,
  onSubmit,
  busy,
  submitLabel,
  disabled = false,
}: {
  children: ReactNode;
  error: string | null;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>{children}</Card>
        {error !== null && <ErrorText>{error}</ErrorText>}
        <AppButton title={submitLabel} onPress={onSubmit} busy={busy} disabled={disabled} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[type.caption, { color: t.danger, textAlign: 'center' }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  picker: { paddingHorizontal: space.l, paddingVertical: space.m },
  wrap: { flexWrap: 'wrap' },
  container: { padding: space.l, gap: space.l },
  card: { gap: space.m },
});
