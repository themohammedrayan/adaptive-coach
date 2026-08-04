import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { defaultGenId } from '../../finance/ids';
import { formatMoneyMinor, parseMoneyInput } from '../../finance/money';
import { UNCATEGORISED_EXTERNAL_ID } from '../../finance/presetCategories';
import type {
  Account,
  Category,
  RecurrenceFrequency,
  RecurringTransaction,
  Transaction,
  TransactionType,
} from '../../finance/types';
import { AppButton, AppSwitch, Card, Chip, EmptyState, ErrorText, FAB, Field, Overline, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { CategoryEditorModal } from './components/CategoryEditorModal';
import { useFinanceData } from './FinanceDataContext';

const KIND_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Adjustment' },
];

function accountName(accounts: Account[], externalId: string | null): string {
  if (externalId === null) return '—';
  return accounts.find((a) => a.externalId === externalId)?.name ?? 'Unknown account';
}

function categoryName(categories: Category[], externalId: string | null): string {
  if (externalId === null) return '—';
  return categories.find((c) => c.externalId === externalId)?.name ?? 'Unknown';
}

export function TransactionsScreen() {
  const t = useTheme();
  const { transactions, accounts, categories, recurringTransactions, deleteTransaction } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [addRecurringOpen, setAddRecurringOpen] = useState(false);

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.txnDate < b.txnDate ? 1 : a.txnDate > b.txnDate ? -1 : 0)),
    [transactions],
  );
  const activeRecurringCount = recurringTransactions.filter((r) => r.active).length;

  const confirmDelete = (txn: Transaction) => {
    Alert.alert('Delete this transaction?', `${formatMoneyMinor(txn.amountMinor, txn.currency)} on ${txn.txnDate}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteTransaction(txn.externalId) },
    ]);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Overline>Recent</Overline>
        <Pressable onPress={() => setRecurringOpen(true)}>
          <Text style={[type.caption, { color: t.accent, fontWeight: '600' }]}>
            Recurring ({activeRecurringCount})
          </Text>
        </Pressable>
      </Row>

      {sorted.length === 0 && <EmptyState message="No transactions yet — tap + to log one." />}
      {sorted.length > 0 && (
        <Text style={[type.caption, { color: t.muted }]}>Long-press an entry to delete it.</Text>
      )}

      {sorted.map((txn) => {
        const isExpense = txn.type === 'expense';
        const isIncome = txn.type === 'income';
        const signedMinor = isExpense ? -txn.amountMinor : txn.amountMinor;
        const color = isExpense ? t.danger : isIncome ? t.good : t.ink;
        const subtitle =
          txn.type === 'transfer'
            ? `${accountName(accounts, txn.accountExternalId)} → ${accountName(accounts, txn.counterAccountExternalId)}`
            : txn.type === 'adjustment'
              ? `${accountName(accounts, txn.accountExternalId)} · adjustment`
              : `${categoryName(categories, txn.categoryExternalId)} · ${accountName(accounts, txn.accountExternalId)}`;
        return (
          <Pressable key={txn.id} onLongPress={() => confirmDelete(txn)}>
            <Card style={{ gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[type.body, { color: t.ink }]}>{subtitle}</Text>
                <Text style={[type.heading, { color }]}>{formatMoneyMinor(signedMinor, txn.currency)}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[type.caption, { color: t.muted }]}>{txn.txnDate}</Text>
                {txn.note !== null && txn.note !== '' && (
                  <Text style={[type.caption, { color: t.muted }]}>{txn.note}</Text>
                )}
              </Row>
            </Card>
          </Pressable>
        );
      })}
      </ScrollView>

      <FAB icon="plus" accessibilityLabel="Add transaction" onPress={() => setAddOpen(true)} />

      <AddTransactionModal visible={addOpen} onClose={() => setAddOpen(false)} />
      <RecurringListModal
        visible={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        onAddNew={() => {
          setRecurringOpen(false);
          setAddRecurringOpen(true);
        }}
      />
      <AddRecurringModal visible={addRecurringOpen} onClose={() => setAddRecurringOpen(false)} />
    </View>
  );
}

/* ------------------------------------------------------------- add txn */

export function AddTransactionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { accounts, categories, transactions, today, saveTransaction, saveCategory } = useFinanceData();

  const lastTxn = transactions[0] ?? null;
  const [kind, setKind] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [accountExternalId, setAccountExternalId] = useState<string | null>(lastTxn?.accountExternalId ?? accounts[0]?.externalId ?? null);
  const [counterAccountExternalId, setCounterAccountExternalId] = useState<string | null>(null);
  const [categoryExternalId, setCategoryExternalId] = useState<string | null>(
    lastTxn?.categoryExternalId ?? UNCATEGORISED_EXTERNAL_ID.expense,
  );
  const [note, setNote] = useState('');
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesForKind = categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));

  const selectKind = (next: TransactionType) => {
    setKind(next);
    if (next === 'expense' || next === 'income') {
      setCategoryExternalId(UNCATEGORISED_EXTERNAL_ID[next]);
    } else {
      setCategoryExternalId(null);
    }
  };


  const submit = async () => {
    setError(null);
    const parsed = parseMoneyInput(amountInput);
    if (parsed === null) return setError('Enter an amount.');
    if (accountExternalId === null) return setError('Add an account first.');
    if (kind === 'transfer' && (counterAccountExternalId === null || counterAccountExternalId === accountExternalId)) {
      return setError('Pick a different "to" account for the transfer.');
    }
    if (kind === 'adjustment' && parsed === 0) return setError('Enter a non-zero adjustment amount.');

    const account = accounts.find((a) => a.externalId === accountExternalId);
    const nowIso = new Date().toISOString();
    const amountMinor = kind === 'adjustment' ? parsed : Math.abs(parsed);

    await saveTransaction({
      id: defaultGenId(),
      externalId: defaultGenId(),
      type: kind,
      accountExternalId,
      counterAccountExternalId: kind === 'transfer' ? counterAccountExternalId : null,
      categoryExternalId: kind === 'transfer' || kind === 'adjustment' ? null : categoryExternalId,
      amountMinor,
      currency: account?.currency ?? 'INR',
      note: note.trim() === '' ? null : note.trim(),
      txnDate: today,
      source: 'manual',
      recurrenceExternalId: null,
      updatedAt: nowIso,
    });
    setAmountInput('');
    setNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m }}>
              <Overline>Add transaction</Overline>
              <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                {KIND_OPTIONS.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={kind === opt.value} onPress={() => selectKind(opt.value)} />
                ))}
              </Row>

              <Field placeholder="Amount" keyboardType="decimal-pad" value={amountInput} onChangeText={setAmountInput} autoFocus />

              <Text style={[type.caption, { color: t.secondary }]}>
                {kind === 'transfer' ? 'From account' : 'Account'}
              </Text>
              <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                {accounts
                  .filter((a) => a.archivedAt === null)
                  .map((a) => (
                    <Chip
                      key={a.externalId}
                      label={a.name}
                      active={accountExternalId === a.externalId}
                      onPress={() => setAccountExternalId(a.externalId)}
                    />
                  ))}
              </Row>

              {kind === 'transfer' && (
                <>
                  <Text style={[type.caption, { color: t.secondary }]}>To account</Text>
                  <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                    {accounts
                      .filter((a) => a.archivedAt === null && a.externalId !== accountExternalId)
                      .map((a) => (
                        <Chip
                          key={a.externalId}
                          label={a.name}
                          active={counterAccountExternalId === a.externalId}
                          onPress={() => setCounterAccountExternalId(a.externalId)}
                        />
                      ))}
                  </Row>
                </>
              )}

              {(kind === 'expense' || kind === 'income') && (
                <>
                  <Text style={[type.caption, { color: t.secondary }]}>Category</Text>
                  <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                    {categoriesForKind.map((c) => (
                      <Chip
                        key={c.externalId}
                        label={c.name}
                        active={categoryExternalId === c.externalId}
                        onPress={() => setCategoryExternalId(c.externalId)}
                      />
                    ))}
                    <Chip label="+ New" active={false} onPress={() => setCategoryEditorOpen(true)} />
                  </Row>
                  <CategoryEditorModal
                    visible={categoryEditorOpen}
                    onClose={() => setCategoryEditorOpen(false)}
                    category={null}
                    kind={kind}
                    onSaved={(c) => setCategoryExternalId(c.externalId)}
                  />
                </>
              )}

              <Field placeholder="Note (optional)" value={note} onChangeText={setNote} />

              {error !== null && <ErrorText>{error}</ErrorText>}
              <AppButton title="Save" onPress={submit} />
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* --------------------------------------------------------- recurring list */

function describeRule(rule: RecurringTransaction, accounts: Account[], categories: Category[]): string {
  const freq = rule.frequency === 'monthly' ? 'Monthly' : rule.frequency === 'weekly' ? 'Weekly' : 'Daily';
  const label =
    rule.type === 'transfer'
      ? `${accountName(accounts, rule.accountExternalId)} → ${accountName(accounts, rule.counterAccountExternalId)}`
      : `${categoryName(categories, rule.categoryExternalId)} · ${accountName(accounts, rule.accountExternalId)}`;
  return `${freq} · ${label}`;
}

function RecurringListModal({
  visible,
  onClose,
  onAddNew,
}: {
  visible: boolean;
  onClose: () => void;
  onAddNew: () => void;
}) {
  const t = useTheme();
  const { recurringTransactions, accounts, categories, saveRecurringTransaction } = useFinanceData();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m }}>
              <Overline>Recurring transactions</Overline>
              {recurringTransactions.length === 0 && (
                <Text style={[type.body, { color: t.muted }]}>No recurring rules yet — rent, EMIs, SIPs, subscriptions.</Text>
              )}
              {recurringTransactions.map((rule) => (
                <Row key={rule.id} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: t.ink }]}>{describeRule(rule, accounts, categories)}</Text>
                    <Text style={[type.caption, { color: t.muted }]}>{formatMoneyMinor(rule.amountMinor, rule.currency)}</Text>
                  </View>
                  <AppSwitch
                    value={rule.active}
                    onChange={(active) => void saveRecurringTransaction({ ...rule, active, updatedAt: new Date().toISOString() })}
                  />
                </Row>
              ))}
              <AppButton title="Add recurring transaction" onPress={onAddNew} variant="secondary" />
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ----------------------------------------------------------- add recurring */

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

function AddRecurringModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { accounts, categories, today, saveRecurringTransaction } = useFinanceData();

  const [kind, setKind] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [accountExternalId, setAccountExternalId] = useState<string | null>(accounts[0]?.externalId ?? null);
  const [counterAccountExternalId, setCounterAccountExternalId] = useState<string | null>(null);
  const [categoryExternalId, setCategoryExternalId] = useState<string | null>(UNCATEGORISED_EXTERNAL_ID.expense);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [note, setNote] = useState('');

  const categoriesForKind = categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));

  const submit = async () => {
    const amountMinor = parseMoneyInput(amountInput);
    if (amountMinor === null || amountMinor <= 0 || accountExternalId === null) return;
    if (kind === 'transfer' && (counterAccountExternalId === null || counterAccountExternalId === accountExternalId)) return;

    const account = accounts.find((a) => a.externalId === accountExternalId);
    const dayOfMonth = frequency === 'monthly' ? Number(today.slice(8, 10)) : null;
    const externalId = defaultGenId();

    await saveRecurringTransaction({
      id: externalId,
      externalId,
      type: kind,
      accountExternalId,
      counterAccountExternalId: kind === 'transfer' ? counterAccountExternalId : null,
      categoryExternalId: kind === 'transfer' ? null : categoryExternalId,
      amountMinor,
      currency: account?.currency ?? 'INR',
      note: note.trim() === '' ? null : note.trim(),
      frequency,
      interval: 1,
      dayOfMonth,
      startDate: today,
      endDate: null,
      lastMaterializedDate: null,
      active: true,
      updatedAt: new Date().toISOString(),
    });
    setAmountInput('');
    setNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m }}>
              <Overline>Add recurring transaction</Overline>
              <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                {(['expense', 'income', 'transfer'] as const).map((k) => (
                  <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} active={kind === k} onPress={() => setKind(k)} />
                ))}
              </Row>
              <Field placeholder="Amount" keyboardType="decimal-pad" value={amountInput} onChangeText={setAmountInput} autoFocus />

              <Text style={[type.caption, { color: t.secondary }]}>{kind === 'transfer' ? 'From account' : 'Account'}</Text>
              <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                {accounts
                  .filter((a) => a.archivedAt === null)
                  .map((a) => (
                    <Chip key={a.externalId} label={a.name} active={accountExternalId === a.externalId} onPress={() => setAccountExternalId(a.externalId)} />
                  ))}
              </Row>

              {kind === 'transfer' ? (
                <>
                  <Text style={[type.caption, { color: t.secondary }]}>To account</Text>
                  <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                    {accounts
                      .filter((a) => a.archivedAt === null && a.externalId !== accountExternalId)
                      .map((a) => (
                        <Chip key={a.externalId} label={a.name} active={counterAccountExternalId === a.externalId} onPress={() => setCounterAccountExternalId(a.externalId)} />
                      ))}
                  </Row>
                </>
              ) : (
                <>
                  <Text style={[type.caption, { color: t.secondary }]}>Category</Text>
                  <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                    {categoriesForKind.map((c) => (
                      <Chip key={c.externalId} label={c.name} active={categoryExternalId === c.externalId} onPress={() => setCategoryExternalId(c.externalId)} />
                    ))}
                  </Row>
                </>
              )}

              <Text style={[type.caption, { color: t.secondary }]}>Repeats</Text>
              <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <Chip key={opt.value} label={opt.label} active={frequency === opt.value} onPress={() => setFrequency(opt.value)} />
                ))}
              </Row>

              <Field placeholder="Note (optional)" value={note} onChangeText={setNote} />
              <AppButton title="Save" onPress={submit} />
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
