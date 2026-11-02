import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { iouPosition } from '../../../finance/debt';
import { defaultGenId } from '../../../finance/ids';
import { currencySymbol, formatMoneyMinor, parseMoneyInput } from '../../../finance/money';
import { formatDayLabel } from '../../../finance/periods';
import type { Iou, IouDirection } from '../../../finance/types';
import { AppButton, Card, Chip, EmptyState, ErrorText, Field, Overline, Row } from '../../kit';
import { space, type, useTheme } from '../../theme';
import { useFinanceData } from '../FinanceDataContext';
import { showAlert } from '../../../lib/alert';

const DIRECTIONS: { value: IouDirection; label: string }[] = [
  { value: 'owed_to_me', label: 'They owe me' },
  { value: 'i_owe', label: 'I owe them' },
];

export function IouSection({ currency }: { currency: string }) {
  const t = useTheme();
  const { ious, today, settleIou } = useFinanceData();
  const [addOpen, setAddOpen] = useState(false);

  const position = iouPosition(ious);
  const open = ious.filter((i) => i.settledAt === null);

  const confirmSettle = (iou: Iou) => {
    showAlert(
      'Settle this IOU?',
      `${iou.personName} · ${formatMoneyMinor(iou.amountMinor, iou.currency)} will be marked settled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settle', onPress: () => void settleIou(iou.externalId) },
      ],
    );
  };

  return (
    <>
      <Card style={{ gap: space.xs }}>
        <Overline>Net position</Overline>
        <Text style={[type.hero, { color: position.netMinor < 0 ? t.danger : t.good }]}>
          {formatMoneyMinor(position.netMinor, currency, { showSign: true })}
        </Text>
        <Text style={[type.caption, { color: t.muted }]}>
          {formatMoneyMinor(position.owedToMeMinor, currency)} owed to you ·{' '}
          {formatMoneyMinor(position.iOweMinor, currency)} you owe
        </Text>
        <Text style={[type.caption, { color: t.muted }]}>Kept separate from net worth.</Text>
      </Card>

      <AppButton title="Add an IOU" onPress={() => setAddOpen(true)} variant="secondary" />

      {open.length === 0 && <EmptyState message="Nothing outstanding between you and anyone else." />}

      {open.map((iou) => (
        <Card key={iou.id} style={{ gap: space.xs }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[type.heading, { color: t.ink }]}>{iou.personName}</Text>
            <Text
              style={[type.heading, { color: iou.direction === 'owed_to_me' ? t.good : t.danger }]}
            >
              {formatMoneyMinor(iou.direction === 'owed_to_me' ? iou.amountMinor : -iou.amountMinor, iou.currency, {
                showSign: true,
              })}
            </Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[type.caption, { color: t.muted }]} numberOfLines={1}>
              {iou.note ?? (iou.direction === 'owed_to_me' ? 'Owed to you' : 'You owe')}
              {iou.dueDate !== null
                ? ` · due ${formatDayLabel(iou.dueDate)}${iou.dueDate < today ? ' (overdue)' : ''}`
                : ''}
            </Text>
            <AppButton title="Settle" onPress={() => confirmSettle(iou)} variant="ghost" small />
          </Row>
        </Card>
      ))}

      <AddIouModal visible={addOpen} onClose={() => setAddOpen(false)} currency={currency} today={today} />
    </>
  );
}

function AddIouModal({
  visible,
  onClose,
  currency,
  today,
}: {
  visible: boolean;
  onClose: () => void;
  currency: string;
  today: string;
}) {
  const t = useTheme();
  const { saveIou } = useFinanceData();
  const [personName, setPersonName] = useState('');
  const [direction, setDirection] = useState<IouDirection>('owed_to_me');
  const [amountInput, setAmountInput] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (personName.trim() === '') return setError('Whose IOU is this?');
    const amountMinor = parseMoneyInput(amountInput);
    if (amountMinor === null || amountMinor <= 0) return setError('Enter an amount greater than zero.');
    if (dueDate !== null && dueDate < today) return setError('Due date is before today — leave it blank if this is already overdue, or pick a later date.');
    try {
      await saveIou({
        id: defaultGenId(),
        externalId: defaultGenId(),
        personName: personName.trim(),
        direction,
        amountMinor,
        currency,
        note: note.trim() === '' ? null : note.trim(),
        incurredDate: today,
        dueDate,
        settledAt: null,
        updatedAt: new Date().toISOString(),
      });
      setPersonName('');
      setAmountInput('');
      setDueDate(null);
      setNote('');
      setDirection('owed_to_me');
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
              <Overline>Add an IOU</Overline>
              <Field label="Person" value={personName} onChangeText={setPersonName} autoFocus />
              <Row gap={space.s}>
                {DIRECTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    active={direction === opt.value}
                    onPress={() => setDirection(opt.value)}
                  />
                ))}
              </Row>
              <Field
                label="Amount"
                prefix={currencySymbol(currency)}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amountInput}
                onChangeText={setAmountInput}
              />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[type.body, { color: t.ink }]}>Due date</Text>
                <Chip label="No due date" active={dueDate === null} onPress={() => setDueDate(dueDate === null ? today : null)} />
              </Row>
              {dueDate !== null && (
                <>
                  <Pressable onPress={() => setShowDuePicker(true)}>
                    <Text style={[type.body, { color: t.accent }]}>
                      {new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </Pressable>
                  {showDuePicker && (
                    <DateTimePicker
                      value={new Date(`${dueDate}T00:00:00`)}
                      mode="date"
                      display="default"
                      onChange={(_event, selected) => {
                        setShowDuePicker(false);
                        if (selected) setDueDate(selected.toISOString().slice(0, 10));
                      }}
                    />
                  )}
                </>
              )}
              <Field label="What for?" placeholder="Optional" value={note} onChangeText={setNote} />
              {error !== null && <ErrorText>{error}</ErrorText>}
              <AppButton title="Add IOU" onPress={submit} />
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
