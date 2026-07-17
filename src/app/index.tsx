import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDashboardRuntime } from '../dashboard/runtime';
import { CoachNotesFeed } from '../ui/CoachNotesFeed';
import { DashboardScreen } from '../ui/DashboardScreen';
import { FoodLogScreen } from '../ui/FoodLogScreen';
import { TabIcon, type TabIconName } from '../ui/kit';
import { ProfileScreen } from '../ui/ProfileScreen';
import { ProfileSetupScreen } from '../ui/ProfileSetupScreen';
import { SignIn } from '../ui/SignIn';
import { space, type, useTheme } from '../ui/theme';
import { useSession } from '../ui/useSession';
import { WeightScreen } from '../ui/WeightScreen';

export type Tab = 'home' | 'food' | 'weight' | 'coach' | 'profile';

const TABS: { key: Tab; label: string; icon: TabIconName; title: string }[] = [
  { key: 'home', label: 'Home', icon: 'home', title: 'Today' },
  { key: 'food', label: 'Food', icon: 'food', title: 'Food log' },
  { key: 'weight', label: 'Weight', icon: 'weight', title: 'Weight' },
  { key: 'coach', label: 'Coach', icon: 'coach', title: 'Coach' },
  { key: 'profile', label: 'Profile', icon: 'profile', title: 'Profile' },
];

export default function Index() {
  const t = useTheme();
  const { session, loading } = useSession();
  const [tab, setTab] = useState<Tab>('home');
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  const checkProfile = useCallback(async () => {
    const rt = await getDashboardRuntime();
    setHasProfile((await rt.store.getProfile()) !== null);
  }, []);

  useEffect(() => {
    if (session) {
      void checkProfile();
    } else {
      setHasProfile(null);
      setTab('home');
    }
  }, [session, checkProfile]);

  if (loading) return null;

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
        <SignIn />
      </SafeAreaView>
    );
  }

  if (hasProfile === null) return <View style={[styles.safe, { backgroundColor: t.page }]} />;

  if (!hasProfile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
        <ProfileSetupScreen onDone={checkProfile} />
      </SafeAreaView>
    );
  }

  const active = TABS.find((x) => x.key === tab)!;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
      <View style={styles.header}>
        <Text style={[type.title, { color: t.ink }]}>{active.title}</Text>
        {tab === 'home' && <Text style={[type.caption, { color: t.muted }]}>{today}</Text>}
      </View>

      <View style={styles.content}>
        {tab === 'home' && <DashboardScreen onNavigate={setTab} />}
        {tab === 'food' && <FoodLogScreen />}
        {tab === 'weight' && <WeightScreen />}
        {tab === 'coach' && <CoachNotesFeed />}
        {tab === 'profile' && <ProfileScreen />}
      </View>

      <View
        style={[
          styles.tabBar,
          { backgroundColor: t.card, borderTopColor: t.hairline },
        ]}
      >
        {TABS.map(({ key, label, icon }) => {
          const isActive = key === tab;
          const color = isActive ? t.accent : t.muted;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={({ pressed }) => [styles.tabItem, { opacity: pressed ? 0.6 : 1 }]}
            >
              <TabIcon name={icon} color={color} />
              <Text style={[styles.tabLabel, { color, fontWeight: isActive ? '600' : '400' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: space.l,
    paddingTop: space.m,
    paddingBottom: space.s,
    gap: 2,
  },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11 },
});
