import { allNumbersAllowed, collectAllowedNumbers } from './numberGuard';
import type { ChatAnswerContent, CoachPayload } from './types';

const MAX_ANSWER_CHARS = 800;

/**
 * v2 — deterministic, no LLM. Never attempts the free-form question itself
 * (there's no deterministic way to do that); instead recites the same kind
 * of payload-grounded summary fallbackNote() already produces for the
 * weekly note, so a fallback is always safe even though it doesn't answer
 * what was asked.
 */
export function fallbackAnswer(payload: CoachPayload): ChatAnswerContent {
  const summary =
    `Your target is currently ${payload.current.targetKcal} kcal. ` +
    `You've logged ${payload.adherence.loggedDays} of ${payload.adherence.windowDays} days, ` +
    `averaging ${Math.round(payload.adherence.avgIntake)} kcal against a ` +
    `${Math.round(payload.adherence.avgTarget)} kcal target.`;
  return {
    answer: `I can't answer that specific question right now, but here's where things stand: ${summary}`,
  };
}

/**
 * v2 — generalizes validateNote()'s number-tracing rule to a single
 * free-text field. Unlike a weekly note, a numberless conversational
 * answer (e.g. to "is it okay to eat out tonight?") is expected and valid.
 */
export function validateChatAnswer(content: ChatAnswerContent, payload: CoachPayload): boolean {
  const { answer } = content;
  if (typeof answer !== 'string' || answer.trim().length === 0) return false;
  if (answer.length > MAX_ANSWER_CHARS) return false;

  const allowed = collectAllowedNumbers(payload);
  return allNumbersAllowed(answer, allowed);
}
