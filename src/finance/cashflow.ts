import { addDays, dateRange, diffDays, type IsoDate } from '../engine';
import { transactionEffectForAccount, ledgerBalanceAsOf } from './ledger';
import { occurrenceDatesBetween } from './recurrenceDates';
import type {
  Account,
  MoneyMinor,
  RecurringTransaction,
  Transaction,
  TransactionType,
} from './types';

/**
 * Forward cash-flow simulation: walks recurrence rules *past* today the same
 * way `materializeDueRecurrences` walks them up to it, and lays the result on a
 * running daily balance.
 *
 * Distinct from `projection.ts` — that extrapolates a net-worth trend from
 * history and knows nothing about scheduled bills. This one knows only about
 * scheduled bills and ignores trend entirely.
 *
 * Pure and deterministic: `today` is a parameter, nothing here reads a clock.
 */

/** How far ahead the outlook banner looks when the caller has no opinion. */
export const DEFAULT_HORIZON_DAYS = 30;

export interface ProjectedEvent {
  /** Stable React key: a real transaction's externalId, or `${ruleExternalId}@${date}` when forecast. */
  key: string;
  date: IsoDate;
  /** `settled` = a real logged transaction. `forecast` = a rule occurrence that hasn't happened yet. */
  kind: 'settled' | 'forecast';
  type: TransactionType;
  label: string | null;
  categoryExternalId: string | null;
  /** Signed effect on the spendable pool. Negative drains it. */
  deltaMinor: MoneyMinor;
  /** Set for both forecast occurrences and already-materialized recurring transactions. */
  recurrenceExternalId: string | null;
}

export interface ProjectedDay {
  date: IsoDate;
  events: ProjectedEvent[];
  netDeltaMinor: MoneyMinor;
  /** Pool balance at end of this day. */
  closingBalanceMinor: MoneyMinor;
}

export interface CashflowProjection {
  startDate: IsoDate;
  endDate: IsoDate;
  /** Pool balance at end of the day before `startDate`, including anything forecast between today and then. */
  openingBalanceMinor: MoneyMinor;
  /** One entry per day in [startDate, endDate], inclusive, no gaps. */
  days: ProjectedDay[];
  /** Lowest closing balance across `days`; earliest date wins a tie. */
  low: { date: IsoDate; balanceMinor: MoneyMinor };
}

export interface ProjectCashflowInput {
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  today: IsoDate;
  startDate: IsoDate;
  endDate: IsoDate;
}

/**
 * The accounts a "what will I have left" question is actually about.
 *
 * Valuation-mode accounts (investments, loans) are excluded because they carry
 * periodic snapshots rather than a ledger — there is no day-by-day series to
 * simulate. Liabilities are excluded because a credit-card balance is not cash;
 * spending on a card shows up here only when the card is paid off, as a
 * transfer out of a pooled account.
 */
function spendablePool(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.archivedAt === null && a.balanceMode === 'ledger' && !a.isLiability);
}

/**
 * Net effect on the pool as a whole. Summing per-account effects means a
 * transfer *between* two pooled accounts cancels to zero on its own, and a
 * transaction on an unpooled account contributes nothing — both without a
 * special case.
 */
function poolEffect(txn: Transaction, pool: Account[]): MoneyMinor {
  return pool.reduce((sum, a) => sum + transactionEffectForAccount(txn, a.externalId), 0);
}

/** A rule occurrence shaped as a transaction so it runs through the same sign logic as a real one. */
function syntheticTransaction(rule: RecurringTransaction, date: IsoDate): Transaction {
  return {
    id: `${rule.externalId}@${date}`,
    externalId: `${rule.externalId}@${date}`,
    type: rule.type,
    accountExternalId: rule.accountExternalId,
    counterAccountExternalId: rule.counterAccountExternalId,
    categoryExternalId: rule.categoryExternalId,
    amountMinor: rule.amountMinor,
    currency: rule.currency,
    note: rule.note,
    txnDate: date,
    source: 'recurring',
    recurrenceExternalId: rule.externalId,
    updatedAt: '',
  };
}

/**
 * Dates a rule has already been materialized into a real row for.
 *
 * `lastMaterializedDate` is the primary guard against forecasting an occurrence
 * that already exists, but it is not sufficient on its own: in
 * `FinanceDataContext.materializeRecurring` the transaction write and the
 * `lastMaterializedDate` write are separate network calls that fail
 * independently into the outbox, so a real row can exist while its rule still
 * reports an older date. This set closes that window.
 */
function materializedOccurrenceKeys(transactions: Transaction[]): Set<string> {
  const keys = new Set<string>();
  for (const t of transactions) {
    if (t.source === 'recurring' && t.recurrenceExternalId !== null) {
      keys.add(`${t.recurrenceExternalId}|${t.txnDate}`);
    }
  }
  return keys;
}

export function projectCashflow(input: ProjectCashflowInput): CashflowProjection {
  const { accounts, transactions, recurringTransactions, today, startDate, endDate } = input;
  const pool = spendablePool(accounts);

  // Simulate from today whenever the window starts later, so that viewing a
  // future month still accounts for the bills falling due between now and then.
  const anchor = startDate < today ? startDate : today;
  const alreadyMaterialized = materializedOccurrenceKeys(transactions);

  const eventsByDate = new Map<IsoDate, ProjectedEvent[]>();
  const push = (event: ProjectedEvent) => {
    const bucket = eventsByDate.get(event.date);
    if (bucket === undefined) eventsByDate.set(event.date, [event]);
    else bucket.push(event);
  };

  for (const txn of transactions) {
    if (txn.txnDate < anchor || txn.txnDate > endDate) continue;
    const deltaMinor = poolEffect(txn, pool);
    // Zero means the transaction never touches spendable cash — a card expense,
    // or a transfer that just moves money between two pooled accounts.
    if (deltaMinor === 0) continue;
    push({
      key: txn.externalId,
      date: txn.txnDate,
      kind: 'settled',
      type: txn.type,
      label: txn.note,
      categoryExternalId: txn.categoryExternalId,
      deltaMinor,
      recurrenceExternalId: txn.recurrenceExternalId,
    });
  }

  for (const rule of recurringTransactions) {
    if (!rule.active) continue;
    for (const date of occurrenceDatesBetween(rule, rule.lastMaterializedDate, endDate)) {
      if (date < anchor) continue;
      if (alreadyMaterialized.has(`${rule.externalId}|${date}`)) continue;
      const deltaMinor = poolEffect(syntheticTransaction(rule, date), pool);
      if (deltaMinor === 0) continue;
      push({
        key: `${rule.externalId}@${date}`,
        date,
        kind: 'forecast',
        type: rule.type,
        label: rule.note,
        categoryExternalId: rule.categoryExternalId,
        deltaMinor,
        recurrenceExternalId: rule.externalId,
      });
    }
  }

  // Real ledger balance the day before the simulation starts; everything after
  // that point comes from walking the events above.
  let running = pool.reduce(
    (sum, a) => sum + ledgerBalanceAsOf(a.openingBalanceMinor, a.externalId, transactions, addDays(anchor, -1)),
    0,
  );

  const days: ProjectedDay[] = [];
  let openingBalanceMinor = running;

  for (const date of dateRange(anchor, endDate)) {
    const events = eventsByDate.get(date) ?? [];
    const netDeltaMinor = events.reduce((sum, e) => sum + e.deltaMinor, 0);
    running += netDeltaMinor;
    if (date < startDate) {
      // Still inside the catch-up stretch between today and the visible window.
      openingBalanceMinor = running;
      continue;
    }
    days.push({ date, events, netDeltaMinor, closingBalanceMinor: running });
  }

  let low = { date: startDate, balanceMinor: openingBalanceMinor };
  for (const day of days) {
    if (day.closingBalanceMinor < low.balanceMinor) {
      low = { date: day.date, balanceMinor: day.closingBalanceMinor };
    }
  }

  return { startDate, endDate, openingBalanceMinor, days, low };
}

export type CashflowStatus = 'clear' | 'tight' | 'shortfall';

export interface CashflowOutlook {
  status: CashflowStatus;
  lowBalanceMinor: MoneyMinor;
  lowDate: IsoDate;
  horizonDays: number;
}

/** Fraction of the opening balance below which the low point reads as `tight`. */
const TIGHT_FRACTION = 0.1;

/**
 * Fixed thresholds over the projected low point — same spirit as
 * `assessFinancialHealth`: the read is computed here, the UI only words it.
 */
export function assessCashflow(projection: CashflowProjection): CashflowOutlook {
  const { low, openingBalanceMinor, startDate, endDate } = projection;
  const status: CashflowStatus =
    low.balanceMinor < 0
      ? 'shortfall'
      : low.balanceMinor < openingBalanceMinor * TIGHT_FRACTION
        ? 'tight'
        : 'clear';

  return {
    status,
    lowBalanceMinor: low.balanceMinor,
    lowDate: low.date,
    horizonDays: diffDays(endDate, startDate) + 1,
  };
}
