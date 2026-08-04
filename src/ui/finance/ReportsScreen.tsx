import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { categoryBreakdown, incomeVsExpense } from '../../finance/categoryTotals';
import { formatMoneyMinor } from '../../finance/money';
import { netWorthSeries } from '../../finance/netWorth';
import {
  currentPeriodPrefix,
  lastNMonthPrefixes,
  monthEndDatesForPrefixes,
  periodsFor,
  type Granularity,
} from '../../finance/periods';
import { projectNetWorth } from '../../finance/projection';
import type { CategoryKind } from '../../finance/types';
import { Card, EmptyState, Overline, Row, SegmentedControl } from '../kit';
import { space, type, useTheme } from '../theme';
import { CategoryBreakdownChart } from './components/CategoryBreakdownChart';
import { IncomeVsExpenseChart } from './components/IncomeVsExpenseChart';
import { NetWorthTrendChart } from './components/NetWorthTrendChart';
import { ProjectedNetWorthChart } from './components/ProjectedNetWorthChart';
import { useFinanceData } from './FinanceDataContext';

const DEFAULT_CURRENCY = 'INR';

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];
const INCOME_EXPENSE_COUNT: Record<Granularity, number> = { day: 14, month: 6, year: 5 };
const NET_WORTH_COUNT: Record<Granularity, number> = { day: 30, month: 12, year: 8 };
const GRANULARITY_NOUN: Record<Granularity, string> = { day: 'today', month: 'this month', year: 'this year' };

export function ReportsScreen() {
  const { accounts, transactions, categories, valuations, today } = useFinanceData();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [granularity, setGranularity] = useState<Granularity>('month');

  const currentPeriod = useMemo(() => currentPeriodPrefix(today, granularity), [today, granularity]);
  const incomeExpensePeriods = useMemo(
    () => periodsFor(today, granularity, INCOME_EXPENSE_COUNT[granularity]),
    [today, granularity],
  );
  const netWorthPeriods = useMemo(
    () => periodsFor(today, granularity, NET_WORTH_COUNT[granularity]),
    [today, granularity],
  );

  const breakdown = useMemo(
    () => categoryBreakdown(transactions, categories, currentPeriod, kind),
    [transactions, categories, currentPeriod, kind],
  );
  const monthly = useMemo(
    () => incomeVsExpense(transactions, incomeExpensePeriods.prefixes),
    [transactions, incomeExpensePeriods],
  );
  const netWorthTrend = useMemo(
    () => netWorthSeries(accounts, transactions, valuations, netWorthPeriods.sampleDates),
    [accounts, transactions, valuations, netWorthPeriods],
  );
  // Always a fixed monthly cadence, independent of the granularity toggle above.
  const projectionHistoryEnds = useMemo(() => monthEndDatesForPrefixes(lastNMonthPrefixes(today, 12)), [today]);
  const projectionHistory = useMemo(
    () => netWorthSeries(accounts, transactions, valuations, projectionHistoryEnds),
    [accounts, transactions, valuations, projectionHistoryEnds],
  );
  const wealthProjection = useMemo(() => projectNetWorth(projectionHistory, [3, 6, 12]), [projectionHistory]);

  const currency = accounts[0]?.currency ?? DEFAULT_CURRENCY;
  const expenseCategories = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
      <Card style={{ gap: space.m }}>
        <Overline>Analysis period</Overline>
        <SegmentedControl options={GRANULARITY_OPTIONS} value={granularity} onChange={setGranularity} />
      </Card>


      <Card style={{ gap: space.m }}>
        <Overline>Net worth trend</Overline>
        <NetWorthTrendChart data={netWorthTrend} currency={currency} granularity={granularity} />
      </Card>

      <Card style={{ gap: space.m }}>
        <Overline>Projected net worth</Overline>
        <ProjectedNetWorthChart historical={projectionHistory} projection={wealthProjection} currency={currency} />
      </Card>

      <Card style={{ gap: space.m }}>
        <Overline>Income vs expense</Overline>
        <IncomeVsExpenseChart data={monthly} currency={currency} granularity={granularity} />
      </Card>

      <Card style={{ gap: space.m }}>
        <Overline>Category breakdown — {GRANULARITY_NOUN[granularity]}</Overline>
        <SegmentedControl
          options={[
            { value: 'expense' as const, label: 'Expense' },
            { value: 'income' as const, label: 'Income' },
          ]}
          value={kind}
          onChange={setKind}
        />
        {breakdown.length === 0 ? (
          <EmptyState message="No transactions in this period yet." />
        ) : (
          <CategoryBreakdownChart data={breakdown} currency={currency} />
        )}
      </Card>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.l },
});
