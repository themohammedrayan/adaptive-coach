import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BuildRoutineBlockInput } from '../../calendar/crud';
import { ROUTINE_CATEGORIES, type RoutineBlock, type RoutineCategory } from '../../calendar/types';
import { AppButton, Card, Chip, ErrorText, Field, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { useCalendarData } from './CalendarDataContext';
import { formatClockInput, parseClock } from './timeInput';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Screen = { kind: 'list' } | { kind: 'edit'; block: RoutineBlock | null };

/** Manages the reusable weekly default blocks (see src/calendar/resolve.ts). */
export function TemplateEditorScreen({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { templateBlocks, saveRoutineBlock, deleteRoutineBlock } = useCalendarData();
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });

  if (screen.kind === 'edit') {
    const editing = screen.block;
    return (
      <TemplateBlockForm
        initial={editing}
        onCancel={() => setScreen({ kind: 'list' })}
        onSave={async (input) => {
          await saveRoutineBlock(input, editing ?? undefined);
          setScreen({ kind: 'list' });
        }}
        onDelete={
          editing !== null
            ? async () => {
                await deleteRoutineBlock(editing.externalId);
                setScreen({ kind: 'list' });
              }
            : undefined
        }
      />
    );
  }

  const sorted = [...templateBlocks].sort((a, b) => a.startMinute - b.startMinute);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={onBack} variant="ghost" small />
        <Text style={[type.title, { color: t.ink, flex: 1 }]}>Weekly routine</Text>
        <AppButton title="+ Add" onPress={() => setScreen({ kind: 'edit', block: null })} variant="ghost" small />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {sorted.length === 0 && (
          <Text style={[type.caption, { color: t.muted, textAlign: 'center' }]}>
            No default blocks yet — add your usual sleep, work, and travel times.
          </Text>
        )}
        {sorted.map((block) => (
          <Pressable key={block.externalId} onPress={() => setScreen({ kind: 'edit', block })}>
            <Card style={styles.row}>
              <View style={[styles.dot, { backgroundColor: t.calendarCategory[block.category] }]} />
              <View style={styles.flex}>
                <Text style={[type.body, { color: t.ink, fontWeight: '600' }]}>{block.label}</Text>
                <Text style={[type.caption, { color: t.muted }]}>
                  {formatClockInput(block.startMinute)}–{formatClockInput(block.endMinute)} ·{' '}
                  {block.daysOfWeek.length > 0 ? block.daysOfWeek.map((d) => WEEKDAY_LABELS[d]).join(', ') : 'no days'}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function TemplateBlockForm({
  initial,
  onCancel,
  onSave,
  onDelete,
}: {
  initial: RoutineBlock | null;
  onCancel: () => void;
  onSave: (input: BuildRoutineBlockInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const t = useTheme();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [start, setStart] = useState(initial !== null ? formatClockInput(initial.startMinute) : '');
  const [end, setEnd] = useState(initial !== null ? formatClockInput(initial.endMinute) : '');
  const [category, setCategory] = useState<RoutineCategory>(initial?.category ?? 'other');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial?.daysOfWeek ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: number) =>
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));

  const save = async () => {
    setError(null);
    if (label.trim() === '') return setError('Label is required.');
    const startMinute = parseClock(start);
    let endMinute = parseClock(end);
    if (startMinute === null || endMinute === null) return setError('Use 24h HH:MM, e.g. 09:30.');
    if (endMinute <= startMinute) endMinute += 1440;
    if (endMinute - startMinute > 1440) return setError("A block can't span more than 24 hours.");
    if (daysOfWeek.length === 0) return setError('Pick at least one day.');

    setBusy(true);
    try {
      await onSave({ label: label.trim(), startMinute, endMinute, category, daysOfWeek });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <Field label="Label" placeholder="Work" value={label} onChangeText={setLabel} />
      <Row gap={space.m}>
        <Field label="Start (24h)" placeholder="09:30" value={start} onChangeText={setStart} style={styles.flex} />
        <Field label="End (24h)" placeholder="18:00" value={end} onChangeText={setEnd} style={styles.flex} />
      </Row>

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

      <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Days</Text>
      <Row style={styles.wrap}>
        {WEEKDAY_LABELS.map((label, d) => (
          <Chip key={d} label={label} active={daysOfWeek.includes(d)} onPress={() => toggleDay(d)} />
        ))}
      </Row>

      {error !== null && <ErrorText>{error}</ErrorText>}

      <Row gap={space.m}>
        <View style={styles.flex}>
          <AppButton title="Cancel" onPress={onCancel} variant="secondary" />
        </View>
        <View style={styles.flex}>
          <AppButton title="Save" onPress={() => void save()} busy={busy} />
        </View>
      </Row>

      {onDelete !== undefined && <AppButton title="Delete" onPress={() => void onDelete()} variant="danger" small />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.s,
    gap: space.m,
  },
  list: { padding: space.l, gap: space.m },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  dot: { width: 12, height: 12, borderRadius: 6 },
  wrap: { flexWrap: 'wrap' },
  form: { padding: space.l, gap: space.m },
});
