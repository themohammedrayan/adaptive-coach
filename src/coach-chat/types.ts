import type { CoachGoalSummary, CoachGoalsAggregate, CoachPayload, GoalSignal } from '../coaching';
import type { IsoDate } from '../engine';
import type { FinanceCoachPayload } from '../finance';

/**
 * v2/coach-unification — the single ad-hoc Q&A grounding payload, replacing
 * the separate CoachPayload (health) / FinanceCoachPayload (finance) chat
 * surfaces. `health` is null when there's no primary weight goal with a
 * live EngineResult yet (nothing to ground weight questions in); `finance`
 * is always buildable (an empty accounts list just zeroes its aggregates).
 * `goals`/`goalsAggregate`/`goalSignals` (Goals BRD §H.2/§H.3) live at the
 * top level, not nested in `health` — the unified surface is the one place
 * goal data is meant to reach a chat answer regardless of domain.
 */
export interface UnifiedCoachPayload {
  today: IsoDate;
  health: CoachPayload | null;
  finance: FinanceCoachPayload;
  goals: CoachGoalSummary[];
  goalsAggregate: CoachGoalsAggregate;
  goalSignals: GoalSignal[];
}

/** RN-side mirror of supabase/functions/_shared/types.ts's CoachChatTurn. Domain-generic — used for both former health/finance chat threads, now one merged table. */
export interface CoachChatTurn {
  id: string;
  question: string;
  answer: string;
  source: 'model' | 'fallback';
  model: string | null;
  generatedAt: string;
  payloadHash: string;
}

export interface ChatHistoryTurn {
  question: string;
  answer: string;
}
