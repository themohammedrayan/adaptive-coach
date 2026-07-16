import type { IsoDate } from '../../engine';
import type { Point, Range } from '../types';

/** Dashboard BRD §A5 — literal component signature, shared by native + web variants. */
export interface WeightTrendChartProps {
  raw: Point[];
  trend: Point[];
  goalWeight: number;
  projectedFinish: IsoDate | null;
  range: Range;
}

/** Dashboard BRD §A5 — literal component signature, shared by native + web variants. */
export interface BodyFatTrendProps {
  series: Point[];
}
