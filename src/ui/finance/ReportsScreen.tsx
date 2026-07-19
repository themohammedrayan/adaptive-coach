import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { budgetProgress } from '../../finance/budget';
import { categoryBreakdown, incomeVsExpense } from '../../finance/categoryTotals';
import { defaultGenId } from '../../finance/ids';
import { formatMoneyMinor, parseMoneyInput } from '../../finance/money';
import { netWorthSeries } from '../../finance/netWorth';
import {
  currentPeriodPrefix,
  lastNMonthPrefixes,
  monthEndDatesForPrefixes,
  periodsFor,
  type Granularity,
} from '../../finance/periods';
import { projectNetWorth } from '../../finance/projection';
import type { Budget, CategoryKind } from '../../finance/types';
import { AppButton, Card, EmptyState, Field, Overline, ProgressBar, Row, SegmentedControl } from '../kit';
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
  const { accounts, transactions, categories, valuations, budgets, today } = useFinanceData();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [editBudgetsOpen, setEditBudgetsOpen] = useState(false);

  // Budgets are always monthly regardless of the chart granularity below.
  const currentMonthPrefix = today.slice(0, 7);
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
  const budgetsProgress = useMemo(
    () => budgetProgress(budgets, transactions, categories, currentMonthPrefix),
    [budgets, transactions, categories, currentMonthPrefix],
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

      <BudgetsCard
        progress={budgetsProgress}
        categories={expenseCategories}
        currency={currency}
        onEdit={() => setEditBudgetsOpen(true)}
      />

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

      <EditBudgetsModal
        visible={editBudgetsOpen}
        onClose={() => setEditBudgetsOpen(false)}
        budgets={budgets}
        categories={expenseCategories}
        currency={currency}
      />
    </ScrollView>
  );
}

/* --------------------------------------------------------------- budgets */

function categoryName(categories: { externalId: string; name: string }[], externalId: string | null): string {
  if (externalId === null) return 'Overall';
  return categories.find((c) => c.externalId === externalId)?.name ?? 'Unknown';
}

function BudgetsCard({
  progress,
  categories,
  currency,
  onEdit,
}: {
  progress: ReturnType<typeof budgetProgress>;
  categories: { externalId: string; name: string }[];
  currency: string;
  onEdit: () => void;
}) {
  const t = useTheme();
  return (
    <Card style={{ gap: space.m }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Overline>Budgets — this month</Overline>
        <Pressable onPress={onEdit}>
          <Text style={[type.caption, { color: t.accent, fontWeight: '600' }]}>Edit budgets</Text>
        </Pressable>
      </Row>
      {progress.length === 0 ? (
        <EmptyState message="Set a monthly budget, overall or per category, to track spending against it." />
      ) : (
        progress.map((p) => (
          <View key={p.categoryExternalId ?? 'overall'} style={{ gap: space.xs }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[type.body, { color: t.ink }]}>{categoryName(categories, p.categoryExternalId)}</Text>
              <Text style={[type.caption, { color: p.pct > 1 ? t.danger : t.muted }]}>
                {formatMoneyMinor(p.spentMinor, currency)} / {formatMoneyMinor(p.budgetedMinor, currency)}
              </Text>
            </Row>
            <ProgressBar pct={p.pct} color={p.pct > 1 ? t.danger : t.accent} />
          </View>
        ))
      )}
    </Card>
  );
}

function EditBudgetsModal({
  visible,
  onClose,
  budgets,
  categories,
  currency,
}: {
  visible: boolean;
  onClose: () => void;
  budgets: Budget[];
  categories: { externalId: string; name: string }[];
  currency: string;
}) {
  const { saveBudget } = useFinanceData();
  const activeBudgets = useMemo(() => budgets.filter((b) => b.archivedAt === null), [budgets]);
  const findBudget = (categoryExternalId: string | null) =>
    activeBudgets.find((b) => b.categoryExternalId === categoryExternalId) ?? null;

  const [overallInput, setOverallInput] = useState(() => {
    const existing = findBudget(null);
    return existing !== null ? String(existing.amountMinor / 100) : '';
  });
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      categories.map((c) => {
        const existing = findBudget(c.externalId);
        return [c.externalId, existing !== null ? String(existing.amountMinor / 100) : ''];
      }),
    ),
  );

  const save = async () => {
    const nowIso = new Date().toISOString();
    const edits: { categoryExternalId: string | null; input: string }[] = [
      { categoryExternalId: null, input: overallInput },
      ...categories.map((c) => ({ categoryExternalId: c.externalId, input: categoryInputs[c.externalId] ?? '' })),
    ];
    for (const edit of edits) {
      const amountMinor = parseMoneyInput(edit.input);
      if (amountMinor === null || amountMinor <= 0) continue;
      const existing = findBudget(edit.categoryExternalId);
      await saveBudget({
        id: existing?.id ?? defaultGenId(),
        externalId: existing?.externalId ?? defaultGenId(),
        categoryExternalId: edit.categoryExternalId,
        amountMinor,
        currency,
        archivedAt: null,
        updatedAt: nowIso,
      });
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <ScrollView>
              <Card style={{ gap: space.m }}>
                <Overline>Edit budgets</Overline>
                <Field
                  label="Overall monthly budget (optional)"
                  keyboardType="decimal-pad"
                  value={overallInput}
                  onChangeText={setOverallInput}
                />
                {categories.map((c) => (
                  <Field
                    key={c.externalId}
                    label={c.name}
                    keyboardType="decimal-pad"
                    value={categoryInputs[c.externalId] ?? ''}
                    onChangeText={(v) => setCategoryInputs((prev) => ({ ...prev, [c.externalId]: v }))}
                  />
                ))}
                <AppButton title="Save budgets" onPress={save} />
              </Card>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.l },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l, maxHeight: '80%' },
});
