import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { IsoDate } from '../../engine';
import { deviceLocalDate } from '../../lib/dates';
import * as api from '../../medications/api';
import { readMedicationsCache, writeMedicationsCache } from '../../medications/cache';
import {
  archiveMedication as archiveMedicationCrud,
  buildMedication,
  editMedication,
  setDoseStatus as setDoseStatusCrud,
  type BuildMedicationInput,
} from '../../medications/crud';
import { rebuildMedicationReminders } from '../../medications/reminders';
import type { DoseStatus, Medication, MedicationDose } from '../../medications/types';

interface MedicationsData {
  medications: Medication[];
  doses: MedicationDose[];
}

const EMPTY_DATA: MedicationsData = { medications: [], doses: [] };

interface MedicationsDataValue extends MedicationsData {
  loading: boolean;
  today: IsoDate;
  refresh: () => Promise<void>;
  saveMedication: (input: BuildMedicationInput, existing?: Medication) => Promise<void>;
  archiveMedication: (externalId: string) => Promise<void>;
  setDoseStatus: (
    medicationExternalId: string,
    scheduledDate: IsoDate,
    scheduledMinute: number,
    status: DoseStatus,
  ) => Promise<void>;
}

const MedicationsDataCtx = createContext<MedicationsDataValue | null>(null);

export function useMedicationsData(): MedicationsDataValue {
  const ctx = useContext(MedicationsDataCtx);
  if (ctx === null) throw new Error('useMedicationsData must be used within MedicationsDataProvider');
  return ctx;
}

/**
 * Mirrors GoalsDataContext.tsx/CalendarDataContext.tsx's shape (cache-then-
 * fetch-then-reconcile, best-effort writes with no outbox). Additionally
 * re-syncs local notification reminders after any write that can change a
 * medication's schedule (save/archive) — not after a plain dose-status tap,
 * which doesn't affect what's scheduled and would otherwise churn the
 * device's notification list on every checklist tap.
 */
export function MedicationsDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MedicationsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const today = deviceLocalDate(new Date().toISOString());

  const loadData = useCallback(async (): Promise<Medication[]> => {
    const cached = await readMedicationsCache();
    if (cached !== null) setData({ medications: cached.medications, doses: cached.doses });

    try {
      const [medications, doses] = await Promise.all([api.listMedications(), api.listMedicationDoses()]);
      setData({ medications, doses });
      await writeMedicationsCache({ medications, doses, cachedAt: new Date().toISOString() });
      return medications;
    } catch {
      // offline — whatever was cached stands
      return cached?.medications ?? [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData().then((medications) => {
      void rebuildMedicationReminders(medications, today).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  const persistAndReload = useCallback(
    async (action: () => Promise<void>, syncReminders = false) => {
      try {
        await action();
      } finally {
        // Always reconcile from server/cache, success or failure — but let a
        // write failure propagate so callers can tell it didn't actually save.
        const medications = await loadData();
        if (syncReminders) void rebuildMedicationReminders(medications, today).catch(() => {});
      }
    },
    [loadData, today],
  );

  const saveMedication = useCallback(
    (input: BuildMedicationInput, existing?: Medication) => {
      const nowIso = new Date().toISOString();
      const medication =
        existing !== undefined ? editMedication(existing, input, nowIso) : buildMedication(input, nowIso);
      return persistAndReload(() => api.upsertMedication(medication), true);
    },
    [persistAndReload],
  );

  const archiveMedication = useCallback(
    (externalId: string) => {
      const nowIso = new Date().toISOString();
      const med = data.medications.find((m) => m.externalId === externalId);
      if (med === undefined) return Promise.resolve();
      return persistAndReload(() => api.upsertMedication(archiveMedicationCrud(med, nowIso)), true);
    },
    [data.medications, persistAndReload],
  );

  const setDoseStatus = useCallback(
    (medicationExternalId: string, scheduledDate: IsoDate, scheduledMinute: number, status: DoseStatus) => {
      const nowIso = new Date().toISOString();
      const existing =
        data.doses.find(
          (d) =>
            d.medicationExternalId === medicationExternalId &&
            d.scheduledDate === scheduledDate &&
            d.scheduledMinute === scheduledMinute,
        ) ?? null;
      const next = setDoseStatusCrud(medicationExternalId, scheduledDate, scheduledMinute, status, existing, nowIso);
      return persistAndReload(async () => {
        if (next === null) {
          if (existing !== null) await api.deleteMedicationDose(existing.externalId, nowIso);
        } else {
          await api.upsertMedicationDose(next);
        }
      });
    },
    [data.doses, persistAndReload],
  );

  const value: MedicationsDataValue = {
    ...data,
    loading,
    today,
    refresh: async () => {
      await loadData();
    },
    saveMedication,
    archiveMedication,
    setDoseStatus,
  };

  return <MedicationsDataCtx.Provider value={value}>{children}</MedicationsDataCtx.Provider>;
}
