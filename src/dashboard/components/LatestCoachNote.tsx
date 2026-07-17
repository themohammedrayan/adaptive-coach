import { StyleSheet, Text, View } from 'react-native';
import type { CoachNote } from '../../coaching';
import { useTheme } from '../../ui/theme';

/** Dashboard BRD §A5 — literal component signature. */
export interface LatestCoachNoteProps {
  note: CoachNote | null;
}

/**
 * Dashboard BRD §A2.5 — surfaces the most recent weekly note; the full
 * feed lives in the Coaching module's own Coach tab. The outer card is
 * provided by DashboardScreen.
 */
export function LatestCoachNote({ note }: LatestCoachNoteProps) {
  const t = useTheme();
  if (note === null) {
    return (
      <Text style={[styles.empty, { color: t.muted }]}>
        No coach note yet — check back after your next weekly recompute.
      </Text>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={[styles.weekOf, { color: t.muted }]}>Week of {note.weekOf}</Text>
      <Text style={[styles.headline, { color: t.ink }]}>{note.changeExplanation}</Text>
      <Text style={[styles.body, { color: t.secondary }]}>{note.stallRead}</Text>
      <Text style={[styles.body, { color: t.secondary }]}>{note.suggestion}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 5 },
  empty: { fontSize: 13 },
  weekOf: { fontSize: 11 },
  headline: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 13.5, lineHeight: 19 },
});
