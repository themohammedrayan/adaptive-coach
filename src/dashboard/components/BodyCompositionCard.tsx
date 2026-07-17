import { StyleSheet, Text, View } from 'react-native';
import { type as typeScale, useTheme } from '../../ui/theme';
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
  const t = useTheme();
  if (entries.every((e) => e.latestValue === null)) return null;
  return (
    <View style={styles.container}>
      {entries.map((e) => (
        <View key={e.metricType} style={styles.row}>
          <Text style={[typeScale.caption, styles.label, { color: t.secondary }]}>{e.label}</Text>
          <Text style={[styles.value, { color: t.ink }]}>
            {e.latestValue !== null ? `${e.latestValue.toFixed(1)}${e.unit}` : '—'}
          </Text>
          {e.deltaSincePrevious !== null && (
            <Text
              style={[
                typeScale.caption,
                styles.delta,
                { color: e.deltaSincePrevious < 0 ? t.muted : t.accent },
              ]}
            >
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
  label: { flex: 1 },
  value: { fontSize: 14, fontWeight: '600' },
  delta: { minWidth: 40, textAlign: 'right' },
});
