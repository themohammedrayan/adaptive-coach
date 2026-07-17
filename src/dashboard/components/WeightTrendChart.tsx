import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
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
  const rawByDate = new Map(raw.map((p) => [p.date, p.value]));
  const trendData = trend.map((p) => ({ value: p.value, label: p.date, hideDataPoint: true }));
  const rawData = trend.map((p) => {
    const value = rawByDate.get(p.date);
    return value === undefined
      ? { value: undefined, hideDataPoint: true }
      : { value, dataPointColor: '#94a3b8', dataPointRadius: 3, hideDataPoint: false };
  });

  const values = trend.map((p) => p.value);
  const { min, max } = computeYAxisScale(values, [goalWeight], { minSpan: 2 });
  const yAxisSpan = max - min;

  return (
    <View style={styles.container}>
      <LineChart
        data={trendData}
        data2={rawData}
        color1="#111827"
        color2="transparent"
        thickness1={2}
        thickness2={0}
        hideDataPoints={false}
        hideRules
        showReferenceLine1
        referenceLine1Position={goalWeight}
        referenceLine1Config={{ color: '#047857', dashWidth: 4, dashGap: 4, labelText: `Goal ${goalWeight}kg` }}
        yAxisOffset={min}
        maxValue={yAxisSpan}
        noOfSections={Y_AXIS_SECTIONS}
        stepValue={yAxisSpan / Y_AXIS_SECTIONS}
        height={180}
        adjustToWidth
        xAxisLabelTextStyle={styles.axisLabel}
        yAxisTextStyle={styles.axisLabel}
      />
      <View style={styles.footer}>
        <Text style={styles.rangeLabel}>{RANGE_LABEL[range]}</Text>
        <Text style={styles.projected}>{projectedFinishCopy(projectedFinish)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  axisLabel: { fontSize: 10, color: '#666' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  rangeLabel: { fontSize: 12, color: '#666' },
  projected: { fontSize: 12, fontWeight: '600' },
});
