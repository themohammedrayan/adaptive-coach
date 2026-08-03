import type { IsoDate } from '../engine';

export type CurrencyCode = string;

/** Integer minor units (e.g. paise for INR) — never a float/decimal. */
export type MoneyMinor = number;

export type AccountType = 'bank' | 'cash' | 'credit_card' | 'investment' | 'loan' | 'other';
export type BalanceMode = 'ledger' | 'valuation';
export type EntrySource = 'manual' | 'imported' | 'recurring';

export interface Account {
  id: string;
  externalId: string;
  name: string;
  type: AccountType;
  balanceMode: BalanceMode;
  /** True for accounts that subtract from net worth (credit cards, loans). */
  isLiability: boolean;
  currency: CurrencyCode;
  /** Ledger accounts only. */
  openingBalanceMinor: MoneyMinor;
  openingDate: IsoDate | null;
  interestRate: number | null;
  minimumPaymentMinor: MoneyMinor | null;
  dueDay: number | null;
  /** Credit cards only. */
  creditLimitMinor: MoneyMinor | null;
  source: 'manual' | 'imported';
  archivedAt: string | null;
  updatedAt: string;
}

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: string;
  externalId: string;
  name: string;
  kind: CategoryKind;
  parentExternalId: string | null;
  isSystem: boolean;
  color: string | null;
  updatedAt: string;
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment';

export interface Transaction {
  id: string;
  externalId: string;
  type: TransactionType;
  /** The account; the "from" side for a transfer. */
  accountExternalId: string;
  /** Transfer destination only. */
  counterAccountExternalId: string | null;
  /** Null for transfer/adjustment; always set for expense/income. */
  categoryExternalId: string | null;
  amountMinor: MoneyMinor;
  currency: CurrencyCode;
  note: string | null;
  txnDate: IsoDate;
  source: EntrySource;
  recurrenceExternalId: string | null;
  updatedAt: string;
}

export interface AccountValuation {
  id: string;
  externalId: string;
  accountExternalId: string;
  /** Investment: market value. Loan: amount owed, always entered positive. */
  amountMinor: MoneyMinor;
  asOfDate: IsoDate;
  source: EntrySource;
  note: string | null;
  updatedAt: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurringTransaction {
  id: string;
  externalId: string;
  type: 'expense' | 'income' | 'transfer';
  accountExternalId: string;
  counterAccountExternalId: string | null;
  categoryExternalId: string | null;
  amountMinor: MoneyMinor;
  currency: CurrencyCode;
  note: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth: number | null;
  startDate: IsoDate;
  endDate: IsoDate | null;
  lastMaterializedDate: IsoDate | null;
  active: boolean;
  updatedAt: string;
}

/** A standing monthly spending target — editing it changes the target going forward, it doesn't rewrite past months. */
export interface Budget {
  id: string;
  externalId: string;
  /** Null = overall monthly cap; otherwise the per-category limit. */
  categoryExternalId: string | null;
  amountMinor: MoneyMinor;
  currency: CurrencyCode;
  archivedAt: string | null;
  updatedAt: string;
}

export type IouDirection = 'owed_to_me' | 'i_owe';

/**
 * An informal person-to-person debt. Deliberately outside net worth — see the
 * migration comment. `settledAt` is the lifecycle field; a settled IOU stays
 * for history but drops out of the net position.
 */
export interface Iou {
  id: string;
  externalId: string;
  personName: string;
  direction: IouDirection;
  /** Always positive; `direction` carries the sign. */
  amountMinor: MoneyMinor;
  currency: CurrencyCode;
  note: string | null;
  incurredDate: IsoDate;
  dueDate: IsoDate | null;
  settledAt: string | null;
  updatedAt: string;
}

export type FinanceGoalStatus = 'active' | 'completed' | 'archived';

/** A savings goal ("save for a house") — progress tracks a linked account's live balance, never a manual check-in. */
export interface FinanceGoal {
  id: string;
  externalId: string;
  name: string;
  targetAmountMinor: MoneyMinor;
  currency: CurrencyCode;
  linkedAccountExternalId: string;
  targetDate: IsoDate | null;
  status: FinanceGoalStatus;
  archivedAt: string | null;
  updatedAt: string;
}
