import { StyleSheet, Text, View } from 'react-native';
import type { CoachNote } from '../types';

/** Dashboard BRD §A5 — literal component signature. */
export interface LatestCoachNoteProps {
  note: CoachNote | null;
}

/**
 * Dashboard BRD §A2.5 — surfaces the most recent weekly note; the full
 * feed lives in the Coaching module (not built yet — renders gracefully
 * empty until it exists).
 */
export function LatestCoachNote({ note }: LatestCoachNoteProps) {
  if (note === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No coach note yet — the coach module isn't built.</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={styles.weekOf}>Week of {note.weekOf}</Text>
      <Text style={styles.headline}>{note.headline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 8, backgroundColor: '#f4f4f5', gap: 4 },
  empty: { color: '#999', fontSize: 13 },
  weekOf: { fontSize: 11, color: '#666' },
  headline: { fontSize: 14, fontWeight: '600' },
});
