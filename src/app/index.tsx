import { useState } from 'react';
import { Button, SafeAreaView, StyleSheet, View } from 'react-native';
import { FoodLogScreen } from '../ui/FoodLogScreen';
import { SignIn } from '../ui/SignIn';
import { useSession } from '../ui/useSession';
import { WeightScreen } from '../ui/WeightScreen';

type Tab = 'weight' | 'food-log';

export default function Index() {
  const { session, loading } = useSession();
  const [tab, setTab] = useState<Tab>('weight');
  if (loading) return null;
  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <SignIn />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.tabBar}>
        <Button title="Weight" onPress={() => setTab('weight')} disabled={tab === 'weight'} />
        <Button title="Food Log" onPress={() => setTab('food-log')} disabled={tab === 'food-log'} />
      </View>
      {tab === 'weight' ? <WeightScreen /> : <FoodLogScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabBar: { flexDirection: 'row', gap: 8, padding: 8, justifyContent: 'center' },
});
