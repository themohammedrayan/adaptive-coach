import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { formatMoneyMinor } from '../../../finance/money';
import { Dot } from '../../kit';
import { type as typeScale, useTheme } from '../../theme';
import type { DebtPayoffChartProps } from './types';

/** Thins x-axis labels so they don't collide on a long payoff timeline. */
function labelEvery(count: number): number {
  return Math.max(1, Math.ceil(count / 6));
}

export function DebtPayoffChart({ plan, planLabel, otherPlan, otherPlanLabel, currency }: DebtPayoffChartProps) {
  const t = useTheme();
  if (plan.length === 0) return null;

  const step = labelEvery(plan.length);
  const primary = plan.map((p, i) => ({
    value: p.totalBalanceMinor / 100,
    label: i % step === 0 || i === plan.length - 1 ? (p.month === 0 ? 'Today' : `+${p.month}m`) : '',
    ...(i === plan.length - 1
      ? {
          dataPointLabelComponent: () => (
            <Text style={[typeScale.caption, styles.debtFreeLabel, { color: t.good }]}>Debt-free</Text>
          ),
          dataPointLabelShiftY: -18,
        }
      : {}),
  }));
  const secondary = otherPlan?.map((p) => ({ value: p.totalBalanceMinor / 100 }));

  return (
    <View style={styles.container}>
      <LineChart
        data={primary}
        data2={secondary}
        color={t.good}
        color2={t.muted}
        thickness={2}
        thickness2={1.5}
        strokeDashArray2={[6, 4]}
        areaChart
        startFillColor={t.good}
        endFillColor={t.good}
        startOpacity={0.25}
        endOpacity={0.02}
        isAnimated
        animationDuration={600}
        rulesColor={t.chart.grid}
        rulesType="solid"
        noOfSections={4}
        height={160}
        adjustToWidth
        hideDataPoints
        hideDataPoints2
        yAxisColor="transparent"
        xAxisColor={t.chart.grid}
        xAxisLabelTextStyle={[styles.axisLabel, { color: t.muted }]}
        yAxisTextStyle={[styles.axisLabel, { color: t.muted }]}
        pointerConfig={{
          pointerStripHeight: 140,
          pointerStripColor: t.chart.grid,
          pointerColor: t.good,
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
      {otherPlan !== null && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Dot color={t.good} />
            <Text style={[typeScale.caption, { color: t.muted }]}>{planLabel}</Text>
          </View>
          <View style={styles.legendItem}>
            <Dot color={t.muted} />
            <Text style={[typeScale.caption, { color: t.muted }]}>{otherPlanLabel} (comparison)</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  axisLabel: { fontSize: 10 },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  debtFreeLabel: { fontWeight: '600' },
  tooltip: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 4 },
});
