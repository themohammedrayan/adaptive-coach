import type { IsoDate } from '../engine';

/**
 * Dashboard BRD §A3 — display rule for the projected finish date. Never a
 * scary countdown: null (stalled/gaining) gets a neutral message instead.
 */
export function projectedFinishCopy(projectedFinishDate: IsoDate | null): string {
  return projectedFinishDate !== null
    ? `On this pace: ~${projectedFinishDate}`
    : "Trend is flat — see this week's note";
}
