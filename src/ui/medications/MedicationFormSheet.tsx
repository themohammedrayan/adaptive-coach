import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuildMedicationInput } from '../../medications/crud';
import type { Medication } from '../../medications/types';
import { AppButton, AppSwitch, Card, Chip, ErrorText, Field, Row } from '../kit';
import { radius, space, type, useTheme } from '../theme';
import { formatClockInput, parseClock } from '../calendar/timeInput';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Add/edit sheet for a medication's definition + schedule — same transparent
 * Modal + bottom Card shape as src/ui/calendar/BlockEditorSheet.tsx. No
 * date/time picker package is installed, so start/end date and each
 * time-of-day are plain "HH:MM"/"YYYY-MM-DD" text fields, matching the
 * convention BlockEditorSheet and CreateGoalScreen already use.
 */
export function MedicationFormSheet({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: Medication | null;
  onClose: () => void;
  onSave: (input: BuildMedicationInput, existing: Medication | null) => Promise<void>;
}) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [notes, setNotes] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [times, setTimes] = useState<number[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(ALL_DAYS);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    setDose(initial?.dose ?? '');
    setNotes(initial?.notes ?? '');
    setTimeInput('');
    setTimes(initial?.timesOfDay ?? []);
    setDaysOfWeek(initial?.daysOfWeek ?? ALL_DAYS);
    setStartDate(initial?.startDate ?? '');
    setEndDate(initial?.endDate ?? '');
    setReminderEnabled(initial?.reminderEnabled ?? true);
    setError(null);
  }, [visible, initial]);

  const addTime = () => {
    const minute = parseClock(timeInput);
    if (minute === null) return setError('Use 24h HH:MM, e.g. 08:00.');
    if (times.includes(minute)) return setTimeInput('');
    setError(null);
    setTimes([...times, minute].sort((a, b) => a - b));
    setTimeInput('');
  };

  const removeTime = (minute: number) => setTimes(times.filter((m) => m !== minute));

  const toggleDay = (day: number) =>
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));

  const save = async () => {
    setError(null);
    if (name.trim() === '') return setError('Name is required.');
    if (dose.trim() === '') return setError('Dose is required.');
    if (times.length === 0) return setError('Add at least one time of day.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return setError('Start date must be YYYY-MM-DD.');
    if (endDate.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return setError('End date must be YYYY-MM-DD.');
    if (daysOfWeek.length === 0) return setError('Select at least one day.');

    setBusy(true);
    try {
      await onSave(
        {
          name: name.trim(),
          dose: dose.trim(),
          notes: notes.trim() === '' ? null : notes.trim(),
          timesOfDay: times,
          daysOfWeek,
          startDate,
          endDate: endDate.trim() === '' ? null : endDate,
          reminderEnabled,
        },
        initial,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <Card style={styles.card}>
            <Field label="Name" placeholder="Metformin" value={name} onChangeText={setName} />
            <Field label="Dose" placeholder="500 mg" value={dose} onChangeText={setDose} />

            <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Times of day</Text>
            <Row gap={space.m}>
              <Field placeholder="08:00" value={timeInput} onChangeText={setTimeInput} style={styles.flex} />
              <AppButton title="Add time" onPress={addTime} variant="secondary" small />
            </Row>
            {times.length > 0 && (
              <Row style={styles.wrap}>
                {times.map((minute) => (
                  <Chip key={minute} label={`${formatClockInput(minute)} ✕`} active={false} onPress={() => removeTime(minute)} />
                ))}
              </Row>
            )}

            <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Days</Text>
            <Row style={styles.wrap}>
              {DAY_LABELS.map((label, day) => (
                <Chip key={day} label={label} active={daysOfWeek.includes(day)} onPress={() => toggleDay(day)} />
              ))}
            </Row>

            <Row gap={space.m}>
              <Field
                label="Start date"
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
                style={styles.flex}
              />
              <Field
                label="End date (optional)"
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
                style={styles.flex}
              />
            </Row>

            <Field label="Notes (optional)" placeholder="Take with food" value={notes} onChangeText={setNotes} multiline />

            <Row style={styles.reminderRow}>
              <Text style={[type.body, { color: t.ink }]}>Reminders</Text>
              <AppSwitch value={reminderEnabled} onChange={setReminderEnabled} />
            </Row>

            {error !== null && <ErrorText>{error}</ErrorText>}

            <Row gap={space.m}>
              <View style={styles.flex}>
                <AppButton title="Cancel" onPress={onClose} variant="secondary" />
              </View>
              <View style={styles.flex}>
                <AppButton title="Save" onPress={save} busy={busy} />
              </View>
            </Row>
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
  reminderRow: { justifyContent: 'space-between' },
});
