import { FinanceDataProvider } from '../ui/finance/FinanceDataContext';
import { FinanceCoachChatScreen } from '../ui/finance/FinanceCoachChatScreen';

export default function FinanceCoachChatRoute() {
  return (
    <FinanceDataProvider>
      <FinanceCoachChatScreen />
    </FinanceDataProvider>
  );
}
