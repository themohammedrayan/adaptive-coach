import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildDebtOverview, iouPosition, simulatePayoff, type PayoffStrategy } from '../../finance/debt';
import { formatMoneyMinor, parseMoneyInput } from '../../finance/money';
import { formatDayLabel } from '../../finance/periods';
import type { Account } from '../../finance/types';
import { AppButton, Card, EmptyState, Field, Overline, Row, SegmentedControl } from '../kit';
import { space, type, useTheme } from '../theme';
import { DebtLineCard } from './components/DebtLineCard';
import { IouSection } from './components/IouSection';
import { useFinanceData } from './FinanceDataContext';
import { AddTransactionModal } from './TransactionsScreen';

const DEFAULT_CURRENCY = 'INR';

type DebtLens = 'cards' | 'loans' | 'ious';

const LENS_OPTIONS: { value: DebtLens; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'loans', label: 'Debts' },
  { value: 'ious', label: 'IOUs' },
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
export function DebtScreen({ onNavigateToAccounts }: { onNavigateToAccounts: () => void }) {
  const t = useTheme();
  const { accounts, transactions, valuations, ious, today, loading } = useFinanceData();
  const [lens, setLens] = useState<DebtLens>('cards');
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche');
  const [budgetInput, setBudgetInput] = useState('');
  const [payingAccount, setPayingAccount] = useState<Account | null>(null);

  const overview = useMemo(
    () => buildDebtOverview(accounts, transactions, valuations, today, strategy),
    [accounts, transactions, valuations, today, strategy],
  );

  const currency = accounts.find((a) => a.archivedAt === null)?.currency ?? DEFAULT_CURRENCY;
  const position = iouPosition(ious);
  const visible = overview.lines.filter((l) =>
    lens === 'cards' ? l.account.type === 'credit_card' : l.account.type === 'loan',
  );
  // Only the top-ranked debt overall carries the badge, not the top of each lens.
  const payFirstId = overview.lines.find((l) => l.balanceMinor > 0)?.account.externalId ?? null;

  // A what-if, held in component state only — nothing is persisted. Blank falls
  // back to paying exactly the minimums.
  const budgetMinor = parseMoneyInput(budgetInput) ?? overview.totalMinimumDueMinor;
  const plan = useMemo(
    () => simulatePayoff(overview.lines, budgetMinor, strategy, today),
    [overview.lines, budgetMinor, strategy, today],
  );
  const otherPlan = useMemo(
    () => simulatePayoff(overview.lines, budgetMinor, strategy === 'avalanche' ? 'snowball' : 'avalanche', today),
    [overview.lines, budgetMinor, strategy, today],
  );
  const interestSavedMinor =
    plan !== null && otherPlan !== null ? otherPlan.totalInterestMinor - plan.totalInterestMinor : 0;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        {!loading && overview.lines.length === 0 && position.openCount === 0 && (
          <EmptyState message="No credit cards, loans or IOUs yet. Add a card or loan from Accounts to track payoff here." />
        )}

        {(overview.lines.length > 0 || position.openCount > 0) && (
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

            {lens === 'ious' ? (
              <IouSection currency={currency} />
            ) : (
              <>
                <Card style={{ gap: space.s }}>
                  <Overline>Payoff strategy</Overline>
                  <SegmentedControl options={STRATEGY_OPTIONS} value={strategy} onChange={setStrategy} />
                  <Text style={[type.caption, { color: t.muted }]}>{STRATEGY_EXPLAINER[strategy]}</Text>

                  <Field
                    label="Monthly payment"
                    placeholder={`Minimums — ${formatMoneyMinor(overview.totalMinimumDueMinor, currency)}`}
                    keyboardType="decimal-pad"
                    value={budgetInput}
                    onChangeText={setBudgetInput}
                  />

                  {plan !== null ? (
                    <>
                      <Text style={[type.body, { color: t.ink }]}>
                        Debt-free in {plan.months} {plan.months === 1 ? 'month' : 'months'} —{' '}
                        {formatDayLabel(plan.debtFreeDate)} {plan.debtFreeDate.slice(0, 4)}
                      </Text>
                      <Text style={[type.caption, { color: t.muted }]}>
                        {formatMoneyMinor(plan.totalInterestMinor, currency)} of interest along the way
                        {interestSavedMinor > 0
                          ? ` · saves ${formatMoneyMinor(interestSavedMinor, currency)} vs ${
                              strategy === 'avalanche' ? 'snowball' : 'avalanche'
                            }`
                          : ''}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[type.caption, { color: t.muted }]}>
                        {overview.lines.some((l) => l.balanceMinor > 0 && l.aprPct === null)
                          ? 'Set an APR on every debt to project a payoff date.'
                          : 'Enter a monthly payment above the minimums to project a payoff date.'}
                      </Text>
                      {overview.lines.some((l) => l.balanceMinor > 0 && l.aprPct === null) && (
                        <AppButton title="Set APR" onPress={onNavigateToAccounts} variant="secondary" small />
                      )}
                    </>
                  )}
                </Card>

                {visible.length === 0 && (
                  <EmptyState message={lens === 'cards' ? 'No credit cards yet.' : 'No loans yet.'} />
                )}

                {visible.map((line) => (
                  <DebtLineCard
                    key={line.account.id}
                    line={line}
                    payFirst={line.account.externalId === payFirstId}
                    onLogPayment={setPayingAccount}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <AddTransactionModal
        visible={payingAccount !== null}
        onClose={() => setPayingAccount(null)}
        context={
          payingAccount === null
            ? undefined
            : {
                lockKind: 'transfer',
                toAccountExternalId: payingAccount.externalId,
                title: `Pay ${payingAccount.name}`,
              }
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.m },
  tile: { flex: 1, borderRadius: 12, padding: space.s, alignItems: 'center', gap: 2 },
});
