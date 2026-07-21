import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { accountBalanceAsOf } from '../../finance/netWorth';
import { defaultGenId } from '../../finance/ids';
import { formatMoneyMinor, parseMoneyInput } from '../../finance/money';
import type { Account, AccountType } from '../../finance/types';
import { AppButton, AppSwitch, Card, Chip, EmptyState, ErrorText, FAB, Field, Overline, ProgressBar, Row } from '../kit';
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

function CreditUtilization({
  usedMinor,
  limitMinor,
  currency,
}: {
  usedMinor: number;
  limitMinor: number;
  currency: string;
}) {
  const t = useTheme();
  const pct = limitMinor > 0 ? usedMinor / limitMinor : 0;
  return (
    <View style={{ gap: space.xs }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[type.caption, { color: t.muted }]}>
          Used {formatMoneyMinor(usedMinor, currency)} of {formatMoneyMinor(limitMinor, currency)}
        </Text>
        <Text style={[type.caption, { color: pct > 0.8 ? t.danger : t.muted }]}>{Math.round(pct * 100)}%</Text>
      </Row>
      <ProgressBar pct={pct} color={pct > 0.8 ? t.danger : t.accent} />
    </View>
  );
}

export function AccountsScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, today, saveAccount, archiveAccount, saveValuation, saveTransaction } =
    useFinanceData();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [valuationInput, setValuationInput] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');

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

  /** Corrects a ledger account's balance by booking the delta as an 'adjustment' transaction — the balance itself is never stored directly. */
  const submitCorrection = async (account: Account) => {
    const enteredMinor = parseMoneyInput(correctionInput);
    if (enteredMinor === null) return;
    const currentMinor = balanceFor(account) ?? 0;
    const deltaMinor = enteredMinor - currentMinor;
    if (deltaMinor === 0) return;
    await saveTransaction({
      id: defaultGenId(),
      externalId: defaultGenId(),
      type: 'adjustment',
      accountExternalId: account.externalId,
      counterAccountExternalId: null,
      categoryExternalId: null,
      amountMinor: deltaMinor,
      currency: account.currency,
      note: 'Balance correction',
      txnDate: today,
      source: 'manual',
      recurrenceExternalId: null,
      updatedAt: new Date().toISOString(),
    });
    setCorrectionInput('');
  };

  const confirmArchive = (account: Account) => {
    Alert.alert('Archive account?', `"${account.name}" will be hidden but kept for historical reports.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void archiveAccount(account.externalId) },
    ]);
  };

  return (
    <View style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.list}>
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

            {account.type === 'credit_card' && account.creditLimitMinor !== null && (
              <CreditUtilization usedMinor={balance ?? 0} limitMinor={account.creditLimitMinor} currency={account.currency} />
            )}

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
                  <>
                    <Text style={[type.caption, { color: t.muted }]}>
                      Balance updates automatically from logged transactions. If it's wrong, correct it below.
                    </Text>
                    <Row gap={space.m}>
                      <Field
                        placeholder={`Actual balance (${account.currency})`}
                        keyboardType="decimal-pad"
                        value={correctionInput}
                        onChangeText={setCorrectionInput}
                        style={{ flex: 1 }}
                      />
                      <AppButton title="Correct" onPress={() => submitCorrection(account)} small />
                    </Row>
                  </>
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
      </ScrollView>
      </KeyboardAvoidingView>

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
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const balanceMode = defaultBalanceMode(accountType);

  const selectType = (next: AccountType) => {
    setAccountType(next);
    setIsLiability(defaultIsLiability(next));
  };

  const submit = async () => {
    setError(null);
    if (name.trim() === '') return setError('Enter an account name.');
    const openingBalanceMinor = balanceMode === 'ledger' ? (parseMoneyInput(openingBalanceInput) ?? 0) : 0;
    const creditLimitMinor = accountType === 'credit_card' ? parseMoneyInput(creditLimitInput) : null;
    const nowIso = new Date().toISOString();
    try {
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
        creditLimitMinor,
        source: 'manual',
        archivedAt: null,
        updatedAt: nowIso,
      });
      setName('');
      setOpeningBalanceInput('');
      setAccountType('bank');
      setIsLiability(defaultIsLiability('bank'));
      setCreditLimitInput('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
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
              {accountType === 'credit_card' && (
                <Field
                  placeholder="Credit limit (optional)"
                  keyboardType="decimal-pad"
                  value={creditLimitInput}
                  onChangeText={setCreditLimitInput}
                />
              )}
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[type.body, { color: t.ink }]}>Counts as a liability</Text>
                <AppSwitch value={isLiability} onChange={setIsLiability} />
              </Row>
              {error !== null && <ErrorText>{error}</ErrorText>}
              <AppButton title="Add account" onPress={submit} />
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, gap: space.m },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l },
});
