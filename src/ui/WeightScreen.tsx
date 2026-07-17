import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { getDataSyncRuntime } from '../data-sync/runtime';
import type { BodyMetricRow, SyncResult } from '../data-sync/types';
import { AppButton, Card, Dot, EmptyState, Field, Overline, Row } from './kit';
import { radius, space, type, useTheme } from './theme';

const HC_LABEL: Record<SyncResult['hc'], string> = {
  synced: 'Health Connect synced',
  unavailable: 'Health Connect unavailable — manual mode',
  update_required: 'Health Connect provider update required',
  permission_denied: 'Health Connect permission needed',
};

export function WeightScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<BodyMetricRow[]>([]);
  const [input, setInput] = useState('');
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
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
        setSyncError(null);
        await refresh();
      } catch (e) {
        // An HC adapter/store failure must be visible, not an unhandled rejection.
        setSyncError(e instanceof Error ? e.message : String(e));
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

  const latest = rows[0] ?? null;
  const syncOk = sync?.hc === 'synced' && !sync.remoteError && syncError === null;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Card style={styles.hero}>
            <Overline>Current weight</Overline>
            <Text style={[type.hero, { color: t.ink }]}>
              {latest === null ? '—' : latest.valueSI.toFixed(1)}
              <Text style={[type.heading, { color: t.muted }]}> kg</Text>
            </Text>
            {latest !== null && (
              <Text style={[type.caption, { color: t.muted }]}>Last weigh-in {latest.localDate}</Text>
            )}
          </Card>

          <Card style={styles.addCard}>
            <Row gap={space.m}>
              <Field
                placeholder="Weight (kg)"
                keyboardType="decimal-pad"
                value={input}
                onChangeText={setInput}
                style={styles.flex}
              />
              <AppButton title="Add" onPress={addWeight} />
            </Row>
          </Card>

          <Row style={styles.syncRow}>
            <Row gap={6} style={styles.flex}>
              <Dot color={syncOk ? t.good : sync === null ? t.muted : t.warning} />
              <View style={styles.flex}>
                <Text style={[type.caption, { color: t.secondary }]} numberOfLines={1}>
                  {sync ? HC_LABEL[sync.hc] : 'Syncing…'}
                  {sync?.remoteError ? ' · cloud push pending' : ''}
                </Text>
                <Text style={[type.caption, { color: t.muted }]}>
                  Last sync {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}
                </Text>
              </View>
            </Row>
            <AppButton title="Sync now" onPress={() => runSync(true)} variant="ghost" small busy={busy} />
          </Row>
          {syncError !== null && (
            <Text style={[type.caption, { color: t.danger }]}>Sync failed: {syncError}</Text>
          )}

          {rows.length > 0 && <Overline style={styles.historyTitle}>History</Overline>}
        </View>
      }
      ListEmptyComponent={<EmptyState message="No weigh-ins yet — add one above." />}
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.row,
            {
              backgroundColor: t.card,
              borderColor: t.hairline,
              borderTopLeftRadius: index === 0 ? radius.card : 0,
              borderTopRightRadius: index === 0 ? radius.card : 0,
              borderBottomLeftRadius: index === rows.length - 1 ? radius.card : 0,
              borderBottomRightRadius: index === rows.length - 1 ? radius.card : 0,
              borderBottomWidth: index === rows.length - 1 ? StyleSheet.hairlineWidth : 0,
            },
          ]}
        >
          <Text style={[type.heading, { color: t.ink }]}>{item.valueSI.toFixed(1)} kg</Text>
          <Text style={[type.caption, { color: t.secondary, flex: 1, textAlign: 'right', marginRight: space.m }]}>
            {item.localDate}
          </Text>
          <Text
            style={[
              styles.badge,
              item.source === 'manual'
                ? { backgroundColor: t.wash, color: t.secondary }
                : { backgroundColor: t.accentSoft, color: t.accent },
            ]}
          >
            {item.source === 'manual' ? 'manual' : 'watch/scale'}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.l, paddingTop: space.s },
  header: { gap: space.m, marginBottom: space.xs },
  hero: { gap: space.xs, alignItems: 'center' },
  addCard: { paddingVertical: space.m },
  syncRow: { justifyContent: 'space-between', paddingHorizontal: space.xs },
  historyTitle: { marginTop: space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
