import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { incomeVsExpense } from '../../finance/categoryTotals';
import { assessFinancialHealth, computeFinancialHealthInputs, type FinancialHealthStatus } from '../../finance/health';
import { formatMoneyMinor } from '../../finance/money';
import { accountBalanceAsOf, netWorthAsOf } from '../../finance/netWorth';
import { Card, EmptyState, FAB, Overline, Row } from '../kit';
import { space, type, useTheme, type Theme } from '../theme';
import { AddTransactionModal } from './TransactionsScreen';
import { useFinanceData } from './FinanceDataContext';

const DEFAULT_CURRENCY = 'INR';

const HEALTH_LABEL: Record<FinancialHealthStatus, string> = {
  good: 'Looking good',
  mixed: 'Mixed',
  concerning: 'Needs attention',
};

function healthColor(t: Theme, status: FinancialHealthStatus): string {
  return status === 'good' ? t.good : status === 'concerning' ? t.danger : t.warning;
}

export function OverviewScreen() {
  const t = useTheme();
  const router = useRouter();
  const { accounts, transactions, valuations, categories, budgets, today, loading } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);
  const netWorth = useMemo(
    () => netWorthAsOf(accounts, transactions, valuations, today),
    [accounts, transactions, valuations, today],
  );
  const monthPrefix = today.slice(0, 7);
  const [monthTotals] = useMemo(
    () => incomeVsExpense(transactions, [monthPrefix]),
    [transactions, monthPrefix],
  );
  const recentTransactions = useMemo(() => [...transactions].slice(0, 5), [transactions]);
  const healthRead = useMemo(
    () => assessFinancialHealth(computeFinancialHealthInputs(accounts, transactions, valuations, budgets, categories, today)),
    [accounts, transactions, valuations, budgets, categories, today],
  );

  const currency = activeAccounts[0]?.currency ?? DEFAULT_CURRENCY;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
      <Card style={{ alignItems: 'center', gap: space.xs }}>
        <Overline>Net worth</Overline>
        <Text style={[type.hero, { color: t.ink }]}>{loading ? '—' : formatMoneyMinor(netWorth, currency)}</Text>
      </Card>

      {!loading && (
        <Card style={{ gap: space.s }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Overline>Financial health</Overline>
            <Text style={[type.caption, { color: healthColor(t, healthRead.status), fontWeight: '700' }]}>
              {HEALTH_LABEL[healthRead.status]}
            </Text>
          </Row>
          {healthRead.reasons.map((reason) => (
            <Text key={reason} style={[type.caption, { color: t.secondary }]}>
              {reason}
            </Text>
          ))}
        </Card>
      )}

      <Pressable onPress={() => router.push('/coach-chat')}>
        <Card style={{ gap: 2 }}>
          <Text style={[type.body, { color: t.ink, fontWeight: '600' }]}>Ask the coach</Text>
          <Text style={[type.caption, { color: t.muted }]}>
            Get tips and a read on your spending, budget, and goal pace.
          </Text>
        </Card>
      </Pressable>

      {monthTotals !== undefined && (
        <Card style={{ gap: space.s }}>
          <Overline>This month</Overline>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[type.body, { color: t.good }]}>
              Income {formatMoneyMinor(monthTotals.incomeMinor, currency)}
            </Text>
            <Text style={[type.body, { color: t.danger }]}>
              Expense {formatMoneyMinor(monthTotals.expenseMinor, currency)}
            </Text>
          </Row>
        </Card>
      )}

      <Overline>Accounts</Overline>
      {activeAccounts.length === 0 && <EmptyState message="Add an account to start tracking your net worth." />}
      {activeAccounts.map((account) => {
        const balance = accountBalanceAsOf(account, transactions, valuations, today);
        return (
          <Card key={account.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[type.body, { color: t.ink }]}>{account.name}</Text>
              <Text style={[type.body, { color: account.isLiability ? t.danger : t.ink }]}>
                {balance === null ? '—' : formatMoneyMinor(balance, account.currency)}
              </Text>
            </Row>
          </Card>
        );
      })}

      {recentTransactions.length > 0 && (
        <>
          <Overline>Recent</Overline>
          {recentTransactions.map((txn) => {
            const isExpense = txn.type === 'expense';
            const isIncome = txn.type === 'income';
            const signedMinor = isExpense ? -txn.amountMinor : txn.amountMinor;
            const color = isExpense ? t.danger : isIncome ? t.good : t.ink;
            const categoryName = categories.find((c) => c.externalId === txn.categoryExternalId)?.name ?? txn.type;
            return (
              <Card key={txn.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[type.caption, { color: t.secondary }]}>
                    {categoryName} · {txn.txnDate}
                  </Text>
                  <Text style={[type.body, { color }]}>{formatMoneyMinor(signedMinor, txn.currency)}</Text>
                </Row>
              </Card>
            );
          })}
        </>
      )}

      </ScrollView>

      <FAB icon="plus" accessibilityLabel="Add transaction" onPress={() => setAddOpen(true)} />
      <AddTransactionModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.m },
});
