import { supabase } from '../lib/supabase';
import type { ChallengeRemote } from './sync';
import type { Challenge } from './types';

/** Server column mapping for public.challenges (user_id defaults to auth.uid()). */
interface ServerChallengeRow {
  external_id: string;
  domain: string;
  status: string;
  is_primary: boolean;
  start_date: string;
  params: Record<string, unknown>;
  created_at_client: string;
  client_updated_at: string;
}

const CORE_KEYS = ['id', 'domain', 'status', 'isPrimary', 'startDate', 'createdAt', 'updatedAt'] as const;

export function challengeToServer(c: Challenge): ServerChallengeRow {
  const params: Record<string, unknown> = { ...c };
  for (const k of CORE_KEYS) delete params[k];
  return {
    external_id: c.id,
    domain: c.domain,
    status: c.status,
    is_primary: c.isPrimary,
    start_date: c.startDate,
    params,
    created_at_client: c.createdAt,
    client_updated_at: c.updatedAt,
  };
}

/** Postgres returns timestamptz as "+00:00"; normalise to the client's toISOString() form so LWW string compares stay valid. */
function iso(ts: string): string {
  return new Date(ts).toISOString();
}

export function challengeFromServer(r: ServerChallengeRow): Challenge {
  return {
    ...(r.params as object),
    id: r.external_id,
    domain: r.domain,
    status: r.status,
    isPrimary: r.is_primary,
    startDate: r.start_date,
    createdAt: iso(r.created_at_client),
    updatedAt: iso(r.client_updated_at),
  } as Challenge;
}

export class SupabaseChallengeRemote implements ChallengeRemote {
  async fetchAll(): Promise<Challenge[]> {
    const { data, error } = await supabase
      .from('challenges')
      .select('external_id,domain,status,is_primary,start_date,params,created_at_client,client_updated_at');
    if (error) throw error;
    return (data as ServerChallengeRow[]).map(challengeFromServer);
  }

  async upsert(challenges: Challenge[]): Promise<void> {
    if (challenges.length === 0) return;
    const { error } = await supabase
      .from('challenges')
      .upsert(challenges.map(challengeToServer), { onConflict: 'user_id,external_id' });
    if (error) throw error;
  }
}
