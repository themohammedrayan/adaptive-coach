import { assembleCoachPayload } from '../coaching/assembleCoachPayload';
import { gatherPayloadInputs, type PayloadInputDeps } from '../coaching/gatherPayloadInputs';
import { buildGoalSummary } from '../coaching/goal';
import { buildAdherenceSummary } from '../dashboard/adherence';
import type { DashboardStore } from '../dashboard/store';
import type { IsoDate } from '../engine';
import { askCoach as invokeAskCoach } from './remote';
import type { ChatHistoryTurn, CoachChatTurn } from './types';

export interface AskCoachDeps extends PayloadInputDeps {
  dashboardStore: DashboardStore;
}

export type AskCoachResult =
  | { status: 'no-data' }
  | { status: 'ok'; turn: CoachChatTurn };

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
 * v2 — the ad-hoc chat orchestrator. Reads the dashboard's cached
 * EngineState/EngineResult (never calls recompute() — the engine is pure
 * and only advances on its own weekly gate) and builds a CoachPayload from
 * it via the same assembleCoachPayload() used for weekly notes, so a chat
 * answer is grounded in exactly the same state the user sees on screen.
 */
export async function askCoachQuestion(
  deps: AskCoachDeps,
  question: string,
  today: IsoDate,
  history: ChatHistoryTurn[] = [],
): Promise<AskCoachResult> {
  const profile = await deps.dashboardStore.getProfile();
  const engineState = await deps.dashboardStore.getEngineState();
  const cached = await deps.dashboardStore.getLastResult();
  if (profile === null || engineState === null || cached === null) {
    return { status: 'no-data' };
  }

  const { last14, trend } = await gatherPayloadInputs(deps, profile, today);
  const adherenceSummary = buildAdherenceSummary(last14, cached.result.targetKcal);
  const goal = buildGoalSummary(profile, engineState, today);
  const payload = assembleCoachPayload(cached.result, adherenceSummary, goal, cached.computedAt, trend);

  const turn = await invokeAskCoach(generateRequestId(), question, payload, history);
  return { status: 'ok', turn };
}
