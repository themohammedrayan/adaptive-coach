import { normalizeFoodName, type CreateFoodInput } from './foods';
import { computeGrams } from './grams';
import type { Food, FoodUnitOverride, Unit } from './types';

/**
 * One item as the model parsed it out of "two rotis, dal and a katori of rice".
 * RN-side mirror of supabase/functions/_shared/types.ts's ParsedMealItem.
 */
export interface ParsedMealItem {
  /** The model's guess at an existing catalog id, or null. Never trusted blind. */
  matchedCatalogId: string | null;
  name: string;
  quantity: number;
  unitId: string;
  /** Model's gram weight for one of that unit, when it had an opinion. */
  gramsPerUnit: number | null;
  proteinPer100g: number | null;
  carbPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  /** Null when macros are all known — the client derives 4P+4C+9F itself. */
  kcalPer100g: number | null;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * A parsed item after it has been reconciled against the local catalog.
 * `matched` is loggable as-is; `new` needs the user's explicit approval before
 * anything is created.
 */
export type ResolvedMealItem =
  | {
      kind: 'matched';
      food: Food;
      name: string;
      quantity: number;
      unitId: string;
      grams: number;
      confidence: ParsedMealItem['confidence'];
    }
  | {
      kind: 'new';
      draft: CreateFoodInput;
      name: string;
      quantity: number;
      unitId: string;
      grams: number;
      confidence: ParsedMealItem['confidence'];
    };

export interface ResolveMealItemsDeps {
  catalog: Food[];
  units: Unit[];
  overrides?: FoodUnitOverride[];
  /** Used when the model names a unit that isn't in the library. */
  fallbackUnitId: string;
}

function findUnit(units: Unit[], unitId: string): Unit | null {
  return units.find((u) => u.id === unitId) ?? null;
}

/**
 * Reconciles the model's parse against what the user already has.
 *
 * The matching rule deliberately lives here rather than in the model: an exact
 * name hit in the local catalog always wins, and the model's own
 * `matchedCatalogId` is honoured only when that id actually exists locally. A
 * hallucinated id degrades to a new-food draft needing approval — it can never
 * silently log the wrong food's macros.
 */
export function resolveMealItems(
  items: ParsedMealItem[],
  deps: ResolveMealItemsDeps,
): ResolvedMealItem[] {
  const { catalog, units, overrides = [], fallbackUnitId } = deps;

  const byId = new Map(catalog.map((f) => [f.id, f]));
  // Later entries lose to earlier ones so the first (alphabetically listed)
  // match is stable rather than depending on catalog order.
  const byName = new Map<string, Food>();
  for (const food of catalog) {
    const key = normalizeFoodName(food.name);
    if (!byName.has(key)) byName.set(key, food);
  }

  return items.map((item) => {
    const matched = byName.get(normalizeFoodName(item.name)) ?? resolveById(byId, item.matchedCatalogId);

    const unit = findUnit(units, item.unitId) ?? findUnit(units, fallbackUnitId);
    const unitId = unit?.id ?? fallbackUnitId;

    const grams = resolveGramsForItem(item, matched, unit, overrides, unitId);
    const base = { name: item.name, quantity: item.quantity, unitId, grams, confidence: item.confidence };

    if (matched !== null) return { kind: 'matched', food: matched, ...base };

    return {
      kind: 'new',
      draft: {
        name: item.name,
        proteinPer100g: item.proteinPer100g,
        carbPer100g: item.carbPer100g,
        fatPer100g: item.fatPer100g,
        fiberPer100g: item.fiberPer100g,
        kcalPer100g: item.kcalPer100g ?? undefined,
        defaultUnitId: unitId,
        source: 'coach',
      },
      ...base,
    };
  });
}

function resolveById(byId: Map<string, Food>, id: string | null): Food | null {
  if (id === null) return null;
  return byId.get(id) ?? null;
}

/**
 * Gram resolution follows the same precedence the manual portion form does —
 * the user's own override first, then the unit default — and only falls back to
 * the model's `gramsPerUnit` when neither exists. The model never overrules a
 * gram weight the user has already set for themselves.
 */
function resolveGramsForItem(
  item: ParsedMealItem,
  matched: Food | null,
  unit: Unit | null,
  overrides: FoodUnitOverride[],
  unitId: string,
): number {
  const override =
    matched === null
      ? null
      : (overrides.find(
          (o) => o.foodId === matched.id && o.unitId === unitId && o.deletedAt === null,
        ) ?? null);

  if (unit !== null) return computeGrams(unit, item.quantity, override);
  if (item.gramsPerUnit !== null) return item.quantity * item.gramsPerUnit;
  return item.quantity;
}
