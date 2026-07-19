import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { categoryBreakdown, incomeVsExpense } from '../../finance/categoryTotals';
import { netWorthSeries } from '../../finance/netWorth';
import type { CategoryKind } from '../../finance/types';
import { Card, EmptyState, Overline, SegmentedControl } from '../kit';
import { space } from '../theme';
import { CategoryBreakdownChart } from './components/CategoryBreakdownChart';
import { IncomeVsExpenseChart } from './components/IncomeVsExpenseChart';
import { NetWorthTrendChart } from './components/NetWorthTrendChart';
import { useFinanceData } from './FinanceDataContext';

const DEFAULT_CURRENCY = 'INR';

/** Month prefixes ('YYYY-MM'), oldest first, for the n months ending with the month containing `today`. */
function lastNMonthPrefixes(today: string, n: number): string[] {
  const [y, m] = today.split('-').map(Number);
  const prefixes: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const totalMonthIndex = m - 1 - i;
    const year = y + Math.floor(totalMonthIndex / 12);
    const month = ((totalMonthIndex % 12) + 12) % 12;
    prefixes.push(`${year}-${String(month + 1).padStart(2, '0')}`);
  }
  return prefixes;
}

/** The last calendar day (IsoDate) of each given 'YYYY-MM' prefix. */
function monthEndDatesForPrefixes(prefixes: string[]): string[] {
  return prefixes.map((prefix) => {
    const [y, m] = prefix.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${prefix}-${String(lastDay).padStart(2, '0')}`;
  });
}

export function ReportsScreen() {
  const { accounts, transactions, categories, valuations, today } = useFinanceData();
  const [kind, setKind] = useState<CategoryKind>('expense');

  const currentMonthPrefix = today.slice(0, 7);
  const last6Months = useMemo(() => lastNMonthPrefixes(today, 6), [today]);
  const last12MonthEnds = useMemo(() => monthEndDatesForPrefixes(lastNMonthPrefixes(today, 12)), [today]);

  const breakdown = useMemo(
    () => categoryBreakdown(transactions, categories, currentMonthPrefix, kind),
    [transactions, categories, currentMonthPrefix, kind],
  );
  const monthly = useMemo(() => incomeVsExpense(transactions, last6Months), [transactions, last6Months]);
  const netWorthTrend = useMemo(
    () => netWorthSeries(accounts, transactions, valuations, last12MonthEnds),
    [accounts, transactions, valuations, last12MonthEnds],
  );

  const currency = accounts[0]?.currency ?? DEFAULT_CURRENCY;

  return (
    <View style={{ gap: space.l }}>
      <Card style={{ gap: space.m }}>
        <Overline>Net worth trend</Overline>
        <NetWorthTrendChart data={netWorthTrend} currency={currency} />
      </Card>

      <Card style={{ gap: space.m }}>
        <Overline>Income vs expense</Overline>
        <IncomeVsExpenseChart data={monthly} currency={currency} />
      </Card>

      <Card style={{ gap: space.m }}>
        <Overline>Category breakdown — this month</Overline>
        <SegmentedControl
          options={[
            { value: 'expense' as const, label: 'Expense' },
            { value: 'income' as const, label: 'Income' },
          ]}
          value={kind}
          onChange={setKind}
        />
        {breakdown.length === 0 ? (
          <EmptyState message="No transactions this month yet." />
        ) : (
          <CategoryBreakdownChart data={breakdown} currency={currency} />
        )}
      </Card>
    </View>
  );
}
