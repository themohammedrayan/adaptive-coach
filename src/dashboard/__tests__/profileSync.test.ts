import { PROFILE_UPDATED_AT_KEY, SyncedDashboardStore, syncProfile, type ProfileRemote, type RemoteProfile, type SyncKV } from '../profileSync';
import { MemoryStore } from '../store.memory';

const P1 = { sex: 'male' as const, age: 30, heightCm: 180, activityFactor: 1.4 };
const P2 = { sex: 'male' as const, age: 31, heightCm: 180, activityFactor: 1.55 };

class FakeKV implements SyncKV {
  m = new Map<string, string>();
  async get(k: string) { return this.m.get(k) ?? null; }
  async set(k: string, v: string | null) { if (v === null) this.m.delete(k); else this.m.set(k, v); }
}
class FakeRemote implements ProfileRemote {
  row: RemoteProfile | null = null;
  fail = false;
  async fetch() { if (this.fail) throw new Error('offline'); return this.row; }
  async upsert(r: RemoteProfile) { if (this.fail) throw new Error('offline'); this.row = r; }
}

describe('syncProfile', () => {
  it('uploads an unstamped pre-sync phone profile and stamps it', async () => {
    const base = new MemoryStore(); const kv = new FakeKV(); const remote = new FakeRemote();
    base.profile = P1;
    expect(await syncProfile(base, remote, kv)).toBe('pushed');
    expect(remote.row!.profile).toEqual(P1);
    expect(await kv.get(PROFILE_UPDATED_AT_KEY)).toBe(remote.row!.updatedAt);
  });

  it('pulls onto a fresh device', async () => {
    const base = new MemoryStore(); const kv = new FakeKV(); const remote = new FakeRemote();
    remote.row = { profile: P1, updatedAt: '2026-10-01T00:00:00.000Z' };
    expect(await syncProfile(base, remote, kv)).toBe('pulled');
    expect(base.profile).toEqual(P1);
  });

  it('remote beats an unstamped local profile', async () => {
    const base = new MemoryStore(); const kv = new FakeKV(); const remote = new FakeRemote();
    base.profile = P1;
    remote.row = { profile: P2, updatedAt: '2026-10-01T00:00:00.000Z' };
    expect(await syncProfile(base, remote, kv)).toBe('pulled');
    expect(base.profile).toEqual(P2);
  });

  it('newer local edit is pushed; equal is unchanged; nothing anywhere is empty', async () => {
    const base = new MemoryStore(); const kv = new FakeKV(); const remote = new FakeRemote();
    expect(await syncProfile(base, remote, kv)).toBe('empty');
    base.profile = P2;
    await kv.set(PROFILE_UPDATED_AT_KEY, '2026-10-05T00:00:00.000Z');
    remote.row = { profile: P1, updatedAt: '2026-10-01T00:00:00.000Z' };
    expect(await syncProfile(base, remote, kv)).toBe('pushed');
    expect(remote.row.profile).toEqual(P2);
    expect(await syncProfile(base, remote, kv)).toBe('unchanged');
  });
});

describe('SyncedDashboardStore', () => {
  it('stamps + pushes on setProfile, survives offline, clearAll drops the stamp', async () => {
    const kv = new FakeKV(); const remote = new FakeRemote(); remote.fail = true;
    const store = new SyncedDashboardStore(new MemoryStore(), remote, kv, () => '2026-11-02T10:00:00.000Z');
    await store.setProfile(P1);
    expect(await store.getProfile()).toEqual(P1);
    expect(await kv.get(PROFILE_UPDATED_AT_KEY)).toBe('2026-11-02T10:00:00.000Z');
    remote.fail = false;
    expect(await store.sync()).toBe('pushed');
    await store.clearAll();
    expect(await kv.get(PROFILE_UPDATED_AT_KEY)).toBeNull();
  });
});
