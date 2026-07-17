import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../../ui/theme';
import { computeYAxisScale } from '../chartScale';
import type { BodyFatTrendProps } from './types';

const Y_AXIS_SECTIONS = 3;

/**
 * Dashboard BRD §A2.4/§A5 — small body-fat line, only rendered when
 * body-comp is syncing (empty series -> renders null, hidden entirely).
 */
export function BodyFatTrend({ series }: BodyFatTrendProps) {
  const t = useTheme();
  if (series.length === 0) return null;
  const data = series.map((p) => ({ value: p.value, label: p.date }));
  const values = series.map((p) => p.value);
  const { min, max } = computeYAxisScale(values, [], { minSpan: 2 });
  const yAxisSpan = max - min;
  return (
    <View>
      <LineChart
        data={data}
        color1={t.chart.bodyFat}
        thickness1={2}
        hideDataPoints
        hideRules
        yAxisOffset={min}
        maxValue={yAxisSpan}
        noOfSections={Y_AXIS_SECTIONS}
        stepValue={yAxisSpan / Y_AXIS_SECTIONS}
        height={80}
        adjustToWidth
        yAxisColor="transparent"
        xAxisColor={t.chart.grid}
        xAxisLabelTextStyle={[styles.axisLabel, { color: t.muted }]}
        yAxisTextStyle={[styles.axisLabel, { color: t.muted }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabel: { fontSize: 9 },
});
