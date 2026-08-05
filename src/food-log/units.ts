import { computeGrams } from './grams';
import type { FoodLogStore } from './store';

/** Food-Log BRD §3/§9 — resolves grams for a food+unit+quantity, respecting per-food overrides. */
export async function resolveGrams(
  store: FoodLogStore,
  foodId: string,
  unitId: string,
  quantity: number,
): Promise<number> {
  const unit = await store.getUnit(unitId);
  if (unit === null) throw new Error(`Unknown unit: ${unitId}`);
  const override = await store.getOverride(foodId, unitId);
  // getOverride returns soft-deleted rows too (sync needs them); a deleted
  // override must fall back to the unit's default gram weight.
  return computeGrams(unit, quantity, override?.deletedAt === null ? override : null);
}

export async function setFoodUnitOverride(
  store: FoodLogStore,
  foodId: string,
  unitId: string,
  grams: number,
  nowUtc: string = new Date().toISOString(),
): Promise<void> {
  await store.upsertOverride({
    foodId,
    unitId,
    grams,
    deletedAt: null,
    updatedAt: nowUtc,
    pendingPush: true,
  });
}
