import { buildMeasurementSeries, canonicalDailyWeight } from '../canonical';
import { addManualMetric } from '../manual';
import { normalizeRecord, offsetLocalDate } from '../normalize';
import { KV } from '../store';
import { MemoryStore } from '../store.memory';
import {
  FIRST_RUN_BACKFILL_DAYS,
  syncOnOpen,
  type HealthConnectAdapter,
  type RemoteStore,
  type SyncDeps,
} from '../sync';
import type { BodyMetricRow, HCRecord, MetricType, SdkAvailability } from '../types';

const NOW = '2026-07-15T10:00:00.000Z';
const IST = offsetLocalDate(330); // UTC+05:30, the device timezone in these tests

const hcWeight = (externalId: string, recordedAtUtc: string, kg: number): HCRecord => ({
  externalId,
  dataOrigin: 'com.sec.android.app.shealth',
  recordedAtUtc,
  metricType: 'weight',
  value: kg,
  unit: 'kg',
});

class FakeHC implements HealthConnectAdapter {
  status: SdkAvailability = 'available';
  granted: MetricType[] = ['weight', 'body_fat'];
  records: HCRecord[] = [];
  deletedExternalIds: string[] = [];
  nextChangesToken: string | null = 'token-1';
  lastReadOpts: { changesToken: string | null; sinceIso: string; untilIso: string } | null = null;

  async getSdkStatus() {
    return this.status;
  }
  async ensurePermissions() {
    return this.granted;
  }
  async read(opts: { changesToken: string | null; sinceIso: string; untilIso: string }) {
    this.lastReadOpts = opts;
    return {
      records: this.records,
      deletedExternalIds: this.deletedExternalIds,
      nextChangesToken: this.nextChangesToken,
    };
  }
  async mintChangesToken() {
    return this.nextChangesToken;
  }
}

class FakeRemote implements RemoteStore {
  pushed: BodyMetricRow[][] = [];
  pullRows: BodyMetricRow[] = [];
  failing = false;

  async pushUpserts(rows: BodyMetricRow[]) {
    if (this.failing) throw new Error('network down');
    this.pushed.push(rows);
  }
  async pullUpdatedSince() {
    if (this.failing) throw new Error('network down');
    return this.pullRows;
  }
}

function makeDeps(): { deps: SyncDeps; hc: FakeHC; store: MemoryStore; remote: FakeRemote } {
  const hc = new FakeHC();
  const store = new MemoryStore();
  const remote = new FakeRemote();
  return { deps: { hc, store, remote, toLocalDate: IST }, hc, store, remote };
}

describe('syncOnOpen — BRD §12 acceptance tests', () => {
  it('1. HC absent → manual-only mode, no crash', async () => {
    const { deps, hc, store } = makeDeps();
    hc.status = 'unavailable';
    const res = await syncOnOpen(deps, NOW);
    expect(res.ran).toBe(true);
    expect(res.hc).toBe('unavailable');

    // manual entry still fully works
    await addManualMetric(
      store,
      { metricType: 'weight', valueSI: 82.5, recordedAtUtc: NOW },
      IST,
      NOW,
    );
    expect(canonicalDailyWeight(await store.listByType('weight', wideRange()), '2026-07-15'))
      .toEqual({ weightKg: 82.5, source: 'manual' });
  });

  it('2. permission denied → manual fallback; re-prompt (next sync) works', async () => {
    const { deps, hc } = makeDeps();
    hc.granted = ['body_fat']; // weight missing = the only must-have
    const res = await syncOnOpen(deps, NOW);
    expect(res.hc).toBe('permission_denied');
    expect(res.upserted).toBe(0);

    hc.granted = ['weight'];
    hc.records = [hcWeight('a', '2026-07-15T02:00:00.000Z', 83)];
    const res2 = await syncOnOpen(deps, NOW, { force: true });
    expect(res2.hc).toBe('synced');
    expect(res2.upserted).toBe(1);
  });

  it('3. first run backfills 60–90 days (no changes token yet)', async () => {
    const { deps, hc } = makeDeps();
    await syncOnOpen(deps, NOW);
    expect(hc.lastReadOpts!.changesToken).toBeNull();
    const sinceMs = Date.parse(NOW) - Date.parse(hc.lastReadOpts!.sinceIso);
    expect(sinceMs / 86_400_000).toBe(FIRST_RUN_BACKFILL_DAYS);
    // token stored → next sync is incremental
    const { deps: d2, hc: h2, store: s2 } = makeDeps();
    await s2.setKV(KV.hcChangesToken, 'token-0');
    await syncOnOpen(d2, NOW);
    expect(h2.lastReadOpts!.changesToken).toBe('token-0');
  });

  it('4. re-syncing the same record upserts — zero duplicates', async () => {
    const { deps, hc, store } = makeDeps();
    hc.records = [hcWeight('rec-1', '2026-07-15T02:00:00.000Z', 83)];
    await syncOnOpen(deps, NOW);
    hc.records = [hcWeight('rec-1', '2026-07-15T02:00:00.000Z', 83.2)]; // same id, edited value
    await syncOnOpen(deps, NOW, { force: true });

    const rows = await store.listByType('weight', wideRange());
    expect(rows).toHaveLength(1);
    expect(rows[0].valueSI).toBe(83.2);
  });

  it('5. two HC weights same day → canonical = earliest', async () => {
    const { deps, hc, store } = makeDeps();
    hc.records = [
      hcWeight('am', '2026-07-15T01:30:00.000Z', 83.0), // 07:00 IST
      hcWeight('pm', '2026-07-15T05:30:00.000Z', 84.1), // 11:00 IST, still before `now`
    ];
    await syncOnOpen(deps, NOW, { force: true });
    const rows = await store.listByType('weight', wideRange());
    expect(canonicalDailyWeight(rows, '2026-07-15')).toEqual({
      weightKg: 83.0,
      source: 'health_connect',
    });
    expect(canonicalDailyWeight(rows, '2026-07-15', 'latest')!.weightKg).toBe(84.1);
  });

  it('6. manual + HC same day → both rows kept, canonical = manual', async () => {
    const { deps, hc, store } = makeDeps();
    hc.records = [hcWeight('a', '2026-07-15T01:30:00.000Z', 83.0)];
    await syncOnOpen(deps, NOW);
    await addManualMetric(
      store,
      { metricType: 'weight', valueSI: 82.4, recordedAtUtc: '2026-07-15T03:00:00.000Z' },
      IST,
      NOW,
    );

    expect(store.rows.size).toBe(2); // both kept for audit
    const rows = await store.listByType('weight', wideRange());
    expect(canonicalDailyWeight(rows, '2026-07-15')).toEqual({
      weightKg: 82.4,
      source: 'manual',
    });
  });

  it('7. a 23:30 local reading belongs to that local day', async () => {
    // 18:00 UTC = 23:30 IST on the 14th; 20:00 UTC = 01:30 IST on the 15th
    const late = normalizeRecord(hcWeight('x', '2026-07-14T18:00:00.000Z', 83), IST, NOW)!;
    const past = normalizeRecord(hcWeight('y', '2026-07-14T20:00:00.000Z', 83), IST, NOW)!;
    expect(late.localDate).toBe('2026-07-14');
    expect(past.localDate).toBe('2026-07-15');
  });

  it('8. deletion via Changes API → soft delete, excluded from canonical', async () => {
    const { deps, hc, store } = makeDeps();
    hc.records = [hcWeight('gone', '2026-07-15T02:00:00.000Z', 83)];
    await syncOnOpen(deps, NOW);

    hc.records = [];
    hc.deletedExternalIds = ['gone'];
    const res = await syncOnOpen(deps, NOW, { force: true });
    expect(res.deleted).toBe(1);

    const row = await store.get('health_connect', 'gone');
    expect(row!.deletedAt).not.toBeNull(); // kept for audit, not hard-deleted
    expect(canonicalDailyWeight(await store.listByType('weight', wideRange()), '2026-07-15')).toBeNull();
  });

  it('9. future-dated records are ignored', async () => {
    const { deps, hc } = makeDeps();
    hc.records = [hcWeight('future', '2026-07-16T09:00:00.000Z', 83)];
    const res = await syncOnOpen(deps, NOW);
    expect(res.upserted).toBe(0);
  });
});

describe('syncOnOpen — throttle, outbox, pull', () => {
  it('throttles within 15 minutes; force bypasses', async () => {
    const { deps } = makeDeps();
    await syncOnOpen(deps, NOW);
    const again = await syncOnOpen(deps, '2026-07-15T10:10:00.000Z');
    expect(again.ran).toBe(false);
    const forced = await syncOnOpen(deps, '2026-07-15T10:10:00.000Z', { force: true });
    expect(forced.ran).toBe(true);
    const later = await syncOnOpen(deps, '2026-07-15T10:26:00.000Z');
    expect(later.ran).toBe(true);
  });

  it('pushes HC and manual rows to the remote, then clears the outbox', async () => {
    const { deps, hc, store, remote } = makeDeps();
    hc.records = [hcWeight('a', '2026-07-15T02:00:00.000Z', 83)];
    await addManualMetric(
      store,
      { metricType: 'weight', valueSI: 82, recordedAtUtc: NOW },
      IST,
      NOW,
    );
    const res = await syncOnOpen(deps, NOW);
    expect(res.pushed).toBe(2);
    expect(remote.pushed[0].map((r) => r.source).sort()).toEqual(['health_connect', 'manual']);
    expect(await store.listPendingPush()).toHaveLength(0);
  });

  it('remote failure leaves the outbox intact and does not block HC ingest', async () => {
    const { deps, hc, store, remote } = makeDeps();
    remote.failing = true;
    hc.records = [hcWeight('a', '2026-07-15T02:00:00.000Z', 83)];
    const res = await syncOnOpen(deps, NOW);
    expect(res.hc).toBe('synced');
    expect(res.upserted).toBe(1);
    expect(res.remoteError).toBe('network down');
    expect(await store.listPendingPush()).toHaveLength(1); // retried next sync
  });

  it('pull upserts remote rows but never clobbers a pending local edit', async () => {
    const { deps, store, remote } = makeDeps();
    const local = await addManualMetric(
      store,
      { metricType: 'weight', valueSI: 82, recordedAtUtc: NOW },
      IST,
      NOW,
    );
    remote.failing = false;
    remote.pullRows = [
      { ...local, valueSI: 99, pendingPush: false }, // stale server copy of the pending row
      {
        id: 'manual:other',
        metricType: 'weight',
        valueSI: 81,
        source: 'manual',
        externalId: 'other',
        dataOrigin: null,
        recordedAtUtc: '2026-07-10T03:00:00.000Z',
        localDate: '2026-07-10',
        ingestedAt: NOW,
        deletedAt: null,
        pendingPush: false,
      },
    ];
    // push fails first so `local` stays pending, but pull succeeds
    remote.pushUpserts = async () => {
      throw new Error('push down');
    };
    const res = await syncOnOpen(deps, NOW);
    expect(res.remoteError).toBe('push down');
    expect((await store.get('manual', local.externalId))!.valueSI).toBe(82); // not clobbered
  });
});

describe('normalizeRecord unit conversion', () => {
  it('converts lb→kg, fraction→percent, m→cm', () => {
    const base = { externalId: 'u', dataOrigin: null, recordedAtUtc: NOW };
    expect(
      normalizeRecord({ ...base, metricType: 'weight', value: 180, unit: 'lb' }, IST, NOW)!
        .valueSI,
    ).toBeCloseTo(81.65, 2);
    expect(
      normalizeRecord({ ...base, metricType: 'body_fat', value: 0.24, unit: 'fraction' }, IST, NOW)!
        .valueSI,
    ).toBeCloseTo(24, 6);
    expect(
      normalizeRecord({ ...base, metricType: 'height', value: 1.75, unit: 'm' }, IST, NOW)!
        .valueSI,
    ).toBeCloseTo(175, 6);
  });
});

describe('buildMeasurementSeries', () => {
  it('produces the engine series with gaps omitted and manual override applied', async () => {
    const store = new MemoryStore();
    const mk = (externalId: string, iso: string, kg: number): BodyMetricRow =>
      normalizeRecord(hcWeight(externalId, iso, kg), IST, NOW)!;
    await store.upsert(mk('d1', '2026-07-12T02:00:00.000Z', 84));
    // gap on the 13th
    await store.upsert(mk('d3', '2026-07-14T02:00:00.000Z', 83.5));
    await addManualMetric(
      store,
      { metricType: 'weight', valueSI: 83.2, recordedAtUtc: '2026-07-14T05:00:00.000Z' },
      IST,
      NOW,
    );

    const series = buildMeasurementSeries(
      await store.listByType('weight', { start: '2026-07-12', end: '2026-07-15' }),
      { start: '2026-07-12', end: '2026-07-15' },
    );
    expect(series).toEqual([
      { date: '2026-07-12', weightKg: 84, source: 'health_connect' },
      { date: '2026-07-14', weightKg: 83.2, source: 'manual' },
    ]);
  });
});

function wideRange() {
  return { start: '2026-01-01', end: '2026-12-31' };
}
