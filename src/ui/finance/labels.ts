import type { Account, Category } from '../../finance/types';

/** Shared by TransactionsScreen and RecurringModal — kept out of either file to avoid a circular import between them. */
export function accountName(accounts: Account[], externalId: string | null): string {
  if (externalId === null) return '—';
  return accounts.find((a) => a.externalId === externalId)?.name ?? 'Unknown account';
}

export function categoryName(categories: Category[], externalId: string | null): string {
  if (externalId === null) return '—';
  return categories.find((c) => c.externalId === externalId)?.name ?? 'Unknown';
}
