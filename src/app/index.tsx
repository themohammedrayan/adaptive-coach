import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDashboardRuntime } from '../dashboard/runtime';
import { useAppMode } from '../lib/appMode';
import { FinanceApp } from '../ui/finance/FinanceApp';
import { HealthApp } from '../ui/health/HealthApp';
import { ModeSwitcher } from '../ui/kit';
import { ProfileSetupScreen } from '../ui/ProfileSetupScreen';
import { SignIn } from '../ui/SignIn';
import { useTheme } from '../ui/theme';
import { useSession } from '../ui/useSession';

export default function Index() {
  const t = useTheme();
  const { session, loading } = useSession();
  const { mode, setMode } = useAppMode();
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
    }
  }, [session, checkProfile]);

  if (loading || mode === null) return null;

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
        <SignIn />
      </SafeAreaView>
    );
  }

  const modeSwitcher = <ModeSwitcher mode={mode} onChange={setMode} />;

  if (mode === 'finance') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
        <FinanceApp modeSwitcher={modeSwitcher} />
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
      <HealthApp modeSwitcher={modeSwitcher} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
