import type { IsoDate, Mode } from '../engine';

export type ChallengeDomain = 'weight';

export type ChallengeStatus = 'active' | 'paused' | 'completed' | 'deleted';

export interface ChallengeCore {
  id: string;
  status: ChallengeStatus;
  startDate: IsoDate;
  createdAt: string;
  updatedAt: string;
}

/**
 * Weight is the only domain today. `isPrimary` and the engine-bookkeeping
 * fields (`prevTargetKcal`/`lastRecomputeDate`) are weight-specific, not part
 * of the generic core — they exist because weight challenges compete for the
 * engine's one daily calorie prescription. A future domain with no shared
 * computed output (e.g. finance: each "save for a car"/"save for a house"
 * goal just tracks its own saved-vs-target amount) would have no primary
 * concept at all — every active challenge in that domain runs independently.
 */
export interface WeightChallenge extends ChallengeCore {
  domain: 'weight';
  /** Exactly one active weight challenge can be true — it alone drives recompute(). */
  isPrimary: boolean;
  goalWeightKg: number;
  /** Canonical time driver. A weekly-pace input at creation is converted to
   * horizonDays up front; the rate itself isn't stored separately. */
  horizonDays: number;
  startWeightKg: number;
  mode: Mode;
  /** Folded in from the old singleton EngineState — each challenge carries its
   * own recompute bookkeeping so promoting a different challenge to primary
   * cold-starts fresh rather than inheriting stale history. Only meaningful
   * while `isPrimary` is (or was) true. */
  prevTargetKcal: number | null;
  lastRecomputeDate: IsoDate | null;
}

// | FinanceChallenge | ... once those domains exist.
export type Challenge = WeightChallenge;
