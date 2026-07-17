import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useTheme } from '../../ui/theme';
import { computeYAxisScale } from '../chartScale';
import type { BodyFatTrendProps } from './types';

/**
 * Dashboard BRD §A2.4/§A5 — web export variant, same data contract as the
 * native chart (BodyFatTrend.tsx). Renders null when empty, matching the
 * native component's behavior.
 */
export function BodyFatTrend({ series }: BodyFatTrendProps) {
  const t = useTheme();
  if (series.length === 0) return null;
  const values = series.map((p) => p.value);
  const { min, max } = computeYAxisScale(values, [], { minSpan: 2 });
  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={series}>
        <XAxis dataKey="date" tick={{ fontSize: 9 }} hide />
        <YAxis domain={[min, max]} tick={{ fontSize: 9, fill: t.muted }} width={30} stroke="transparent" />
        <Line type="monotone" dataKey="value" stroke={t.chart.bodyFat} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
