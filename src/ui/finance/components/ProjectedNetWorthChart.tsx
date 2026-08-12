import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { formatPeriodLabel } from '../../../finance/periods';
import { zeroCrossingIndex } from '../../../finance/projection';
import { EmptyState } from '../../kit';
import { type as typeScale, useTheme } from '../../theme';
import type { ProjectedNetWorthChartProps } from './types';

export function ProjectedNetWorthChart({ historical, projection }: ProjectedNetWorthChartProps) {
  const t = useTheme();
  if (historical.length === 0 && projection.length === 0) {
    return <EmptyState message="Not enough history yet to project a trend." />;
  }

  const historicalPoints = historical.map((d) => ({
    value: d.netWorthMinor / 100,
    label: formatPeriodLabel(d.date, 'month'),
  }));
  const projectedPoints = projection.map((p) => ({
    value: p.projectedNetWorthMinor / 100,
    label: `+${p.monthsAhead}m`,
  }));
  const combined = [...historicalPoints, ...projectedPoints];
  const majorValues = combined.map((d) => d.value);
  const min = Math.min(0, ...majorValues);
  const max = Math.max(...majorValues, 0);
  const span = max - min || 1;

  // Only worth marking a crossing that happens in the *projected* half — a
  // past crossing already happened and isn't the motivating "when" question.
  const crossingInProjection = zeroCrossingIndex(majorValues);
  const crossingIndex =
    crossingInProjection !== null && crossingInProjection >= historicalPoints.length ? crossingInProjection : null;
  const chartData =
    crossingIndex === null
      ? combined
      : combined.map((d, i) =>
          i === crossingIndex
            ? {
                ...d,
                dataPointLabelComponent: () => (
                  <Text style={[typeScale.caption, styles.crossingLabel, { color: t.good }]}>Turns positive</Text>
                ),
                dataPointLabelShiftY: -18,
              }
            : d,
        );

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
        showReferenceLine1={min < 0 && max > 0}
        referenceLine1Position={0}
        referenceLine1Config={{ color: t.chart.grid, dashWidth: 4, dashGap: 4, thickness: 1 }}
        lineSegments={
          historicalPoints.length > 0 && projectedPoints.length > 0
            ? [
                {
                  startIndex: historicalPoints.length - 1,
                  endIndex: combined.length - 1,
                  strokeDashArray: [6, 4],
                  color: t.muted,
                },
              ]
            : undefined
        }
      />
      <Text style={[typeScale.caption, { color: t.muted }]}>
        Dashed = a rough estimate based on your recent monthly net-worth change, not financial advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  axisLabel: { fontSize: 10 },
  crossingLabel: { fontWeight: '600' },
});
