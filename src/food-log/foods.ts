import { deriveKcalPer100g } from './macros';
import type { FoodLogStore } from './store';
import type { Food, FoodSource } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Catalog dedupe/search key. Kept in lockstep with food_catalog.name_normalized. */
export function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase();
}

export interface CreateFoodInput {
  name: string;
  proteinPer100g: number | null;
  carbPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  /** Required when protein/carb/fat aren't all known (kcal-only quick food). */
  kcalPer100g?: number;
  defaultUnitId: string;
  /** Defaults to 'manual'. Provenance only — never affects the math. */
  source?: FoodSource;
  /** auth.uid() of the author, when known. Null offline. */
  createdBy?: string | null;
  photoPath?: string | null;
  photoLocalUri?: string | null;
}

function resolveKcal(input: CreateFoodInput): { kcalPer100g: number; macrosComplete: boolean } {
  const macrosComplete =
    input.proteinPer100g !== null && input.carbPer100g !== null && input.fatPer100g !== null;

  if (!macrosComplete && input.kcalPer100g === undefined) {
    throw new Error('kcalPer100g is required when protein/carb/fat are not all known');
  }

  return {
    macrosComplete,
    kcalPer100g: macrosComplete
      ? deriveKcalPer100g(
          input.proteinPer100g as number,
          input.carbPer100g as number,
          input.fatPer100g as number,
        )
      : (input.kcalPer100g as number),
  };
}

/**
 * Food-Log BRD §2/§9 — derives kcalPer100g=4P+4C+9F when macros are known;
 * else macrosComplete=false and the caller's kcalPer100g is authoritative.
 *
 * The row lands in the shared catalog on the next push. Nothing here is
 * user-scoped: `createdBy` is recorded for provenance and to decide who may
 * later edit in place (see editFood), not to restrict who can read it.
 */
export async function createFood(
  store: FoodLogStore,
  input: CreateFoodInput,
  nowUtc: string,
  genId: IdGenerator = defaultGenId,
): Promise<Food> {
  const { kcalPer100g, macrosComplete } = resolveKcal(input);

  const food: Food = {
    id: genId(),
    name: input.name,
    proteinPer100g: input.proteinPer100g,
    carbPer100g: input.carbPer100g,
    fatPer100g: input.fatPer100g,
    fiberPer100g: input.fiberPer100g,
    kcalPer100g,
    defaultUnitId: input.defaultUnitId,
    macrosComplete,
    source: input.source ?? 'manual',
    createdBy: input.createdBy ?? null,
    photoPath: input.photoPath ?? null,
    photoLocalUri: input.photoLocalUri ?? null,
    createdAt: nowUtc,
    archivedAt: null,
    updatedAt: nowUtc,
    pendingPush: true,
  };
  await store.upsertFood(food);
  return food;
}

export interface EditFoodInput extends CreateFoodInput {}

/**
 * Edits a catalog food, honouring the append-only rule.
 *
 * The catalog is shared, so "edit" means two different things depending on who
 * wrote the row. If you authored it, the edit lands in place — the server's
 * `catalog update own` policy permits exactly that. If someone else authored it,
 * updating would rewrite a definition other people's history was snapshotted
 * from (and the server would reject it anyway), so the edit **forks**: a fresh
 * catalog id carrying your numbers, with the original left untouched and the
 * fork favorited in its place.
 *
 * Returns the food to use going forward — the same row when edited in place, the
 * fork otherwise. `forked` lets callers tell the user which happened.
 */
export async function editFood(
  store: FoodLogStore,
  food: Food,
  input: EditFoodInput,
  nowUtc: string,
  myUserId: string | null,
  genId: IdGenerator = defaultGenId,
): Promise<{ food: Food; forked: boolean }> {
  const { kcalPer100g, macrosComplete } = resolveKcal(input);
  const mine = food.createdBy === null || food.createdBy === myUserId;

  const patched = {
    name: input.name,
    proteinPer100g: input.proteinPer100g,
    carbPer100g: input.carbPer100g,
    fatPer100g: input.fatPer100g,
    fiberPer100g: input.fiberPer100g,
    kcalPer100g,
    defaultUnitId: input.defaultUnitId,
    macrosComplete,
    photoPath: input.photoPath ?? food.photoPath,
    photoLocalUri: input.photoLocalUri ?? null,
  };

  if (mine) {
    const next: Food = {
      ...food,
      ...patched,
      // Claim authorship on rows that predate the catalog, so the next edit
      // still resolves as "mine" once the server has stamped created_by.
      createdBy: food.createdBy ?? myUserId,
      updatedAt: nowUtc,
      pendingPush: true,
    };
    await store.upsertFood(next);
    return { food: next, forked: false };
  }

  const fork: Food = {
    ...food,
    ...patched,
    id: genId(),
    source: food.source,
    createdBy: myUserId,
    createdAt: nowUtc,
    archivedAt: null,
    updatedAt: nowUtc,
    pendingPush: true,
  };
  await store.upsertFood(fork);

  // Move the favorite across so the fork is what shows up next time; the
  // original stays in the catalog, just no longer starred for this user.
  const fav = await store.getFavorite(food.id);
  if (fav !== null && fav.deletedAt === null) {
    await store.removeFavorite(food.id, nowUtc);
    await store.upsertFavorite({
      foodId: fork.id,
      mealHint: fav.mealHint,
      addedAt: nowUtc,
      deletedAt: null,
      updatedAt: nowUtc,
      pendingPush: true,
    });
  }

  return { food: fork, forked: true };
}

/**
 * Food-Log BRD §5/§10 AT8 — archiving retains historical entries (snapshot
 * immutability). With the shared catalog this is also the *only* delete the app
 * offers: it hides the food from your list and never touches the catalog row,
 * which stays readable by everyone. Local-only, so it is not pushed.
 */
export async function archiveFood(
  store: FoodLogStore,
  foodId: string,
  nowUtc: string,
): Promise<void> {
  const food = await store.getFood(foodId);
  if (food === null) return;
  // pendingPush is carried through rather than set: archiving is not itself a
  // remote change, but a food created offline and archived before its first sync
  // still has a creation to push.
  await store.upsertFood({ ...food, archivedAt: nowUtc, updatedAt: nowUtc });
}

/** Food-Log BRD §6/§9 — local search over the (non-archived) catalog mirror. */
export async function searchFoods(store: FoodLogStore, query: string): Promise<Food[]> {
  const q = normalizeFoodName(query);
  const foods = await store.listFoods(false);
  if (q === '') return foods;
  return foods.filter((f) => f.name.toLowerCase().includes(q));
}
