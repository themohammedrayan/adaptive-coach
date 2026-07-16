import { DEFAULT_RECENTS_LIMIT } from './constants';
import type { FoodLogStore } from './store';
import type { Favorite, Food, Meal } from './types';

/** Food-Log BRD §7/§9 — curated quick-access list. */
export async function addFavorite(
  store: FoodLogStore,
  foodId: string,
  mealHint: Meal | null,
  nowUtc: string,
): Promise<Favorite> {
  const fav: Favorite = { foodId, mealHint, addedAt: nowUtc };
  await store.upsertFavorite(fav);
  return fav;
}

export async function removeFavorite(store: FoodLogStore, foodId: string): Promise<void> {
  await store.removeFavorite(foodId);
}

/** Resolves favorites to Food records (a stale favorite pointing at a deleted food is skipped). */
export async function listFavorites(store: FoodLogStore): Promise<Food[]> {
  const favs = await store.listFavorites();
  const foods = await Promise.all(favs.map((f) => store.getFood(f.foodId)));
  return foods.filter((f): f is Food => f !== null);
}

/** Food-Log BRD §7/§9 — last N distinct foods logged, most recent first. */
export async function listRecents(
  store: FoodLogStore,
  n: number = DEFAULT_RECENTS_LIMIT,
): Promise<Food[]> {
  const ids = await store.listRecentFoodIds(n);
  const foods = await Promise.all(ids.map((id) => store.getFood(id)));
  return foods.filter((f): f is Food => f !== null);
}
