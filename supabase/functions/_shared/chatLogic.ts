// Coach-unification — merged deterministic fallback + validation, replacing
// the separate health (chatLogic.ts) / finance (financeChatLogic.ts) guards.

import { collectAllowedNumbers as collectFinanceAllowedNumbers } from './financeNumberGuard.ts';
import { allNumbersAllowed, collectAllowedNumbers as collectHealthAllowedNumbers, collectGoalsNumbers } from './numberGuard.ts';
import type { ChatAnswerContent, UnifiedCoachPayload } from './types.ts';

const MAX_ANSWER_CHARS = 800;

function collectUnifiedAllowedNumbers(payload: UnifiedCoachPayload): number[] {
  const health = payload.health !== null ? collectHealthAllowedNumbers(payload.health) : [];
  const finance = collectFinanceAllowedNumbers(payload.finance);
  // payload.health.goals is always empty for the unified surface (goal data lives at the top level here) — see src/coach-chat/askCoach.ts.
  const goals = collectGoalsNumbers(payload.goals, payload.goalsAggregate, payload.goalSignals);
  return [...health, ...finance, ...goals];
}

/**
 * Deterministic, no LLM. Never attempts the free-form question itself
 * (there's no deterministic way to do that); instead recites a
 * payload-grounded summary spanning whichever domains have data, so a
 * fallback is always safe even though it doesn't answer what was asked.
 */
export function fallbackAnswer(payload: UnifiedCoachPayload): ChatAnswerContent {
  const parts: string[] = [];

  if (payload.health !== null) {
    parts.push(
      `Your weight target is currently ${payload.health.current.targetKcal} kcal — ` +
        `you've logged ${payload.health.adherence.loggedDays} of ${payload.health.adherence.windowDays} days.`,
    );
  }

  parts.push(
    `Your net worth is currently ${(payload.finance.netWorthMinor / 100).toFixed(2)} ${payload.finance.currency}. ` +
      `Financial health read: ${payload.finance.healthRead.status}.`,
  );

  if (payload.goalsAggregate.activeCount > 0) {
    parts.push(`${payload.goalsAggregate.activeCount} goals active, ${payload.goalsAggregate.blockedCount} blocked.`);
  }

  return { answer: `I can't answer that specific question right now, but here's where things stand: ${parts.join(' ')}` };
}

/**
 * Generalizes validateNote()'s number-tracing rule to a single free-text
 * field, over the union of health + finance + goals numbers. Unlike a
 * weekly note, a numberless conversational answer (e.g. to "is it okay to
 * eat out tonight?") is expected and valid.
 */
export function validateChatAnswer(content: ChatAnswerContent, payload: UnifiedCoachPayload): boolean {
  const { answer } = content;
  if (typeof answer !== 'string' || answer.trim().length === 0) return false;
  if (answer.length > MAX_ANSWER_CHARS) return false;

  return allNumbersAllowed(answer, collectUnifiedAllowedNumbers(payload));
}
