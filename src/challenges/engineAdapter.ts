import type { EngineState, Profile } from '../engine';
import type { WeightChallenge } from './types';

/** The person-level fields the engine's Profile needs, independent of any one challenge. */
export type BioFields = Pick<Profile, 'sex' | 'age' | 'heightCm' | 'activityFactor'>;

/**
 * Builds the engine-facing Profile the pure engine's recompute() expects, by
 * merging person-level bio fields with the primary challenge's goal fields.
 * The engine module itself is untouched — this is the one adapter seam
 * dashboard/refreshSnapshot.ts and coach-chat/askCoach.ts both call through.
 */
export function toEngineProfile(bio: BioFields, challenge: WeightChallenge): Profile {
  return {
    ...bio,
    goalWeightKg: challenge.goalWeightKg,
    horizonDays: challenge.horizonDays,
    startDate: challenge.startDate,
    mode: challenge.mode,
  };
}

/** Builds the engine-facing EngineState from a challenge's own recompute bookkeeping. */
export function toEngineState(challenge: WeightChallenge): EngineState {
  return {
    prevTargetKcal: challenge.prevTargetKcal,
    mode: challenge.mode,
    lastRecomputeDate: challenge.lastRecomputeDate,
    startWeightKg: challenge.startWeightKg,
  };
}

/** Folds a fresh EngineState (from engine's nextEngineState()) back onto the challenge. */
export function withEngineState(challenge: WeightChallenge, next: EngineState): WeightChallenge {
  return {
    ...challenge,
    prevTargetKcal: next.prevTargetKcal,
    lastRecomputeDate: next.lastRecomputeDate,
    mode: next.mode,
  };
}
