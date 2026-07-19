import { Bar, BarChart as RBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../theme';
import type { IncomeVsExpenseChartProps } from './types';

/** Web export variant, same data contract as the native chart (IncomeVsExpenseChart.tsx). */
export function IncomeVsExpenseChart({ data }: IncomeVsExpenseChartProps) {
  const t = useTheme();
  const chartData = data.map((d) => ({
    month: d.month.slice(5),
    income: d.incomeMinor / 100,
    expense: d.expenseMinor / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <RBarChart data={chartData}>
        <CartesianGrid stroke={t.chart.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: t.muted }} stroke={t.chart.grid} />
        <YAxis tick={{ fontSize: 10, fill: t.muted }} stroke="transparent" />
        <Tooltip />
        <Bar dataKey="income" fill={t.good} />
        <Bar dataKey="expense" fill={t.danger} />
      </RBarChart>
    </ResponsiveContainer>
  );
}
