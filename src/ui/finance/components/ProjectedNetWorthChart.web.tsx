import {
  CartesianGrid,
  Label,
  Line,
  LineChart as RLineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoneyMinor } from '../../../finance/money';
import { formatPeriodLabel } from '../../../finance/periods';
import { zeroCrossingIndex } from '../../../finance/projection';
import { EmptyState } from '../../kit';
import { useTheme } from '../../theme';
import type { ProjectedNetWorthChartProps } from './types';

interface ChartPoint {
  label: string;
  netWorth: number | undefined;
  netWorthProjected: number | undefined;
}

/** Web export variant, same data contract as the native chart (ProjectedNetWorthChart.tsx). */
export function ProjectedNetWorthChart({ historical, projection, currency }: ProjectedNetWorthChartProps) {
  const t = useTheme();
  if (historical.length === 0 && projection.length === 0) {
    return <EmptyState message="Not enough history yet to project a trend." />;
  }

  const historicalData: ChartPoint[] = historical.map((d) => ({
    label: formatPeriodLabel(d.date, 'month'),
    netWorth: d.netWorthMinor / 100,
    netWorthProjected: undefined,
  }));
  const lastHistorical = historical[historical.length - 1];
  const projectedData: ChartPoint[] = projection.map((p) => ({
    label: `+${p.monthsAhead}m`,
    netWorth: undefined,
    netWorthProjected: p.projectedNetWorthMinor / 100,
  }));
  // Duplicate the last historical point into the projected series so the dashed line visually connects.
  const bridged: ChartPoint[] =
    lastHistorical !== undefined && historicalData.length > 0
      ? [
          ...historicalData.slice(0, -1),
          { ...historicalData[historicalData.length - 1], netWorthProjected: lastHistorical.netWorthMinor / 100 },
        ]
      : historicalData;
  const chartData = [...bridged, ...projectedData];

  const combinedValues = chartData.map((d) => d.netWorth ?? d.netWorthProjected ?? 0);
  const crossing = zeroCrossingIndex(combinedValues);
  const crossingPoint = crossing !== null && crossing >= historicalData.length ? chartData[crossing] : null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <RLineChart data={chartData}>
        <CartesianGrid stroke={t.chart.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: t.muted }} stroke={t.chart.grid} />
        <YAxis tick={{ fontSize: 10, fill: t.muted }} stroke="transparent" />
        <Tooltip formatter={(value) => formatMoneyMinor(Number(value) * 100, currency)} />
        <ReferenceLine y={0} stroke={t.chart.grid} strokeDasharray="4 4" />
        <Line type="monotone" dataKey="netWorth" stroke={t.accent} strokeWidth={2} dot={false} connectNulls={false} />
        <Line
          type="monotone"
          dataKey="netWorthProjected"
          stroke={t.muted}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls={false}
        />
        {crossingPoint !== null && (
          <ReferenceDot
            x={crossingPoint.label}
            y={crossingPoint.netWorthProjected ?? 0}
            r={4}
            fill={t.good}
            stroke="none"
          >
            <Label value="Turns positive" position="top" fill={t.good} fontSize={11} fontWeight={600} />
          </ReferenceDot>
        )}
      </RLineChart>
    </ResponsiveContainer>
  );
}
