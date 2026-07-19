// Finance coach — deterministic fallback + validation, sibling of chatLogic.ts for the health coach.

import { collectAllowedNumbers, allNumbersAllowed } from './financeNumberGuard.ts';
import type { ChatAnswerContent } from './types.ts';
import type { FinanceCoachPayload } from './financeTypes.ts';

const MAX_ANSWER_CHARS = 800;

/** Deterministic, no LLM — recites the payload-grounded health read so a fallback is always safe even though it doesn't answer what was asked. */
export function fallbackFinanceAnswer(payload: FinanceCoachPayload): ChatAnswerContent {
  const summary =
    `Your net worth is currently ${(payload.netWorthMinor / 100).toFixed(2)} ${payload.currency}. ` +
    `This month: ${(payload.month.incomeMinor / 100).toFixed(2)} income, ${(payload.month.expenseMinor / 100).toFixed(2)} expense. ` +
    `Financial health read: ${payload.healthRead.status}.`;
  return {
    answer: `I can't answer that specific question right now, but here's where things stand: ${summary}`,
  };
}

/** Every number-like substring in the answer must trace back to a number that actually appears in the finance payload. */
export function validateFinanceChatAnswer(content: ChatAnswerContent, payload: FinanceCoachPayload): boolean {
  const { answer } = content;
  if (typeof answer !== 'string' || answer.trim().length === 0) return false;
  if (answer.length > MAX_ANSWER_CHARS) return false;

  const allowed = collectAllowedNumbers(payload);
  return allNumbersAllowed(answer, allowed);
}
