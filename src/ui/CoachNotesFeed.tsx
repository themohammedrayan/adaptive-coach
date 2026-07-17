import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listCoachNotes, type CoachNote } from '../coaching';
import { Card, EmptyState, Row } from './kit';
import { radius, space, type, useTheme } from './theme';

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
      contentContainerStyle={styles.list}
      data={notes ?? []}
      keyExtractor={(note) => note.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => <CoachNoteCard note={item} />}
      ListEmptyComponent={
        <EmptyState
          message={error ?? 'No coach notes yet — check back after your next weekly recompute.'}
        />
      }
    />
  );
}

function CoachNoteCard({ note }: { note: CoachNote }) {
  const t = useTheme();
  return (
    <Card style={styles.card}>
      <Row style={styles.header}>
        <Text style={[type.overline, { color: t.muted }]}>Week of {note.weekOf}</Text>
        {note.source === 'fallback' && (
          <Text style={[styles.autoTag, { backgroundColor: t.wash, color: t.muted }]}>auto</Text>
        )}
      </Row>
      <Text style={[type.heading, { color: t.ink }]}>{note.changeExplanation}</Text>
      <View style={styles.body}>
        <Text style={[type.body, { color: t.secondary }]}>{note.weeklyReview}</Text>
        <Text style={[type.body, { color: t.secondary }]}>{note.stallRead}</Text>
        <Text style={[type.body, { color: t.ink }]}>{note.suggestion}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.l, paddingTop: space.s, gap: space.m },
  card: { gap: space.s },
  header: { justifyContent: 'space-between' },
  autoTag: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  body: { gap: 6 },
});
