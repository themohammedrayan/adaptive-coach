import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { diffDays } from '../../engine';
import { buildDebtOverview, type DebtLine } from '../../finance/debt';
import { accountBalanceAsOf } from '../../finance/netWorth';
import { formatMoneyMinor } from '../../finance/money';
import type { Account } from '../../finance/types';
import { AppButton, Card, EmptyState, FAB, Overline, Row } from '../kit';
import { space, type, useTheme, type Theme } from '../theme';
import { AccountEditorModal, ACCOUNT_TYPES } from './components/AccountEditorModal';
import { CreditUtilization } from './components/CreditUtilization';
import { NetWorthHeader } from './components/NetWorthHeader';
import { useFinanceData } from './FinanceDataContext';

const DEFAULT_CURRENCY = 'INR';

type DebtStatusTone = 'good' | 'warning' | 'muted';

function toneColor(t: Theme, tone: DebtStatusTone): string {
  return tone === 'good' ? t.good : tone === 'warning' ? t.warning : t.muted;
}

/**
 * Next-action status line for a debt-type account row — read from logged
 * payments and the account's own due day, never a manual flag. `statementCycle`
 * always resolves to the *next* upcoming due date, so there's no "overdue"
 * case to represent here.
 */
function debtStatusLine(account: Account, line: DebtLine | null, today: string): { text: string; tone: DebtStatusTone } | null {
  if (line === null || account.dueDay === null || line.balanceMinor <= 0) return null;
  const minLabel = line.minimumPaymentMinor !== null ? `Min ${formatMoneyMinor(line.minimumPaymentMinor, account.currency)} · ` : '';
  if (line.cycleStatus === 'paid') return { text: `${minLabel}paid this cycle`, tone: 'good' };
  const daysUntilDue = diffDays(line.cycle.due, today);
  if (daysUntilDue === 0) return { text: `${minLabel}due today`, tone: 'warning' };
  return { text: `${minLabel}due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`, tone: 'muted' };
}

export function AccountsScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, today, unarchiveAccount } = useFinanceData();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);
  const archivedAccounts = useMemo(() => accounts.filter((a) => a.archivedAt !== null), [accounts]);
  const assets = useMemo(() => activeAccounts.filter((a) => !a.isLiability), [activeAccounts]);
  const liabilities = useMemo(() => activeAccounts.filter((a) => a.isLiability), [activeAccounts]);
  const currency = activeAccounts[0]?.currency ?? DEFAULT_CURRENCY;

  const debtOverview = useMemo(
    () => buildDebtOverview(accounts, transactions, valuations, today, 'avalanche'),
    [accounts, transactions, valuations, today],
  );

  const balanceFor = (account: Account) => accountBalanceAsOf(account, transactions, valuations, today);
  const subtotalFor = (list: Account[]) => list.reduce((sum, a) => sum + (balanceFor(a) ?? 0), 0);

  const openCreate = () => {
    setEditingAccount(null);
    setEditorOpen(true);
  };
  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setEditorOpen(true);
  };

  const renderAccountRow = (account: Account) => {
    const balance = balanceFor(account);
    const line = debtOverview.lines.find((l) => l.account.externalId === account.externalId) ?? null;
    const status = debtStatusLine(account, line, today);
    return (
      <Pressable key={account.id} onPress={() => openEdit(account)}>
        <Card style={{ gap: space.s }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={[type.heading, { color: t.ink }]}>{account.name}</Text>
              <Text style={[type.caption, { color: t.muted }]}>
                {ACCOUNT_TYPES.find((x) => x.value === account.type)?.label}
                {account.isLiability ? ' · liability' : ''}
              </Text>
              {status !== null && (
                <Text style={[type.caption, { color: toneColor(t, status.tone) }]}>{status.text}</Text>
              )}
            </View>
            <Text style={[type.heading, { color: account.isLiability ? t.danger : t.ink }]}>
              {balance === null ? '—' : formatMoneyMinor(balance, account.currency)}
            </Text>
          </Row>

          {account.type === 'credit_card' && account.creditLimitMinor !== null && (
            <CreditUtilization usedMinor={balance ?? 0} limitMinor={account.creditLimitMinor} currency={account.currency} />
          )}
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        <NetWorthHeader />

        {activeAccounts.length === 0 && (
          <EmptyState message="Add a bank, cash, credit card, investment, or loan account to get started." />
        )}

        {assets.length > 0 && (
          <View style={{ gap: space.m }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Overline>Assets</Overline>
              <Text style={[type.caption, { color: t.muted }]}>{formatMoneyMinor(subtotalFor(assets), currency)}</Text>
            </Row>
            {assets.map(renderAccountRow)}
          </View>
        )}

        {liabilities.length > 0 && (
          <View style={{ gap: space.m }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Overline>Liabilities</Overline>
              <Text style={[type.caption, { color: t.muted }]}>{formatMoneyMinor(subtotalFor(liabilities), currency)}</Text>
            </Row>
            {liabilities.map(renderAccountRow)}
          </View>
        )}

        {archivedAccounts.length > 0 && (
          <View style={{ gap: space.m }}>
            <Pressable onPress={() => setShowArchived((v) => !v)}>
              <Overline>
                {showArchived ? '▾' : '▸'} Archived ({archivedAccounts.length})
              </Overline>
            </Pressable>
            {showArchived &&
              archivedAccounts.map((account) => (
                <Card key={account.id} style={{ gap: space.s }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={[type.body, { color: t.muted }]}>{account.name}</Text>
                    <AppButton title="Restore" small onPress={() => void unarchiveAccount(account.externalId)} />
                  </Row>
                </Card>
              ))}
          </View>
        )}
      </ScrollView>

      <FAB icon="plus" accessibilityLabel="Add account" onPress={openCreate} />

      <AccountEditorModal visible={editorOpen} onClose={() => setEditorOpen(false)} account={editingAccount} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.l },
});
