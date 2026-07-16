import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { BodyFatTrendProps } from './types';

/**
 * Dashboard BRD §A2.4/§A5 — web export variant, same data contract as the
 * native chart (BodyFatTrend.tsx). Renders null when empty, matching the
 * native component's behavior.
 */
export function BodyFatTrend({ series }: BodyFatTrendProps) {
  if (series.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={series}>
        <XAxis dataKey="date" tick={{ fontSize: 9 }} hide />
        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} width={30} />
        <Line type="monotone" dataKey="value" stroke="#b45309" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
