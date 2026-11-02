import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getChallengeRuntime } from '../challenges/runtime';
import { getDashboardRuntime } from '../dashboard/runtime';
import { AppShell } from '../ui/AppShell';
import { SignIn } from '../ui/SignIn';
import { useTheme } from '../ui/theme';
import { useSession } from '../ui/useSession';

const SYNC_TIMEOUT_MS = 5000;

export default function Index() {
  const t = useTheme();
  const { session, loading } = useSession();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  const checkProfile = useCallback(async () => {
    const [rt, challengeRt] = await Promise.all([getDashboardRuntime(), getChallengeRuntime()]);
    // Pull profile + goals from Supabase first so a fresh device/browser lands on
    // the dashboard, not setup. Capped and best-effort: offline falls back to local.
    await Promise.race([
      Promise.allSettled([rt.sync(), challengeRt.sync()]),
      new Promise((resolve) => setTimeout(resolve, SYNC_TIMEOUT_MS)),
    ]);
    setHasProfile((await rt.store.getProfile()) !== null);
  }, []);

  useEffect(() => {
    if (session) {
      void checkProfile();
    } else {
      setHasProfile(null);
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
      <AppShell hasProfile={hasProfile} onProfileDone={checkProfile} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
