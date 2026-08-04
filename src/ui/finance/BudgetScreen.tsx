import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays } from '../../engine';
import { budgetEnvelope, upcomingByCategory, type UpcomingExpense } from '../../finance/budget';
import { formatMoneyMinor } from '../../finance/money';
import { currentPeriodPrefix, formatMonthLabel, monthEndDatesForPrefixes } from '../../finance/periods';
import { AppButton, Card, EmptyState, FAB, Overline, Row } from '../kit';
import { space, type, useTheme, type Theme } from '../theme';
import { BudgetCategoryRow } from './components/BudgetCategoryRow';
import { EditBudgetsModal } from './components/EditBudgetsModal';
import { useFinanceData } from './FinanceDataContext';
import { AddTransactionModal } from './TransactionsScreen';

const DEFAULT_CURRENCY = 'INR';

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.wash }]}>
      <Text style={[type.heading, { color: tone ?? t.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[type.caption, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

function unassignedTone(t: Theme, unassignedMinor: number): string | undefined {
  if (unassignedMinor < 0) return t.danger;
  return unassignedMinor > 0 ? t.warning : t.good;
}

/**
 * Envelope budgeting for one month: what's assigned, what's spent, and what's
 * still scheduled to land in each category.
 *
 * Budgets are standing targets with no period column, so navigating to a past
 * month changes the *spend* but not the targets — the header says so rather
 * than implying the figures are historical truth.
 */
export function BudgetScreen() {
  const t = useTheme();
  const { budgets, categories, transactions, recurringTransactions, today, loading } = useFinanceData();
  const [monthPrefix, setMonthPrefix] = useState(() => currentPeriodPrefix(today, 'month'));
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const currency = budgets[0]?.currency ?? DEFAULT_CURRENCY;
  const expenseCategories = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories]);
  const monthEnd = monthEndDatesForPrefixes([monthPrefix])[0];
  const isCurrentMonth = monthPrefix === currentPeriodPrefix(today, 'month');

  const envelope = useMemo(
    () => budgetEnvelope(budgets, transactions, categories, monthPrefix),
    [budgets, transactions, categories, monthPrefix],
  );

  // Only the rest of *this* month can still be "upcoming"; a past month has
  // nothing left to come, and a future month is upcoming from its first day.
  const upcoming = useMemo((): Map<string, UpcomingExpense[]> => {
    if (monthEnd < today) return new Map();
    const from = isCurrentMonth ? today : `${monthPrefix}-01`;
    return upcomingByCategory(recurringTransactions, categories, from, monthEnd);
  }, [recurringTransactions, categories, monthPrefix, monthEnd, today, isCurrentMonth]);

  const stepMonth = (delta: -1 | 1) =>
    setMonthPrefix((prefix) =>
      delta === -1
        ? addDays(`${prefix}-01`, -1).slice(0, 7)
        : addDays(monthEndDatesForPrefixes([prefix])[0], 1).slice(0, 7),
    );

  const categoryByExternalId = useMemo(
    () => new Map(categories.map((c) => [c.externalId, c])),
    [categories],
  );
  const categoryRows = envelope.rows.filter((r) => r.categoryExternalId !== null);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppButton title="←" onPress={() => stepMonth(-1)} variant="ghost" small />
          <Text style={[type.heading, { color: t.ink }]}>{formatMonthLabel(monthPrefix)}</Text>
          <AppButton title="→" onPress={() => stepMonth(1)} variant="ghost" small />
        </Row>

        {!isCurrentMonth && (
          <Text style={[type.caption, { color: t.muted, textAlign: 'center' }]}>
            Spending for this month, measured against your current targets — budgets aren't stored per month.
          </Text>
        )}

        {!loading && envelope.rows.length === 0 && (
          <EmptyState
            message="Set a monthly budget, overall or per category, to track spending against it."
            actionTitle="Set budgets"
            onAction={() => setEditOpen(true)}
          />
        )}

        {envelope.rows.length > 0 && (
          <>
            <Card style={{ gap: space.s }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Overline>{envelope.hasOverallBudget ? 'Total budget' : 'Spent this month'}</Overline>
                <Pressable onPress={() => setEditOpen(true)}>
                  <Text style={[type.caption, { color: t.accent, fontWeight: '600' }]}>Edit budgets</Text>
                </Pressable>
              </Row>
              <Text style={[type.hero, { color: t.ink }]}>
                {formatMoneyMinor(
                  envelope.hasOverallBudget ? envelope.totalBudgetMinor : envelope.spentMinor,
                  currency,
                )}
              </Text>
              <Row gap={space.s}>
                <Tile label="Spent" value={formatMoneyMinor(envelope.spentMinor, currency)} />
                <Tile
                  label="Remaining"
                  value={formatMoneyMinor(envelope.remainingMinor, currency)}
                  tone={envelope.remainingMinor < 0 ? t.danger : t.good}
                />
                <Tile
                  label={envelope.unassignedMinor < 0 ? 'Over-assigned' : 'Unassigned'}
                  value={formatMoneyMinor(Math.abs(envelope.unassignedMinor), currency)}
                  tone={unassignedTone(t, envelope.unassignedMinor)}
                />
              </Row>
              {envelope.hasOverallBudget && (
                <Text style={[type.caption, { color: t.muted }]}>
                  {formatMoneyMinor(envelope.assignedMinor, currency)} assigned across {categoryRows.length}{' '}
                  {categoryRows.length === 1 ? 'category' : 'categories'}
                </Text>
              )}
            </Card>

            <Card>
              {categoryRows.length === 0 ? (
                <EmptyState message="No per-category budgets yet." />
              ) : (
                categoryRows.map((row) => (
                  <BudgetCategoryRow
                    key={row.categoryExternalId}
                    progress={row}
                    category={categoryByExternalId.get(row.categoryExternalId!)}
                    currency={currency}
                    upcoming={upcoming.get(row.categoryExternalId!) ?? []}
                  />
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>

      <FAB icon="plus" accessibilityLabel="Add transaction" onPress={() => setAddOpen(true)} />
      <AddTransactionModal visible={addOpen} onClose={() => setAddOpen(false)} />
      <EditBudgetsModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        budgets={budgets}
        categories={expenseCategories}
        currency={currency}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.m },
  tile: { flex: 1, borderRadius: 12, padding: space.s, alignItems: 'center', gap: 2 },
});
