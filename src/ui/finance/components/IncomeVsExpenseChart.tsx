import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { formatPeriodLabel } from '../../../finance/periods';
import { useTheme } from '../../theme';
import type { IncomeVsExpenseChartProps } from './types';

export function IncomeVsExpenseChart({ data, granularity }: IncomeVsExpenseChartProps) {
  const t = useTheme();
  const barData = data.flatMap((d) => [
    { value: d.incomeMinor / 100, label: formatPeriodLabel(d.month, granularity), frontColor: t.good, spacing: 2 },
    { value: d.expenseMinor / 100, frontColor: t.danger, spacing: 14 },
  ]);

  return (
    <View style={styles.container}>
      <BarChart
        data={barData}
        height={160}
        barWidth={14}
        noOfSections={4}
        rulesColor={t.chart.grid}
        yAxisColor="transparent"
        xAxisColor={t.chart.grid}
        xAxisLabelTextStyle={[styles.axisLabel, { color: t.muted }]}
        yAxisTextStyle={[styles.axisLabel, { color: t.muted }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  axisLabel: { fontSize: 10 },
});
