import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, dateRange } from '../../engine';
import { buildMedicationAdherence, currentStreak, type DayAdherence } from '../../medications/adherence';
import { expectedDosesForDate } from '../../medications/schedule';
import type { DoseStatus, ExpectedDose, Medication } from '../../medications/types';
import { AppButton, Card, EmptyState, FAB, Overline, ProgressBar, Row, SegmentedControl } from '../kit';
import { radius, space, type, useTheme } from '../theme';
import { formatClockInput } from '../calendar/timeInput';
import { MedicationFormSheet } from './MedicationFormSheet';
import { useMedicationsData } from './MedicationsDataContext';
import { showAlert } from '../../lib/alert';

type MedsView = 'today' | 'medications' | 'history';

const VIEW_OPTIONS: { value: MedsView; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'medications', label: 'Medications' },
  { value: 'history', label: 'History' },
];

const HISTORY_WINDOW_DAYS = 30;
const DOSE_STATUS_LABEL: Record<DoseStatus, string> = { taken: 'Taken', skipped: 'Skipped', snoozed: 'Snoozed' };

export function MedicationsScreen() {
  const t = useTheme();
  const { medications, doses, today, saveMedication, archiveMedication, setDoseStatus } = useMedicationsData();
  const [view, setView] = useState<MedsView>('today');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);

  const activeMedications = medications.filter((m) => m.archivedAt === null);

  const todayDoses = useMemo(() => expectedDosesForDate(activeMedications, doses, today), [activeMedications, doses, today]);

  const historyWindow = useMemo(() => dateRange(addDays(today, -(HISTORY_WINDOW_DAYS - 1)), today), [today]);
  const adherence = useMemo(
    () => buildMedicationAdherence(activeMedications, doses, historyWindow),
    [activeMedications, doses, historyWindow],
  );
  const streak = useMemo(() => currentStreak(adherence), [adherence]);

  const medicationName = (externalId: string) => medications.find((m) => m.externalId === externalId)?.name ?? '—';
  const medicationDose = (externalId: string) => medications.find((m) => m.externalId === externalId)?.dose ?? '';

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (med: Medication) => {
    setEditing(med);
    setFormOpen(true);
  };

  const confirmStop = (med: Medication) => {
    showAlert('Stop taking this medication?', med.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => void archiveMedication(med.externalId) },
    ]);
  };

  const takenCount = todayDoses.filter((d) => d.status === 'taken').length;

  return (
    <View style={styles.flex}>
      <View style={styles.segmentWrap}>
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} />
      </View>

      {view === 'today' && (
        <FlatList
          data={todayDoses}
          keyExtractor={(d) => `${d.medicationExternalId}-${d.scheduledMinute}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Card style={styles.hero}>
              <Overline>Today</Overline>
              <Text style={[type.hero, { color: t.ink }]}>
                {takenCount}
                <Text style={[type.heading, { color: t.muted }]}> / {todayDoses.length} taken</Text>
              </Text>
              <ProgressBar pct={todayDoses.length > 0 ? takenCount / todayDoses.length : 0} />
            </Card>
          }
          ListEmptyComponent={<EmptyState message="No doses scheduled for today." />}
          renderItem={({ item }) => (
            <DoseRow
              item={item}
              name={medicationName(item.medicationExternalId)}
              dose={medicationDose(item.medicationExternalId)}
              onSetStatus={(status) => setDoseStatus(item.medicationExternalId, item.scheduledDate, item.scheduledMinute, status)}
            />
          )}
        />
      )}

      {view === 'medications' && (
        <>
          <FlatList
            data={activeMedications}
            keyExtractor={(m) => m.externalId}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              activeMedications.length > 0 ? (
                <Text style={[type.caption, { color: t.muted, marginBottom: space.s }]}>
                  Tap to edit · long-press to stop
                </Text>
              ) : null
            }
            ListEmptyComponent={<EmptyState message="No medications yet — tap + to add one." />}
            renderItem={({ item }) => (
              <Pressable onPress={() => openEdit(item)} onLongPress={() => confirmStop(item)}>
                <Card style={styles.medCard}>
                  <Text style={[type.body, { color: t.ink, fontWeight: '600' }]}>{item.name}</Text>
                  <Text style={[type.caption, { color: t.secondary }]}>{item.dose}</Text>
                  <Row style={styles.wrap} gap={space.xs}>
                    {item.timesOfDay.map((minute) => (
                      <Text key={minute} style={[styles.timeBadge, { backgroundColor: t.wash, color: t.secondary }]}>
                        {formatClockInput(minute)}
                      </Text>
                    ))}
                  </Row>
                </Card>
              </Pressable>
            )}
          />
          <FAB icon="plus" accessibilityLabel="Add medication" onPress={openAdd} />
        </>
      )}

      {view === 'history' && (
        <FlatList
          data={[...adherence].reverse()}
          keyExtractor={(d) => d.date}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Card style={styles.hero}>
              <Overline>Current streak</Overline>
              <Text style={[type.hero, { color: t.ink }]}>
                {streak}
                <Text style={[type.heading, { color: t.muted }]}> day{streak === 1 ? '' : 's'}</Text>
              </Text>
            </Card>
          }
          ListEmptyComponent={<EmptyState message="No history yet." />}
          renderItem={({ item }) => <HistoryRow item={item} />}
        />
      )}

      <MedicationFormSheet
        visible={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSave={(input, existing) => saveMedication(input, existing ?? undefined)}
      />
    </View>
  );
}

function DoseRow({
  item,
  name,
  dose,
  onSetStatus,
}: {
  item: ExpectedDose;
  name: string;
  dose: string;
  onSetStatus: (status: DoseStatus) => void;
}) {
  const t = useTheme();
  return (
    <Card style={styles.doseCard}>
      <View style={styles.flex}>
        <Text style={[type.body, { color: t.ink, fontWeight: '600' }]}>{name}</Text>
        <Text style={[type.caption, { color: t.secondary }]}>
          {dose} · {formatClockInput(item.scheduledMinute)}
        </Text>
      </View>
      <Row gap={space.xs}>
        {(['taken', 'skipped', 'snoozed'] as DoseStatus[]).map((status) => (
          <AppButton
            key={status}
            title={DOSE_STATUS_LABEL[status]}
            onPress={() => onSetStatus(status)}
            variant={item.status === status ? 'primary' : 'secondary'}
            small
          />
        ))}
      </Row>
    </Card>
  );
}

function HistoryRow({ item }: { item: DayAdherence }) {
  const t = useTheme();
  return (
    <Card style={styles.historyCard}>
      <Row style={styles.historyTop}>
        <Text style={[type.body, { color: t.ink }]}>{item.date}</Text>
        <Text style={[type.caption, { color: t.secondary }]}>
          {item.expected === 0 ? 'Nothing due' : `${item.taken}/${item.expected} taken`}
        </Text>
      </Row>
      {item.expected > 0 && <ProgressBar pct={item.pct ?? 0} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segmentWrap: { paddingHorizontal: space.l, paddingTop: space.s },
  list: { padding: space.l, paddingTop: space.m },
  hero: { gap: space.xs, alignItems: 'center', marginBottom: space.s },
  doseCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m, marginBottom: space.m },
  medCard: { gap: space.s, marginBottom: space.m, alignItems: 'flex-start' },
  historyCard: { gap: space.s, marginBottom: space.s, borderRadius: radius.card },
  historyTop: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
  timeBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
