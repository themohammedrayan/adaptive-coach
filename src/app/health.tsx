import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { HealthApp, type Tab } from '../ui/health/HealthApp';
import { useTheme } from '../ui/theme';

export default function HealthRoute() {
  const t = useTheme();
  const { tab } = useLocalSearchParams<{ tab?: Tab }>();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
      <HealthApp initialTab={tab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
