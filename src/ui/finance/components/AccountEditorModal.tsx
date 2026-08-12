import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { accountBalanceAsOf } from '../../../finance/netWorth';
import { defaultGenId } from '../../../finance/ids';
import { CURRENCY_CODES, currencySymbol, formatMoneyMinor, moneyInputValue, parseMoneyInput } from '../../../finance/money';
import type { Account, AccountType, AccountValuation, CurrencyCode } from '../../../finance/types';
import { AppButton, AppSwitch, Card, Chip, ErrorText, Field, Overline, Row } from '../../kit';
import { space, type, useTheme } from '../../theme';
import { useFinanceData } from '../FinanceDataContext';

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
 * Parses the three optional debt fields. A blank field means "not set" (null),
 * never zero — the debt module treats a null APR as unknown and refuses to
 * rank on it.
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

/**
 * Creates or edits an account's core fields, plus (edit only) its quick
 * valuation/balance-correction update, debt details, and archive/restore/
 * delete actions — the module's `entity: Entity | null` idiom, mirroring
 * CategoryEditorModal and RecurringModal. `account: null` means create.
 */
export function AccountEditorModal({
  visible,
  onClose,
  account,
}: {
  visible: boolean;
  onClose: () => void;
  account: Account | null;
}) {
  const t = useTheme();
  const {
    transactions,
    valuations,
    today,
    saveAccount,
    saveValuation,
    deleteValuation,
    saveTransaction,
    archiveAccount,
    unarchiveAccount,
    deleteAccount,
  } = useFinanceData();

  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [isLiability, setIsLiability] = useState(defaultIsLiability('bank'));
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [aprInput, setAprInput] = useState('');
  const [minimumInput, setMinimumInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
  const [valuationInput, setValuationInput] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Re-seed whenever the target changes, so reopening on a different account
  // (or switching from edit back to create) doesn't show stale values.
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setValuationInput('');
    setCorrectionInput('');
    if (account === null) {
      setName('');
      setAccountType('bank');
      setCurrency('INR');
      setOpeningBalanceInput('');
      setIsLiability(defaultIsLiability('bank'));
      setCreditLimitInput('');
      setAprInput('');
      setMinimumInput('');
      setDueDayInput('');
    } else {
      setName(account.name);
      setAccountType(account.type);
      setCurrency(account.currency);
      setOpeningBalanceInput(moneyInputValue(account.openingBalanceMinor));
      setIsLiability(account.isLiability);
      setCreditLimitInput(moneyInputValue(account.creditLimitMinor));
      setAprInput(account.interestRate === null ? '' : String(account.interestRate));
      setMinimumInput(moneyInputValue(account.minimumPaymentMinor));
      setDueDayInput(account.dueDay === null ? '' : String(account.dueDay));
    }
  }, [visible, account]);

  const balanceMode = defaultBalanceMode(accountType);

  const latestValuation: AccountValuation | null =
    account === null
      ? null
      : valuations
          .filter((v) => v.accountExternalId === account.externalId)
          .reduce<AccountValuation | null>((best, v) => {
            if (best === null || v.asOfDate > best.asOfDate) return v;
            if (v.asOfDate === best.asOfDate && v.updatedAt > best.updatedAt) return v;
            return best;
          }, null);

  const confirmDeleteValuation = () => {
    if (latestValuation === null) return;
    Alert.alert(
      'Remove this value entry?',
      `The entry of ${formatMoneyMinor(latestValuation.amountMinor, currency)} as of ${latestValuation.asOfDate} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void deleteValuation(latestValuation.externalId) },
      ],
    );
  };

  const selectType = (next: AccountType) => {
    setAccountType(next);
    setIsLiability(defaultIsLiability(next));
  };

  const submit = async () => {
    setError(null);
    if (name.trim() === '') return setError('Enter an account name.');
    const creditLimitMinor = accountType === 'credit_card' ? parseMoneyInput(creditLimitInput) : null;
    const parsedDebt = isDebtType(accountType)
      ? parseDebtFields(aprInput, minimumInput, dueDayInput)
      : { fields: { interestRate: null, minimumPaymentMinor: null, dueDay: null } };
    if ('error' in parsedDebt) return setError(parsedDebt.error);

    // Opening balance is set once at creation — editing it here would silently
    // rewrite every historical ledger balance. Balance correction (below) is
    // the sanctioned way to fix drift after the fact.
    const openingBalanceMinor =
      account !== null ? account.openingBalanceMinor : balanceMode === 'ledger' ? (parseMoneyInput(openingBalanceInput) ?? 0) : 0;

    const nowIso = new Date().toISOString();
    const next: Account = {
      id: account?.id ?? defaultGenId(),
      externalId: account?.externalId ?? defaultGenId(),
      name: name.trim(),
      type: accountType,
      balanceMode,
      isLiability,
      currency,
      openingBalanceMinor,
      openingDate: account?.openingDate ?? (balanceMode === 'ledger' ? today : null),
      ...parsedDebt.fields,
      creditLimitMinor,
      source: account?.source ?? 'manual',
      archivedAt: account?.archivedAt ?? null,
      updatedAt: nowIso,
    };
    try {
      await saveAccount(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitValuation = async () => {
    if (account === null) return;
    const amountMinor = parseMoneyInput(valuationInput);
    if (amountMinor === null || amountMinor < 0) return setError('Enter a valid amount.');
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
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Corrects a ledger account's balance by booking the delta as an 'adjustment' transaction — the balance itself is never stored directly. */
  const submitCorrection = async () => {
    if (account === null) return;
    const enteredMinor = parseMoneyInput(correctionInput);
    if (enteredMinor === null) return setError('Enter a valid amount.');
    const currentMinor = accountBalanceAsOf(account, transactions, valuations, today) ?? 0;
    const deltaMinor = enteredMinor - currentMinor;
    if (deltaMinor === 0) return setError('That already matches the current balance.');
    // accountBalanceAsOf derives a liability's owed amount as opening minus
    // effects (netWorth.ts), but ledgerBalanceAsOf applies an adjustment's
    // amountMinor to effects unflipped — so on a liability account the effect
    // has to be negated, or the correction moves the owed balance the wrong
    // way (and by 2x the intended distance).
    const effectMinor = account.isLiability ? -deltaMinor : deltaMinor;
    try {
      await saveTransaction({
        id: defaultGenId(),
        externalId: defaultGenId(),
        type: 'adjustment',
        accountExternalId: account.externalId,
        counterAccountExternalId: null,
        categoryExternalId: null,
        amountMinor: effectMinor,
        currency: account.currency,
        note: 'Balance correction',
        txnDate: today,
        source: 'manual',
        recurrenceExternalId: null,
        updatedAt: new Date().toISOString(),
      });
      setCorrectionInput('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmArchive = () => {
    if (account === null) return;
    Alert.alert('Archive account?', `"${account.name}" will be hidden but kept for historical reports.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          void archiveAccount(account.externalId);
          onClose();
        },
      },
    ]);
  };

  /** For accounts created by mistake (typo'd name, duplicate) — unlike archive, this removes it and its transaction history entirely. */
  const confirmDelete = () => {
    if (account === null) return;
    const historyCount = transactions.filter(
      (tx) => tx.accountExternalId === account.externalId || tx.counterAccountExternalId === account.externalId,
    ).length;
    const message =
      historyCount > 0
        ? `"${account.name}" and its ${historyCount} logged transaction${historyCount === 1 ? '' : 's'} will be permanently deleted, including from past reports. This can't be undone. If you want to keep the history, use Archive instead.`
        : `"${account.name}" will be permanently deleted. This can't be undone.`;
    Alert.alert('Delete account?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteAccount(account.externalId);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m }}>
              <Overline>{account === null ? 'New account' : 'Edit account'}</Overline>
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
              {account === null && balanceMode === 'ledger' && (
                <Field
                  label="Opening balance"
                  prefix={currencySymbol(currency)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={openingBalanceInput}
                  onChangeText={setOpeningBalanceInput}
                />
              )}
              {account === null && balanceMode === 'valuation' && (
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

              {account !== null && balanceMode === 'valuation' && (
                <>
                  <Row gap={space.m}>
                    <Field
                      label={`Current value (${currency})`}
                      prefix={currencySymbol(currency)}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={valuationInput}
                      onChangeText={setValuationInput}
                      style={{ flex: 1 }}
                    />
                    <AppButton title="Update" onPress={submitValuation} small />
                  </Row>
                  {latestValuation !== null && (
                    <AppButton
                      title={`Remove entry of ${formatMoneyMinor(latestValuation.amountMinor, currency)} (${latestValuation.asOfDate})`}
                      onPress={confirmDeleteValuation}
                      variant="ghost"
                      small
                    />
                  )}
                </>
              )}
              {account !== null && balanceMode === 'ledger' && (
                <>
                  <Text style={[type.caption, { color: t.muted }]}>
                    Balance updates automatically from logged transactions. If it's wrong, correct it below.
                  </Text>
                  <Row gap={space.m}>
                    <Field
                      label={`Actual balance (${currency})`}
                      prefix={currencySymbol(currency)}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={correctionInput}
                      onChangeText={setCorrectionInput}
                      style={{ flex: 1 }}
                    />
                    <AppButton title="Correct" onPress={submitCorrection} small />
                  </Row>
                </>
              )}

              {error !== null && <ErrorText>{error}</ErrorText>}
              <AppButton title={account === null ? 'Add account' : 'Save changes'} onPress={submit} />

              {account !== null && (
                <Row gap={space.m}>
                  <View style={{ flex: 1 }}>
                    {account.archivedAt === null ? (
                      <AppButton title="Archive account" onPress={confirmArchive} variant="ghost" small />
                    ) : (
                      <AppButton
                        title="Restore account"
                        onPress={() => {
                          void unarchiveAccount(account.externalId);
                          onClose();
                        }}
                        variant="ghost"
                        small
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppButton title="Delete account" onPress={confirmDelete} variant="danger" small />
                  </View>
                </Row>
              )}
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l },
});
