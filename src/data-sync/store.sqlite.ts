import * as SQLite from 'expo-sqlite';
import type { IsoDate } from '../engine';
import type { BodyMetricsStore } from './store';
import type { BodyMetricRow, MetricType } from './types';

interface DbRow {
  id: string;
  metric_type: string;
  value_si: number;
  source: string;
  external_id: string;
  data_origin: string | null;
  recorded_at_utc: string;
  local_date: string;
  ingested_at: string;
  deleted_at: string | null;
  pending_push: number;
}

function fromDb(r: DbRow): BodyMetricRow {
  return {
    id: r.id,
    metricType: r.metric_type as MetricType,
    valueSI: r.value_si,
    source: r.source as BodyMetricRow['source'],
    externalId: r.external_id,
    dataOrigin: r.data_origin,
    recordedAtUtc: r.recorded_at_utc,
    localDate: r.local_date,
    ingestedAt: r.ingested_at,
    deletedAt: r.deleted_at,
    pendingPush: r.pending_push === 1,
  };
}

export class SQLiteStore implements BodyMetricsStore {
  private constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(name = 'adaptive-coach.db'): Promise<SQLiteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync(`
      pragma journal_mode = wal;
      create table if not exists body_metrics (
        id text primary key,
        metric_type text not null,
        value_si real not null,
        source text not null,
        external_id text not null,
        data_origin text,
        recorded_at_utc text not null,
        local_date text not null,
        ingested_at text not null,
        deleted_at text,
        pending_push integer not null default 1,
        unique (source, external_id)
      );
      create index if not exists body_metrics_type_date_idx
        on body_metrics (metric_type, local_date);
      create table if not exists kv (key text primary key, value text not null);
    `);
    return new SQLiteStore(db);
  }

  async upsert(row: BodyMetricRow): Promise<void> {
    await this.db.runAsync(
      `insert into body_metrics
         (id, metric_type, value_si, source, external_id, data_origin,
          recorded_at_utc, local_date, ingested_at, deleted_at, pending_push)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (source, external_id) do update set
         metric_type = excluded.metric_type,
         value_si = excluded.value_si,
         data_origin = excluded.data_origin,
         recorded_at_utc = excluded.recorded_at_utc,
         local_date = excluded.local_date,
         deleted_at = excluded.deleted_at,
         pending_push = excluded.pending_push`,
      row.id,
      row.metricType,
      row.valueSI,
      row.source,
      row.externalId,
      row.dataOrigin,
      row.recordedAtUtc,
      row.localDate,
      row.ingestedAt,
      row.deletedAt,
      row.pendingPush ? 1 : 0,
    );
  }

  async get(source: BodyMetricRow['source'], externalId: string): Promise<BodyMetricRow | null> {
    const r = await this.db.getFirstAsync<DbRow>(
      'select * from body_metrics where source = ? and external_id = ?',
      source,
      externalId,
    );
    return r ? fromDb(r) : null;
  }

  async softDelete(
    source: BodyMetricRow['source'],
    externalId: string,
    deletedAtUtc: string,
  ): Promise<boolean> {
    const res = await this.db.runAsync(
      'update body_metrics set deleted_at = ?, pending_push = 1 where source = ? and external_id = ?',
      deletedAtUtc,
      source,
      externalId,
    );
    return res.changes > 0;
  }

  async listByType(
    metricType: MetricType,
    range: { start: IsoDate; end: IsoDate },
  ): Promise<BodyMetricRow[]> {
    const rows = await this.db.getAllAsync<DbRow>(
      `select * from body_metrics
       where metric_type = ? and deleted_at is null and local_date between ? and ?
       order by recorded_at_utc asc`,
      metricType,
      range.start,
      range.end,
    );
    return rows.map(fromDb);
  }

  async listPendingPush(): Promise<BodyMetricRow[]> {
    const rows = await this.db.getAllAsync<DbRow>(
      'select * from body_metrics where pending_push = 1',
    );
    return rows.map(fromDb);
  }

  async markPushed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `update body_metrics set pending_push = 0 where id in (${placeholders})`,
      ...ids,
    );
  }

  async getKV(key: string): Promise<string | null> {
    const r = await this.db.getFirstAsync<{ value: string }>(
      'select value from kv where key = ?',
      key,
    );
    return r?.value ?? null;
  }

  async setKV(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'insert into kv (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
      key,
      value,
    );
  }
}
