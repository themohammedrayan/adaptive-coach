import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarScreen } from './calendar/CalendarScreen';
import { DashboardScreen } from './DashboardScreen';
import { GoalsApp } from './goals/GoalsApp';
import type { Tab as HealthTab } from './health/HealthApp';
import { AppButton, BottomTabBar, type TabIconName } from './kit';
import { ProfileScreen } from './ProfileScreen';
import { ProfileSetupScreen } from './ProfileSetupScreen';
import { space, type, useTheme } from './theme';

type OuterTab = 'dashboard' | 'calendar' | 'goals' | 'profile';

const OUTER_TABS: { key: OuterTab; label: string; icon: TabIconName }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'goals', label: 'Goals', icon: 'goals' },
  { key: 'profile', label: 'Profile', icon: 'profile' },
];

/**
 * Outer/global shell — Dashboard (landing), Calendar, Goals, Profile. Health
 * and Finance stay self-contained apps with their own tab bars, reached by
 * drilling down from the Dashboard tab (src/app/health.tsx, finance.tsx),
 * not by switching here.
 */
export function AppShell({
  hasProfile,
  onProfileDone,
}: {
  hasProfile: boolean;
  onProfileDone: () => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<OuterTab>('dashboard');

  const openHealth = (healthTab?: HealthTab) =>
    router.push(healthTab ? { pathname: '/health', params: { tab: healthTab } } : '/health');
  const openFinance = () => router.push('/finance');

  // Calendar doesn't depend on a weight profile, so it's exempt from the
  // onboarding gate below — always live regardless of `hasProfile`.
  if (tab === 'calendar') {
    return (
      <>
        <CalendarScreen />
        <BottomTabBar tabs={OUTER_TABS} active={tab} onChange={setTab} />
      </>
    );
  }

  if (!hasProfile) {
    return (
      <>
        <ProfileSetupScreen onDone={onProfileDone} onSkipToFinance={openFinance} />
        <BottomTabBar tabs={OUTER_TABS} active={tab} onChange={setTab} />
      </>
    );
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      {tab === 'dashboard' && (
        <>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: t.ink }]}>Dashboard</Text>
              <Text style={[type.caption, { color: t.muted }]}>{today}</Text>
            </View>
            <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
          </View>
          <View style={styles.content}>
            <DashboardScreen onOpenHealth={openHealth} onOpenFinance={openFinance} />
          </View>
        </>
      )}

      {tab === 'goals' && <GoalsApp />}

      {tab === 'profile' && (
        <>
          <View style={styles.header}>
            <Text style={[type.title, { color: t.ink, flex: 1 }]}>Profile</Text>
          </View>
          <View style={styles.content}>
            <ProfileScreen />
          </View>
        </>
      )}

      <BottomTabBar tabs={OUTER_TABS} active={tab} onChange={setTab} />
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
});
