import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { defaultGenId } from '../../finance/ids';
import { currencySymbol, formatMoneyMinor, moneyInputValue, parseMoneyInput } from '../../finance/money';
import { UNCATEGORISED_EXTERNAL_ID } from '../../finance/presetCategories';
import type { Transaction, TransactionType } from '../../finance/types';
import { AppButton, Card, Chip, EmptyState, ErrorText, FAB, Field, Overline, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { CategoryEditorModal } from './components/CategoryEditorModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { RecurringModal } from './components/RecurringModal';
import { useFinanceData } from './FinanceDataContext';
import { accountName, categoryName } from './labels';

const KIND_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Adjustment' },
];

const KIND_FILTER_OPTIONS: { value: TransactionType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...KIND_OPTIONS,
];

const PAGE_SIZE = 50;

export function TransactionsScreen() {
  const t = useTheme();
  const { transactions, accounts, categories, recurringTransactions, deleteTransaction } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<TransactionType | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.txnDate < b.txnDate ? 1 : a.txnDate > b.txnDate ? -1 : 0)),
    [transactions],
  );

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sorted.filter((txn) => {
      if (kindFilter !== 'all' && txn.type !== kindFilter) return false;
      if (query === '') return true;
      const haystack = [
        txn.note ?? '',
        categoryName(categories, txn.categoryExternalId),
        accountName(accounts, txn.accountExternalId),
        accountName(accounts, txn.counterAccountExternalId),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sorted, searchQuery, kindFilter, categories, accounts]);

  const visible = filtered.slice(0, visibleCount);
  const activeRecurringCount = recurringTransactions.filter((r) => r.active).length;
  const isFiltering = searchQuery.trim() !== '' || kindFilter !== 'all';

  const confirmDelete = (txn: Transaction) => {
    Alert.alert('Delete this transaction?', `${formatMoneyMinor(txn.amountMinor, txn.currency)} on ${txn.txnDate}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteTransaction(txn.externalId) },
    ]);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        <Field placeholder="Search notes, category, account" value={searchQuery} onChangeText={setSearchQuery} />
        <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
          {KIND_FILTER_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} active={kindFilter === opt.value} onPress={() => setKindFilter(opt.value)} />
          ))}
        </Row>

        <Row style={{ justifyContent: 'space-between' }}>
          <Overline>Recent</Overline>
          <Row gap={space.m}>
            <Chip
              label="Manage categories"
              active={false}
              onPress={() => setCategoriesOpen(true)}
            />
            <Chip
              label={`Recurring (${activeRecurringCount})`}
              active={false}
              onPress={() => setRecurringOpen(true)}
            />
          </Row>
        </Row>

        {sorted.length === 0 && <EmptyState message="No transactions yet — tap + to log one." />}
        {sorted.length > 0 && filtered.length === 0 && (
          <EmptyState message="No transactions match this search or filter." />
        )}
        {filtered.length > 0 && (
          <Text style={[type.caption, { color: t.muted }]}>Tap an entry to edit it, long-press to delete.</Text>
        )}

        {visible.map((txn) => {
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
            <Pressable
              key={txn.id}
              onPress={() => setEditingTxn(txn)}
              onLongPress={() => confirmDelete(txn)}
              accessibilityRole="button"
              accessibilityLabel={`${subtitle}, ${formatMoneyMinor(signedMinor, txn.currency)}, ${txn.txnDate}`}
              accessibilityHint="Double tap to edit. Long-press to delete."
            >
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

        {filtered.length > visibleCount && (
          <AppButton
            title={`Show more (${filtered.length - visibleCount} left)`}
            onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
            variant="ghost"
            small
          />
        )}
        {!isFiltering && visibleCount > PAGE_SIZE && filtered.length <= visibleCount && (
          <AppButton title="Show fewer" onPress={() => setVisibleCount(PAGE_SIZE)} variant="ghost" small />
        )}
      </ScrollView>

      <FAB icon="plus" accessibilityLabel="Add transaction" onPress={() => setAddOpen(true)} />

      <AddTransactionModal visible={addOpen} onClose={() => setAddOpen(false)} />
      <AddTransactionModal
        visible={editingTxn !== null}
        onClose={() => setEditingTxn(null)}
        transaction={editingTxn}
      />
      <RecurringModal visible={recurringOpen} onClose={() => setRecurringOpen(false)} />
      <CategoryManagerModal visible={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </View>
  );
}

/* ------------------------------------------------------------- add/edit txn */

interface TransactionLockContext {
  lockKind: 'transfer';
  toAccountExternalId: string;
  title: string;
}

export function AddTransactionModal({
  visible,
  onClose,
  transaction = null,
  context,
}: {
  visible: boolean;
  onClose: () => void;
  /** Present to edit an existing transaction; absent/null to add a new one. */
  transaction?: Transaction | null;
  /** Locks kind + destination account — used when the entry point already knows what's being logged (e.g. a debt payment). */
  context?: TransactionLockContext;
}) {
  const t = useTheme();
  const { accounts, categories, transactions, today, saveTransaction } = useFinanceData();

  const isEditing = transaction !== null;
  const [kind, setKind] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [accountExternalId, setAccountExternalId] = useState<string | null>(null);
  const [counterAccountExternalId, setCounterAccountExternalId] = useState<string | null>(null);
  const [categoryExternalId, setCategoryExternalId] = useState<string | null>(UNCATEGORISED_EXTERNAL_ID.expense);
  const [txnDate, setTxnDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seeds every time the modal opens on a (possibly different) transaction/context — this
  // component stays mounted across opens, so plain useState initializers would only fire once
  // and keep showing whichever transaction was tapped first. Deps are primitives, not the
  // `transaction`/`context` objects themselves, so retyping inside an already-open modal (which
  // re-renders the parent and hands down new object references) doesn't wipe what's been typed.
  useEffect(() => {
    if (!visible) return;
    const lastTxn = transactions[0] ?? null;
    setKind(transaction?.type ?? (context !== undefined ? 'transfer' : 'expense'));
    setAmountInput(transaction === null ? '' : moneyInputValue(transaction.amountMinor));
    const defaultFrom = transaction?.accountExternalId ?? lastTxn?.accountExternalId ?? accounts[0]?.externalId ?? null;
    const fromCandidates = accounts.filter((a) => a.archivedAt === null && a.externalId !== context?.toAccountExternalId);
    setAccountExternalId(
      context !== undefined && defaultFrom === context.toAccountExternalId
        ? (fromCandidates[0]?.externalId ?? null)
        : defaultFrom,
    );
    setCounterAccountExternalId(transaction?.counterAccountExternalId ?? context?.toAccountExternalId ?? null);
    setCategoryExternalId(transaction?.categoryExternalId ?? lastTxn?.categoryExternalId ?? UNCATEGORISED_EXTERNAL_ID.expense);
    setTxnDate(transaction?.txnDate ?? today);
    setNote(transaction?.note ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, transaction?.externalId, context?.toAccountExternalId, context?.title]);

  const categoriesForKind = categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));
  const account = accounts.find((a) => a.externalId === accountExternalId);
  const currency = account?.currency ?? 'INR';

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
    if (amountInput.trim() === '') return setError('Enter an amount.');
    const parsed = parseMoneyInput(amountInput);
    if (parsed === null) return setError('Enter a valid amount, e.g. 450.50.');
    if (parsed === 0) {
      return setError(kind === 'adjustment' ? 'Enter a non-zero adjustment amount.' : 'Enter an amount greater than zero.');
    }
    if (accountExternalId === null) return setError('Add an account first.');
    if (kind === 'transfer' && (counterAccountExternalId === null || counterAccountExternalId === accountExternalId)) {
      return setError('Pick a different "to" account for the transfer.');
    }

    const nowIso = new Date().toISOString();
    const amountMinor = kind === 'adjustment' ? parsed : Math.abs(parsed);

    await saveTransaction({
      id: transaction?.id ?? defaultGenId(),
      externalId: transaction?.externalId ?? defaultGenId(),
      type: kind,
      accountExternalId,
      counterAccountExternalId: kind === 'transfer' ? counterAccountExternalId : null,
      categoryExternalId: kind === 'transfer' || kind === 'adjustment' ? null : categoryExternalId,
      amountMinor,
      currency: account?.currency ?? 'INR',
      note: note.trim() === '' ? null : note.trim(),
      txnDate,
      source: transaction?.source ?? 'manual',
      recurrenceExternalId: transaction?.recurrenceExternalId ?? null,
      updatedAt: nowIso,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m }}>
              <Overline>{context?.title ?? (isEditing ? 'Edit transaction' : 'Add transaction')}</Overline>

              {context === undefined && (
                <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                  {KIND_OPTIONS.map((opt) => (
                    <Chip key={opt.value} label={opt.label} active={kind === opt.value} onPress={() => selectKind(opt.value)} />
                  ))}
                </Row>
              )}

              <Field
                label="Amount"
                prefix={currencySymbol(currency)}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amountInput}
                onChangeText={setAmountInput}
                autoFocus
              />

              <Text style={[type.caption, { color: t.secondary }]}>
                {kind === 'transfer' ? 'From account' : 'Account'}
              </Text>
              <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
                {accounts
                  .filter((a) => a.archivedAt === null && a.externalId !== context?.toAccountExternalId)
                  .map((a) => (
                    <Chip
                      key={a.externalId}
                      label={a.name}
                      active={accountExternalId === a.externalId}
                      onPress={() => setAccountExternalId(a.externalId)}
                    />
                  ))}
              </Row>

              {kind === 'transfer' && context === undefined && (
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

              <Text style={[type.caption, { color: t.secondary }]}>Date</Text>
              <Pressable onPress={() => setShowDatePicker(true)}>
                <Text style={[type.body, { color: t.accent }]}>
                  {new Date(`${txnDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(`${txnDate}T00:00:00`)}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(_event, selected) => {
                    setShowDatePicker(false);
                    if (selected) setTxnDate(selected.toISOString().slice(0, 10));
                  }}
                />
              )}

              <Field label="Note" placeholder="Optional" value={note} onChangeText={setNote} />

              {error !== null && <ErrorText>{error}</ErrorText>}
              <AppButton title={isEditing ? 'Save changes' : 'Save'} onPress={submit} />
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
