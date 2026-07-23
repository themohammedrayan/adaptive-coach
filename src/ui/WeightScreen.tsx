import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deviceLocalDate } from '../data-sync/normalize';
import { uploadProgressPhoto } from '../data-sync/progressPhotos';
import { getDataSyncRuntime } from '../data-sync/runtime';
import type { BodyMetricRow, MetricType, SyncResult } from '../data-sync/types';
import { AppButton, Card, Dot, EmptyState, FAB, Field, Overline, Row } from './kit';
import { radius, space, type, useTheme } from './theme';

const HC_LABEL: Record<SyncResult['hc'], string> = {
  synced: 'Health Connect synced',
  unavailable: 'Health Connect unavailable — manual mode',
  update_required: 'Health Connect provider update required',
  permission_denied: 'Health Connect permission needed',
};

/** Log Measurements screen fields, in display order. All optional. */
const FIELDS: { metricType: MetricType; label: string; unit: string }[] = [
  { metricType: 'weight', label: 'Body Weight', unit: 'kg' },
  { metricType: 'waist', label: 'Waist', unit: 'cm' },
  { metricType: 'body_fat', label: 'Body Fat', unit: '%' },
  { metricType: 'lean_mass', label: 'Lean Body Mass', unit: 'kg' },
  { metricType: 'neck', label: 'Neck', unit: 'cm' },
  { metricType: 'shoulder', label: 'Shoulder', unit: 'cm' },
  { metricType: 'chest', label: 'Chest', unit: 'cm' },
  { metricType: 'bicep_left', label: 'Left Bicep', unit: 'cm' },
  { metricType: 'bicep_right', label: 'Right Bicep', unit: 'cm' },
  { metricType: 'forearm_left', label: 'Left Forearm', unit: 'cm' },
  { metricType: 'forearm_right', label: 'Right Forearm', unit: 'cm' },
  { metricType: 'abdomen', label: 'Abdomen', unit: 'cm' },
  { metricType: 'hips', label: 'Hips', unit: 'cm' },
  { metricType: 'thigh_left', label: 'Left Thigh', unit: 'cm' },
  { metricType: 'thigh_right', label: 'Right Thigh', unit: 'cm' },
  { metricType: 'calf_left', label: 'Left Calf', unit: 'cm' },
  { metricType: 'calf_right', label: 'Right Calf', unit: 'cm' },
];

export function WeightScreen() {
  const t = useTheme();
  const [rows, setRows] = useState<BodyMetricRow[]>([]);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [values, setValues] = useState<Partial<Record<MetricType, string>>>({});
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const openLog = () => {
    setDate(new Date());
    setValues({});
    setImageUri(null);
    setImageBase64(null);
    setSaveError(null);
    setLogOpen(true);
  };

  const closeLog = () => {
    setLogOpen(false);
    setShowDatePicker(false);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.5 };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveLog = async () => {
    const parsed: Partial<Record<MetricType, number>> = {};
    for (const f of FIELDS) {
      const raw = values[f.metricType];
      if (raw === undefined || raw.trim() === '') continue;
      const n = Number(raw.replace(',', '.'));
      if (Number.isFinite(n) && n > 0) parsed[f.metricType] = n;
    }
    if (Object.keys(parsed).length === 0 && imageBase64 === null) return;

    setSaving(true);
    setSaveError(null);
    try {
      const rt = await getDataSyncRuntime();
      const recordedAtUtc = date.toISOString();
      if (Object.keys(parsed).length > 0) {
        await rt.addMeasurementSet(parsed, recordedAtUtc);
      }
      if (imageBase64 !== null) {
        await uploadProgressPhoto({
          base64: imageBase64,
          recordedAtUtc,
          localDate: deviceLocalDate(recordedAtUtc),
        });
      }
      closeLog();
      await refresh();
      void runSync(true); // opportunistic push; offline is fine, outbox retries
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteWeight = (item: BodyMetricRow) => {
    if (item.source !== 'manual') return; // Health Connect rows aren't user-deletable this way
    Alert.alert('Delete weigh-in?', `${item.valueSI.toFixed(1)} kg on ${item.localDate}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const rt = await getDataSyncRuntime();
              await rt.deleteWeight(item.externalId);
              await refresh();
              void runSync(true); // opportunistic push; propagates the soft-delete
            } catch (e) {
              Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
            }
          })();
        },
      },
    ]);
  };

  const latest = rows[0] ?? null;
  const syncOk = sync?.hc === 'synced' && !sync.remoteError && syncError === null;
  const canSave = Object.values(values).some((v) => v !== undefined && v.trim() !== '') || imageBase64 !== null;

  return (
    <View style={styles.flex}>
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

            {rows.length > 0 && (
              <Row style={styles.historyTitle} gap={space.s}>
                <Overline>History</Overline>
                <Text style={[type.caption, { color: t.muted }]}>· long-press a manual entry to delete</Text>
              </Row>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState message="No weigh-ins yet — tap + to add one." />}
        renderItem={({ item, index }) => (
          <Pressable
            onLongPress={() => confirmDeleteWeight(item)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: t.card,
                borderColor: t.hairline,
                borderTopLeftRadius: index === 0 ? radius.card : 0,
                borderTopRightRadius: index === 0 ? radius.card : 0,
                borderBottomLeftRadius: index === rows.length - 1 ? radius.card : 0,
                borderBottomRightRadius: index === rows.length - 1 ? radius.card : 0,
                borderBottomWidth: index === rows.length - 1 ? StyleSheet.hairlineWidth : 0,
                opacity: pressed && item.source === 'manual' ? 0.6 : 1,
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
          </Pressable>
        )}
      />

      <FAB icon="plus" accessibilityLabel="Log measurements" onPress={openLog} />

      <Modal visible={logOpen} animationType="slide" onRequestClose={closeLog}>
        <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
          <Row style={styles.modalHeader}>
            <Pressable onPress={closeLog}>
              <Text style={[type.body, { color: t.accent }]}>Cancel</Text>
            </Pressable>
            <Text style={[type.heading, { color: t.ink }]}>Log Measurements</Text>
            <Pressable onPress={saveLog} disabled={saving || !canSave}>
              <Text style={[type.body, { color: t.accent, fontWeight: '600', opacity: saving || !canSave ? 0.4 : 1 }]}>
                Save
              </Text>
            </Pressable>
          </Row>

          <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <ScrollView contentContainerStyle={styles.logScroll}>
              <Card style={styles.dateCard}>
                <Row style={styles.dateRow}>
                  <Text style={[type.body, { color: t.ink }]}>Date</Text>
                  <Pressable onPress={() => setShowDatePicker(true)}>
                    <Text style={[type.body, { color: t.accent }]}>
                      {date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </Pressable>
                </Row>
              </Card>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(_event, selected) => {
                    setShowDatePicker(false);
                    if (selected) setDate(selected);
                  }}
                />
              )}

              <Card style={styles.photoCard}>
                <Overline>Progress Picture</Overline>
                {imageUri !== null ? (
                  <Image source={{ uri: imageUri }} style={styles.preview} />
                ) : (
                  <Row gap={space.m}>
                    <AppButton title="Take photo" onPress={() => void pickImage('camera')} variant="secondary" small />
                    <AppButton
                      title="Choose from library"
                      onPress={() => void pickImage('library')}
                      variant="secondary"
                      small
                    />
                  </Row>
                )}
              </Card>

              {saveError !== null && <Text style={[type.caption, { color: t.danger }]}>{saveError}</Text>}

              <Overline>Measurements</Overline>
              <Card style={styles.fieldsCard}>
                {FIELDS.map((f) => (
                  <Field
                    key={f.metricType}
                    label={`${f.label} (${f.unit})`}
                    placeholder="—"
                    keyboardType="decimal-pad"
                    value={values[f.metricType] ?? ''}
                    onChangeText={(txt) => setValues((v) => ({ ...v, [f.metricType]: txt }))}
                  />
                ))}
              </Card>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  list: { padding: space.l, paddingTop: space.s },
  header: { gap: space.m, marginBottom: space.xs },
  hero: { gap: space.xs, alignItems: 'center' },
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
  modalHeader: {
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingVertical: space.m,
  },
  logScroll: { padding: space.l, paddingTop: space.s, gap: space.m },
  dateCard: { paddingVertical: space.s },
  dateRow: { justifyContent: 'space-between' },
  photoCard: { gap: space.m },
  preview: { width: '100%', height: 200, borderRadius: radius.card },
  fieldsCard: { gap: space.m },
});
