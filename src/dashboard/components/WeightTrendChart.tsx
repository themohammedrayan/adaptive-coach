import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { type as typeScale, useTheme } from '../../ui/theme';
import { computeYAxisScale } from '../chartScale';
import { projectedFinishCopy } from '../copy';
import type { WeightTrendChartProps } from './types';

const Y_AXIS_SECTIONS = 4;

const RANGE_LABEL: Record<WeightTrendChartProps['range'], string> = {
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  all: 'All time',
};

/**
 * Dashboard BRD §A2.1/§A5 — hero view: raw weigh-ins as light points + EWMA
 * trend line + goal line + projected-finish copy. `raw`/`trend` share the
 * same date grid (trend is continuous, raw has gaps) so they're merged
 * onto one x-axis via gifted-charts' data/data2 multi-series.
 */
export function WeightTrendChart({ raw, trend, goalWeight, projectedFinish, range }: WeightTrendChartProps) {
  const t = useTheme();
  const rawByDate = new Map(raw.map((p) => [p.date, p.value]));
  const trendData = trend.map((p) => ({ value: p.value, label: p.date, hideDataPoint: true }));
  const rawData = trend.map((p) => {
    const value = rawByDate.get(p.date);
    return value === undefined
      ? { value: undefined, hideDataPoint: true }
      : { value, dataPointColor: t.chart.dots, dataPointRadius: 3, hideDataPoint: false };
  });

  const values = trend.map((p) => p.value);
  const { min, max } = computeYAxisScale(values, goalWeight !== null ? [goalWeight] : [], { minSpan: 2 });
  const yAxisSpan = max - min;

  return (
    <View style={styles.container}>
      <LineChart
        data={trendData}
        data2={rawData}
        color1={t.chart.trend}
        color2="transparent"
        thickness1={2}
        thickness2={0}
        hideDataPoints={false}
        rulesColor={t.chart.grid}
        rulesType="solid"
        showReferenceLine1={goalWeight !== null}
        referenceLine1Position={goalWeight ?? undefined}
        referenceLine1Config={{
          color: t.chart.goal,
          dashWidth: 4,
          dashGap: 4,
          labelText: `Goal ${goalWeight}kg`,
          labelTextStyle: { color: t.chart.goal, fontSize: 10, fontWeight: '600' },
        }}
        yAxisOffset={min}
        maxValue={yAxisSpan}
        noOfSections={Y_AXIS_SECTIONS}
        stepValue={yAxisSpan / Y_AXIS_SECTIONS}
        height={180}
        adjustToWidth
        yAxisColor="transparent"
        xAxisColor={t.chart.grid}
        xAxisLabelTextStyle={[styles.axisLabel, { color: t.muted }]}
        yAxisTextStyle={[styles.axisLabel, { color: t.muted }]}
      />
      <View style={styles.footer}>
        <Text style={[typeScale.caption, { color: t.muted }]}>{RANGE_LABEL[range]}</Text>
        <Text style={[typeScale.caption, { color: t.ink, fontWeight: '600' }]}>
          {projectedFinishCopy(projectedFinish)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  axisLabel: { fontSize: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
});
