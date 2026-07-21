import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { applyDateOverrideEdit } from '../../calendar/crud';
import { dayOfWeek } from '../../calendar/resolve';
import type { ResolvedBlock, RoutineBlock } from '../../calendar/types';
import { addDays, type IsoDate } from '../../engine';
import { AppButton } from '../kit';
import { space, type, useTheme } from '../theme';
import { BlockEditorSheet, type EditScope } from './BlockEditorSheet';
import { CalendarDataProvider, useCalendarData } from './CalendarDataContext';
import { DayTimeline } from './DayTimeline';
import { TemplateEditorScreen } from './TemplateEditorScreen';

type Screen = { kind: 'day' } | { kind: 'template' };

export function CalendarScreen() {
  return (
    <CalendarDataProvider>
      <CalendarInner />
    </CalendarDataProvider>
  );
}

const BLANK_BLOCK: ResolvedBlock = { label: '', startMinute: 9 * 60, endMinute: 10 * 60, category: 'other' };

function CalendarInner() {
  const t = useTheme();
  const router = useRouter();
  const { today, overrides, templateBlocks, resolveDay, saveDateOverride, saveRoutineBlock, deleteRoutineBlock } =
    useCalendarData();
  const [screen, setScreen] = useState<Screen>({ kind: 'day' });
  const [date, setDate] = useState<IsoDate>(today);
  const [editingIndex, setEditingIndex] = useState<number | 'new' | null>(null);

  if (screen.kind === 'template') {
    return <TemplateEditorScreen onBack={() => setScreen({ kind: 'day' })} />;
  }

  const resolvedDay = resolveDay(date);
  const isOverridden = overrides.some((o) => o.date === date);

  // When the day isn't overridden, resolveDay returns the template rows
  // themselves (see src/calendar/resolve.ts), so this cast is safe — it's
  // how "Always" edits find the underlying template block to update.
  const sourceForIndex = (i: number): RoutineBlock | null => {
    if (isOverridden) return null;
    const candidate = resolvedDay[i] as unknown as RoutineBlock;
    return templateBlocks.find((b) => b.externalId === candidate.externalId) ?? null;
  };

  const editingBlock: ResolvedBlock | null =
    editingIndex === 'new' ? BLANK_BLOCK : editingIndex !== null ? resolvedDay[editingIndex] : null;

  const handleSave = async (value: ResolvedBlock, scope: EditScope) => {
    if (scope === 'today') {
      const nextBlocks =
        editingIndex === 'new'
          ? [...resolvedDay, value]
          : applyDateOverrideEdit(resolvedDay, editingIndex as number, value);
      await saveDateOverride(date, nextBlocks);
      return;
    }
    const source = editingIndex === 'new' || editingIndex === null ? null : sourceForIndex(editingIndex);
    const daysOfWeek = source?.daysOfWeek ?? [dayOfWeek(date)];
    await saveRoutineBlock(
      { label: value.label, startMinute: value.startMinute, endMinute: value.endMinute, category: value.category, daysOfWeek },
      source ?? undefined,
    );
  };

  const handleDelete = async (scope: EditScope) => {
    if (editingIndex === null || editingIndex === 'new') return;
    if (scope === 'today') {
      await saveDateOverride(date, resolvedDay.filter((_, i) => i !== editingIndex));
      return;
    }
    const source = sourceForIndex(editingIndex);
    if (source !== null) await deleteRoutineBlock(source.externalId);
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={[type.title, { color: t.ink }]}>Calendar</Text>
          <View style={styles.dateRow}>
            <AppButton title="←" onPress={() => setDate(addDays(date, -1))} variant="ghost" small />
            <Text style={[type.body, { color: t.secondary }]}>{date === today ? 'Today' : date}</Text>
            <AppButton title="→" onPress={() => setDate(addDays(date, 1))} variant="ghost" small />
          </View>
        </View>
        <AppButton title="Routine" onPress={() => setScreen({ kind: 'template' })} variant="ghost" small />
        <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
      </View>

      <View style={styles.content}>
        <DayTimeline blocks={resolvedDay} onEditBlock={setEditingIndex} />
      </View>

      <View style={styles.addRow}>
        <AppButton title="+ Add block" onPress={() => setEditingIndex('new')} variant="secondary" />
      </View>

      <BlockEditorSheet
        visible={editingIndex !== null}
        initial={editingBlock}
        onClose={() => setEditingIndex(null)}
        onSave={handleSave}
        onDelete={editingIndex !== null && editingIndex !== 'new' ? handleDelete : undefined}
      />
    </>
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
    gap: space.s,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  content: { flex: 1 },
  addRow: { paddingHorizontal: space.l, paddingBottom: space.m },
});
