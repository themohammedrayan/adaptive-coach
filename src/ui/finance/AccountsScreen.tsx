import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { accountBalanceAsOf } from '../../finance/netWorth';
import { defaultGenId } from '../../finance/ids';
import { CURRENCY_CODES, currencySymbol, formatMoneyMinor, moneyInputValue, parseMoneyInput } from '../../finance/money';
import type { Account, AccountType, CurrencyCode } from '../../finance/types';
import { AppButton, AppSwitch, Card, Chip, EmptyState, ErrorText, FAB, Field, Overline, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { CreditUtilization } from './components/CreditUtilization';
import { NetWorthHeader } from './components/NetWorthHeader';
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

/** Credit cards and loans are the two types the debt module reads APR/minimum/due-day from. */
function isDebtType(type: AccountType): boolean {
  return type === 'credit_card' || type === 'loan';
}

interface DebtFields {
  interestRate: number | null;
  minimumPaymentMinor: number | null;
  dueDay: number | null;
}

/**
 * Parses the three optional debt fields shared by the add form and the inline
 * editor. A blank field means "not set" (null), never zero — the debt module
 * treats a null APR as unknown and refuses to rank on it.
 */
function parseDebtFields(
  aprInput: string,
  minimumInput: string,
  dueDayInput: string,
): { fields: DebtFields } | { error: string } {
  let interestRate: number | null = null;
  if (aprInput.trim() !== '') {
    const parsed = Number(aprInput.trim());
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 200) {
      return { error: 'Enter an APR between 0 and 200.' };
    }
    interestRate = parsed;
  }

  let minimumPaymentMinor: number | null = null;
  if (minimumInput.trim() !== '') {
    const parsed = parseMoneyInput(minimumInput);
    if (parsed === null || parsed < 0) return { error: 'Enter a valid minimum payment.' };
    minimumPaymentMinor = parsed;
  }

  let dueDay: number | null = null;
  if (dueDayInput.trim() !== '') {
    const parsed = Number(dueDayInput.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
      return { error: 'Due day must be a whole number from 1 to 31.' };
    }
    dueDay = parsed;
  }

  return { fields: { interestRate, minimumPaymentMinor, dueDay } };
}

export function AccountsScreen() {
  const t = useTheme();
  const { accounts, transactions, valuations, today, saveAccount, archiveAccount, saveValuation, saveTransaction } =
    useFinanceData();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [valuationInput, setValuationInput] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');
  const [aprInput, setAprInput] = useState('');
  const [minimumInput, setMinimumInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.archivedAt === null), [accounts]);

  const balanceFor = (account: Account) => accountBalanceAsOf(account, transactions, valuations, today);

  const seedDebtInputs = (account: Account) => {
    setInlineError(null);
    setAprInput(account.interestRate === null ? '' : String(account.interestRate));
    setMinimumInput(moneyInputValue(account.minimumPaymentMinor));
    setDueDayInput(account.dueDay === null ? '' : String(account.dueDay));
  };

  /** Seeds the debt inputs from the account being opened — only one row is ever expanded. */
  const toggleExpanded = (account: Account) => {
    setExpandedId((prev) => (prev === account.externalId ? null : account.externalId));
    seedDebtInputs(account);
  };

  /** After creating an account, land the user straight in its own editor rather than a second "just created" form — resolves the create-time vs. inline-editor duplication for debt fields. */
  const openJustCreated = (account: Account) => {
    setExpandedId(account.externalId);
    seedDebtInputs(account);
  };

  const submitDebtFields = async (account: Account) => {
    const parsed = parseDebtFields(aprInput, minimumInput, dueDayInput);
    if ('error' in parsed) return setInlineError(parsed.error);
    try {
      // Same externalId, so upsert resolves to an update rather than an insert.
      await saveAccount({ ...account, ...parsed.fields, updatedAt: new Date().toISOString() });
      setInlineError(null);
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitValuation = async (account: Account) => {
    const amountMinor = parseMoneyInput(valuationInput);
    if (amountMinor === null || amountMinor < 0) return setInlineError('Enter a valid amount.');
    try {
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
      setInlineError(null);
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Corrects a ledger account's balance by booking the delta as an 'adjustment' transaction — the balance itself is never stored directly. */
  const submitCorrection = async (account: Account) => {
    const enteredMinor = parseMoneyInput(correctionInput);
    if (enteredMinor === null) return setInlineError('Enter a valid amount.');
    const currentMinor = balanceFor(account) ?? 0;
    const deltaMinor = enteredMinor - currentMinor;
    if (deltaMinor === 0) return setInlineError('That already matches the current balance.');
    try {
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
      setInlineError(null);
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e));
    }
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
      <NetWorthHeader />

      {activeAccounts.length === 0 && (
        <EmptyState message="Add a bank, cash, credit card, investment, or loan account to get started." />
      )}

      {activeAccounts.map((account) => {
        const balance = balanceFor(account);
        const expanded = expandedId === account.externalId;
        return (
          <Card key={account.id} style={{ gap: space.s }}>
            <Pressable onPress={() => toggleExpanded(account)}>
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
                      label={`Current value (${account.currency})`}
                      prefix={currencySymbol(account.currency)}
                      placeholder="0.00"
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
                        label={`Actual balance (${account.currency})`}
                        prefix={currencySymbol(account.currency)}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        value={correctionInput}
                        onChangeText={setCorrectionInput}
                        style={{ flex: 1 }}
                      />
                      <AppButton title="Correct" onPress={() => submitCorrection(account)} small />
                    </Row>
                  </>
                )}
                {isDebtType(account.type) && (
                  <View style={{ gap: space.s }}>
                    <Text style={[type.caption, { color: t.muted }]}>
                      Used by the Debt tab to rank what to pay first and track this cycle.
                    </Text>
                    <Row gap={space.m}>
                      <Field
                        label="APR %"
                        placeholder="e.g. 36"
                        keyboardType="decimal-pad"
                        value={aprInput}
                        onChangeText={setAprInput}
                        style={{ flex: 1 }}
                      />
                      <Field
                        label="Minimum"
                        placeholder="e.g. 1000"
                        keyboardType="decimal-pad"
                        value={minimumInput}
                        onChangeText={setMinimumInput}
                        style={{ flex: 1 }}
                      />
                      <Field
                        label="Due day"
                        placeholder="1–31"
                        keyboardType="number-pad"
                        value={dueDayInput}
                        onChangeText={setDueDayInput}
                        style={{ flex: 1 }}
                      />
                    </Row>
                    <AppButton title="Save debt details" onPress={() => submitDebtFields(account)} small />
                  </View>
                )}
                {inlineError !== null && <ErrorText>{inlineError}</ErrorText>}
                <AppButton title="Archive account" onPress={() => confirmArchive(account)} variant="ghost" small />
              </View>
            )}
          </Card>
        );
      })}
      </ScrollView>
      </KeyboardAvoidingView>

      <FAB icon="plus" accessibilityLabel="Add account" onPress={() => setAddOpen(true)} />

      <AddAccountModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={saveAccount}
        onCreated={openJustCreated}
        today={today}
      />
    </View>
  );
}

function AddAccountModal({
  visible,
  onClose,
  onSave,
  onCreated,
  today,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (account: Account) => Promise<void>;
  onCreated: (account: Account) => void;
  today: string;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [isLiability, setIsLiability] = useState(defaultIsLiability('bank'));
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [aprInput, setAprInput] = useState('');
  const [minimumInput, setMinimumInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
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
    const parsedDebt = isDebtType(accountType)
      ? parseDebtFields(aprInput, minimumInput, dueDayInput)
      : { fields: { interestRate: null, minimumPaymentMinor: null, dueDay: null } };
    if ('error' in parsedDebt) return setError(parsedDebt.error);
    const nowIso = new Date().toISOString();
    const account: Account = {
      id: defaultGenId(),
      externalId: defaultGenId(),
      name: name.trim(),
      type: accountType,
      balanceMode,
      isLiability,
      currency,
      openingBalanceMinor,
      openingDate: balanceMode === 'ledger' ? today : null,
      ...parsedDebt.fields,
      creditLimitMinor,
      source: 'manual',
      archivedAt: null,
      updatedAt: nowIso,
    };
    try {
      await onSave(account);
      setName('');
      setOpeningBalanceInput('');
      setAccountType('bank');
      setCurrency('INR');
      setIsLiability(defaultIsLiability('bank'));
      setCreditLimitInput('');
      setAprInput('');
      setMinimumInput('');
      setDueDayInput('');
      onClose();
      onCreated(account);
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
              <Field label="Account name" value={name} onChangeText={setName} autoFocus />
              <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                {ACCOUNT_TYPES.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={accountType === opt.value} onPress={() => selectType(opt.value)} />
                ))}
              </Row>
              <Text style={[type.caption, { color: t.secondary }]}>Currency</Text>
              <Row gap={space.s}>
                {CURRENCY_CODES.map((code) => (
                  <Chip key={code} label={code} active={currency === code} onPress={() => setCurrency(code)} />
                ))}
              </Row>
              {balanceMode === 'ledger' && (
                <Field
                  label="Opening balance"
                  prefix={currencySymbol(currency)}
                  placeholder="0.00"
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
                  label="Credit limit (optional)"
                  prefix={currencySymbol(currency)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={creditLimitInput}
                  onChangeText={setCreditLimitInput}
                />
              )}
              {isDebtType(accountType) && (
                <Row gap={space.m}>
                  <Field
                    label="APR %"
                    placeholder="Optional"
                    keyboardType="decimal-pad"
                    value={aprInput}
                    onChangeText={setAprInput}
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="Minimum"
                    placeholder="Optional"
                    keyboardType="decimal-pad"
                    value={minimumInput}
                    onChangeText={setMinimumInput}
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="Due day"
                    placeholder="1–31"
                    keyboardType="number-pad"
                    value={dueDayInput}
                    onChangeText={setDueDayInput}
                    style={{ flex: 1 }}
                  />
                </Row>
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
