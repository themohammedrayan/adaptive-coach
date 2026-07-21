import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { FinanceApp } from '../ui/finance/FinanceApp';
import { useTheme } from '../ui/theme';

export default function FinanceRoute() {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]}>
      <FinanceApp />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
