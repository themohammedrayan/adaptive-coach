import type { CategoryKind } from './types';

export interface PresetCategory {
  externalId: string;
  name: string;
  kind: CategoryKind;
  /** Default emoji, used when the row carries no icon of its own. */
  icon: string;
  /** Default hex colour, or null to let the UI fall back to a theme token. */
  color: string | null;
}

/**
 * Mirrors the set seeded server-side by the `seed_finance_categories` migration
 * trigger, plus the appearance defaults for those rows.
 *
 * Appearance lives here rather than in the database so seeded categories look
 * right with no backfill — the `icon`/`color` columns only ever hold a user's
 * override or a user-created category's own choice.
 */
export const PRESET_CATEGORIES: PresetCategory[] = [
  { externalId: 'sys-exp-uncategorised', name: 'Uncategorised', kind: 'expense', icon: '❓', color: null },
  { externalId: 'sys-exp-food', name: 'Food', kind: 'expense', icon: '🍔', color: '#E0A800' },
  { externalId: 'sys-exp-transport', name: 'Transport', kind: 'expense', icon: '🚗', color: '#3B82F6' },
  { externalId: 'sys-exp-bills', name: 'Bills & Utilities', kind: 'expense', icon: '💡', color: '#6366F1' },
  { externalId: 'sys-exp-shopping', name: 'Shopping', kind: 'expense', icon: '🛍️', color: '#EC4899' },
  { externalId: 'sys-exp-rent', name: 'Rent', kind: 'expense', icon: '🏠', color: '#B07D62' },
  { externalId: 'sys-exp-health', name: 'Health', kind: 'expense', icon: '🏥', color: '#EF4444' },
  { externalId: 'sys-exp-entertainment', name: 'Entertainment', kind: 'expense', icon: '🎬', color: '#A855F7' },
  { externalId: 'sys-exp-other', name: 'Other', kind: 'expense', icon: '📦', color: '#6B7280' },
  { externalId: 'sys-inc-uncategorised', name: 'Uncategorised', kind: 'income', icon: '❓', color: null },
  { externalId: 'sys-inc-salary', name: 'Salary', kind: 'income', icon: '💰', color: '#059669' },
  { externalId: 'sys-inc-freelance', name: 'Freelance', kind: 'income', icon: '💼', color: '#0891B2' },
  { externalId: 'sys-inc-gifts', name: 'Gifts', kind: 'income', icon: '🎁', color: '#F59E0B' },
  { externalId: 'sys-inc-other', name: 'Other', kind: 'income', icon: '📥', color: '#6B7280' },
];

export const UNCATEGORISED_EXTERNAL_ID: Record<CategoryKind, string> = {
  expense: 'sys-exp-uncategorised',
  income: 'sys-inc-uncategorised',
};

/** Shown for a user-created category that hasn't picked an emoji. */
export const FALLBACK_CATEGORY_ICON = '🏷️';

const PRESET_BY_EXTERNAL_ID = new Map(PRESET_CATEGORIES.map((c) => [c.externalId, c]));

export interface CategoryAppearance {
  icon: string;
  /** Null means "no opinion" — the caller should use a theme token. */
  color: string | null;
}

/**
 * Resolves how a category should look: its own stored values win, then the
 * seeded defaults, then a neutral fallback. Pure, so budget rows, the
 * transaction list and the breakdown chart all agree on one answer.
 */
export function categoryAppearance(
  externalId: string,
  icon: string | null,
  color: string | null,
): CategoryAppearance {
  const preset = PRESET_BY_EXTERNAL_ID.get(externalId);
  return {
    icon: icon ?? preset?.icon ?? FALLBACK_CATEGORY_ICON,
    color: color ?? preset?.color ?? null,
  };
}

/** The emoji palette offered by the category editor. */
export const CATEGORY_ICON_CHOICES = [
  '🍔', '🛒', '☕', '🚗', '⛽', '🚌', '🏠', '💡', '📱', '🛍️',
  '🎬', '🎮', '🏥', '💊', '🏋️', '✈️', '🎓', '🎁', '💰', '💼',
  '📥', '📦', '🐾', '🧾', '🏷️',
];

/** The colour palette offered by the category editor. */
export const CATEGORY_COLOR_CHOICES = [
  '#E0A800', '#F59E0B', '#EF4444', '#EC4899', '#A855F7',
  '#6366F1', '#3B82F6', '#0891B2', '#059669', '#65A30D',
  '#B07D62', '#6B7280',
];
