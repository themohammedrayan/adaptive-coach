import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { formatPeriodLabel } from '../../../finance/periods';
import { Dot, EmptyState } from '../../kit';
import { type as typeScale, useTheme } from '../../theme';
import type { IncomeVsExpenseChartProps } from './types';

export function IncomeVsExpenseChart({ data, granularity }: IncomeVsExpenseChartProps) {
  const t = useTheme();
  if (data.length === 0) {
    return <EmptyState message="Not enough history yet to compare income and expense." />;
  }

  const netByPeriod = data.map((d) => (d.incomeMinor - d.expenseMinor) / 100);
  const barData = data.flatMap((d, i) => {
    const deficit = netByPeriod[i] < 0;
    return [
      { value: d.incomeMinor / 100, label: formatPeriodLabel(d.month, granularity), frontColor: t.good, spacing: 2 },
      {
        value: d.expenseMinor / 100,
        frontColor: t.danger,
        spacing: 14,
        ...(deficit
          ? { topLabelComponent: () => <Text style={[typeScale.caption, { color: t.danger }]}>▼</Text> }
          : {}),
      },
    ];
  });
  // Duplicated onto both bars of each period so the net line reads as one
  // flat segment per period rather than sawtoothing between bar positions.
  const netLineData = netByPeriod.flatMap((net) => [{ value: net }, { value: net }]);

  return (
    <View style={styles.container}>
      <BarChart
        data={barData}
        showLine
        lineData={netLineData}
        lineConfig={{
          color: t.ink,
          thickness: 2,
          curved: false,
          hideDataPoints: true,
          isAnimated: true,
        }}
        height={160}
        barWidth={14}
        noOfSections={4}
        isAnimated
        animationDuration={600}
        rulesColor={t.chart.grid}
        yAxisColor="transparent"
        xAxisColor={t.chart.grid}
        xAxisLabelTextStyle={[styles.axisLabel, { color: t.muted }]}
        yAxisTextStyle={[styles.axisLabel, { color: t.muted }]}
      />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Dot color={t.good} />
          <Text style={[typeScale.caption, { color: t.muted }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <Dot color={t.danger} />
          <Text style={[typeScale.caption, { color: t.muted }]}>Expense</Text>
        </View>
        <View style={styles.legendItem}>
          <Dot color={t.ink} />
          <Text style={[typeScale.caption, { color: t.muted }]}>Net</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  axisLabel: { fontSize: 10 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
