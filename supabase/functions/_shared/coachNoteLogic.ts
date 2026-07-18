import { allNumbersAllowed, collectAllowedNumbers } from './numberGuard.ts';
import type { CoachNoteContent, CoachPayload, Reason } from './types.ts';

function findReason<C extends Reason['code']>(
  reasons: Reason[],
  code: C,
): Extract<Reason, { code: C }> | undefined {
  return reasons.find((r): r is Extract<Reason, { code: C }> => r.code === code);
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Coaching BRD §7 — deterministic, no LLM. Every number is read straight
 * from `payload`, never invented. INSUFFICIENT_DATA owns the whole note
 * when present; otherwise each field is built independently from whichever
 * reasons/adherence numbers are relevant.
 */
export function fallbackNote(payload: CoachPayload): CoachNoteContent {
  const insufficientData = findReason(payload.reasons, 'INSUFFICIENT_DATA');
  if (insufficientData) {
    const note =
      `You logged ${insufficientData.loggedDays} of ${payload.adherence.windowDays} days` +
      ` — I kept your target where it was. Log a couple more days and I can fine-tune it.`;
    return {
      changeExplanation: note,
      weeklyReview: note,
      stallRead: "Not enough data yet to read a trend — that'll improve once more days are logged.",
      suggestion: 'Log a couple more days and I can fine-tune it.',
    };
  }

  const targetChanged = findReason(payload.reasons, 'TARGET_CHANGED');
  const changeExplanation = targetChanged
    ? `Your target moved to ${payload.current.targetKcal} kcal ` +
      `(${formatSigned(targetChanged.deltaKcal)} from ${targetChanged.from}).`
    : `Your target held at ${payload.current.targetKcal} kcal this week.`;

  const weeklyReview =
    `You logged ${payload.adherence.loggedDays} of ${payload.adherence.windowDays} days, ` +
    `averaging ${Math.round(payload.adherence.avgIntake)} kcal against a ` +
    `${Math.round(payload.adherence.avgTarget)} kcal target.`;

  const trendStalled = findReason(payload.reasons, 'TREND_STALLED');
  const nearZeroDeficit =
    payload.current.effectiveDeficit !== null && Math.abs(payload.current.effectiveDeficit) < 50;
  const stallRead =
    trendStalled || nearZeroDeficit
      ? `Your weight held about steady over the last window` +
        (trendStalled ? ` (~${trendStalled.windowRateKg} kg/week)` : '') +
        ` — that can happen even on track; we adjust gradually.`
      : 'Your trend is tracking the plan.';

  const boundHit = findReason(payload.reasons, 'BOUND_HIT');
  const suggestion = boundHit
    ? 'We adjust gradually to keep things smooth, so expect small weekly nudges.'
    : 'Keep logging consistently — that keeps the trend and your target accurate.';

  return { changeExplanation, weeklyReview, stallRead, suggestion };
}

const MAX_FIELD_CHARS = 500;

/**
 * Coaching BRD §6 — reject fabricated figures. Every number-like substring
 * in the note's text must trace back to a number that actually appears in
 * `payload` (see numberGuard.ts). Known limitation: a narrated date (e.g.
 * "2026-12-30") splits into digit groups that won't match any allowed
 * number and would be rejected — an accepted false-positive per the BRD's
 * own priority (wrongly falling back is safe; showing an invented figure
 * is not).
 */
export function validateNote(note: CoachNoteContent, payload: CoachPayload): boolean {
  const fields = [note.changeExplanation, note.weeklyReview, note.stallRead, note.suggestion];
  if (fields.some((f) => typeof f !== 'string' || f.trim().length === 0)) return false;
  if (fields.some((f) => f.length > MAX_FIELD_CHARS)) return false;

  const allowed = collectAllowedNumbers(payload);
  return fields.every((field) => allNumbersAllowed(field, allowed));
}
