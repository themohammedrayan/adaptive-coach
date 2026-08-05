import type { Unit } from './types';

/**
 * Food-Log BRD §3 — India-friendly household units, seeded on first run.
 * Gram weights are placeholders (product-owner should confirm real values);
 * any food can override a unit's grams per-food (see FoodUnitOverride).
 *
 * `gram` must stay first: several callers use `units[0]` as their last-resort
 * fallback unit, and a fallback that is anything but 1 g/unit silently rescales
 * whatever it catches.
 *
 * Adding to this list is safe on an existing install — SQLiteStore.seedUnits
 * runs on every open and inserts new ids with `insert or ignore`. **Editing an
 * existing entry's defaultGrams is not**: the ignore keeps old devices on the
 * old number while fresh installs get the new one, so the same log would resolve
 * to different grams on two devices. Change a weight only by adding a new unit.
 */
export const DEFAULT_UNITS: Unit[] = [
  { id: 'gram', name: 'gram', defaultGrams: 1 },
  { id: 'ml', name: 'ml', defaultGrams: 1 }, // 1 ml ≈ 1 g default density; override per food for denser/lighter liquids
  { id: 'katori', name: 'katori', defaultGrams: 150 },
  { id: 'roti', name: 'roti', defaultGrams: 40 },
  { id: 'piece', name: 'piece', defaultGrams: 30 },
  // 'piece' at 30 g is far too light for the single items people log most, and
  // its weight can't be corrected in place (see above) — so the common ones get
  // their own units rather than relying on every user setting a per-food override.
  { id: 'egg', name: 'egg', defaultGrams: 50 }, // one medium egg, edible portion
  { id: 'slice', name: 'slice', defaultGrams: 25 }, // one bread slice
  { id: 'tbsp', name: 'tbsp', defaultGrams: 15 },
  { id: 'tsp', name: 'tsp', defaultGrams: 5 },
  { id: 'glass', name: 'glass', defaultGrams: 250 },
  { id: 'cup', name: 'cup', defaultGrams: 200 },
  { id: 'plate', name: 'plate', defaultGrams: 300 },
];

/** Food-Log BRD §7 — "last N distinct foods" for the Recents friction-saver. */
export const DEFAULT_RECENTS_LIMIT = 12;
