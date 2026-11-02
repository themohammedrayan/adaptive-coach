import type { ChallengeStore } from './store';
import type { Challenge, ChallengeDomain, ChallengeStatus } from './types';

/** Supabase seam for public.challenges; faked in tests. */
export interface ChallengeRemote {
  fetchAll(): Promise<Challenge[]>;
  upsert(challenges: Challenge[]): Promise<void>;
}

export const CHALLENGE_DOMAINS: ChallengeDomain[] = ['weight'];
const ALL_STATUSES: ChallengeStatus[] = ['active', 'paused', 'completed', 'deleted'];

export interface ChallengeSyncResult {
  pushed: number;
  pulled: number;
}

/**
 * Two-way reconcile, last-write-wins on `updatedAt` (client clock at edit
 * time). Local-only rows are pushed — this is also how the first sync
 * uploads challenges that predate the table — and remote-only rows pulled.
 * Pulled rows go to the *base* store so they aren't echoed back.
 */
export async function syncChallenges(base: ChallengeStore, remote: ChallengeRemote): Promise<ChallengeSyncResult> {
  const local = new Map<string, Challenge>();
  for (const domain of CHALLENGE_DOMAINS) {
    for (const c of await base.list(domain, ALL_STATUSES)) local.set(c.id, c);
  }
  const remoteRows = await remote.fetchAll();
  const remoteIds = new Set<string>();

  let pulled = 0;
  for (const r of remoteRows) {
    remoteIds.add(r.id);
    const l = local.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) {
      await base.upsert(r);
      pulled += 1;
    }
  }

  const toPush = [...local.values()].filter((l) => {
    if (!remoteIds.has(l.id)) return true;
    const r = remoteRows.find((x) => x.id === l.id)!;
    return l.updatedAt > r.updatedAt;
  });
  if (toPush.length > 0) await remote.upsert(toPush);

  return { pushed: toPush.length, pulled };
}

/**
 * Write-through decorator: every upsert lands locally first, then is pushed
 * in the background. A failed push (offline) is harmless — the next
 * syncChallenges() sees the local row is newer and pushes it then.
 */
export class SyncedChallengeStore implements ChallengeStore {
  constructor(
    private readonly base: ChallengeStore,
    private readonly remote: ChallengeRemote,
  ) {}

  get(id: string) {
    return this.base.get(id);
  }
  list(domain: ChallengeDomain, statuses?: ChallengeStatus[]) {
    return this.base.list(domain, statuses);
  }
  getPrimary(domain: ChallengeDomain) {
    return this.base.getPrimary(domain);
  }

  async upsert(challenge: Challenge): Promise<void> {
    await this.base.upsert(challenge);
    this.remote.upsert([challenge]).catch(() => {});
  }

  /** Local wipe only — account reset deletes the server rows itself. */
  clearAll() {
    return this.base.clearAll();
  }

  sync(): Promise<ChallengeSyncResult> {
    return syncChallenges(this.base, this.remote);
  }
}
