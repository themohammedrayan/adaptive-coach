import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { formatMoneyMinor } from '../../../finance/money';
import { Dot } from '../../kit';
import { type as typeScale, useTheme } from '../../theme';
import type { CategoryBreakdownChartProps } from './types';

const PALETTE_KEYS = ['protein', 'carb', 'fat', 'trend', 'goal', 'bodyFat'] as const;

export function CategoryBreakdownChart({ data, currency }: CategoryBreakdownChartProps) {
  const t = useTheme();
  const palette = PALETTE_KEYS.map((k) => t.chart[k]);
  const pieData = data.map((d, i) => ({ value: d.totalMinor, color: palette[i % palette.length] }));

  return (
    <View style={styles.container}>
      <View style={styles.pieWrap}>
        <PieChart data={pieData} radius={70} innerRadius={40} />
      </View>
      <View style={{ gap: 6 }}>
        {data.map((d, i) => (
          <View key={d.categoryName} style={styles.legendRow}>
            <Dot color={palette[i % palette.length]} />
            <Text style={[typeScale.caption, { color: t.ink, flex: 1 }]}>{d.categoryName}</Text>
            <Text style={[typeScale.caption, { color: t.muted }]}>{formatMoneyMinor(d.totalMinor, currency)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  pieWrap: { alignItems: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
