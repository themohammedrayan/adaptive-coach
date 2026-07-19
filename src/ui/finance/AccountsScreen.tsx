import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { accountBalanceAsOf } from '../../finance/netWorth';
import { defaultGenId } from '../../finance/ids';
import { formatMoneyMinor, parseMoneyInput } from '../../finance/money';
import type { Account, AccountType } from '../../finance/types';
import { AppButton, AppSwitch, Card, Chip, EmptyState, FAB, Field, Overline, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { useFinanceData } from './FinanceDataContext';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'investment', label: 'Investment' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
];

function defaultBalanceMode(type: AccountType): 'ledger' | 'valuation' {
  return type === 'investment' || type === 'loan' ? 'valuation' : 'ledger';
}

function defaultIsLiability(type: AccountType): boolean {
  return type === 'credit_card' || type === 'loan';
}

export function AccountsScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, today, saveAccount, archiveAccount, saveValuation } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [valuationInput, setValuationInput] = useState('');

  const activeAccounts = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);

  const balanceFor = (account: Account) => accountBalanceAsOf(account, transactions, valuations, today);

  const submitValuation = async (account: Account) => {
    const amountMinor = parseMoneyInput(valuationInput);
    if (amountMinor === null || amountMinor < 0) return;
    await saveValuation({
      id: defaultGenId(),
      externalId: defaultGenId(),
      accountExternalId: account.externalId,
      amountMinor,
      asOfDate: today,
      source: 'manual',
      note: null,
      updatedAt: new Date().toISOString(),
    });
    setValuationInput('');
  };

  const confirmArchive = (account: Account) => {
    Alert.alert('Archive account?', `"${account.name}" will be hidden but kept for historical reports.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void archiveAccount(account.externalId) },
    ]);
  };

  return (
    <View style={{ gap: space.m }}>
      {activeAccounts.length === 0 && (
        <EmptyState message="Add a bank, cash, credit card, investment, or loan account to get started." />
      )}

      {activeAccounts.map((account) => {
        const balance = balanceFor(account);
        const expanded = expandedId === account.externalId;
        return (
          <Card key={account.id} style={{ gap: space.s }}>
            <Pressable onPress={() => setExpandedId(expanded ? null : account.externalId)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ gap: 2 }}>
                  <Text style={[type.heading, { color: t.ink }]}>{account.name}</Text>
                  <Text style={[type.caption, { color: t.muted }]}>
                    {ACCOUNT_TYPES.find((x) => x.value === account.type)?.label}
                    {account.isLiability ? ' · liability' : ''}
                  </Text>
                </View>
                <Text style={[type.heading, { color: account.isLiability ? t.danger : t.ink }]}>
                  {balance === null ? '—' : formatMoneyMinor(balance, account.currency)}
                </Text>
              </Row>
            </Pressable>

            {expanded && (
              <View style={{ gap: space.s, marginTop: space.xs }}>
                {account.balanceMode === 'valuation' && (
                  <Row gap={space.m}>
                    <Field
                      placeholder={`Current value (${account.currency})`}
                      keyboardType="decimal-pad"
                      value={valuationInput}
                      onChangeText={setValuationInput}
                      style={{ flex: 1 }}
                    />
                    <AppButton title="Update" onPress={() => submitValuation(account)} small />
                  </Row>
                )}
                {account.balanceMode === 'ledger' && (
                  <Text style={[type.caption, { color: t.muted }]}>
                    Balance updates automatically from logged transactions.
                  </Text>
                )}
                {(account.type === 'credit_card' || account.type === 'loan') && (
                  <Text style={[type.caption, { color: t.muted }]}>
                    {account.interestRate !== null ? `${account.interestRate}% interest` : 'No interest rate set'}
                    {account.dueDay !== null ? ` · due day ${account.dueDay}` : ''}
                  </Text>
                )}
                <AppButton title="Archive account" onPress={() => confirmArchive(account)} variant="ghost" small />
              </View>
            )}
          </Card>
        );
      })}

      <FAB icon="plus" accessibilityLabel="Add account" onPress={() => setAddOpen(true)} />

      <AddAccountModal visible={addOpen} onClose={() => setAddOpen(false)} onSave={saveAccount} today={today} />
    </View>
  );
}

function AddAccountModal({
  visible,
  onClose,
  onSave,
  today,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (account: Account) => Promise<void>;
  today: string;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [isLiability, setIsLiability] = useState(defaultIsLiability('bank'));

  const balanceMode = defaultBalanceMode(accountType);

  const selectType = (next: AccountType) => {
    setAccountType(next);
    setIsLiability(defaultIsLiability(next));
  };

  const submit = async () => {
    if (name.trim() === '') return;
    const openingBalanceMinor = balanceMode === 'ledger' ? (parseMoneyInput(openingBalanceInput) ?? 0) : 0;
    const nowIso = new Date().toISOString();
    await onSave({
      id: defaultGenId(),
      externalId: defaultGenId(),
      name: name.trim(),
      type: accountType,
      balanceMode,
      isLiability,
      currency: 'INR',
      openingBalanceMinor,
      openingDate: balanceMode === 'ledger' ? today : null,
      interestRate: null,
      minimumPaymentMinor: null,
      dueDay: null,
      source: 'manual',
      archivedAt: null,
      updatedAt: nowIso,
    });
    setName('');
    setOpeningBalanceInput('');
    setAccountType('bank');
    setIsLiability(defaultIsLiability('bank'));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <Card style={{ gap: space.m }}>
            <Overline>Add account</Overline>
            <Field placeholder="Account name" value={name} onChangeText={setName} autoFocus />
            <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
              {ACCOUNT_TYPES.map((opt) => (
                <Chip key={opt.value} label={opt.label} active={accountType === opt.value} onPress={() => selectType(opt.value)} />
              ))}
            </Row>
            {balanceMode === 'ledger' && (
              <Field
                placeholder="Opening balance"
                keyboardType="decimal-pad"
                value={openingBalanceInput}
                onChangeText={setOpeningBalanceInput}
              />
            )}
            {balanceMode === 'valuation' && (
              <Text style={[type.caption, { color: t.muted }]}>
                You'll enter its current value right after creating it.
              </Text>
            )}
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={[type.body, { color: t.ink }]}>Counts as a liability</Text>
              <AppSwitch value={isLiability} onChange={setIsLiability} />
            </Row>
            <AppButton title="Add account" onPress={submit} />
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l },
});
