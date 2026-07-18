import {
  createChallenge,
  deleteChallenge,
  listChallenges,
  pauseChallenge,
  restartChallenge,
  resumeChallenge,
  setPrimaryChallenge,
} from '../crud';
import { MemoryStore } from '../store.memory';

const NOW = '2026-07-15T10:00:00.000Z';
const TODAY = '2026-07-15';

async function seedActive(store: MemoryStore, goalWeightKg = 80, startWeightKg = 100) {
  return createChallenge(store, { domain: 'weight', goalWeightKg, startWeightKg, horizonDays: 180 }, NOW, TODAY);
}

describe('createChallenge', () => {
  it('the first challenge in a domain is auto-primary', async () => {
    const store = new MemoryStore();
    const c = await seedActive(store);
    expect(c.isPrimary).toBe(true);
    expect(c.status).toBe('active');
    expect(c.mode).toBe('lose');
  });

  it('a second challenge is not auto-primary', async () => {
    const store = new MemoryStore();
    await seedActive(store);
    const second = await createChallenge(
      store,
      { domain: 'weight', goalWeightKg: 90, startWeightKg: 95, horizonDays: 90 },
      NOW,
      TODAY,
    );
    expect(second.isPrimary).toBe(false);
  });

  it('derives horizonDays from a weekly-pace input', async () => {
    const store = new MemoryStore();
    const c = await createChallenge(
      store,
      { domain: 'weight', goalWeightKg: 80, startWeightKg: 100, targetWeeklyRateKg: 0.5 },
      NOW,
      TODAY,
    );
    expect(c.horizonDays).toBe(280);
  });

  it('new challenge starts with null engine bookkeeping (cold start)', async () => {
    const store = new MemoryStore();
    const c = await seedActive(store);
    expect(c.prevTargetKcal).toBeNull();
    expect(c.lastRecomputeDate).toBeNull();
  });
});

describe('pauseChallenge', () => {
  it('pausing the primary auto-promotes the oldest remaining active challenge', async () => {
    const store = new MemoryStore();
    const first = await seedActive(store);
    const second = await createChallenge(
      store,
      { domain: 'weight', goalWeightKg: 90, startWeightKg: 95, horizonDays: 90 },
      NOW,
      TODAY,
    );
    await pauseChallenge(store, first.id, NOW);

    expect((await store.get(first.id))!.status).toBe('paused');
    expect((await store.get(first.id))!.isPrimary).toBe(false);
    expect((await store.get(second.id))!.isPrimary).toBe(true);
    expect(await store.getPrimary('weight')).toMatchObject({ id: second.id });
  });

  it('pausing the only active challenge leaves no primary', async () => {
    const store = new MemoryStore();
    const only = await seedActive(store);
    await pauseChallenge(store, only.id, NOW);
    expect(await store.getPrimary('weight')).toBeNull();
  });

  it('pausing a non-primary challenge does not disturb the current primary', async () => {
    const store = new MemoryStore();
    const first = await seedActive(store);
    const second = await createChallenge(
      store,
      { domain: 'weight', goalWeightKg: 90, startWeightKg: 95, horizonDays: 90 },
      NOW,
      TODAY,
    );
    await pauseChallenge(store, second.id, NOW);
    expect((await store.get(first.id))!.isPrimary).toBe(true);
  });
});

describe('resumeChallenge', () => {
  it('resuming a paused challenge does not auto-become primary', async () => {
    const store = new MemoryStore();
    const first = await seedActive(store);
    const second = await createChallenge(
      store,
      { domain: 'weight', goalWeightKg: 90, startWeightKg: 95, horizonDays: 90 },
      NOW,
      TODAY,
    );
    await pauseChallenge(store, first.id, NOW); // second becomes primary
    const resumed = await resumeChallenge(store, first.id, NOW);
    expect(resumed!.status).toBe('active');
    expect(resumed!.isPrimary).toBe(false);
    expect((await store.get(second.id))!.isPrimary).toBe(true);
  });
});

describe('setPrimaryChallenge', () => {
  it('promotes the target and demotes the previous primary', async () => {
    const store = new MemoryStore();
    const first = await seedActive(store);
    const second = await createChallenge(
      store,
      { domain: 'weight', goalWeightKg: 90, startWeightKg: 95, horizonDays: 90 },
      NOW,
      TODAY,
    );
    await setPrimaryChallenge(store, second.id, NOW);
    expect((await store.get(first.id))!.isPrimary).toBe(false);
    expect((await store.get(second.id))!.isPrimary).toBe(true);
  });

  it('refuses to promote a non-active challenge', async () => {
    const store = new MemoryStore();
    const first = await seedActive(store);
    await pauseChallenge(store, first.id, NOW);
    expect(await setPrimaryChallenge(store, first.id, NOW)).toBeNull();
  });
});

describe('deleteChallenge', () => {
  it('deleting the primary auto-promotes the oldest remaining active challenge', async () => {
    const store = new MemoryStore();
    const first = await seedActive(store);
    const second = await createChallenge(
      store,
      { domain: 'weight', goalWeightKg: 90, startWeightKg: 95, horizonDays: 90 },
      NOW,
      TODAY,
    );
    await deleteChallenge(store, first.id, NOW);
    expect((await store.get(first.id))!.status).toBe('deleted');
    expect((await store.get(second.id))!.isPrimary).toBe(true);
  });

  it('a deleted challenge is excluded from the default list', async () => {
    const store = new MemoryStore();
    const first = await seedActive(store);
    await deleteChallenge(store, first.id, NOW);
    expect(await listChallenges(store, 'weight')).toHaveLength(0);
  });
});

describe('restartChallenge', () => {
  it('resets startDate/startWeightKg/engine bookkeeping but keeps the goal', async () => {
    const store = new MemoryStore();
    const c = await seedActive(store);
    // Simulate a few weeks of recomputes having happened.
    await store.upsert({ ...c, prevTargetKcal: 1900, lastRecomputeDate: '2026-08-01' });

    const restarted = await restartChallenge(store, c.id, NOW, '2026-09-01', 97.5);
    expect(restarted!.startDate).toBe('2026-09-01');
    expect(restarted!.startWeightKg).toBe(97.5);
    expect(restarted!.prevTargetKcal).toBeNull();
    expect(restarted!.lastRecomputeDate).toBeNull();
    expect(restarted!.goalWeightKg).toBe(c.goalWeightKg);
    expect(restarted!.horizonDays).toBe(c.horizonDays);
  });
});
