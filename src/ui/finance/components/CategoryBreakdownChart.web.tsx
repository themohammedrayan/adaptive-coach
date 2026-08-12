import { StyleSheet, Text, View } from 'react-native';
import { Cell, Legend, Pie, PieChart as RPieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { bucketTopCategories } from '../../../finance/categoryTotals';
import { formatMoneyMinor } from '../../../finance/money';
import { type as typeScale, useTheme } from '../../theme';
import type { CategoryBreakdownChartProps } from './types';

const PALETTE_KEYS = ['protein', 'carb', 'fat', 'trend', 'goal', 'bodyFat'] as const;
const TOP_N = 6;

/** Web export variant, same data contract as the native chart (CategoryBreakdownChart.tsx). */
export function CategoryBreakdownChart({ data, currency }: CategoryBreakdownChartProps) {
  const t = useTheme();
  const bucketed = bucketTopCategories(data, TOP_N);
  const totalMinor = bucketed.reduce((sum, d) => sum + d.totalMinor, 0);
  const palette = PALETTE_KEYS.map((k) => t.chart[k]);
  // Mirrors the native variant: a category's own colour wins over the palette.
  const chartData = bucketed.map((d, i) => ({
    name: d.categoryName,
    value: d.totalMinor,
    color: d.color ?? palette[i % palette.length],
  }));

  return (
    <View style={styles.wrap}>
      <ResponsiveContainer width="100%" height={220}>
        <RPieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="38%" cy="50%" innerRadius={50} outerRadius={80}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              `${formatMoneyMinor(Number(value), currency)} · ${totalMinor > 0 ? Math.round((Number(value) / totalMinor) * 100) : 0}%`,
              undefined,
            ]}
          />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
        </RPieChart>
      </ResponsiveContainer>
      <View style={styles.centerLabel} pointerEvents="none">
        <Text style={[typeScale.caption, { color: t.muted }]}>Total</Text>
        <Text style={[typeScale.body, { color: t.ink, fontWeight: '600' }]}>{formatMoneyMinor(totalMinor, currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  centerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '76%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
