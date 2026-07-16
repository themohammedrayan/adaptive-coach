import * as SQLite from 'expo-sqlite';
import type { EngineResult, EngineState, IsoDate, Mode, Profile } from '../engine';
import { DEFAULT_REMINDER_CONFIG } from './constants';
import type { DashboardStore } from './store';
import type { ReminderConfig, ReminderKind } from './types';

interface ProfileRow {
  sex: string;
  age: number;
  height_cm: number;
  activity_factor: number;
  goal_weight_kg: number;
  horizon_days: number;
  start_date: string;
  mode: string;
}

function profileFromDb(r: ProfileRow): Profile {
  return {
    sex: r.sex as Profile['sex'],
    age: r.age,
    heightCm: r.height_cm,
    activityFactor: r.activity_factor,
    goalWeightKg: r.goal_weight_kg,
    horizonDays: r.horizon_days,
    startDate: r.start_date,
    mode: r.mode as Mode,
  };
}

interface EngineStateRow {
  prev_target_kcal: number | null;
  mode: string;
  last_recompute_date: string | null;
  start_weight_kg: number;
}

function engineStateFromDb(r: EngineStateRow): EngineState {
  return {
    prevTargetKcal: r.prev_target_kcal,
    mode: r.mode as Mode,
    lastRecomputeDate: r.last_recompute_date,
    startWeightKg: r.start_weight_kg,
  };
}

interface ReminderConfigRow {
  kind: string;
  enabled: number;
  hour: number | null;
  minute: number | null;
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
        activity_factor real not null,
        goal_weight_kg real not null,
        horizon_days integer not null,
        start_date text not null,
        mode text not null
      );

      create table if not exists engine_state (
        id integer primary key check (id = 1),
        prev_target_kcal real,
        mode text not null,
        last_recompute_date text,
        start_weight_kg real not null
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
    return new SQLiteStore(db);
  }

  async getProfile(): Promise<Profile | null> {
    const r = await this.db.getFirstAsync<ProfileRow>('select * from profile where id = 1');
    return r ? profileFromDb(r) : null;
  }

  async setProfile(profile: Profile): Promise<void> {
    await this.db.runAsync(
      `insert into profile
         (id, sex, age, height_cm, activity_factor, goal_weight_kg, horizon_days, start_date, mode)
       values (1, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         sex = excluded.sex, age = excluded.age, height_cm = excluded.height_cm,
         activity_factor = excluded.activity_factor, goal_weight_kg = excluded.goal_weight_kg,
         horizon_days = excluded.horizon_days, start_date = excluded.start_date, mode = excluded.mode`,
      profile.sex,
      profile.age,
      profile.heightCm,
      profile.activityFactor,
      profile.goalWeightKg,
      profile.horizonDays,
      profile.startDate,
      profile.mode,
    );
  }

  async getEngineState(): Promise<EngineState | null> {
    const r = await this.db.getFirstAsync<EngineStateRow>(
      'select * from engine_state where id = 1',
    );
    return r ? engineStateFromDb(r) : null;
  }

  async setEngineState(state: EngineState): Promise<void> {
    await this.db.runAsync(
      `insert into engine_state (id, prev_target_kcal, mode, last_recompute_date, start_weight_kg)
       values (1, ?, ?, ?, ?)
       on conflict (id) do update set
         prev_target_kcal = excluded.prev_target_kcal, mode = excluded.mode,
         last_recompute_date = excluded.last_recompute_date, start_weight_kg = excluded.start_weight_kg`,
      state.prevTargetKcal,
      state.mode,
      state.lastRecomputeDate,
      state.startWeightKg,
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
}
