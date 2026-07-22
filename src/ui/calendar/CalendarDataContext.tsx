import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '../../calendar/api';
import { readCalendarCache, writeCalendarCache } from '../../calendar/cache';
import { buildOverrideForDate, buildRoutineBlock, type BuildRoutineBlockInput } from '../../calendar/crud';
import { resolveDay as resolveDayPure } from '../../calendar/resolve';
import type { DayOverride, ResolvedBlock, RoutineBlock } from '../../calendar/types';
import type { IsoDate } from '../../engine';
import { deviceLocalDate } from '../../lib/dates';

interface CalendarData {
  templateBlocks: RoutineBlock[];
  overrides: DayOverride[];
}

const EMPTY_DATA: CalendarData = { templateBlocks: [], overrides: [] };

interface CalendarDataValue extends CalendarData {
  loading: boolean;
  today: IsoDate;
  refresh: () => Promise<void>;
  resolveDay: (date: IsoDate) => ResolvedBlock[];
  saveRoutineBlock: (input: BuildRoutineBlockInput, existing?: RoutineBlock) => Promise<void>;
  deleteRoutineBlock: (externalId: string) => Promise<void>;
  saveDateOverride: (date: IsoDate, blocks: ResolvedBlock[]) => Promise<void>;
}

const CalendarDataCtx = createContext<CalendarDataValue | null>(null);

export function useCalendarData(): CalendarDataValue {
  const ctx = useContext(CalendarDataCtx);
  if (ctx === null) throw new Error('useCalendarData must be used within CalendarDataProvider');
  return ctx;
}

/**
 * Mirrors GoalsDataContext.tsx's shape: cache-then-fetch-then-reconcile,
 * best-effort writes with no outbox (Calendar's edits are rare and low-
 * stakes, same call Goals made — see src/goals/cache.ts).
 */
export function CalendarDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CalendarData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const today = deviceLocalDate(new Date().toISOString());

  const load = useCallback(async () => {
    const cached = await readCalendarCache();
    if (cached !== null) {
      setData({ templateBlocks: cached.templateBlocks, overrides: cached.overrides });
    }

    try {
      const [templateBlocks, overrides] = await Promise.all([api.listRoutineBlocks(), api.listOverrides()]);
      setData({ templateBlocks, overrides });
      await writeCalendarCache({ templateBlocks, overrides, cachedAt: new Date().toISOString() });
    } catch {
      // offline — whatever was cached stands
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistAndReload = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } finally {
        // Always reconcile, success or failure — but let a write failure
        // propagate so callers can tell it didn't actually save.
        await load();
      }
    },
    [load],
  );

  const saveRoutineBlock = useCallback(
    (input: BuildRoutineBlockInput, existing?: RoutineBlock) => {
      const nowIso = new Date().toISOString();
      const block: RoutineBlock =
        existing !== undefined ? { ...existing, ...input, updatedAt: nowIso } : buildRoutineBlock(input, nowIso);
      return persistAndReload(() => api.upsertRoutineBlock(block));
    },
    [persistAndReload],
  );

  const deleteRoutineBlock = useCallback(
    (externalId: string) => persistAndReload(() => api.deleteRoutineBlock(externalId, new Date().toISOString())),
    [persistAndReload],
  );

  const saveDateOverride = useCallback(
    (date: IsoDate, blocks: ResolvedBlock[]) => {
      const nowIso = new Date().toISOString();
      const existing = data.overrides.find((o) => o.date === date);
      const override =
        existing !== undefined ? { ...existing, blocks, updatedAt: nowIso } : buildOverrideForDate(date, blocks, nowIso);
      return persistAndReload(() => api.upsertOverride(override));
    },
    [data.overrides, persistAndReload],
  );

  const value: CalendarDataValue = {
    ...data,
    loading,
    today,
    refresh: load,
    resolveDay: (date) => resolveDayPure(data.templateBlocks, data.overrides, date),
    saveRoutineBlock,
    deleteRoutineBlock,
    saveDateOverride,
  };

  return <CalendarDataCtx.Provider value={value}>{children}</CalendarDataCtx.Provider>;
}
