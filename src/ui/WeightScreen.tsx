import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getDataSyncRuntime } from '../data-sync/runtime';
import type { BodyMetricRow, SyncResult } from '../data-sync/types';
import { supabase } from '../lib/supabase';

const HC_LABEL: Record<SyncResult['hc'], string> = {
  synced: 'Health Connect: synced',
  unavailable: 'Health Connect: not available — manual mode',
  update_required: 'Health Connect: provider update required',
  permission_denied: 'Health Connect: permission needed',
};

export function WeightScreen() {
  const [rows, setRows] = useState<BodyMetricRow[]>([]);
  const [input, setInput] = useState('');
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const rt = await getDataSyncRuntime();
    setRows(await rt.listRecentWeights());
    setLastSyncAt(await rt.store.getKV('lastSyncAt'));
  }, []);

  const runSync = useCallback(
    async (force: boolean) => {
      setBusy(true);
      try {
        const rt = await getDataSyncRuntime();
        const result = await rt.sync(force);
        if (result.ran) setSync(result);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    void runSync(false); // sync-on-open (BRD §5)
  }, [runSync]);

  const addWeight = async () => {
    const kg = Number(input.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0 || kg > 400) return;
    const rt = await getDataSyncRuntime();
    await rt.addWeightKg(kg);
    setInput('');
    await refresh();
    void runSync(true); // opportunistic push; offline is fine, outbox retries
  };

  return (
    <View style={styles.container}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Weight (kg)"
          keyboardType="decimal-pad"
          value={input}
          onChangeText={setInput}
        />
        <Button title="Add" onPress={addWeight} />
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.status}>
          {sync ? HC_LABEL[sync.hc] : 'Syncing…'}
          {sync?.remoteError ? ' · cloud push pending (offline?)' : ''}
        </Text>
        <Text style={styles.status}>
          Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}
        </Text>
        <Button title={busy ? 'Syncing…' : 'Sync now'} onPress={() => runSync(true)} disabled={busy} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={styles.empty}>No weigh-ins yet — add one above.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.weight}>{item.valueSI.toFixed(1)} kg</Text>
            <Text style={styles.date}>{item.localDate}</Text>
            <Text style={[styles.badge, item.source === 'manual' ? styles.manual : styles.hc]}>
              {item.source === 'manual' ? 'manual' : 'watch/scale'}
            </Text>
          </View>
        )}
      />

      <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  statusRow: { gap: 4 },
  status: { color: '#666', fontSize: 12 },
  empty: { textAlign: 'center', color: '#999', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  weight: { fontSize: 16, fontWeight: '600' },
  date: { color: '#666' },
  badge: { fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  manual: { backgroundColor: '#e8f0fe', color: '#1a56db' },
  hc: { backgroundColor: '#e6f7ee', color: '#047857' },
});
