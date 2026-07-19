import type { ChallengeStore } from '../challenges';
import { toEngineProfile } from '../challenges';
import { assembleCoachPayload } from '../coaching/assembleCoachPayload';
import { gatherPayloadInputs, type PayloadInputDeps } from '../coaching/gatherPayloadInputs';
import { buildGoalSummary } from '../coaching/goal';
import { buildAdherenceSummary } from '../dashboard/adherence';
import type { DashboardStore } from '../dashboard/store';
import type { IsoDate } from '../engine';
import { assembleFinanceCoachPayload } from '../finance/coachPayload';
import type { Account, AccountValuation, Budget, Category, FinanceGoal, Transaction } from '../finance/types';
import { buildCoachGoalContext } from '../goals/coachSummary';
import type { Goal, GoalProgress } from '../goals/types';
import { assembleUnifiedCoachPayload } from './assemblePayload';
import { askCoach as invokeAskCoach } from './remote';
import type { ChatHistoryTurn, CoachChatTurn } from './types';

export interface AskCoachFinanceInputs {
  accounts: Account[];
  transactions: Transaction[];
  valuations: AccountValuation[];
  financeGoals: FinanceGoal[];
  budgets: Budget[];
  categories: Category[];
}

export interface AskCoachGoalsInputs {
  /** Every active goal (all four types) and its already-resolved progress — see src/goals/loadResolvedGoals.ts. */
  activeGoals: Goal[];
  progressByGoalId: Map<string, GoalProgress>;
}

export interface AskCoachDeps extends PayloadInputDeps {
  dashboardStore: DashboardStore;
  challengeStore: ChallengeStore;
  finance: AskCoachFinanceInputs;
  goals: AskCoachGoalsInputs;
}

export interface AskCoachResult {
  turn: CoachChatTurn;
}

/** Request ids only need to be unique enough to dedupe a retry — not cryptographically random. */
function generateRequestId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const bytes = Array.from({ length: 32 }, hex);
  bytes[12] = '4'; // version 4
  bytes[16] = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]; // variant
  const s = bytes.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * Coach unification — the single ad-hoc Q&A orchestrator, replacing the
 * separate health (askCoach) / finance (askFinanceCoachQuestion)
 * orchestrators. Builds `health` from the cached EngineResult + primary
 * weight Challenge when one exists (never calls recompute() — the engine
 * is pure and only advances on its own weekly gate), always builds
 * `finance` (empty accounts just zero its aggregates), and folds in
 * already-resolved goal data — one UnifiedCoachPayload either way, so a
 * chat answer is grounded in exactly the same state the user sees on
 * screen, in whichever app mode they asked from.
 */
export async function askCoachQuestion(
  deps: AskCoachDeps,
  question: string,
  today: IsoDate,
  history: ChatHistoryTurn[] = [],
): Promise<AskCoachResult> {
  const profile = await deps.dashboardStore.getProfile();
  const primary = await deps.challengeStore.getPrimary('weight');
  const cached = await deps.dashboardStore.getLastResult();

  const health =
    profile !== null && primary !== null && cached !== null
      ? await (async () => {
          const engineProfile = toEngineProfile(profile, primary);
          const { last14, trend } = await gatherPayloadInputs(deps, engineProfile, today);
          const adherenceSummary = buildAdherenceSummary(last14, cached.result.targetKcal);
          const goalSummary = buildGoalSummary(primary.startWeightKg, primary.goalWeightKg, primary.horizonDays, primary.startDate, today);
          // goals/goalsAggregate/goalSignals live at the UnifiedCoachPayload top level for
          // the chat surface (below), not duplicated onto the nested health payload.
          return assembleCoachPayload(cached.result, adherenceSummary, goalSummary, cached.computedAt, trend);
        })()
      : null;

  const finance = assembleFinanceCoachPayload(
    deps.finance.accounts,
    deps.finance.transactions,
    deps.finance.valuations,
    deps.finance.financeGoals,
    deps.finance.budgets,
    deps.finance.categories,
    today,
  );

  const { goals, goalsAggregate, goalSignals } = buildCoachGoalContext(deps.goals.activeGoals, deps.goals.progressByGoalId, today);

  const payload = assembleUnifiedCoachPayload(today, health, finance, goals, goalsAggregate, goalSignals);

  const turn = await invokeAskCoach(generateRequestId(), question, payload, history);
  return { turn };
}
