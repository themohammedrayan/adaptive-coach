import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { bucketTopCategories } from '../../../finance/categoryTotals';
import { formatMoneyMinor } from '../../../finance/money';
import { Dot } from '../../kit';
import { type as typeScale, useTheme } from '../../theme';
import type { CategoryBreakdownChartProps } from './types';

const PALETTE_KEYS = ['protein', 'carb', 'fat', 'trend', 'goal', 'bodyFat'] as const;
const TOP_N = 6;

export function CategoryBreakdownChart({ data, currency }: CategoryBreakdownChartProps) {
  const t = useTheme();
  const bucketed = bucketTopCategories(data, TOP_N);
  const totalMinor = bucketed.reduce((sum, d) => sum + d.totalMinor, 0);
  const palette = PALETTE_KEYS.map((k) => t.chart[k]);
  // A category's own colour wins so the chart, the budget rows and the
  // transaction list all read as the same category. "Other" falls back to
  // the positional palette like any uncoloured category.
  const colorAt = (i: number) => bucketed[i].color ?? palette[i % palette.length];
  const pieData = bucketed.map((d, i) => ({ value: d.totalMinor, color: colorAt(i) }));

  return (
    <View style={styles.container}>
      <View style={styles.pieWrap}>
        <PieChart
          data={pieData}
          radius={70}
          innerRadius={40}
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={[typeScale.caption, { color: t.muted }]}>Total</Text>
              <Text style={[typeScale.body, { color: t.ink, fontWeight: '600' }]}>
                {formatMoneyMinor(totalMinor, currency)}
              </Text>
            </View>
          )}
        />
      </View>
      <View style={{ gap: 6 }}>
        {bucketed.map((d, i) => (
          <View key={d.categoryName} style={styles.legendRow}>
            <Dot color={colorAt(i)} />
            <Text style={[typeScale.caption, { color: t.ink, flex: 1 }]}>{d.categoryName}</Text>
            <Text style={[typeScale.caption, { color: t.muted }]}>
              {formatMoneyMinor(d.totalMinor, currency)}
              {totalMinor > 0 ? ` · ${Math.round((d.totalMinor / totalMinor) * 100)}%` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  pieWrap: { alignItems: 'center' },
  centerLabel: { alignItems: 'center', gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
