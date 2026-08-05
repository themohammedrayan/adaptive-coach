import { normalizeFoodName } from './foods';
import type { Unit } from './types';

/**
 * Name fragments that imply a unit, most specific first. Matching is
 * substring-on-word-boundaries against the normalized name, so "boiled egg"
 * and "egg curry" both hit `egg` — the latter wrongly, which is why this only
 * ever *preselects* a unit the user can change, and never rewrites a food that
 * already has one.
 */
const UNIT_HINTS: { unitId: string; keywords: string[] }[] = [
  { unitId: 'egg', keywords: ['egg', 'anda', 'omelette', 'omelet'] },
  { unitId: 'roti', keywords: ['roti', 'chapati', 'chappathi', 'phulka', 'paratha', 'parotta', 'naan', 'kulcha'] },
  { unitId: 'slice', keywords: ['bread', 'toast', 'slice'] },
  {
    unitId: 'ml',
    keywords: [
      'milk', 'water', 'juice', 'tea', 'coffee', 'lassi', 'buttermilk', 'chaas',
      'smoothie', 'shake', 'soda', 'cola', 'beer', 'wine', 'broth', 'stock',
      'syrup', 'oil', 'ghee', 'honey', 'vinegar', 'sauce', 'soup', 'rasam', 'sambar',
      // Closed compounds have to be spelled out: boundary matching means neither
      // 'milk' nor 'shake' fires inside "milkshake", and a bare 'banana' would
      // otherwise carry "banana milkshake" off to `piece`.
      'milkshake', 'buttermilk',
    ],
  },
  { unitId: 'piece', keywords: ['idli', 'vada', 'dosa', 'samosa', 'biscuit', 'cookie', 'banana', 'apple', 'orange', 'mango'] },
  { unitId: 'katori', keywords: ['dal', 'daal', 'curry', 'sabzi', 'sabji', 'rice', 'poha', 'upma', 'khichdi', 'curd', 'yogurt', 'dahi'] },
];

/** Word-boundary-ish containment — avoids "mango" matching inside "mangosteen". */
function mentions(normalized: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${keyword}([^a-z0-9]|$)`).test(normalized);
}

/**
 * Picks the unit a food should default to, from its name.
 *
 * This exists because the create-food flow used to hardcode `units[0]` (gram)
 * for every food, so logging an egg or a glass of milk meant re-picking the
 * unit by hand every single time. It is a *suggestion*: the create form
 * preselects the result and the user can override it before saving, and
 * whatever they save is what `Food.defaultUnitId` keeps thereafter.
 *
 * Falls back to the first available unit (gram) when nothing matches, which is
 * exactly the old behaviour — so a miss is never worse than before.
 */
export function inferDefaultUnitId(name: string, units: Unit[]): string {
  const fallback = units[0]?.id ?? 'gram';
  const normalized = normalizeFoodName(name);
  if (normalized === '') return fallback;

  const available = new Set(units.map((u) => u.id));
  for (const { unitId, keywords } of UNIT_HINTS) {
    if (!available.has(unitId)) continue;
    if (keywords.some((k) => mentions(normalized, k))) return unitId;
  }
  return fallback;
}
