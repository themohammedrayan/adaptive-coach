import type { Challenge, ChallengeDomain, ChallengeStatus } from './types';

/**
 * Local persistence contract. Implementations: SQLite (device), in-memory
 * (tests/web). Local-only for now, same as Profile/EngineState were before
 * this rework — no Supabase table/sync (unlike food-log/data-sync), since
 * clearing app data losing your goal wasn't a reported bug. The same
 * remote/sync pattern from src/food-log could be bolted on later if wanted.
 */
export interface ChallengeStore {
  upsert(challenge: Challenge): Promise<void>;
  get(id: string): Promise<Challenge | null>;
  /** Non-deleted challenges in a domain, optionally filtered to specific statuses. */
  list(domain: ChallengeDomain, statuses?: ChallengeStatus[]): Promise<Challenge[]>;
  /** The single active+primary challenge for a domain, or null if none. */
  getPrimary(domain: ChallengeDomain): Promise<Challenge | null>;
}
