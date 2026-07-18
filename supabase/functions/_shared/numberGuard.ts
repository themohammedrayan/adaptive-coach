// Coaching BRD §6 — shared anti-hallucination guard. Any model output that
// narrates payload state (weekly notes, ad-hoc chat answers) must only cite
// numbers that actually appear in the CoachPayload it was given. Extracted
// out of coachNoteLogic.ts so coach-note and coach-chat share one
// implementation instead of two independently-maintained copies.

import type { CoachPayload } from './types';

export function collectAllowedNumbers(payload: CoachPayload): number[] {
  const nums: (number | null | undefined)[] = [
    payload.current.targetKcal,
    payload.current.prevTargetKcal,
    payload.current.deltaKcal,
    payload.current.tdeeEst,
    payload.current.effectiveDeficit,
    payload.current.weeklyRateKg,
    payload.current.macros.proteinG,
    payload.current.macros.fatG,
    payload.current.macros.carbG,
    payload.current.macros.fiberG,
    payload.goal.startWeightKg,
    payload.goal.goalWeightKg,
    payload.goal.horizonDays,
    payload.goal.daysElapsed,
    payload.adherence.loggedDays,
    payload.adherence.windowDays,
    payload.adherence.avgIntake,
    payload.adherence.avgTarget,
  ];
  for (const r of payload.reasons) {
    switch (r.code) {
      case 'TARGET_CHANGED':
        nums.push(r.from, r.to, r.deltaKcal);
        break;
      case 'TREND_STALLED':
        nums.push(r.windowRateKg);
        break;
      case 'INSUFFICIENT_DATA':
        nums.push(r.loggedDays, r.weighIns);
        break;
      case 'COLD_START':
        nums.push(r.seedShare);
        break;
      case 'BOUND_HIT':
      case 'MACRO_RECONCILED':
        break;
    }
  }
  return nums.filter((n): n is number => typeof n === 'number');
}

export function isAllowed(n: number, allowed: number[]): boolean {
  return allowed.some(
    (a) =>
      n === a ||
      Math.round(n) === Math.round(a) ||
      Math.abs(n - a) <= 0.05 ||
      Math.round(n) === Math.round(a * 100), // fraction expressed as a percent (e.g. seedShare)
  );
}

/**
 * Every number-like substring in `text` must trace back to a number that
 * actually appears in `allowed`. Known limitation: a narrated date (e.g.
 * "2026-12-30") splits into digit groups that won't match any allowed
 * number and would be rejected — an accepted false-positive per the BRD's
 * own priority (wrongly falling back is safe; showing an invented figure
 * is not).
 */
export function allNumbersAllowed(text: string, allowed: number[]): boolean {
  const matches = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.every((m) => isAllowed(parseFloat(m), allowed));
}
