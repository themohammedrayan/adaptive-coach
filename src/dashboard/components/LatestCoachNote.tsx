import { StyleSheet, Text, View } from 'react-native';
import type { CoachNote } from '../../coaching';

/** Dashboard BRD §A5 — literal component signature. */
export interface LatestCoachNoteProps {
  note: CoachNote | null;
}

/**
 * Dashboard BRD §A2.5 — surfaces the most recent weekly note; the full
 * feed lives in the Coaching module's own Coach tab.
 */
export function LatestCoachNote({ note }: LatestCoachNoteProps) {
  if (note === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>No coach note yet — check back after your next weekly recompute.</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={styles.weekOf}>Week of {note.weekOf}</Text>
      <Text style={styles.headline}>{note.changeExplanation}</Text>
      <Text style={styles.body}>{note.stallRead}</Text>
      <Text style={styles.body}>{note.suggestion}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderRadius: 8, backgroundColor: '#f4f4f5', gap: 4 },
  empty: { color: '#999', fontSize: 13 },
  weekOf: { fontSize: 11, color: '#666' },
  headline: { fontSize: 14, fontWeight: '600' },
  body: { fontSize: 13, color: '#333' },
});
