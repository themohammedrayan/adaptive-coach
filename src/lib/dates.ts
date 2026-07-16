import type { IsoDate } from '../engine';

/** Maps an ISO instant to a local calendar day. Injected so tests use a fixed offset. */
export type InstantToLocalDate = (instantUtc: string) => IsoDate;

/** Fixed-offset converter (minutes east of UTC) — deterministic, used in tests. */
export function offsetLocalDate(offsetMinutes: number): InstantToLocalDate {
  return (instantUtc) =>
    new Date(Date.parse(instantUtc) + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Device-timezone converter for runtime (handles DST per instant via local getters). */
export const deviceLocalDate: InstantToLocalDate = (instantUtc) => {
  const d = new Date(instantUtc);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
