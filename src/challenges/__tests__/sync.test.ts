import { MemoryStore } from '../store.memory';
import { SyncedChallengeStore, syncChallenges, type ChallengeRemote } from '../sync';
import type { Challenge } from '../types';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
// eslint-disable-next-line import/first
import { challengeFromServer, challengeToServer } from '../remote';

function ch(id: string, updatedAt: string, extra: Partial<Challenge> = {}): Challenge {
  return {
    id, domain: 'weight', status: 'active', isPrimary: true, startDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt, goalWeightKg: 75, horizonDays: 180,
    startWeightKg: 85, mode: 'lose', prevTargetKcal: null, lastRecomputeDate: null, ...extra,
  };
}

class FakeRemote implements ChallengeRemote {
  rows = new Map<string, Challenge>();
  fail = false;
  async fetchAll() { if (this.fail) throw new Error('offline'); return [...this.rows.values()]; }
  async upsert(cs: Challenge[]) { if (this.fail) throw new Error('offline'); for (const c of cs) this.rows.set(c.id, c); }
}

describe('syncChallenges', () => {
  it('uploads local-only rows (first sync of pre-existing phone data)', async () => {
    const base = new MemoryStore(); const remote = new FakeRemote();
    await base.upsert(ch('a', '2026-10-01T00:00:00.000Z'));
    expect(await syncChallenges(base, remote)).toEqual({ pushed: 1, pulled: 0 });
    expect(remote.rows.get('a')).toBeDefined();
  });

  it('pulls remote-only rows (fresh browser)', async () => {
    const base = new MemoryStore(); const remote = new FakeRemote();
    remote.rows.set('a', ch('a', '2026-10-01T00:00:00.000Z'));
    expect(await syncChallenges(base, remote)).toEqual({ pushed: 0, pulled: 1 });
    expect(await base.getPrimary('weight')).not.toBeNull();
  });

  it('newer side wins in both directions, soft deletes included', async () => {
    const base = new MemoryStore(); const remote = new FakeRemote();
    await base.upsert(ch('a', '2026-10-05T00:00:00.000Z', { status: 'deleted' }));
    remote.rows.set('a', ch('a', '2026-10-02T00:00:00.000Z'));
    await base.upsert(ch('b', '2026-10-01T00:00:00.000Z', { goalWeightKg: 80 }));
    remote.rows.set('b', ch('b', '2026-10-03T00:00:00.000Z', { goalWeightKg: 72 }));
    expect(await syncChallenges(base, remote)).toEqual({ pushed: 1, pulled: 1 });
    expect(remote.rows.get('a')!.status).toBe('deleted');
    expect((await base.get('b'))!.goalWeightKg).toBe(72);
  });

  it('equal timestamps are a no-op', async () => {
    const base = new MemoryStore(); const remote = new FakeRemote();
    await base.upsert(ch('a', '2026-10-01T00:00:00.000Z'));
    remote.rows.set('a', ch('a', '2026-10-01T00:00:00.000Z'));
    expect(await syncChallenges(base, remote)).toEqual({ pushed: 0, pulled: 0 });
  });
});

describe('SyncedChallengeStore', () => {
  it('writes locally even when the push fails, and the next sync pushes it', async () => {
    const remote = new FakeRemote(); remote.fail = true;
    const store = new SyncedChallengeStore(new MemoryStore(), remote);
    await store.upsert(ch('a', '2026-10-01T00:00:00.000Z'));
    expect(await store.get('a')).not.toBeNull();
    remote.fail = false;
    expect(await store.sync()).toEqual({ pushed: 1, pulled: 0 });
  });
});

describe('server mapping', () => {
  it('round-trips core columns + params, normalising Postgres timestamps', () => {
    const c = ch('a', '2026-10-01T12:00:00.000Z', { prevTargetKcal: 2300, lastRecomputeDate: '2026-10-08' });
    const row = challengeToServer(c);
    expect(row.params).toEqual({ goalWeightKg: 75, horizonDays: 180, startWeightKg: 85, mode: 'lose', prevTargetKcal: 2300, lastRecomputeDate: '2026-10-08' });
    const back = challengeFromServer({ ...row, client_updated_at: '2026-10-01 12:00:00+00:00', created_at_client: '2026-10-01T00:00:00+00:00' });
    expect(back).toEqual(c);
  });
});
