import type { Unit } from './types';

/**
 * Food-Log BRD §3 — India-friendly household units, seeded on first run.
 * Gram weights are placeholders (product-owner should confirm real values);
 * any food can override a unit's grams per-food (see FoodUnitOverride).
 */
export const DEFAULT_UNITS: Unit[] = [
  { id: 'gram', name: 'gram', defaultGrams: 1 },
  { id: 'ml', name: 'ml', defaultGrams: 1 }, // 1 ml ≈ 1 g default density; override per food for denser/lighter liquids
  { id: 'katori', name: 'katori', defaultGrams: 150 },
  { id: 'roti', name: 'roti', defaultGrams: 40 },
  { id: 'piece', name: 'piece', defaultGrams: 30 },
  { id: 'tbsp', name: 'tbsp', defaultGrams: 15 },
  { id: 'tsp', name: 'tsp', defaultGrams: 5 },
  { id: 'glass', name: 'glass', defaultGrams: 250 },
  { id: 'cup', name: 'cup', defaultGrams: 200 },
  { id: 'plate', name: 'plate', defaultGrams: 300 },
];

/** Food-Log BRD §7 — "last N distinct foods" for the Recents friction-saver. */
export const DEFAULT_RECENTS_LIMIT = 12;
