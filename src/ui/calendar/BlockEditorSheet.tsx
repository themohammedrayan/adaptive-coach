import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ROUTINE_CATEGORIES, type ResolvedBlock, type RoutineCategory } from '../../calendar/types';
import { AppButton, Card, Chip, ErrorText, Field, Row, SegmentedControl } from '../kit';
import { radius, space, type, useTheme } from '../theme';
import { TimeFieldBox, WheelTimePicker } from './WheelTimePicker';

export type EditScope = 'today' | 'always';

const SCOPE_OPTIONS: { value: EditScope; label: string }[] = [
  { value: 'today', label: 'Just today' },
  { value: 'always', label: 'Always' },
];

/**
 * Tap-to-edit sheet for a day's resolved block. "Just today" writes that
 * date's override; "Always" edits the underlying weekly template block (or
 * creates one scoped to just this weekday if the block came from an
 * override with no template of its own — see CalendarScreen).
 */
export function BlockEditorSheet({
  visible,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  initial: ResolvedBlock | null;
  onClose: () => void;
  onSave: (value: ResolvedBlock, scope: EditScope) => Promise<void>;
  onDelete?: (scope: EditScope) => Promise<void>;
}) {
  const t = useTheme();
  const [label, setLabel] = useState('');
  const [startMinute, setStartMinute] = useState(0);
  const [endMinute, setEndMinute] = useState(0);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);
  const [category, setCategory] = useState<RoutineCategory>('other');
  const [scope, setScope] = useState<EditScope>('today');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial === null) return;
    setLabel(initial.label);
    setStartMinute(initial.startMinute);
    setEndMinute(initial.endMinute);
    setCategory(initial.category);
    setScope('today');
    setActiveField(null);
    setError(null);
  }, [initial]);

  if (initial === null) return null;

  const save = async () => {
    setError(null);
    if (label.trim() === '') return setError('Label is required.');
    let finalEndMinute = endMinute;
    if (finalEndMinute <= startMinute) finalEndMinute += 1440;
    if (finalEndMinute - startMinute > 1440) return setError("A block can't span more than 24 hours.");

    setBusy(true);
    try {
      await onSave({ label: label.trim(), startMinute, endMinute: finalEndMinute, category }, scope);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (onDelete === undefined) return;
    Alert.alert(
      'Delete this block?',
      scope === 'today'
        ? `"${label}" will be removed from today's schedule only.`
        : `"${label}" will be removed from your weekly routine.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await onDelete(scope);
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <Card style={styles.card}>
            <Field label="Label" placeholder="Sleep" value={label} onChangeText={setLabel} />

            <Row gap={space.m}>
              <TimeFieldBox
                label="Start"
                minute={startMinute}
                active={activeField === 'start'}
                onPress={() => setActiveField(activeField === 'start' ? null : 'start')}
              />
              <TimeFieldBox
                label="End"
                minute={endMinute}
                active={activeField === 'end'}
                onPress={() => setActiveField(activeField === 'end' ? null : 'end')}
              />
            </Row>

            {activeField !== null && (
              <WheelTimePicker
                minute={activeField === 'start' ? startMinute : endMinute}
                onChange={activeField === 'start' ? setStartMinute : setEndMinute}
              />
            )}

            <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Category</Text>
            <Row style={styles.wrap}>
              {ROUTINE_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c.charAt(0).toUpperCase() + c.slice(1)}
                  active={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </Row>

            <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Applies to</Text>
            <SegmentedControl options={SCOPE_OPTIONS} value={scope} onChange={setScope} />

            {error !== null && <ErrorText>{error}</ErrorText>}

            <Row gap={space.m}>
              <View style={styles.flex}>
                <AppButton title="Cancel" onPress={onClose} variant="secondary" />
              </View>
              <View style={styles.flex}>
                <AppButton title="Save" onPress={save} busy={busy} />
              </View>
            </Row>

            {onDelete !== undefined && (
              <AppButton title="Delete" onPress={remove} variant="danger" small />
            )}
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetWrap: { padding: space.l },
  card: { gap: space.m, borderRadius: radius.card },
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
});
