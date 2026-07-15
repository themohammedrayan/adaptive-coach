import type { IsoDate } from '../engine';
import type { BodyMetricsStore } from './store';
import type { BodyMetricRow, MetricType } from './types';

/** In-memory store for tests. Mirrors the SQLite implementation's semantics. */
export class MemoryStore implements BodyMetricsStore {
  rows = new Map<string, BodyMetricRow>();
  kv = new Map<string, string>();

  private key(source: string, externalId: string): string {
    return `${source}:${externalId}`;
  }

  async upsert(row: BodyMetricRow): Promise<void> {
    const key = this.key(row.source, row.externalId);
    const existing = this.rows.get(key);
    this.rows.set(key, existing ? { ...row, ingestedAt: existing.ingestedAt } : row);
  }

  async get(source: BodyMetricRow['source'], externalId: string): Promise<BodyMetricRow | null> {
    return this.rows.get(this.key(source, externalId)) ?? null;
  }

  async softDelete(
    source: BodyMetricRow['source'],
    externalId: string,
    deletedAtUtc: string,
  ): Promise<boolean> {
    const key = this.key(source, externalId);
    const row = this.rows.get(key);
    if (!row) return false;
    this.rows.set(key, { ...row, deletedAt: deletedAtUtc, pendingPush: true });
    return true;
  }

  async listByType(
    metricType: MetricType,
    range: { start: IsoDate; end: IsoDate },
  ): Promise<BodyMetricRow[]> {
    return [...this.rows.values()]
      .filter(
        (r) =>
          r.metricType === metricType &&
          r.deletedAt === null &&
          r.localDate >= range.start &&
          r.localDate <= range.end,
      )
      .sort((a, b) => a.recordedAtUtc.localeCompare(b.recordedAtUtc));
  }

  async listPendingPush(): Promise<BodyMetricRow[]> {
    return [...this.rows.values()].filter((r) => r.pendingPush);
  }

  async markPushed(ids: string[]): Promise<void> {
    for (const row of this.rows.values()) {
      if (ids.includes(row.id)) {
        this.rows.set(this.key(row.source, row.externalId), { ...row, pendingPush: false });
      }
    }
  }

  async getKV(key: string): Promise<string | null> {
    return this.kv.get(key) ?? null;
  }

  async setKV(key: string, value: string): Promise<void> {
    this.kv.set(key, value);
  }
}
