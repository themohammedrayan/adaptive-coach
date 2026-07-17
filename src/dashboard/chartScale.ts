export interface YAxisScale {
  min: number;
  max: number;
}

/**
 * Dashboard follow-up — the raw weight/body-fat charts previously defaulted
 * to a Y-axis floor of 0, which crushes bands like 80-105kg or 30-38% into a
 * near-flat line. Computes a padded, non-zero-anchored range instead.
 * `include` covers values that must stay on-chart without being part of the
 * plotted series (e.g. the goal-weight reference line). `minSpan` guards
 * near-flat/single-point data from collapsing to an invisible line.
 */
export function computeYAxisScale(
  values: number[],
  include: number[] = [],
  opts?: { paddingFrac?: number; minSpan?: number },
): YAxisScale {
  const paddingFrac = opts?.paddingFrac ?? 0.1;
  const minSpan = opts?.minSpan ?? 0;
  const all = [...values, ...include];

  if (all.length === 0) return { min: 0, max: 1 };

  const dataMin = Math.min(...all);
  const dataMax = Math.max(...all);
  const center = (dataMin + dataMax) / 2;
  const span = Math.max(dataMax - dataMin, minSpan) * (1 + paddingFrac);

  return { min: center - span / 2, max: center + span / 2 };
}
