import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoneyMinor } from '../../../finance/money';
import { formatPeriodLabel } from '../../../finance/periods';
import { EmptyState } from '../../kit';
import { useTheme } from '../../theme';
import type { NetWorthTrendChartProps } from './types';

/** Web export variant, same data contract as the native chart (NetWorthTrendChart.tsx). */
export function NetWorthTrendChart({ data, currency, granularity }: NetWorthTrendChartProps) {
  const t = useTheme();
  if (data.length === 0) {
    return <EmptyState message="Not enough history yet to chart a trend." />;
  }

  const chartData = data.map((d) => ({ date: formatPeriodLabel(d.date, granularity), netWorth: d.netWorthMinor / 100 }));
  const latest = data[data.length - 1];
  const seriesColor = latest.netWorthMinor >= 0 ? t.good : t.danger;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={seriesColor} stopOpacity={0.25} />
            <stop offset="95%" stopColor={seriesColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={t.chart.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.muted }} stroke={t.chart.grid} />
        <YAxis tick={{ fontSize: 10, fill: t.muted }} stroke="transparent" />
        <Tooltip formatter={(value) => formatMoneyMinor(Number(value) * 100, currency)} />
        <ReferenceLine y={0} stroke={t.chart.grid} strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="netWorth"
          stroke={seriesColor}
          strokeWidth={2}
          fill="url(#netWorthFill)"
          dot={false}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
