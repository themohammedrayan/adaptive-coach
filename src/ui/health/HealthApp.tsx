import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CoachNotesFeed } from '../CoachNotesFeed';
import { DashboardScreen } from '../DashboardScreen';
import { FoodLogScreen } from '../FoodLogScreen';
import { AppButton, BottomTabBar, type TabIconName } from '../kit';
import { ProfileScreen } from '../ProfileScreen';
import { space, type, useTheme } from '../theme';
import { WeightScreen } from '../WeightScreen';

// Goals BRD §G.6 — the Challenges tab retired; metric-goal list/detail now
// lives in the Goals module (src/ui/goals/GoalDetailScreen.tsx's metric branch).
export type Tab = 'home' | 'food' | 'weight' | 'coach' | 'profile';

const TABS: { key: Tab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'home', label: 'Home', icon: 'home', title: 'Today' },
  { key: 'food', label: 'Food', icon: 'food', title: 'Food log' },
  { key: 'weight', label: 'Weight', icon: 'weight', title: 'Weight' },
  { key: 'coach', label: 'Coach', icon: 'coach', title: 'Coach' },
  { key: 'profile', label: 'Profile', icon: 'profile', title: 'Profile' },
];

export function HealthApp({ modeSwitcher }: { modeSwitcher?: ReactNode }) {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');

  const active = TABS.find((x) => x.key === tab)!;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: t.ink }]}>{active.title}</Text>
          {tab === 'home' && <Text style={[type.caption, { color: t.muted }]}>{today}</Text>}
        </View>
        <AppButton title="Ask coach" onPress={() => router.push('/coach-chat')} variant="ghost" small />
        {modeSwitcher}
      </View>

      <View style={styles.content}>
        {tab === 'home' && <DashboardScreen onNavigate={setTab} />}
        {tab === 'food' && <FoodLogScreen />}
        {tab === 'weight' && <WeightScreen />}
        {tab === 'coach' && <CoachNotesFeed />}
        {tab === 'profile' && <ProfileScreen />}
      </View>

      <BottomTabBar tabs={TABS} active={tab} onChange={setTab} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.s,
    gap: space.m,
  },
  content: { flex: 1 },
});
