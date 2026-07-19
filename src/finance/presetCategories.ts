import type { CategoryKind } from './types';

export interface PresetCategory {
  externalId: string;
  name: string;
  kind: CategoryKind;
}

/** Mirrors the set seeded server-side by the `seed_finance_categories` migration trigger. */
export const PRESET_CATEGORIES: PresetCategory[] = [
  { externalId: 'sys-exp-uncategorised', name: 'Uncategorised', kind: 'expense' },
  { externalId: 'sys-exp-food', name: 'Food', kind: 'expense' },
  { externalId: 'sys-exp-transport', name: 'Transport', kind: 'expense' },
  { externalId: 'sys-exp-bills', name: 'Bills & Utilities', kind: 'expense' },
  { externalId: 'sys-exp-shopping', name: 'Shopping', kind: 'expense' },
  { externalId: 'sys-exp-rent', name: 'Rent', kind: 'expense' },
  { externalId: 'sys-exp-health', name: 'Health', kind: 'expense' },
  { externalId: 'sys-exp-entertainment', name: 'Entertainment', kind: 'expense' },
  { externalId: 'sys-exp-other', name: 'Other', kind: 'expense' },
  { externalId: 'sys-inc-uncategorised', name: 'Uncategorised', kind: 'income' },
  { externalId: 'sys-inc-salary', name: 'Salary', kind: 'income' },
  { externalId: 'sys-inc-freelance', name: 'Freelance', kind: 'income' },
  { externalId: 'sys-inc-gifts', name: 'Gifts', kind: 'income' },
  { externalId: 'sys-inc-other', name: 'Other', kind: 'income' },
];

export const UNCATEGORISED_EXTERNAL_ID: Record<CategoryKind, string> = {
  expense: 'sys-exp-uncategorised',
  income: 'sys-inc-uncategorised',
};
