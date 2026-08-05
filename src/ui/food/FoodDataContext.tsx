import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { addDays, type IsoDate } from '../../engine';
import {
  addFavorite,
  addLogEntry,
  archiveFood as archiveFoodDomain,
  copyDay,
  createFood,
  editFood,
  editLogEntry,
  removeFavorite,
  setFoodUnitOverride,
  type AddLogEntryInput,
  type CreateFoodInput,
  type Favorite,
  type Food,
  type FoodUnitOverride,
  type LogEntry,
  type Meal,
  type Unit,
} from '../../food-log';
import {
  FOOD_PHOTO_BUCKET,
  MEAL_PHOTO_BUCKET,
  signedPhotoUrl,
  uploadCatalogPhoto,
  uploadMealPhoto,
} from '../../food-log/photos';
import { getFoodLogRuntime } from '../../food-log/runtime';
import { supabase } from '../../lib/supabase';

interface FoodData {
  entries: LogEntry[];
  foods: Food[];
  units: Unit[];
  favorites: Favorite[];
  overrides: FoodUnitOverride[];
}

const EMPTY_DATA: FoodData = { entries: [], foods: [], units: [], favorites: [], overrides: [] };

/** A photo the user picked but hasn't saved yet. base64 is what Storage wants. */
export interface PickedPhoto {
  uri: string;
  base64: string;
}

export interface SaveFoodResult {
  food: Food;
  /** True when an edit forked a catalog row authored by someone else. */
  forked: boolean;
}

interface FoodDataValue extends FoodData {
  loading: boolean;
  today: IsoDate | null;
  error: string | null;
  /** auth.uid(), or null offline/signed out. Decides edit-in-place vs fork. */
  myUserId: string | null;

  foodsById: Map<string, Food>;
  unitNames: Map<string, string>;
  favoriteIds: Set<string>;

  refresh: () => Promise<void>;

  /** `food: null` means create — the same idiom the finance modals use. */
  saveFood: (food: Food | null, input: CreateFoodInput, photo?: PickedPhoto | null) => Promise<SaveFoodResult>;
  archiveFood: (foodId: string) => Promise<void>;
  toggleFavorite: (foodId: string, mealHint?: Meal | null) => Promise<void>;

  logEntry: (input: Omit<AddLogEntryInput, 'loggedAt'>, photo?: PickedPhoto | null) => Promise<LogEntry>;
  editEntry: (entry: LogEntry, patch: { quantity: number; unitId: string }) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  copyYesterday: () => Promise<void>;
  setEntryPhoto: (entry: LogEntry, photo: PickedPhoto) => Promise<void>;

  setUnitOverride: (foodId: string, unitId: string, grams: number) => Promise<void>;
  getOverrideGrams: (foodId: string, unitId: string) => number | null;

  /**
   * Signed URL for a stored photo, or undefined until it has been minted.
   * Requesting one for a path not yet cached kicks off the fetch and re-renders.
   */
  photoUrl: (bucket: string, storagePath: string | null) => string | undefined;
}

const FoodDataCtx = createContext<FoodDataValue | null>(null);

export function useFoodData(): FoodDataValue {
  const ctx = useContext(FoodDataCtx);
  if (ctx === null) throw new Error('useFoodData must be used within FoodDataProvider');
  return ctx;
}

/**
 * The food-log data-access boundary, mirroring GoalsDataContext /
 * MedicationsDataContext (load-then-reconcile, best-effort writes that
 * **propagate** errors so callers can report them).
 *
 * It deliberately does *not* copy FinanceDataContext's AsyncStorage cache +
 * outbox: food-log already has a stronger offline story underneath it (a SQLite
 * store, a pendingPush column per row, and the throttled foodLogSyncOnOpen), so
 * a second cache would only be a second thing to keep in step. Every read here
 * comes from the local store, which is already durable; `sync` reconciles it
 * with Supabase in the background.
 */
export function FoodDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FoodData>(EMPTY_DATA);
  const [today, setToday] = useState<IsoDate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  // Requests already in flight, so a re-render can't stampede the same path.
  const pendingUrls = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const rt = await getFoodLogRuntime();
      const localDate = rt.toLocalDate(rt.nowUtc());
      const [entries, units, foods, favorites, overrides] = await Promise.all([
        rt.store.listEntriesByDate(localDate),
        rt.store.listUnits(),
        // Archived included so historical entries still resolve to a name.
        rt.store.listFoods(true),
        rt.store.listFavorites(),
        rt.store.listOverrides(),
      ]);
      setToday(localDate);
      setData({ entries, units, foods, favorites, overrides });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        setMyUserId(userData.user?.id ?? null);
      } catch {
        setMyUserId(null); // offline; edits fall back to fork-on-conflict
      }
    })();
  }, []);

  // Sync-on-open, matching WeightScreen/FoodLogScreen's existing convention.
  useEffect(() => {
    void (async () => {
      try {
        const rt = await getFoodLogRuntime();
        await rt.sync(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      await load();
    })();
  }, [load]);

  /**
   * Runs a local write, then reloads and opportunistically pushes. The reload
   * happens in `finally` so state is consistent either way, but the write error
   * still propagates — unlike finance, a failed food write is worth telling the
   * user about rather than silently queueing.
   */
  const persistAndReload = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } finally {
        await load();
        void getFoodLogRuntime()
          .then((rt) => rt.sync(true))
          .catch(() => {}); // offline is fine, the outbox retries
      }
    },
    [load],
  );

  const foodsById = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  const unitNames = useMemo(() => new Map(data.units.map((u) => [u.id, u.name])), [data.units]);
  const favoriteIds = useMemo(() => new Set(data.favorites.map((f) => f.foodId)), [data.favorites]);

  const photoUrl = useCallback(
    (bucket: string, storagePath: string | null): string | undefined => {
      if (storagePath === null) return undefined;
      const key = `${bucket}/${storagePath}`;
      const cached = photoUrls.get(key);
      if (cached !== undefined) return cached;
      if (pendingUrls.current.has(key)) return undefined;

      pendingUrls.current.add(key);
      void signedPhotoUrl(bucket, storagePath)
        .then((url) => setPhotoUrls((prev) => new Map(prev).set(key, url)))
        .catch(() => {}) // a missing photo just renders the placeholder
        .finally(() => pendingUrls.current.delete(key));
      return undefined;
    },
    [photoUrls],
  );

  const saveFood = useCallback(
    (food: Food | null, input: CreateFoodInput, photo?: PickedPhoto | null): Promise<SaveFoodResult> =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        const nowUtc = rt.nowUtc();

        const result =
          food === null
            ? { food: await createFood(rt.store, { ...input, createdBy: myUserId }, nowUtc), forked: false }
            : await editFood(rt.store, food, input, nowUtc, myUserId);

        if (photo == null) return result;

        // Upload after the row exists, so the storage key is the catalog id.
        // A failed upload keeps the local URI so the picture still shows here
        // and the user can retry, rather than losing it silently.
        let saved: Food;
        try {
          const photoPath = await uploadCatalogPhoto(result.food.id, photo.base64);
          saved = { ...result.food, photoPath, photoLocalUri: null, updatedAt: nowUtc, pendingPush: true };
        } catch {
          saved = { ...result.food, photoLocalUri: photo.uri, updatedAt: nowUtc };
        }
        await rt.store.upsertFood(saved);
        return { food: saved, forked: result.forked };
      }),
    [myUserId, persistAndReload],
  );

  const archiveFood = useCallback(
    (foodId: string) =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        await archiveFoodDomain(rt.store, foodId, rt.nowUtc());
      }),
    [persistAndReload],
  );

  const toggleFavorite = useCallback(
    (foodId: string, mealHint: Meal | null = null) =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        if (favoriteIds.has(foodId)) {
          await removeFavorite(rt.store, foodId, rt.nowUtc());
        } else {
          await addFavorite(rt.store, foodId, mealHint, rt.nowUtc());
        }
      }),
    [favoriteIds, persistAndReload],
  );

  const logEntry = useCallback(
    (input: Omit<AddLogEntryInput, 'loggedAt'>, photo?: PickedPhoto | null): Promise<LogEntry> =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        const entry = await addLogEntry(
          rt.store,
          { ...input, loggedAt: rt.nowUtc(), photoLocalUri: photo?.uri ?? null },
          rt.toLocalDate,
        );
        if (photo == null) return entry;
        return uploadEntryPhoto(rt, entry, photo);
      }),
    [persistAndReload],
  );

  const setEntryPhoto = useCallback(
    (entry: LogEntry, photo: PickedPhoto) =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        await uploadEntryPhoto(rt, entry, photo);
      }),
    [persistAndReload],
  );

  const editEntry = useCallback(
    (entry: LogEntry, patch: { quantity: number; unitId: string }) =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        await editLogEntry(rt.store, entry, patch, rt.nowUtc());
      }),
    [persistAndReload],
  );

  const deleteEntry = useCallback(
    (entryId: string) =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        await rt.store.deleteEntry(entryId, rt.nowUtc());
      }),
    [persistAndReload],
  );

  const copyYesterday = useCallback(
    () =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        const localDate = rt.toLocalDate(rt.nowUtc());
        await copyDay(rt.store, addDays(localDate, -1), localDate, rt.nowUtc());
      }),
    [persistAndReload],
  );

  const setUnitOverride = useCallback(
    (foodId: string, unitId: string, grams: number) =>
      persistAndReload(async () => {
        const rt = await getFoodLogRuntime();
        await setFoodUnitOverride(rt.store, foodId, unitId, grams, rt.nowUtc());
      }),
    [persistAndReload],
  );

  const getOverrideGrams = useCallback(
    (foodId: string, unitId: string): number | null =>
      data.overrides.find((o) => o.foodId === foodId && o.unitId === unitId && o.deletedAt === null)?.grams ??
      null,
    [data.overrides],
  );

  const value: FoodDataValue = {
    ...data,
    loading,
    today,
    error,
    myUserId,
    foodsById,
    unitNames,
    favoriteIds,
    refresh: load,
    saveFood,
    archiveFood,
    toggleFavorite,
    logEntry,
    editEntry,
    deleteEntry,
    copyYesterday,
    setEntryPhoto,
    setUnitOverride,
    getOverrideGrams,
    photoUrl,
  };

  return <FoodDataCtx.Provider value={value}>{children}</FoodDataCtx.Provider>;
}

/** Shared by logEntry and setEntryPhoto — same upload-then-persist, same fallback. */
async function uploadEntryPhoto(
  rt: { store: { upsertEntry: (e: LogEntry) => Promise<void> }; nowUtc: () => string },
  entry: LogEntry,
  photo: PickedPhoto,
): Promise<LogEntry> {
  const nowUtc = rt.nowUtc();
  let next: LogEntry;
  try {
    const photoPath = await uploadMealPhoto(entry.id, photo.base64);
    next = { ...entry, photoPath, photoLocalUri: null, updatedAt: nowUtc, pendingPush: true };
  } catch {
    next = { ...entry, photoLocalUri: photo.uri, updatedAt: nowUtc };
  }
  await rt.store.upsertEntry(next);
  return next;
}

export { FOOD_PHOTO_BUCKET, MEAL_PHOTO_BUCKET };
