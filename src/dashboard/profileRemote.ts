import { supabase } from '../lib/supabase';
import type { ProfileRemote, RemoteProfile } from './profileSync';

/** Server column mapping for public.person_profiles (user_id defaults to auth.uid()). */
interface ServerProfileRow {
  sex: 'male' | 'female';
  age: number;
  height_cm: number;
  activity_factor: number;
  client_updated_at: string;
}

export class SupabaseProfileRemote implements ProfileRemote {
  async fetch(): Promise<RemoteProfile | null> {
    const { data, error } = await supabase
      .from('person_profiles')
      .select('sex,age,height_cm,activity_factor,client_updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as ServerProfileRow;
    return {
      profile: { sex: r.sex, age: r.age, heightCm: Number(r.height_cm), activityFactor: Number(r.activity_factor) },
      // Postgres returns "+00:00"; normalise to toISOString() form for LWW string compares.
      updatedAt: new Date(r.client_updated_at).toISOString(),
    };
  }

  async upsert({ profile, updatedAt }: RemoteProfile): Promise<void> {
    const row: ServerProfileRow = {
      sex: profile.sex,
      age: profile.age,
      height_cm: profile.heightCm,
      activity_factor: profile.activityFactor,
      client_updated_at: updatedAt,
    };
    const { error } = await supabase.from('person_profiles').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
  }
}
