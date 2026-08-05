export * from './types';
export { DEFAULT_RECENTS_LIMIT, DEFAULT_UNITS } from './constants';
export { deviceLocalDate, offsetLocalDate, type InstantToLocalDate } from './dates';
export { computeGrams } from './grams';
export { computeEntryMacros, deriveKcalPer100g, sumEntryMacros } from './macros';
export { toDayLog } from './dayLog';
export { KV, overrideExternalId, parseOverrideExternalId } from './store';
export type { FoodLogStore, PendingPush, PendingPushKind } from './store';
export { MemoryStore } from './store.memory';
export {
  foodLogSyncOnOpen,
  FOOD_LOG_SYNC_THROTTLE_MINUTES,
  type FoodLogSyncDeps,
  type FoodLogSyncResult,
} from './sync';
export {
  createFood,
  editFood,
  archiveFood,
  searchFoods,
  normalizeFoodName,
  type CreateFoodInput,
  type EditFoodInput,
} from './foods';
export {
  resolveMealItems,
  type ParsedMealItem,
  type ResolvedMealItem,
} from './resolveMealItems';
// photos.ts is deliberately NOT re-exported here. It imports the Supabase
// client, which throws at module-eval time when env vars are unset — exporting
// it from the barrel would drag that into every module that merely imports a
// food-log type, breaking tests. Import './photos' directly instead, the same
// way remote.ts is treated.
export { resolveGrams, setFoodUnitOverride } from './units';
export {
  addLogEntry,
  deleteLogEntry,
  editLogEntry,
  listLogEntries,
  type AddLogEntryInput,
  type EditLogEntryInput,
} from './entries';
export { mealSubtotal, dailyTotals, setMarkedComplete } from './totals';
export { addFavorite, removeFavorite, listFavorites, listRecents } from './favorites';
export { copyDay, copyMeal } from './copy';
