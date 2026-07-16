import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listCoachNotes, type CoachNote } from '../coaching';

/**
 * Coaching BRD §8 — read-only weekly feed, newest-first. No chatbot UI in
 * v1: this only renders what the Coaching module already generated.
 */
export function CoachNotesFeed() {
  const [notes, setNotes] = useState<CoachNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setNotes(await listCoachNotes());
      setError(null);
    } catch {
      setError("Couldn't load your coach notes. Pull to retry.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (notes === null && error === null) return null;

  return (
    <FlatList
      style={styles.container}
      data={notes ?? []}
      keyExtractor={(note) => note.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => <CoachNoteRow note={item} />}
      ListEmptyComponent={
        <Text style={styles.empty}>
          {error ?? 'No coach notes yet — check back after your next weekly recompute.'}
        </Text>
      }
    />
  );
}

function CoachNoteRow({ note }: { note: CoachNote }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.weekOf}>Week of {note.weekOf}</Text>
        {note.source === 'fallback' && <Text style={styles.autoTag}>auto-generated</Text>}
      </View>
      <Text style={styles.field}>{note.changeExplanation}</Text>
      <Text style={styles.field}>{note.weeklyReview}</Text>
      <Text style={styles.field}>{note.stallRead}</Text>
      <Text style={styles.field}>{note.suggestion}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    padding: 16,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekOf: { fontSize: 12, color: '#666' },
  autoTag: { fontSize: 11, color: '#999', fontStyle: 'italic' },
  field: { fontSize: 14 },
  empty: { textAlign: 'center', color: '#999', padding: 24 },
});
