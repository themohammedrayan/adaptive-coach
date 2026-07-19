import * as SQLite from 'expo-sqlite';
import type { EngineResult, IsoDate, Mode } from '../engine';
import { DEFAULT_REMINDER_CONFIG } from './constants';
import type { DashboardStore } from './store';
import type { PersonProfile, ReminderConfig, ReminderKind } from './types';

interface ProfileRow {
  sex: string;
  age: number;
  height_cm: number;
  activity_factor: number;
}

function profileFromDb(r: ProfileRow): PersonProfile {
  return {
    sex: r.sex as PersonProfile['sex'],
    age: r.age,
    heightCm: r.height_cm,
    activityFactor: r.activity_factor,
  };
}

interface ReminderConfigRow {
  kind: string;
  enabled: number;
  hour: number | null;
  minute: number | null;
}

interface LegacyProfileRow {
  sex: string;
  age: number;
  height_cm: number;
  activity_factor: number;
  goal_weight_kg: number;
  horizon_days: number;
  start_date: string;
  mode: string;
}

interface LegacyEngineStateRow {
  prev_target_kcal: number | null;
  last_recompute_date: string | null;
  start_weight_kg: number;
}

export class SQLiteStore implements DashboardStore {
  private constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(name = 'adaptive-coach.db'): Promise<SQLiteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync(`
      pragma journal_mode = wal;

      create table if not exists profile (
        id integer primary key check (id = 1),
        sex text not null,
        age integer not null,
        height_cm real not null,
        activity_factor real not null
      );

      create table if not exists engine_result (
        id integer primary key check (id = 1),
        computed_at text not null,
        result_json text not null
      );

      create table if not exists reminder_config (
        kind text primary key,
        enabled integer not null default 1,
        hour integer,
        minute integer
      );
    `);
    await SQLiteStore.migrateLegacyProfileIfNeeded(db, name);
    return new SQLiteStore(db);
  }

  /**
   * One-time migration for installs from before the Challenge rework: the
   * single-row `profile`/`engine_state` tables used to also carry goal data
   * (goalWeightKg/horizonDays/startDate/mode/startWeightKg/prevTargetKcal/
   * lastRecomputeDate). That goal data now lives on a primary Challenge row
   * instead — this preserves an existing user's in-progress goal rather than
   * silently dropping it, then rebuilds `profile` down to bio-only columns
   * and drops the now-obsolete `engine_state` table.
   */
  private static async migrateLegacyProfileIfNeeded(db: SQLite.SQLiteDatabase, name: string): Promise<void> {
    const cols = await db.getAllAsync<{ name: string }>('pragma table_info(profile)');
    const hasLegacyGoalColumn = cols.some((c) => c.name === 'goal_weight_kg');
    if (!hasLegacyGoalColumn) return; // fresh install, or already migrated

    const legacyProfile = await db.getFirstAsync<LegacyProfileRow>('select * from profile where id = 1');

    if (legacyProfile !== null) {
      const legacyEngineState = await db.getFirstAsync<LegacyEngineStateRow>(
        'select * from engine_state where id = 1',
      );
      // Same db file — reuses the canonical `challenges` table schema/creation
      // from that module rather than duplicating its DDL here.
      const { SQLiteStore: ChallengeSQLiteStore } = await import('../challenges/store.sqlite');
      const challengeStore = await ChallengeSQLiteStore.open(name);
      const nowUtc = new Date().toISOString();
      await challengeStore.upsert({
        id: `challenge-migrated-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        domain: 'weight',
        status: 'active',
        isPrimary: true,
        startDate: legacyProfile.start_date,
        goalWeightKg: legacyProfile.goal_weight_kg,
        horizonDays: legacyProfile.horizon_days,
        startWeightKg: legacyEngineState?.start_weight_kg ?? legacyProfile.goal_weight_kg,
        mode: legacyProfile.mode as Mode,
        prevTargetKcal: legacyEngineState?.prev_target_kcal ?? null,
        lastRecomputeDate: legacyEngineState?.last_recompute_date ?? null,
        createdAt: nowUtc,
        updatedAt: nowUtc,
      });
    }

    await db.execAsync(`
      create table profile_new (
        id integer primary key check (id = 1),
        sex text not null,
        age integer not null,
        height_cm real not null,
        activity_factor real not null
      );
      insert into profile_new (id, sex, age, height_cm, activity_factor)
        select id, sex, age, height_cm, activity_factor from profile;
      drop table profile;
      alter table profile_new rename to profile;
      drop table if exists engine_state;
    `);
  }

  async getProfile(): Promise<PersonProfile | null> {
    const r = await this.db.getFirstAsync<ProfileRow>('select * from profile where id = 1');
    return r ? profileFromDb(r) : null;
  }

  async setProfile(profile: PersonProfile): Promise<void> {
    await this.db.runAsync(
      `insert into profile (id, sex, age, height_cm, activity_factor)
       values (1, ?, ?, ?, ?)
       on conflict (id) do update set
         sex = excluded.sex, age = excluded.age, height_cm = excluded.height_cm,
         activity_factor = excluded.activity_factor`,
      profile.sex,
      profile.age,
      profile.heightCm,
      profile.activityFactor,
    );
  }

  async getLastResult(): Promise<{ computedAt: IsoDate; result: EngineResult } | null> {
    const r = await this.db.getFirstAsync<{ computed_at: string; result_json: string }>(
      'select * from engine_result where id = 1',
    );
    return r ? { computedAt: r.computed_at, result: JSON.parse(r.result_json) as EngineResult } : null;
  }

  async setLastResult(computedAt: IsoDate, result: EngineResult): Promise<void> {
    await this.db.runAsync(
      `insert into engine_result (id, computed_at, result_json) values (1, ?, ?)
       on conflict (id) do update set computed_at = excluded.computed_at, result_json = excluded.result_json`,
      computedAt,
      JSON.stringify(result),
    );
  }

  async getReminderConfig(): Promise<ReminderConfig> {
    const rows = await this.db.getAllAsync<ReminderConfigRow>('select * from reminder_config');
    if (rows.length === 0) return DEFAULT_REMINDER_CONFIG;
    const byKind = new Map(rows.map((r) => [r.kind, r]));
    const morning = byKind.get('morningWeighIn');
    const evening = byKind.get('eveningLog');
    const coach = byKind.get('coachNoteReady');
    return {
      morningWeighIn: morning
        ? { enabled: morning.enabled === 1, hour: morning.hour ?? 7, minute: morning.minute ?? 0 }
        : DEFAULT_REMINDER_CONFIG.morningWeighIn,
      eveningLog: evening
        ? { enabled: evening.enabled === 1, hour: evening.hour ?? 21, minute: evening.minute ?? 0 }
        : DEFAULT_REMINDER_CONFIG.eveningLog,
      coachNoteReady: coach
        ? { enabled: coach.enabled === 1 }
        : DEFAULT_REMINDER_CONFIG.coachNoteReady,
    };
  }

  async setReminderConfig(config: ReminderConfig): Promise<void> {
    const rows: { kind: ReminderKind; enabled: boolean; hour: number | null; minute: number | null }[] = [
      {
        kind: 'morningWeighIn',
        enabled: config.morningWeighIn.enabled,
        hour: config.morningWeighIn.hour,
        minute: config.morningWeighIn.minute,
      },
      {
        kind: 'eveningLog',
        enabled: config.eveningLog.enabled,
        hour: config.eveningLog.hour,
        minute: config.eveningLog.minute,
      },
      { kind: 'coachNoteReady', enabled: config.coachNoteReady.enabled, hour: null, minute: null },
    ];
    for (const row of rows) {
      await this.db.runAsync(
        `insert into reminder_config (kind, enabled, hour, minute) values (?, ?, ?, ?)
         on conflict (kind) do update set enabled = excluded.enabled, hour = excluded.hour, minute = excluded.minute`,
        row.kind,
        row.enabled ? 1 : 0,
        row.hour,
        row.minute,
      );
    }
  }

  async clearAll(): Promise<void> {
    await this.db.execAsync(`
      delete from profile;
      delete from engine_result;
      delete from reminder_config;
    `);
  }
}
