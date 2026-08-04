import { Text } from 'react-native';
import { incomeVsExpense } from '../../../finance/categoryTotals';
import {
  assessFinancialHealth,
  computeFinancialHealthInputs,
  type FinancialHealthStatus,
} from '../../../finance/health';
import { formatMoneyMinor } from '../../../finance/money';
import { netWorthAsOf } from '../../../finance/netWorth';
import { Card, Overline, Row } from '../../kit';
import { space, type, useTheme, type Theme } from '../../theme';
import { useFinanceData } from '../FinanceDataContext';

const DEFAULT_CURRENCY = 'INR';

const HEALTH_LABEL: Record<FinancialHealthStatus, string> = {
  good: 'Looking good',
  mixed: 'Mixed',
  concerning: 'Needs attention',
};

function healthColor(t: Theme, status: FinancialHealthStatus): string {
  return status === 'good' ? t.good : status === 'concerning' ? t.danger : t.warning;
}

/**
 * Net worth, the financial-health read, and this month's income vs expense.
 *
 * These were the only parts of the old Overview tab that weren't a digest of
 * another screen — its account list duplicated Accounts and its recent list
 * duplicated Log — so they moved here when Budget took the freed tab slot.
 */
export function NetWorthHeader() {
  const t = useTheme();
  const { accounts, transactions, valuations, categories, budgets, today, loading } = useFinanceData();

  const activeAccounts = accounts.filter((a) => a.archivedAt === null);
  const currency = activeAccounts[0]?.currency ?? DEFAULT_CURRENCY;
  const netWorth = netWorthAsOf(accounts, transactions, valuations, today);
  const [monthTotals] = incomeVsExpense(transactions, [today.slice(0, 7)]);
  const healthRead = assessFinancialHealth(
    computeFinancialHealthInputs(accounts, transactions, valuations, budgets, categories, today),
  );

  return (
    <>
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
    </>
  );
}
