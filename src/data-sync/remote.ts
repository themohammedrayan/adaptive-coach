import { supabase } from '../lib/supabase';
import type { RemoteStore } from './sync';
import type { BodyMetricRow, MetricType } from './types';

/** Server column mapping for public.body_metrics (user_id defaults to auth.uid()). */
interface ServerRow {
  metric_type: string;
  value_si: number;
  source: string;
  external_id: string;
  data_origin: string | null;
  recorded_at_utc: string;
  local_date: string;
  deleted_at: string | null;
  updated_at?: string;
}

function toServer(row: BodyMetricRow): ServerRow {
  return {
    metric_type: row.metricType,
    value_si: row.valueSI,
    source: row.source,
    external_id: row.externalId,
    data_origin: row.dataOrigin,
    recorded_at_utc: row.recordedAtUtc,
    local_date: row.localDate,
    deleted_at: row.deletedAt,
  };
}

function fromServer(r: ServerRow): BodyMetricRow {
  return {
    id: `${r.source}:${r.external_id}`,
    metricType: r.metric_type as MetricType,
    valueSI: Number(r.value_si),
    source: r.source as BodyMetricRow['source'],
    externalId: r.external_id,
    dataOrigin: r.data_origin,
    recordedAtUtc: r.recorded_at_utc,
    localDate: r.local_date,
    ingestedAt: r.updated_at ?? r.recorded_at_utc,
    deletedAt: r.deleted_at,
    pendingPush: false,
  };
}

export class SupabaseRemote implements RemoteStore {
  async pushUpserts(rows: BodyMetricRow[]): Promise<void> {
    const { error } = await supabase
      .from('body_metrics')
      .upsert(rows.map(toServer), { onConflict: 'user_id,source,external_id' });
    if (error) throw new Error(error.message);
  }

  async pullUpdatedSince(sinceIso: string | null): Promise<BodyMetricRow[]> {
    let query = supabase.from('body_metrics').select('*');
    if (sinceIso !== null) query = query.gt('updated_at', sinceIso);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as ServerRow[]).map(fromServer);
  }
}
