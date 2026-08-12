import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPeriodLabel } from '../../../finance/periods';
import { EmptyState } from '../../kit';
import { useTheme } from '../../theme';
import type { IncomeVsExpenseChartProps } from './types';

/** Web export variant, same data contract as the native chart (IncomeVsExpenseChart.tsx). */
export function IncomeVsExpenseChart({ data, granularity }: IncomeVsExpenseChartProps) {
  const t = useTheme();
  if (data.length === 0) {
    return <EmptyState message="Not enough history yet to compare income and expense." />;
  }

  const chartData = data.map((d) => ({
    month: formatPeriodLabel(d.month, granularity),
    income: d.incomeMinor / 100,
    expense: d.expenseMinor / 100,
    net: (d.incomeMinor - d.expenseMinor) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={chartData}>
        <CartesianGrid stroke={t.chart.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.muted }} stroke={t.chart.grid} />
        <YAxis tick={{ fontSize: 10, fill: t.muted }} stroke="transparent" />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Income" fill={t.good} />
        <Bar dataKey="expense" name="Expense" fill={t.danger} />
        <Line type="monotone" dataKey="net" name="Net" stroke={t.ink} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
