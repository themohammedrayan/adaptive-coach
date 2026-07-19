import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { diffDays } from '../../engine';
import { defaultGenId } from '../../finance/ids';
import { financeGoalProgress } from '../../finance/goals';
import { formatMoneyMinor, parseMoneyInput } from '../../finance/money';
import { accountBalanceAsOf } from '../../finance/netWorth';
import type { FinanceGoal } from '../../finance/types';
import { AppButton, Card, Chip, EmptyState, FAB, Field, Overline, ProgressBar, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { useFinanceData } from './FinanceDataContext';

export function FundGoalsScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, goals, today, saveGoal, archiveGoal } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const activeAccounts = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);

  const confirmArchive = (goal: FinanceGoal) => {
    Alert.alert('Archive goal?', `"${goal.name}" will be hidden from your active goals.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void archiveGoal(goal.externalId) },
    ]);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        {activeGoals.length === 0 && (
          <EmptyState message="Add a goal — like saving for a house — linked to an account to track progress." />
        )}

        {activeGoals.map((goal) => {
          const account = accounts.find((a) => a.externalId === goal.linkedAccountExternalId);
          const balance = account !== undefined ? (accountBalanceAsOf(account, transactions, valuations, today) ?? 0) : 0;
          const progress = financeGoalProgress(goal, balance);
          const daysLeft = goal.targetDate !== null ? diffDays(goal.targetDate, today) : null;
          return (
            <Card key={goal.id} style={{ gap: space.s }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ gap: 2 }}>
                  <Text style={[type.heading, { color: t.ink }]}>{goal.name}</Text>
                  <Text style={[type.caption, { color: t.muted }]}>
                    {account?.name ?? 'Unknown account'}
                    {daysLeft !== null ? ` · ${daysLeft >= 0 ? `${daysLeft} days left` : 'past target date'}` : ''}
                  </Text>
                </View>
                <Text style={[type.heading, { color: t.ink }]}>{Math.round(progress.pct * 100)}%</Text>
              </Row>
              <ProgressBar pct={progress.pct} color={progress.pct >= 1 ? t.good : t.accent} />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[type.caption, { color: t.muted }]}>
                  {formatMoneyMinor(progress.savedMinor, goal.currency)} saved
                </Text>
                <Text style={[type.caption, { color: t.muted }]}>
                  Target {formatMoneyMinor(goal.targetAmountMinor, goal.currency)}
                </Text>
              </Row>
              <AppButton title="Archive goal" onPress={() => confirmArchive(goal)} variant="ghost" small />
            </Card>
          );
        })}
      </ScrollView>

      <FAB icon="plus" accessibilityLabel="Add goal" onPress={() => setAddOpen(true)} />

      <AddGoalModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={saveGoal}
        accounts={activeAccounts}
      />
    </View>
  );
}

function AddGoalModal({
  visible,
  onClose,
  onSave,
  accounts,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (goal: FinanceGoal) => Promise<void>;
  accounts: { externalId: string; name: string; currency: string }[];
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [targetAmountInput, setTargetAmountInput] = useState('');
  const [linkedAccountExternalId, setLinkedAccountExternalId] = useState<string | null>(accounts[0]?.externalId ?? null);
  const [targetDate, setTargetDate] = useState('');

  const submit = async () => {
    const targetAmountMinor = parseMoneyInput(targetAmountInput);
    if (name.trim() === '' || targetAmountMinor === null || targetAmountMinor <= 0 || linkedAccountExternalId === null) {
      return;
    }
    const account = accounts.find((a) => a.externalId === linkedAccountExternalId);
    const nowIso = new Date().toISOString();
    await onSave({
      id: defaultGenId(),
      externalId: defaultGenId(),
      name: name.trim(),
      targetAmountMinor,
      currency: account?.currency ?? 'INR',
      linkedAccountExternalId,
      targetDate: targetDate.trim() === '' ? null : targetDate.trim(),
      status: 'active',
      archivedAt: null,
      updatedAt: nowIso,
    });
    setName('');
    setTargetAmountInput('');
    setTargetDate('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m }}>
              <Overline>Add goal</Overline>
              <Field placeholder="Goal name (e.g. House down payment)" value={name} onChangeText={setName} autoFocus />
              <Field
                placeholder="Target amount"
                keyboardType="decimal-pad"
                value={targetAmountInput}
                onChangeText={setTargetAmountInput}
              />
              {accounts.length === 0 ? (
                <Text style={[type.caption, { color: t.muted }]}>Add an account first to link this goal to it.</Text>
              ) : (
                <>
                  <Text style={[type.caption, { color: t.secondary }]}>Linked account</Text>
                  <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                    {accounts.map((a) => (
                      <Chip
                        key={a.externalId}
                        label={a.name}
                        active={linkedAccountExternalId === a.externalId}
                        onPress={() => setLinkedAccountExternalId(a.externalId)}
                      />
                    ))}
                  </Row>
                </>
              )}
              <Field
                placeholder="Target date (YYYY-MM-DD, optional)"
                value={targetDate}
                onChangeText={setTargetDate}
              />
              <AppButton title="Add goal" onPress={submit} disabled={accounts.length === 0} />
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.m },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l },
});
