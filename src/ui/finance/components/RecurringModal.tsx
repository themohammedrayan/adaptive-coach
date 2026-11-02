import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { defaultGenId } from '../../../finance/ids';
import { currencySymbol, formatMoneyMinor, moneyInputValue, parseDayOfMonth, parseMoneyInput } from '../../../finance/money';
import { UNCATEGORISED_EXTERNAL_ID } from '../../../finance/presetCategories';
import { occurrenceDatesBetween } from '../../../finance/recurrenceDates';
import type { Account, Category, RecurrenceFrequency, RecurringTransaction } from '../../../finance/types';
import { deviceLocalDate } from '../../../lib/dates';
import { AppButton, AppSwitch, Card, Chip, ErrorText, Field, Overline, Row } from '../../kit';
import { space, type, useTheme } from '../../theme';
import { useFinanceData } from '../FinanceDataContext';
import { accountName, categoryName } from '../labels';
import { showAlert } from '../../../lib/alert';

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekdayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
}

function describeRule(rule: RecurringTransaction, accounts: Account[], categories: Category[]): string {
  const freq = rule.frequency === 'monthly' ? 'Monthly' : rule.frequency === 'weekly' ? 'Weekly' : 'Daily';
  const label =
    rule.type === 'transfer'
      ? `${accountName(accounts, rule.accountExternalId)} → ${accountName(accounts, rule.counterAccountExternalId)}`
      : `${categoryName(categories, rule.categoryExternalId)} · ${accountName(accounts, rule.accountExternalId)}`;
  return `${freq} · ${label}`;
}

/**
 * List + create/edit form for recurring rules, sharing one `Modal` mount with
 * an internal `view` state instead of stacking two separate modals — tapping
 * a rule and tapping "Add" both land on the same form, just seeded
 * differently, and "back" returns to the still-mounted list instead of
 * closing everything.
 */
export function RecurringModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { recurringTransactions, accounts, categories, saveRecurringTransaction, deleteRecurringTransaction } =
    useFinanceData();
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingRule, setEditingRule] = useState<RecurringTransaction | null>(null);
  const t = useTheme();

  const close = () => {
    onClose();
    setView('list');
    setEditingRule(null);
  };

  const openCreate = () => {
    setEditingRule(null);
    setView('form');
  };

  const openEdit = (rule: RecurringTransaction) => {
    setEditingRule(rule);
    setView('form');
  };

  const confirmDelete = (rule: RecurringTransaction) => {
    showAlert('Delete this recurring rule?', describeRule(rule, accounts, categories), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteRecurringTransaction(rule.externalId) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <Card style={{ gap: space.m, maxHeight: '85%' }}>
              {view === 'list' ? (
                <>
                  <Overline>Recurring transactions</Overline>
                  <ScrollView>
                    {recurringTransactions.length === 0 && (
                      <Text style={[type.body, { color: t.muted }]}>
                        No recurring rules yet — rent, EMIs, SIPs, subscriptions.
                      </Text>
                    )}
                    {recurringTransactions.map((rule) => (
                      <Row key={rule.id} style={{ justifyContent: 'space-between', paddingVertical: space.xs }}>
                        <Pressable
                          onPress={() => openEdit(rule)}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit recurring rule: ${describeRule(rule, accounts, categories)}`}
                          style={{ flex: 1 }}
                        >
                          <Text style={[type.body, { color: t.ink }]}>{describeRule(rule, accounts, categories)}</Text>
                          <Text style={[type.caption, { color: t.muted }]}>
                            {formatMoneyMinor(rule.amountMinor, rule.currency)}
                          </Text>
                        </Pressable>
                        <Row gap={space.s}>
                          <AppSwitch
                            value={rule.active}
                            onChange={(active) =>
                              void saveRecurringTransaction({ ...rule, active, updatedAt: new Date().toISOString() })
                            }
                          />
                          <AppButton title="Delete" onPress={() => confirmDelete(rule)} variant="ghost" small />
                        </Row>
                      </Row>
                    ))}
                  </ScrollView>
                  <AppButton title="Add recurring transaction" onPress={openCreate} variant="secondary" />
                </>
              ) : (
                <RecurringForm
                  rule={editingRule}
                  onBack={() => setView('list')}
                  onDone={() => setView('list')}
                  onDelete={editingRule === null ? undefined : () => confirmDelete(editingRule)}
                />
              )}
            </Card>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RecurringForm({
  rule,
  onBack,
  onDone,
  onDelete,
}: {
  rule: RecurringTransaction | null;
  onBack: () => void;
  onDone: () => void;
  onDelete?: () => void;
}) {
  const t = useTheme();
  const { accounts, categories, today, saveRecurringTransaction } = useFinanceData();

  const [kind, setKind] = useState<'expense' | 'income' | 'transfer'>(rule?.type ?? 'expense');
  const [amountInput, setAmountInput] = useState(rule === null ? '' : moneyInputValue(rule.amountMinor));
  const [accountExternalId, setAccountExternalId] = useState<string | null>(
    rule?.accountExternalId ?? accounts[0]?.externalId ?? null,
  );
  const [counterAccountExternalId, setCounterAccountExternalId] = useState<string | null>(
    rule?.counterAccountExternalId ?? null,
  );
  const [categoryExternalId, setCategoryExternalId] = useState<string | null>(
    rule?.categoryExternalId ?? UNCATEGORISED_EXTERNAL_ID.expense,
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency ?? 'monthly');
  const [intervalInput, setIntervalInput] = useState(rule === null ? '1' : String(rule.interval));
  const [dayOfMonthInput, setDayOfMonthInput] = useState(
    rule?.dayOfMonth !== undefined && rule !== null && rule.dayOfMonth !== null
      ? String(rule.dayOfMonth)
      : String(Number(today.slice(8, 10))),
  );
  // Once the user (or an edit) has an explicit value, the debt-account default below stops overwriting it.
  const [dayOfMonthTouched, setDayOfMonthTouched] = useState(rule !== null);
  const [startDate, setStartDate] = useState(rule?.startDate ?? today);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [endDate, setEndDate] = useState<string | null>(rule?.endDate ?? null);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [note, setNote] = useState(rule?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const categoriesForKind = categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));
  const account = accounts.find((a) => a.externalId === accountExternalId);
  const currency = account?.currency ?? 'INR';

  // Defaults the monthly day-of-month from the linked debt account's due day, but only for a fresh rule —
  // an edited rule's saved value already reflects a deliberate choice.
  const applyDebtDueDayDefault = (nextAccountExternalId: string | null, nextCounterExternalId: string | null) => {
    if (dayOfMonthTouched || frequency !== 'monthly') return;
    const debtAccount = [nextAccountExternalId, nextCounterExternalId]
      .map((id) => accounts.find((a) => a.externalId === id))
      .find((a) => a !== undefined && (a.type === 'credit_card' || a.type === 'loan') && a.dueDay !== null);
    if (debtAccount !== undefined) setDayOfMonthInput(String(debtAccount.dueDay));
  };

  const selectAccount = (id: string) => {
    setAccountExternalId(id);
    applyDebtDueDayDefault(id, counterAccountExternalId);
  };
  const selectCounterAccount = (id: string) => {
    setCounterAccountExternalId(id);
    applyDebtDueDayDefault(accountExternalId, id);
  };

  const submit = async () => {
    setError(null);
    const amountMinor = parseMoneyInput(amountInput);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter an amount greater than zero.');
    if (accountExternalId === null) return setError('Add an account first.');
    if (kind === 'transfer' && (counterAccountExternalId === null || counterAccountExternalId === accountExternalId)) {
      return setError('Pick a different "to" account for the transfer.');
    }
    const interval = Number(intervalInput.trim());
    if (!Number.isInteger(interval) || interval < 1) return setError('Repeat every must be a whole number, at least 1.');
    const dayOfMonth = frequency === 'monthly' ? parseDayOfMonth(dayOfMonthInput) : null;
    if (frequency === 'monthly' && dayOfMonth === null) return setError('Enter a day of month from 1 to 31.');
    if (endDate !== null && endDate < startDate) return setError('End date must be on or after the start date.');

    const externalId = rule?.externalId ?? defaultGenId();
    const next: RecurringTransaction = {
      id: rule?.id ?? externalId,
      externalId,
      type: kind,
      accountExternalId,
      counterAccountExternalId: kind === 'transfer' ? counterAccountExternalId : null,
      categoryExternalId: kind === 'transfer' ? null : categoryExternalId,
      amountMinor,
      currency,
      note: note.trim() === '' ? null : note.trim(),
      frequency,
      interval,
      dayOfMonth,
      startDate,
      endDate,
      lastMaterializedDate: rule?.lastMaterializedDate ?? null,
      active: rule?.active ?? true,
      updatedAt: new Date().toISOString(),
    };

    // A brand-new rule with a past start date backfills every occurrence
    // between then and today on first materialization — confirm rather than
    // silently dropping in a run of transactions.
    if (rule === null && startDate < today) {
      const backfillCount = occurrenceDatesBetween(next, null, today).length;
      if (backfillCount > 1) {
        showAlert(
          'Backfill past occurrences?',
          `This will create ${backfillCount} transactions from ${startDate} through today.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Create', onPress: () => void persist(next) },
          ],
        );
        return;
      }
    }
    await persist(next);
  };

  const persist = async (next: RecurringTransaction) => {
    try {
      await saveRecurringTransaction(next);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView>
      <Row style={{ justifyContent: 'space-between' }}>
        <AppButton title="← Back" onPress={onBack} variant="ghost" small />
        <Overline>{rule === null ? 'Add recurring transaction' : 'Edit recurring transaction'}</Overline>
        <View style={{ width: 62 }} />
      </Row>

      <View style={{ gap: space.m, marginTop: space.m }}>
        <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
          {(['expense', 'income', 'transfer'] as const).map((k) => (
            <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </Row>
        <Field
          label="Amount"
          prefix={currencySymbol(currency)}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amountInput}
          onChangeText={setAmountInput}
          autoFocus
        />

        <Text style={[type.caption, { color: t.secondary }]}>{kind === 'transfer' ? 'From account' : 'Account'}</Text>
        <Row style={{ flexWrap: 'wrap' }} gap={space.s}>
          {accounts
            .filter((a) => a.archivedAt === null)
            .map((a) => (
              <Chip key={a.externalId} label={a.name} active={accountExternalId === a.externalId} onPress={() => selectAccount(a.externalId)} />
            ))}
        </Row>

        {kind === 'transfer' ? (
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
                    onPress={() => selectCounterAccount(a.externalId)}
                  />
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

        <Row gap={space.m}>
          <Field
            label="Repeat every"
            placeholder="1"
            keyboardType="number-pad"
            value={intervalInput}
            onChangeText={setIntervalInput}
            style={{ flex: 1 }}
          />
          <Text style={[type.caption, { color: t.muted, alignSelf: 'flex-end', paddingBottom: 12 }]}>
            {frequency === 'monthly' ? 'months' : frequency === 'weekly' ? 'weeks' : 'days'}
          </Text>
        </Row>

        {frequency === 'monthly' && (
          <Field
            label="Day of month"
            placeholder="1–31"
            keyboardType="number-pad"
            value={dayOfMonthInput}
            onChangeText={(v) => {
              setDayOfMonthInput(v);
              setDayOfMonthTouched(true);
            }}
          />
        )}

        <Text style={[type.caption, { color: t.secondary }]}>Starts</Text>
        <Pressable onPress={() => setShowStartPicker(true)}>
          <Text style={[type.body, { color: t.accent }]}>
            {new Date(`${startDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </Pressable>
        {frequency === 'weekly' && (
          <Text style={[type.caption, { color: t.muted }]}>Repeats every {weekdayOf(startDate)}</Text>
        )}
        {showStartPicker && (
          <DateTimePicker
            value={new Date(`${startDate}T00:00:00`)}
            mode="date"
            display="default"
            onChange={(_event, selected) => {
              setShowStartPicker(false);
              // toISOString().slice(0,10) would convert to UTC before slicing,
              // shifting the date back a day for any timezone east of UTC.
              if (selected) setStartDate(deviceLocalDate(selected.toISOString()));
            }}
          />
        )}

        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={[type.body, { color: t.ink }]}>Ends</Text>
          <Chip label="No end date" active={endDate === null} onPress={() => setEndDate(endDate === null ? startDate : null)} />
        </Row>
        {endDate !== null && (
          <>
            <Pressable onPress={() => setShowEndPicker(true)}>
              <Text style={[type.body, { color: t.accent }]}>
                {new Date(`${endDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </Pressable>
            {showEndPicker && (
              <DateTimePicker
                value={new Date(`${endDate}T00:00:00`)}
                mode="date"
                display="default"
                onChange={(_event, selected) => {
                  setShowEndPicker(false);
                  // Same UTC-conversion fix as the start-date picker above.
                  if (selected) setEndDate(deviceLocalDate(selected.toISOString()));
                }}
              />
            )}
          </>
        )}

        <Field label="Note" placeholder="Optional" value={note} onChangeText={setNote} />

        {error !== null && <ErrorText>{error}</ErrorText>}
        <AppButton title={rule === null ? 'Add recurring transaction' : 'Save changes'} onPress={submit} />
        {onDelete !== undefined && <AppButton title="Delete this rule" onPress={onDelete} variant="ghost" small />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { padding: space.l },
});
