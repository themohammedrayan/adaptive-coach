import * as SQLite from 'expo-sqlite';
import type { Mode } from '../engine';
import type { ChallengeStore } from './store';
import type { Challenge, ChallengeDomain, ChallengeStatus } from './types';

interface ChallengeRow {
  id: string;
  domain: string;
  status: string;
  is_primary: number;
  start_date: string;
  goal_weight_kg: number;
  horizon_days: number;
  start_weight_kg: number;
  mode: string;
  prev_target_kcal: number | null;
  last_recompute_date: string | null;
  created_at: string;
  updated_at: string;
}

function fromDb(r: ChallengeRow): Challenge {
  return {
    id: r.id,
    domain: r.domain as ChallengeDomain,
    status: r.status as ChallengeStatus,
    isPrimary: r.is_primary === 1,
    startDate: r.start_date,
    goalWeightKg: r.goal_weight_kg,
    horizonDays: r.horizon_days,
    startWeightKg: r.start_weight_kg,
    mode: r.mode as Mode,
    prevTargetKcal: r.prev_target_kcal,
    lastRecomputeDate: r.last_recompute_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SQLiteStore implements ChallengeStore {
  private constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(name = 'adaptive-coach.db'): Promise<SQLiteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync(`
      pragma journal_mode = wal;

      create table if not exists challenges (
        id text primary key,
        domain text not null,
        status text not null,
        is_primary integer not null default 0,
        start_date text not null,
        goal_weight_kg real not null,
        horizon_days integer not null,
        start_weight_kg real not null,
        mode text not null,
        prev_target_kcal real,
        last_recompute_date text,
        created_at text not null,
        updated_at text not null
      );
      create index if not exists challenges_domain_status_idx on challenges (domain, status);
    `);
    return new SQLiteStore(db);
  }

  async upsert(challenge: Challenge): Promise<void> {
    await this.db.runAsync(
      `insert into challenges
         (id, domain, status, is_primary, start_date, goal_weight_kg, horizon_days,
          start_weight_kg, mode, prev_target_kcal, last_recompute_date, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict (id) do update set
         domain = excluded.domain,
         status = excluded.status,
         is_primary = excluded.is_primary,
         start_date = excluded.start_date,
         goal_weight_kg = excluded.goal_weight_kg,
         horizon_days = excluded.horizon_days,
         start_weight_kg = excluded.start_weight_kg,
         mode = excluded.mode,
         prev_target_kcal = excluded.prev_target_kcal,
         last_recompute_date = excluded.last_recompute_date,
         updated_at = excluded.updated_at`,
      challenge.id,
      challenge.domain,
      challenge.status,
      challenge.isPrimary ? 1 : 0,
      challenge.startDate,
      challenge.goalWeightKg,
      challenge.horizonDays,
      challenge.startWeightKg,
      challenge.mode,
      challenge.prevTargetKcal,
      challenge.lastRecomputeDate,
      challenge.createdAt,
      challenge.updatedAt,
    );
  }

  async get(id: string): Promise<Challenge | null> {
    const r = await this.db.getFirstAsync<ChallengeRow>('select * from challenges where id = ?', id);
    return r ? fromDb(r) : null;
  }

  async list(domain: ChallengeDomain, statuses?: ChallengeStatus[]): Promise<Challenge[]> {
    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(',');
      const rows = await this.db.getAllAsync<ChallengeRow>(
        `select * from challenges where domain = ? and status in (${placeholders}) order by created_at asc`,
        domain,
        ...statuses,
      );
      return rows.map(fromDb);
    }
    const rows = await this.db.getAllAsync<ChallengeRow>(
      "select * from challenges where domain = ? and status != 'deleted' order by created_at asc",
      domain,
    );
    return rows.map(fromDb);
  }

  async getPrimary(domain: ChallengeDomain): Promise<Challenge | null> {
    const r = await this.db.getFirstAsync<ChallengeRow>(
      "select * from challenges where domain = ? and status = 'active' and is_primary = 1",
      domain,
    );
    return r ? fromDb(r) : null;
  }

  async clearAll(): Promise<void> {
    await this.db.execAsync('delete from challenges;');
  }
}
