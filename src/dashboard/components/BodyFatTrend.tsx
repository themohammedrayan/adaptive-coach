import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import type { BodyFatTrendProps } from './types';

/**
 * Dashboard BRD §A2.4/§A5 — small body-fat line, only rendered when
 * body-comp is syncing (empty series -> renders null, hidden entirely).
 */
export function BodyFatTrend({ series }: BodyFatTrendProps) {
  if (series.length === 0) return null;
  const data = series.map((p) => ({ value: p.value, label: p.date }));
  return (
    <View style={styles.container}>
      <LineChart
        data={data}
        color1="#b45309"
        thickness1={2}
        hideDataPoints
        hideRules
        height={80}
        adjustToWidth
        xAxisLabelTextStyle={styles.axisLabel}
        yAxisTextStyle={styles.axisLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  axisLabel: { fontSize: 9, color: '#666' },
});
