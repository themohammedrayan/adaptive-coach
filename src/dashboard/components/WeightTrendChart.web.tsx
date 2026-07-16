import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  XAxis,
  YAxis,
} from 'recharts';
import { projectedFinishCopy } from '../copy';
import type { WeightTrendChartProps } from './types';

const RANGE_LABEL: Record<WeightTrendChartProps['range'], string> = {
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  all: 'All time',
};

/**
 * Dashboard BRD §A4/§A5 — web export variant, same data contract as the
 * native chart (WeightTrendChart.tsx), rendered with recharts for the
 * larger-screen dashboard.
 */
export function WeightTrendChart({ raw, trend, goalWeight, projectedFinish, range }: WeightTrendChartProps) {
  const rawByDate = new Map(raw.map((p) => [p.date, p.value]));
  const merged = trend.map((p) => ({
    date: p.date,
    trend: p.value,
    raw: rawByDate.get(p.date) ?? null,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
          <ReferenceLine
            y={goalWeight}
            stroke="#047857"
            strokeDasharray="4 4"
            label={{ value: `Goal ${goalWeight}kg`, fontSize: 10, fill: '#047857' }}
          />
          <Line type="monotone" dataKey="trend" stroke="#111827" strokeWidth={2} dot={false} />
          <Scatter dataKey="raw" fill="#94a3b8" />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ color: '#666' }}>{RANGE_LABEL[range]}</span>
        <span style={{ fontWeight: 600 }}>{projectedFinishCopy(projectedFinish)}</span>
      </div>
    </div>
  );
}
