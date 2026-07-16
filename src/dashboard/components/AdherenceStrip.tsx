import { StyleSheet, Text, View } from 'react-native';
import type { DayStatus } from '../types';

/** Dashboard BRD §A5 — literal component signature. */
export interface AdherenceStripProps {
  days: DayStatus[];
  avgIntake: number;
  avgTarget: number;
}

/** Dashboard BRD §A2.3 — last 14 days at a glance: which were logged, average intake vs target. */
export function AdherenceStrip({ days, avgIntake, avgTarget }: AdherenceStripProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {days.map((d) => (
          <View key={d.date} style={[styles.cell, d.logged ? styles.logged : styles.unlogged]} />
        ))}
      </View>
      <Text style={styles.summary}>
        Avg {Math.round(avgIntake)} / {Math.round(avgTarget)} kcal · {days.filter((d) => d.logged).length}/
        {days.length} days logged
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, height: 20, borderRadius: 4 },
  logged: { backgroundColor: '#047857' },
  unlogged: { backgroundColor: '#e5e5e5' },
  summary: { fontSize: 12, color: '#666' },
});
