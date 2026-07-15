import { SafeAreaView, StyleSheet } from 'react-native';
import { SignIn } from '../ui/SignIn';
import { useSession } from '../ui/useSession';
import { WeightScreen } from '../ui/WeightScreen';

export default function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return (
    <SafeAreaView style={styles.safe}>
      {session ? <WeightScreen /> : <SignIn />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 } });
