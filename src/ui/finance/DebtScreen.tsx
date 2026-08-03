import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildDebtOverview, type PayoffStrategy } from '../../finance/debt';
import { formatMoneyMinor } from '../../finance/money';
import { Card, EmptyState, FAB, Overline, Row, SegmentedControl } from '../kit';
import { space, type, useTheme } from '../theme';
import { DebtLineCard } from './components/DebtLineCard';
import { useFinanceData } from './FinanceDataContext';
import { AddTransactionModal } from './TransactionsScreen';

const DEFAULT_CURRENCY = 'INR';

type DebtLens = 'cards' | 'loans';

const LENS_OPTIONS: { value: DebtLens; label: string }[] = [
  { value: 'cards', label: 'Credit cards' },
  { value: 'loans', label: 'Debts' },
];

const STRATEGY_OPTIONS: { value: PayoffStrategy; label: string }[] = [
  { value: 'avalanche', label: 'Avalanche' },
  { value: 'snowball', label: 'Snowball' },
];

const STRATEGY_EXPLAINER: Record<PayoffStrategy, string> = {
  avalanche: 'Highest rate first. Costs the least interest overall.',
  snowball: 'Smallest balance first. Clears individual debts soonest.',
};

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.wash }]}>
      <Text style={[type.heading, { color: tone ?? t.ink }]}>{value}</Text>
      <Text style={[type.caption, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * What you owe, ranked by which debt to clear first.
 *
 * Paid-this-cycle is read from logged payments rather than a manual checkbox,
 * so it can never disagree with the ledger — the same transfer that marks a
 * card paid here shows on the Cash flow calendar as money leaving.
 */
export function DebtScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, today, loading } = useFinanceData();
  const [lens, setLens] = useState<DebtLens>('cards');
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche');
  const [addOpen, setAddOpen] = useState(false);

  const overview = useMemo(
    () => buildDebtOverview(accounts, transactions, valuations, today, strategy),
    [accounts, transactions, valuations, today, strategy],
  );

  const currency = accounts.find((a) => a.archivedAt === null)?.currency ?? DEFAULT_CURRENCY;
  const visible = overview.lines.filter((l) =>
    lens === 'cards' ? l.account.type === 'credit_card' : l.account.type === 'loan',
  );
  // Only the top-ranked debt overall carries the badge, not the top of each lens.
  const payFirstId = overview.lines.find((l) => l.balanceMinor > 0)?.account.externalId ?? null;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        {!loading && overview.lines.length === 0 && (
          <EmptyState message="No credit cards or loans yet. Add one from Accounts to track payoff here." />
        )}

        {overview.lines.length > 0 && (
          <>
            <Card style={{ gap: space.s }}>
              <Overline>Total outstanding</Overline>
              <Text style={[type.hero, { color: t.ink }]}>
                {formatMoneyMinor(overview.totalOutstandingMinor, currency)}
              </Text>
              <Row gap={space.s}>
                <Tile label={overview.cardCount === 1 ? 'Card' : 'Cards'} value={String(overview.cardCount)} />
                <Tile label="Min due" value={formatMoneyMinor(overview.totalMinimumDueMinor, currency)} />
                <Tile
                  label="Paid"
                  value={`${overview.paidCount}/${overview.lines.length}`}
                  tone={overview.paidCount === overview.lines.length ? t.good : undefined}
                />
              </Row>
            </Card>

            <SegmentedControl options={LENS_OPTIONS} value={lens} onChange={setLens} />

            <Card style={{ gap: space.s }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Overline>Payoff strategy</Overline>
              </Row>
              <SegmentedControl options={STRATEGY_OPTIONS} value={strategy} onChange={setStrategy} />
              <Text style={[type.caption, { color: t.muted }]}>{STRATEGY_EXPLAINER[strategy]}</Text>
            </Card>

            {visible.length === 0 && (
              <EmptyState message={lens === 'cards' ? 'No credit cards yet.' : 'No loans yet.'} />
            )}

            {visible.map((line) => (
              <DebtLineCard
                key={line.account.id}
                line={line}
                payFirst={line.account.externalId === payFirstId}
              />
            ))}
          </>
        )}
      </ScrollView>

      <FAB icon="plus" accessibilityLabel="Log a payment" onPress={() => setAddOpen(true)} />
      <AddTransactionModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.m },
  tile: { flex: 1, borderRadius: 12, padding: space.s, alignItems: 'center', gap: 2 },
});
