import { MemoryStore as ChallengeMemoryStore } from '../../challenges/store.memory';
import { MemoryStore as DashboardMemoryStore } from '../../dashboard/store.memory';
import { MemoryStore as DataSyncMemoryStore } from '../../data-sync/store.memory';
import { MemoryStore as FoodLogMemoryStore } from '../../food-log/store.memory';
import { RESET_REMOTE_TABLES, resetUserDataCore, type ResetAuth, type ResetRemote } from '../resetAccount';

const USER_ID = 'user-1';

class FakeAuth implements ResetAuth {
  signedOut = false;
  constructor(private userId: string | null = USER_ID) {}

  async getUserId(): Promise<string | null> {
    return this.userId;
  }

  async signOut(): Promise<void> {
    this.signedOut = true;
  }
}

class FakeRemote implements ResetRemote {
  deleted: { table: string; userId: string }[] = [];

  async deleteAllFrom(table: string, userId: string): Promise<void> {
    this.deleted.push({ table, userId });
  }
}

function stores() {
  return {
    dashboard: new DashboardMemoryStore(),
    foodLog: new FoodLogMemoryStore(),
    dataSync: new DataSyncMemoryStore(),
    challenge: new ChallengeMemoryStore(),
  };
}

describe('resetUserDataCore', () => {
  it('throws and touches nothing when no user is signed in', async () => {
    const auth = new FakeAuth(null);
    const remote = new FakeRemote();
    const s = stores();
    const cancelAllReminders = jest.fn(async () => {});

    await expect(resetUserDataCore(auth, remote, s, cancelAllReminders)).rejects.toThrow(
      'no signed-in user',
    );

    expect(remote.deleted).toHaveLength(0);
    expect(cancelAllReminders).not.toHaveBeenCalled();
    expect(auth.signedOut).toBe(false);
  });

  it('deletes every remote table for the signed-in user, clears local stores, cancels reminders, and signs out', async () => {
    const auth = new FakeAuth();
    const remote = new FakeRemote();
    const s = stores();
    await s.dashboard.setProfile({ sex: 'male', age: 30, heightCm: 180, activityFactor: 1.4 });
    await s.foodLog.upsertFood({
      id: 'food-1',
      name: 'Rice',
      proteinPer100g: 2,
      carbPer100g: 28,
      fatPer100g: 0,
      fiberPer100g: 0,
      kcalPer100g: 130,
      defaultUnitId: 'g',
      macrosComplete: true,
      isCustom: true,
      createdAt: '2026-07-01T00:00:00.000Z',
      archivedAt: null,
      updatedAt: '2026-07-01T00:00:00.000Z',
      pendingPush: false,
    });
    await s.dataSync.upsert({
      id: 'weight-1',
      metricType: 'weight',
      valueSI: 80,
      source: 'manual',
      externalId: 'ext-1',
      dataOrigin: null,
      recordedAtUtc: '2026-07-01T00:00:00.000Z',
      localDate: '2026-07-01',
      ingestedAt: '2026-07-01T00:00:00.000Z',
      deletedAt: null,
      pendingPush: false,
    });
    await s.challenge.upsert({
      id: 'challenge-1',
      domain: 'weight',
      status: 'active',
      isPrimary: true,
      startDate: '2026-07-01',
      goalWeightKg: 75,
      horizonDays: 180,
      startWeightKg: 80,
      mode: 'lose',
      prevTargetKcal: null,
      lastRecomputeDate: null,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
    const cancelAllReminders = jest.fn(async () => {});

    await resetUserDataCore(auth, remote, s, cancelAllReminders);

    expect(remote.deleted.map((d) => d.table).sort()).toEqual([...RESET_REMOTE_TABLES].sort());
    expect(remote.deleted.every((d) => d.userId === USER_ID)).toBe(true);

    expect(await s.dashboard.getProfile()).toBeNull();
    expect(await s.foodLog.listFoods()).toEqual([]);
    expect(await s.dataSync.listByType('weight', { start: '2026-01-01', end: '2026-12-31' })).toEqual([]);
    expect(await s.challenge.list('weight')).toEqual([]);

    expect(cancelAllReminders).toHaveBeenCalledTimes(1);
    expect(auth.signedOut).toBe(true);
  });

  it('aborts before touching local stores when a remote delete fails', async () => {
    const auth = new FakeAuth();
    const remote: ResetRemote = {
      deleteAllFrom: async () => {
        throw new Error('network down');
      },
    };
    const s = stores();
    await s.dashboard.setProfile({ sex: 'female', age: 25, heightCm: 165, activityFactor: 1.2 });
    const cancelAllReminders = jest.fn(async () => {});

    await expect(resetUserDataCore(auth, remote, s, cancelAllReminders)).rejects.toThrow('network down');

    expect(await s.dashboard.getProfile()).not.toBeNull();
    expect(cancelAllReminders).not.toHaveBeenCalled();
    expect(auth.signedOut).toBe(false);
  });
});
