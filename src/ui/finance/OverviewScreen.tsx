import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { incomeVsExpense } from '../../finance/categoryTotals';
import { formatMoneyMinor } from '../../finance/money';
import { accountBalanceAsOf, netWorthAsOf } from '../../finance/netWorth';
import { Card, EmptyState, FAB, Overline, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { AddTransactionModal } from './TransactionsScreen';
import { useFinanceData } from './FinanceDataContext';

const DEFAULT_CURRENCY = 'INR';

export function OverviewScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, categories, today, loading } = useFinanceData();
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

  const currency = activeAccounts[0]?.currency ?? DEFAULT_CURRENCY;

  return (
    <View style={{ gap: space.m }}>
      <Card style={{ alignItems: 'center', gap: space.xs }}>
        <Overline>Net worth</Overline>
        <Text style={[type.hero, { color: t.ink }]}>{loading ? '—' : formatMoneyMinor(netWorth, currency)}</Text>
      </Card>

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

      <FAB icon="plus" accessibilityLabel="Add transaction" onPress={() => setAddOpen(true)} />
      <AddTransactionModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
