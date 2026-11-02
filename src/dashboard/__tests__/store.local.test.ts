import { LocalStorageStore as ChallengeLocalStore } from '../../challenges/store.local';
import type { Challenge } from '../../challenges/types';
import { LocalStorageStore } from '../store.local';

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('web localStorage stores', () => {
  const g = globalThis as unknown as { localStorage?: FakeStorage };
  beforeEach(() => { g.localStorage = new FakeStorage(); });
  afterEach(() => { delete g.localStorage; });

  it('dashboard profile survives a new instance (page reload) and clearAll wipes it', async () => {
    const profile = { sex: 'male' as const, age: 30, heightCm: 180, activityFactor: 1.4 };
    await new LocalStorageStore().setProfile(profile);
    const reloaded = new LocalStorageStore();
    expect(await reloaded.getProfile()).toEqual(profile);
    await reloaded.clearAll();
    expect(await new LocalStorageStore().getProfile()).toBeNull();
  });

  it('challenges survive a new instance', async () => {
    const c = { id: 'c1', domain: 'weight', status: 'active', isPrimary: true, createdAt: '2026-11-01T00:00:00Z' } as unknown as Challenge;
    await new ChallengeLocalStore().upsert(c);
    expect(await new ChallengeLocalStore().get('c1')).toEqual(c);
  });

  it('degrades to in-memory when storage is unavailable', async () => {
    delete g.localStorage;
    const s = new LocalStorageStore();
    await s.setProfile({ sex: 'female', age: 25, heightCm: 165, activityFactor: 1.2 });
    expect(await s.getProfile()).not.toBeNull();
  });
});
