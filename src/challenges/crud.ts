import { deriveMode, horizonDaysFromWeeklyRate } from './pace';
import type { ChallengeStore } from './store';
import type { Challenge, ChallengeDomain } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `challenge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type CreateChallengeInput =
  | { domain: 'weight'; goalWeightKg: number; startWeightKg: number; horizonDays: number }
  | { domain: 'weight'; goalWeightKg: number; startWeightKg: number; targetWeeklyRateKg: number };

/**
 * Creates a challenge. New challenge is primary iff no other active
 * challenge exists yet in that domain — the first one always drives the
 * prescription; later ones are opt-in via setPrimaryChallenge.
 */
export async function createChallenge(
  store: ChallengeStore,
  input: CreateChallengeInput,
  nowUtc: string,
  startDate: string,
  genId: IdGenerator = defaultGenId,
): Promise<Challenge> {
  const horizonDays =
    'horizonDays' in input
      ? input.horizonDays
      : horizonDaysFromWeeklyRate(input.startWeightKg, input.goalWeightKg, input.targetWeeklyRateKg);

  const existingActive = await store.list(input.domain, ['active']);
  const isPrimary = existingActive.length === 0;

  const challenge: Challenge = {
    id: genId(),
    domain: input.domain,
    status: 'active',
    isPrimary,
    startDate,
    goalWeightKg: input.goalWeightKg,
    horizonDays,
    startWeightKg: input.startWeightKg,
    mode: deriveMode(input.startWeightKg, input.goalWeightKg),
    prevTargetKcal: null,
    lastRecomputeDate: null,
    createdAt: nowUtc,
    updatedAt: nowUtc,
  };
  await store.upsert(challenge);
  return challenge;
}

/** Promotes the oldest remaining active challenge in a domain to primary, if any. */
async function promoteOldestActive(store: ChallengeStore, domain: ChallengeDomain, nowUtc: string): Promise<void> {
  const active = await store.list(domain, ['active']);
  if (active.length === 0) return;
  await store.upsert({ ...active[0], isPrimary: true, updatedAt: nowUtc });
}

export async function pauseChallenge(store: ChallengeStore, id: string, nowUtc: string): Promise<Challenge | null> {
  const challenge = await store.get(id);
  if (challenge === null) return null;
  const wasPrimary = challenge.isPrimary;
  const updated: Challenge = { ...challenge, status: 'paused', isPrimary: false, updatedAt: nowUtc };
  await store.upsert(updated);
  if (wasPrimary) await promoteOldestActive(store, challenge.domain, nowUtc);
  return updated;
}

/** Resumes a paused challenge as active. Does not auto-become primary — use setPrimaryChallenge for that. */
export async function resumeChallenge(store: ChallengeStore, id: string, nowUtc: string): Promise<Challenge | null> {
  const challenge = await store.get(id);
  if (challenge === null) return null;
  const updated: Challenge = { ...challenge, status: 'active', updatedAt: nowUtc };
  await store.upsert(updated);
  return updated;
}

export async function setPrimaryChallenge(store: ChallengeStore, id: string, nowUtc: string): Promise<Challenge | null> {
  const challenge = await store.get(id);
  if (challenge === null || challenge.status !== 'active') return null;
  const currentPrimary = await store.getPrimary(challenge.domain);
  if (currentPrimary !== null && currentPrimary.id !== id) {
    await store.upsert({ ...currentPrimary, isPrimary: false, updatedAt: nowUtc });
  }
  const updated: Challenge = { ...challenge, isPrimary: true, updatedAt: nowUtc };
  await store.upsert(updated);
  return updated;
}

export async function deleteChallenge(store: ChallengeStore, id: string, nowUtc: string): Promise<Challenge | null> {
  const challenge = await store.get(id);
  if (challenge === null) return null;
  const wasPrimary = challenge.isPrimary;
  const updated: Challenge = { ...challenge, status: 'deleted', isPrimary: false, updatedAt: nowUtc };
  await store.upsert(updated);
  if (wasPrimary) await promoteOldestActive(store, challenge.domain, nowUtc);
  return updated;
}

/**
 * Resets the day-count and kcal-bank baseline (new startDate/startWeightKg)
 * while keeping the same goal — distinct from delete+recreate. Also resets
 * the engine bookkeeping so a primary challenge cold-starts fresh instead of
 * carrying over a stale prevTargetKcal/lastRecomputeDate history.
 */
export async function restartChallenge(
  store: ChallengeStore,
  id: string,
  nowUtc: string,
  today: string,
  currentTrendWeightKg: number,
): Promise<Challenge | null> {
  const challenge = await store.get(id);
  if (challenge === null) return null;
  const updated: Challenge = {
    ...challenge,
    startDate: today,
    startWeightKg: currentTrendWeightKg,
    prevTargetKcal: null,
    lastRecomputeDate: null,
    updatedAt: nowUtc,
  };
  await store.upsert(updated);
  return updated;
}

export async function listChallenges(
  store: ChallengeStore,
  domain: ChallengeDomain,
  statuses?: Challenge['status'][],
): Promise<Challenge[]> {
  return store.list(domain, statuses);
}
