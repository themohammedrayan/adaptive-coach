import type { ChallengeStore } from './store';
import type { Challenge, ChallengeDomain, ChallengeStatus } from './types';

/** In-memory store for tests (and web runtime). Mirrors the SQLite implementation's semantics. */
export class MemoryStore implements ChallengeStore {
  challenges = new Map<string, Challenge>();

  async upsert(challenge: Challenge): Promise<void> {
    this.challenges.set(challenge.id, challenge);
  }

  async get(id: string): Promise<Challenge | null> {
    return this.challenges.get(id) ?? null;
  }

  async list(domain: ChallengeDomain, statuses?: ChallengeStatus[]): Promise<Challenge[]> {
    const statusSet = statuses ? new Set(statuses) : null;
    return [...this.challenges.values()]
      .filter((c) => c.domain === domain && (statusSet ? statusSet.has(c.status) : c.status !== 'deleted'))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getPrimary(domain: ChallengeDomain): Promise<Challenge | null> {
    for (const c of this.challenges.values()) {
      if (c.domain === domain && c.status === 'active' && c.isPrimary) return c;
    }
    return null;
  }
}
