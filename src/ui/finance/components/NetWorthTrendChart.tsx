import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { formatMoneyMinor } from '../../../finance/money';
import { formatPeriodLabel } from '../../../finance/periods';
import { type as typeScale, useTheme } from '../../theme';
import type { NetWorthTrendChartProps } from './types';

export function NetWorthTrendChart({ data, currency, granularity }: NetWorthTrendChartProps) {
  const t = useTheme();
  const majorValues = data.map((d) => d.netWorthMinor / 100);
  const min = Math.min(0, ...majorValues);
  const max = Math.max(...majorValues, 0);
  const span = max - min || 1;
  const chartData = data.map((d, i) => ({ value: majorValues[i], label: formatPeriodLabel(d.date, granularity) }));
  const latest = data[data.length - 1];

  return (
    <View style={styles.container}>
      <LineChart
        data={chartData}
        color={t.accent}
        thickness={2}
        rulesColor={t.chart.grid}
        rulesType="solid"
        yAxisOffset={min}
        maxValue={span}
        noOfSections={4}
        height={160}
        adjustToWidth
        hideDataPoints
        yAxisColor="transparent"
        xAxisColor={t.chart.grid}
        xAxisLabelTextStyle={[styles.axisLabel, { color: t.muted }]}
        yAxisTextStyle={[styles.axisLabel, { color: t.muted }]}
      />
      {latest !== undefined && (
        <Text style={[typeScale.caption, { color: t.ink, fontWeight: '600' }]}>
          Latest: {formatMoneyMinor(latest.netWorthMinor, currency)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  axisLabel: { fontSize: 10 },
});
