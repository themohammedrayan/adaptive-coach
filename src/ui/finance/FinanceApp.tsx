import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AccountsScreen } from './AccountsScreen';
import { BudgetScreen } from './BudgetScreen';
import { CashflowScreen } from './CashflowScreen';
import { DebtScreen } from './DebtScreen';
import { FinanceDataProvider, useFinanceData } from './FinanceDataContext';
import { ReportsScreen } from './ReportsScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { AppButton, BottomTabBar, Dot, Row, type TabIconName } from '../kit';
import { space, type, useTheme } from '../theme';

export type FinanceTab = 'accounts' | 'cashflow' | 'transactions' | 'budget' | 'debt' | 'reports';

// Six tabs share the bar at flex:1 with an 11pt label, so labels stay short.
//
// Two slots were freed rather than added: fund goals live in the app-wide Goals
// module (src/ui/goals/), and the old Overview tab was a digest of the others —
// its account list duplicated Accounts and its recent list duplicated Log, so
// its net-worth and health cards moved to the top of Accounts.
const TABS: { key: FinanceTab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'accounts', label: 'Accounts', icon: 'accounts', title: 'Net worth' },
  { key: 'cashflow', label: 'Flow', icon: 'calendar', title: 'Cash flow' },
  { key: 'transactions', label: 'Log', icon: 'transactions', title: 'Transactions' },
  { key: 'budget', label: 'Budget', icon: 'budget', title: 'Budget' },
  { key: 'debt', label: 'Debt', icon: 'debt', title: 'Debt' },
  { key: 'reports', label: 'Reports', icon: 'reports', title: 'Reports' },
];

export function FinanceApp() {
  const [tab, setTab] = useState<FinanceTab>('accounts');

  return (
    <FinanceDataProvider>
      <FinanceAppBody tab={tab} onChangeTab={setTab} />
    </FinanceDataProvider>
  );
}

/** Cross-fades between tab panes that stay mounted once visited, so switching tabs never resets scroll position or in-progress input. */
function AnimatedTabPane({ active, children }: { active: boolean; children: ReactNode }) {
  const opacity = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents={active ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}

function FinanceAppBody({ tab, onChangeTab }: { tab: FinanceTab; onChangeTab: (tab: FinanceTab) => void }) {
  const t = useTheme();
  const router = useRouter();
  const { pendingOutboxCount, poisonedOutboxCount } = useFinanceData();
  const active = TABS.find((x) => x.key === tab)!;

  // Lazy-mount-then-retain: a tab only pays its mount cost once it's actually
  // opened, but after that it stays mounted so switching away and back is
  // instant and keeps whatever state it had.
  const [visited, setVisited] = useState<Set<FinanceTab>>(() => new Set([tab]));
  useEffect(() => {
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

  const renderScreen = (key: FinanceTab): ReactNode => {
    switch (key) {
      case 'cashflow':
        return <CashflowScreen />;
      case 'transactions':
        return <TransactionsScreen />;
      case 'accounts':
        return <AccountsScreen />;
      case 'budget':
        return <BudgetScreen />;
      case 'debt':
        return <DebtScreen onNavigateToAccounts={() => onChangeTab('accounts')} />;
      case 'reports':
        return <ReportsScreen />;
    }
  };

  return (
    <>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={() => router.back()} variant="ghost" small />
        <Text style={[type.title, { color: t.ink, flex: 1 }]}>{active.title}</Text>
        <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
      </View>

      {pendingOutboxCount > 0 && (
        <Row style={styles.syncBanner} gap={space.s}>
          <Dot color={t.warning} />
          <Text style={[type.caption, { color: t.muted }]}>
            {pendingOutboxCount} change{pendingOutboxCount === 1 ? '' : 's'} not yet synced
          </Text>
        </Row>
      )}
      {poisonedOutboxCount > 0 && (
        <Row style={styles.syncBanner} gap={space.s}>
          <Dot color={t.danger} />
          <Text style={[type.caption, { color: t.danger }]}>
            Couldn't sync {poisonedOutboxCount} change{poisonedOutboxCount === 1 ? '' : 's'} after repeated attempts
          </Text>
        </Row>
      )}

      <View style={styles.content}>
        {TABS.map(({ key }) =>
          visited.has(key) ? (
            <AnimatedTabPane key={key} active={tab === key}>
              {renderScreen(key)}
            </AnimatedTabPane>
          ) : null,
        )}
      </View>

      <BottomTabBar tabs={TABS} active={tab} onChange={onChangeTab} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.s,
    gap: space.m,
  },
  content: { flex: 1 },
  syncBanner: { paddingHorizontal: space.l, paddingBottom: space.s },
});
