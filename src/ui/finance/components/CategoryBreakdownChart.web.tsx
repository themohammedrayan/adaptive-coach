import { Cell, Legend, Pie, PieChart as RPieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatMoneyMinor } from '../../../finance/money';
import { useTheme } from '../../theme';
import type { CategoryBreakdownChartProps } from './types';

const PALETTE_KEYS = ['protein', 'carb', 'fat', 'trend', 'goal', 'bodyFat'] as const;

/** Web export variant, same data contract as the native chart (CategoryBreakdownChart.tsx). */
export function CategoryBreakdownChart({ data, currency }: CategoryBreakdownChartProps) {
  const t = useTheme();
  const palette = PALETTE_KEYS.map((k) => t.chart[k]);
  const chartData = data.map((d) => ({ name: d.categoryName, value: d.totalMinor }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RPieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatMoneyMinor(Number(value), currency)} />
        <Legend />
      </RPieChart>
    </ResponsiveContainer>
  );
}
