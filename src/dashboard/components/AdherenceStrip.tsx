import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../ui/theme';
import type { DayStatus } from '../types';

/** Dashboard BRD §A5 — literal component signature. */
export interface AdherenceStripProps {
  days: DayStatus[];
  avgIntake: number;
  avgTarget: number;
}

/** Dashboard BRD §A2.3 — last 14 days at a glance: which were logged, average intake vs target. */
export function AdherenceStrip({ days, avgIntake, avgTarget }: AdherenceStripProps) {
  const t = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {days.map((d) => (
          <View
            key={d.date}
            style={[styles.cell, { backgroundColor: d.logged ? t.chart.goal : t.chart.track }]}
          />
        ))}
      </View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summary, { color: t.secondary }]}>
          Avg {Math.round(avgIntake)} / {Math.round(avgTarget)} kcal
        </Text>
        <Text style={[styles.summary, { color: t.secondary }]}>
          {days.filter((d) => d.logged).length}/{days.length} days logged
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, height: 22, borderRadius: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summary: { fontSize: 12.5 },
});
