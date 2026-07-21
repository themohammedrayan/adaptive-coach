import { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { diffDays } from '../../engine';
import { financeGoalProgress } from '../../finance/goals';
import { formatMoneyMinor } from '../../finance/money';
import { accountBalanceAsOf } from '../../finance/netWorth';
import type { FinanceGoal } from '../../finance/types';
import { AppButton, Card, EmptyState, ProgressBar, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { useFinanceData } from './FinanceDataContext';

export function FundGoalsScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, goals, today, archiveGoal } = useFinanceData();

  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);

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
          <EmptyState message="No fund goals yet — add one from Goals → New goal → Fund." />
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.m },
});
