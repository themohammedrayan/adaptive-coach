import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { formatMoneyMinor } from '../../../finance/money';
import { formatPeriodLabel } from '../../../finance/periods';
import { EmptyState } from '../../kit';
import { type as typeScale, useTheme } from '../../theme';
import type { NetWorthTrendChartProps } from './types';

export function NetWorthTrendChart({ data, currency, granularity }: NetWorthTrendChartProps) {
  const t = useTheme();
  if (data.length === 0) {
    return <EmptyState message="Not enough history yet to chart a trend." />;
  }

  const majorValues = data.map((d) => d.netWorthMinor / 100);
  const min = Math.min(0, ...majorValues);
  const max = Math.max(...majorValues, 0);
  const span = max - min || 1;
  const chartData = data.map((d, i) => ({ value: majorValues[i], label: formatPeriodLabel(d.date, granularity) }));
  const latest = data[data.length - 1];
  const latestIsPositive = latest !== undefined && latest.netWorthMinor >= 0;
  const seriesColor = latestIsPositive ? t.good : t.danger;

  return (
    <View style={styles.container}>
      <LineChart
        data={chartData}
        color={seriesColor}
        thickness={2}
        areaChart
        startFillColor={seriesColor}
        endFillColor={seriesColor}
        startOpacity={0.25}
        endOpacity={0.02}
        isAnimated
        animationDuration={600}
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
        showReferenceLine1={min < 0 && max > 0}
        referenceLine1Position={0}
        referenceLine1Config={{ color: t.chart.grid, dashWidth: 4, dashGap: 4, thickness: 1 }}
        pointerConfig={{
          pointerStripHeight: 140,
          pointerStripColor: t.chart.grid,
          pointerColor: seriesColor,
          radius: 5,
          pointerLabelWidth: 120,
          pointerLabelHeight: 40,
          activatePointersOnLongPress: true,
          pointerLabelComponent: (items: { value: number }[]) => (
            <View style={[styles.tooltip, { backgroundColor: t.card, borderColor: t.hairline }]}>
              <Text style={[typeScale.caption, { color: t.ink }]}>
                {formatMoneyMinor(Math.round(items[0].value * 100), currency)}
              </Text>
            </View>
          ),
        }}
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
  tooltip: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 4 },
});
