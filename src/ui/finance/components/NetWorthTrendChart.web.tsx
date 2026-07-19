import { CartesianGrid, Line, LineChart as RLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoneyMinor } from '../../../finance/money';
import { useTheme } from '../../theme';
import type { NetWorthTrendChartProps } from './types';

/** Web export variant, same data contract as the native chart (NetWorthTrendChart.tsx). */
export function NetWorthTrendChart({ data, currency }: NetWorthTrendChartProps) {
  const t = useTheme();
  const chartData = data.map((d) => ({ date: d.date.slice(5), netWorth: d.netWorthMinor / 100 }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <RLineChart data={chartData}>
        <CartesianGrid stroke={t.chart.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.muted }} stroke={t.chart.grid} />
        <YAxis tick={{ fontSize: 10, fill: t.muted }} stroke="transparent" />
        <Tooltip formatter={(value) => formatMoneyMinor(Number(value) * 100, currency)} />
        <Line type="monotone" dataKey="netWorth" stroke={t.accent} strokeWidth={2} dot={false} />
      </RLineChart>
    </ResponsiveContainer>
  );
}
