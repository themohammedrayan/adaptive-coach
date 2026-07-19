import { allNumbersAllowed, collectAllowedNumbers } from './numberGuard.ts';
import type { CoachNoteContent, CoachPayload, GoalSignal, Reason } from './types.ts';

function findReason<C extends Reason['code']>(
  reasons: Reason[],
  code: C,
): Extract<Reason, { code: C }> | undefined {
  return reasons.find((r): r is Extract<Reason, { code: C }> => r.code === code);
}

function findGoalSignal<C extends GoalSignal['code']>(
  signals: GoalSignal[],
  code: C,
): Extract<GoalSignal, { code: C }> | undefined {
  return signals.find((s): s is Extract<GoalSignal, { code: C }> => s.code === code);
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Goals BRD §H.4 — same reason-keyed-branch pattern as the weight fields, just keyed on goalSignals/goalsAggregate instead. */
function fallbackGoalsNote(payload: CoachPayload): string {
  const completed = findGoalSignal(payload.goalSignals, 'GOAL_COMPLETED');
  if (completed) return `You finished "${completed.title}" this week.`;

  const blocked = findGoalSignal(payload.goalSignals, 'GOAL_BLOCKED');
  if (blocked) return `"${blocked.title}" is on hold until "${blocked.blockedByTitle}" is done.`;

  if (payload.goalsAggregate.activeCount === 0) return '';
  return `${payload.goalsAggregate.activeCount} goals active, ${payload.goalsAggregate.blockedCount} blocked.`;
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
      goalsNote: fallbackGoalsNote(payload),
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

  return { changeExplanation, weeklyReview, stallRead, suggestion, goalsNote: fallbackGoalsNote(payload) };
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
  const requiredFields = [note.changeExplanation, note.weeklyReview, note.stallRead, note.suggestion];
  if (requiredFields.some((f) => typeof f !== 'string' || f.trim().length === 0)) return false;
  // goalsNote may legitimately be empty (no active goals to report on) — Goals BRD §H.4.
  if (typeof note.goalsNote !== 'string') return false;

  const allFields = [...requiredFields, note.goalsNote];
  if (allFields.some((f) => f.length > MAX_FIELD_CHARS)) return false;

  const allowed = collectAllowedNumbers(payload);
  return allFields.every((field) => allNumbersAllowed(field, allowed));
}
