import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { addDays, type IsoDate } from '../../engine';
import {
  assessCashflow,
  DEFAULT_HORIZON_DAYS,
  projectCashflow,
  type CashflowOutlook,
} from '../../finance/cashflow';
import { formatMoneyMinor } from '../../finance/money';
import {
  currentPeriodPrefix,
  formatDayLabel,
  formatMonthLabel,
  monthEndDatesForPrefixes,
} from '../../finance/periods';
import { AppButton, Card, EmptyState, FAB, Overline, Row } from '../kit';
import { space, type, useTheme, type Theme } from '../theme';
import { useFinanceData } from './FinanceDataContext';
import { MonthGrid } from './components/MonthGrid';
import { AddTransactionModal } from './TransactionsScreen';

const DEFAULT_CURRENCY = 'INR';

function outlookColor(t: Theme, status: CashflowOutlook['status']): string {
  return status === 'clear' ? t.good : status === 'tight' ? t.warning : t.danger;
}

/**
 * Cash-flow calendar: the month ahead with every scheduled bill placed on its
 * day and the projected balance running through it.
 *
 * The banner's horizon is deliberately independent of the visible month —
 * navigating to December shouldn't change what "the next 30 days" means.
 */
export function CashflowScreen() {
  const t = useTheme();
  const { accounts, categories, transactions, recurringTransactions, today, loading } = useFinanceData();
  const [monthPrefix, setMonthPrefix] = useState(() => currentPeriodPrefix(today, 'month'));
  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const currency = accounts.find((a) => a.archivedAt === null)?.currency ?? DEFAULT_CURRENCY;

  const monthProjection = useMemo(
    () =>
      projectCashflow({
        accounts,
        transactions,
        recurringTransactions,
        today,
        startDate: `${monthPrefix}-01`,
        endDate: monthEndDatesForPrefixes([monthPrefix])[0],
      }),
    [accounts, transactions, recurringTransactions, today, monthPrefix],
  );

  const outlook = useMemo(
    () =>
      assessCashflow(
        projectCashflow({
          accounts,
          transactions,
          recurringTransactions,
          today,
          startDate: today,
          endDate: addDays(today, DEFAULT_HORIZON_DAYS - 1),
        }),
      ),
    [accounts, transactions, recurringTransactions, today],
  );

  const selectedDay = useMemo(
    () => monthProjection.days.find((d) => d.date === selectedDate) ?? null,
    [monthProjection, selectedDate],
  );

  const stepMonth = (delta: -1 | 1) => {
    setSelectedDate(null);
    setMonthPrefix((prefix) =>
      delta === -1
        ? addDays(`${prefix}-01`, -1).slice(0, 7)
        : addDays(monthEndDatesForPrefixes([prefix])[0], 1).slice(0, 7),
    );
  };

  const hasPool = accounts.some((a) => a.archivedAt === null && a.balanceMode === 'ledger' && !a.isLiability);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        {!loading && !hasPool && (
          <EmptyState message="Add a bank or cash account to see your cash flow projected forward." />
        )}

        {hasPool && (
          <Card style={{ gap: space.xs }}>
            <Overline>Projected low point</Overline>
            <Text style={[type.hero, { color: outlookColor(t, outlook.status) }]}>
              {formatMoneyMinor(outlook.lowBalanceMinor, currency)}
            </Text>
            <Text style={[type.body, { color: t.secondary }]}>
              {outlook.lowDate === today
                ? `Lowest today, over the next ${outlook.horizonDays} days`
                : `Lowest on ${formatDayLabel(outlook.lowDate)}, over the next ${outlook.horizonDays} days`}
            </Text>
          </Card>
        )}

        <Row style={{ justifyContent: 'space-between' }}>
          <AppButton title="←" onPress={() => stepMonth(-1)} variant="ghost" small />
          <Text style={[type.heading, { color: t.ink }]}>{formatMonthLabel(monthPrefix)}</Text>
          <AppButton title="→" onPress={() => stepMonth(1)} variant="ghost" small />
        </Row>

        <Card style={{ padding: space.s }}>
          <MonthGrid
            monthPrefix={monthPrefix}
            days={monthProjection.days}
            today={today}
            currency={currency}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </Card>

        {selectedDay !== null && (
          <Card style={{ gap: space.s }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Overline>{formatDayLabel(selectedDay.date)}</Overline>
              <Text style={[type.caption, { color: t.muted }]}>
                {formatMoneyMinor(selectedDay.closingBalanceMinor, currency)} left
              </Text>
            </Row>

            {selectedDay.events.length === 0 && (
              <Text style={[type.caption, { color: t.muted }]}>Nothing scheduled.</Text>
            )}

            {selectedDay.events.map((event) => {
              const categoryName =
                categories.find((c) => c.externalId === event.categoryExternalId)?.name ?? event.type;
              return (
                <Row key={event.key} style={{ justifyContent: 'space-between' }}>
                  <Text style={[type.caption, { color: t.secondary, flex: 1 }]} numberOfLines={1}>
                    {event.label ?? categoryName}
                    {event.kind === 'forecast' ? ' · upcoming' : ''}
                  </Text>
                  <Text style={[type.body, { color: event.deltaMinor >= 0 ? t.good : t.danger }]}>
                    {formatMoneyMinor(event.deltaMinor, currency, { showSign: true })}
                  </Text>
                </Row>
              );
            })}
          </Card>
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
