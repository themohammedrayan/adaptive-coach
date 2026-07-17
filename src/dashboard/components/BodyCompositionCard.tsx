import { StyleSheet, Text, View } from 'react-native';
import type { BodyCompositionEntry } from '../bodyComposition';

export interface BodyCompositionCardProps {
  entries: BodyCompositionEntry[];
}

/**
 * Dashboard follow-up — Samsung-style body-composition list (Weight/Lean
 * mass/Bone mass/Body water). No colored healthy-range bars: Samsung's are
 * proprietary reference data this app doesn't have, so this shows only the
 * latest value and change since the previous reading.
 */
export function BodyCompositionCard({ entries }: BodyCompositionCardProps) {
  if (entries.every((e) => e.latestValue === null)) return null;
  return (
    <View style={styles.container}>
      {entries.map((e) => (
        <View key={e.metricType} style={styles.row}>
          <Text style={styles.label}>{e.label}</Text>
          <Text style={styles.value}>
            {e.latestValue !== null ? `${e.latestValue.toFixed(1)}${e.unit}` : '—'}
          </Text>
          {e.deltaSincePrevious !== null && (
            <Text style={[styles.delta, e.deltaSincePrevious < 0 && styles.down]}>
              {e.deltaSincePrevious > 0 ? '+' : ''}
              {e.deltaSincePrevious.toFixed(1)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontSize: 13, color: '#666' },
  value: { fontSize: 14, fontWeight: '600' },
  delta: { fontSize: 12, color: '#047857', minWidth: 40, textAlign: 'right' },
  down: { color: '#666' },
});
