import { deriveKcalPer100g } from './macros';
import type { FoodLogStore } from './store';
import type { Food } from './types';

export type IdGenerator = () => string;

const defaultGenId: IdGenerator = () =>
  `food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface CreateFoodInput {
  name: string;
  proteinPer100g: number | null;
  carbPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  /** Required when protein/carb/fat aren't all known (kcal-only quick food). */
  kcalPer100g?: number;
  defaultUnitId: string;
}

/**
 * Food-Log BRD §2/§9 — derives kcalPer100g=4P+4C+9F when macros are known;
 * else macrosComplete=false and the caller's kcalPer100g is authoritative.
 */
export async function createFood(
  store: FoodLogStore,
  input: CreateFoodInput,
  nowUtc: string,
  genId: IdGenerator = defaultGenId,
): Promise<Food> {
  const macrosComplete =
    input.proteinPer100g !== null && input.carbPer100g !== null && input.fatPer100g !== null;

  if (!macrosComplete && input.kcalPer100g === undefined) {
    throw new Error('kcalPer100g is required when protein/carb/fat are not all known');
  }

  const food: Food = {
    id: genId(),
    name: input.name,
    proteinPer100g: input.proteinPer100g,
    carbPer100g: input.carbPer100g,
    fatPer100g: input.fatPer100g,
    fiberPer100g: input.fiberPer100g,
    kcalPer100g: macrosComplete
      ? deriveKcalPer100g(input.proteinPer100g as number, input.carbPer100g as number, input.fatPer100g as number)
      : (input.kcalPer100g as number),
    defaultUnitId: input.defaultUnitId,
    macrosComplete,
    isCustom: true,
    createdAt: nowUtc,
    archivedAt: null,
  };
  await store.upsertFood(food);
  return food;
}

/** Food-Log BRD §5/§10 AT8 — archiving retains historical entries (snapshot immutability). */
export async function archiveFood(
  store: FoodLogStore,
  foodId: string,
  nowUtc: string,
): Promise<void> {
  const food = await store.getFood(foodId);
  if (food === null) return;
  await store.upsertFood({ ...food, archivedAt: nowUtc });
}

/** Food-Log BRD §6/§9 — local search over the user's own (non-archived) foods. */
export async function searchFoods(store: FoodLogStore, query: string): Promise<Food[]> {
  const q = query.trim().toLowerCase();
  const foods = await store.listFoods(false);
  if (q === '') return foods;
  return foods.filter((f) => f.name.toLowerCase().includes(q));
}
