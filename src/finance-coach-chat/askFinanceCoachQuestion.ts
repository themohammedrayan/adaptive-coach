import type { IsoDate } from '../engine';
import type { Account, AccountValuation, Budget, Category, FinanceGoal, Transaction } from '../finance/types';
import { assembleFinanceCoachPayload } from './assemblePayload';
import { askFinanceCoach } from './remote';
import type { FinanceChatHistoryTurn, FinanceCoachChatTurn } from './types';

export interface AskFinanceCoachInputs {
  accounts: Account[];
  transactions: Transaction[];
  valuations: AccountValuation[];
  goals: FinanceGoal[];
  budgets: Budget[];
  categories: Category[];
  today: IsoDate;
}

/** Request ids only need to be unique enough to dedupe a retry — not cryptographically random. */
function generateRequestId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const bytes = Array.from({ length: 32 }, hex);
  bytes[12] = '4'; // version 4
  bytes[16] = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]; // variant
  const s = bytes.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * Finance data is already loaded client-side in FinanceDataContext (unlike
 * the health coach, which reads from device stores/runtimes), so this just
 * assembles the payload from what's already in memory and asks the coach.
 */
export async function askFinanceCoachQuestion(
  inputs: AskFinanceCoachInputs,
  question: string,
  history: FinanceChatHistoryTurn[] = [],
): Promise<FinanceCoachChatTurn> {
  const payload = assembleFinanceCoachPayload(
    inputs.accounts,
    inputs.transactions,
    inputs.valuations,
    inputs.goals,
    inputs.budgets,
    inputs.categories,
    inputs.today,
  );
  return askFinanceCoach(generateRequestId(), question, payload, history);
}
