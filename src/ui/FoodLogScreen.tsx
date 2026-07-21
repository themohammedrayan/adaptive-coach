import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDays } from '../engine';
import {
  addFavorite,
  addLogEntry,
  copyDay,
  editLogEntry,
  listFavorites,
  removeFavorite,
  searchFoods,
  setFoodUnitOverride,
  sumEntryMacros,
  type Favorite,
  type Food,
  type LogEntry,
  type Meal,
  type Unit,
} from '../food-log';
import { getFoodLogRuntime } from '../food-log/runtime';
import { CreateFoodForm } from './CreateFoodForm';
import { AppButton, Card, Chip, Dot, EmptyState, Field, Row } from './kit';
import { radius, space, type, useTheme, type Theme } from './theme';

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export function FoodLogScreen() {
  const t = useTheme();
  const [today, setToday] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [foodNames, setFoodNames] = useState<Map<string, string>>(new Map());
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null);
  const [actionEntry, setActionEntry] = useState<LogEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rt = await getFoodLogRuntime();
      const localDate = rt.toLocalDate(rt.nowUtc());
      setToday(localDate);
      setEntries(await rt.store.listEntriesByDate(localDate));
      setUnits(await rt.store.listUnits());
      // Include archived so historical entries still resolve to a name.
      const foods = await rt.store.listFoods(true);
      setFoodNames(new Map(foods.map((f: Food) => [f.id, f.name])));
      const favs = await rt.store.listFavorites();
      setFavoriteIds(new Set(favs.map((f: Favorite) => f.foodId)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      try {
        const rt = await getFoodLogRuntime();
        await rt.sync(false); // sync-on-open, mirrors data-sync's WeightScreen convention
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      await refresh();
    })();
  }, [refresh]);

  const unitNames = useMemo(() => new Map(units.map((u) => [u.id, u.name])), [units]);

  const sections = useMemo(
    () =>
      MEALS.map(({ key, label }) => {
        const data = entries.filter((e) => e.meal === key);
        const subtotal = sumEntryMacros(data);
        return { key, meal: key, label, kcal: Math.round(subtotal.kcal), data };
      }),
    [entries],
  );

  const dayTotal = useMemo(() => sumEntryMacros(entries), [entries]);

  const copyYesterday = async () => {
    if (today === null) return;
    setBusy(true);
    setCopyError(null);
    try {
      const rt = await getFoodLogRuntime();
      await copyDay(rt.store, addDays(today, -1), today, rt.nowUtc());
      await refresh();
      void rt.sync(true); // opportunistic push; offline is fine, outbox retries
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async (foodId: string) => {
    try {
      const rt = await getFoodLogRuntime();
      if (favoriteIds.has(foodId)) {
        await removeFavorite(rt.store, foodId, rt.nowUtc());
      } else {
        await addFavorite(rt.store, foodId, activeMeal, rt.nowUtc());
      }
      await refresh();
      void rt.sync(true); // opportunistic push; offline is fine, outbox retries
    } catch (e) {
      Alert.alert('Couldn’t update favorite', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.flex}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <Card style={styles.summary}>
            <Row style={styles.spaceBetween}>
              <Text style={[type.hero, { color: t.ink }]}>
                {Math.round(dayTotal.kcal)}
                <Text style={[type.heading, { color: t.muted }]}> kcal</Text>
              </Text>
              <AppButton
                title="Copy yesterday"
                onPress={copyYesterday}
                variant="secondary"
                small
                busy={busy}
              />
            </Row>
            <Row style={styles.wrap} gap={space.m}>
              <MacroPill color={t.chart.protein} label={`P ${Math.round(dayTotal.protein)}g`} t={t} />
              <MacroPill color={t.chart.carb} label={`C ${Math.round(dayTotal.carb)}g`} t={t} />
              <MacroPill color={t.chart.fat} label={`F ${Math.round(dayTotal.fat)}g`} t={t} />
              <MacroPill color={t.muted} label={`Fiber ${Math.round(dayTotal.fiber)}g`} t={t} />
            </Row>
            {dayTotal.macrosIncomplete && (
              <Text style={[type.caption, { color: t.warning }]}>
                Some foods are kcal-only — macro totals are incomplete.
              </Text>
            )}
            {copyError !== null && (
              <Text style={[type.caption, { color: t.danger }]}>Couldn’t copy yesterday: {copyError}</Text>
            )}
          </Card>
        }
        renderSectionHeader={({ section }) => (
          <Row style={[styles.sectionHeader, styles.spaceBetween]}>
            <Text style={[type.heading, { color: t.ink }]}>
              {section.label}
              {section.data.length > 0 && (
                <Text style={[type.caption, { color: t.muted }]}>  {section.kcal} kcal</Text>
              )}
            </Text>
            <AppButton title="+ Add" onPress={() => setActiveMeal(section.meal)} variant="ghost" small />
          </Row>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.entryRow, { backgroundColor: t.card, borderColor: t.hairline }]}
            onPress={() => setActionEntry(item)}
          >
            <View style={styles.flex}>
              <Text style={[type.body, { color: t.ink, fontWeight: '500' }]} numberOfLines={1}>
                {foodNames.get(item.foodId) ?? 'Food'}
              </Text>
              <Text style={[type.caption, { color: t.muted }]}>
                {item.quantity} × {unitNames.get(item.unitId) ?? item.unitId} · {Math.round(item.grams)}g
              </Text>
            </View>
            <Text style={[type.body, { color: t.secondary }]}>{Math.round(item.kcal)} kcal</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState message={error ?? 'Nothing logged today yet.'} />}
      />

      {activeMeal !== null && (
        <AddSheet
          meal={activeMeal}
          units={units}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          onClose={() => setActiveMeal(null)}
          onLogged={refresh}
        />
      )}

      {actionEntry !== null && (
        <EntryActionSheet
          entry={actionEntry}
          foodName={foodNames.get(actionEntry.foodId) ?? 'Food'}
          unitName={unitNames.get(actionEntry.unitId) ?? actionEntry.unitId}
          units={units}
          onClose={() => setActionEntry(null)}
          onChanged={refresh}
        />
      )}
    </View>
  );
}

function MacroPill({ color, label, t }: { color: string; label: string; t: Theme }) {
  return (
    <Row gap={6}>
      <Dot color={color} />
      <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>{label}</Text>
    </Row>
  );
}

function AddSheet({
  meal,
  units,
  favoriteIds,
  onToggleFavorite,
  onClose,
  onLogged,
}: {
  meal: Meal;
  units: Unit[];
  favoriteIds: Set<string>;
  onToggleFavorite: (foodId: string) => void;
  onClose: () => void;
  onLogged: () => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    try {
      const rt = await getFoodLogRuntime();
      setFavorites(await listFavorites(rt.store));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  // Refresh on return from /estimate-meal (v2) — a food created there is
  // favorited so it shows up here without the user having to re-search.
  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites]),
  );

  const runSearch = useCallback(async (q: string) => {
    setQuery(q);
    try {
      const rt = await getFoodLogRuntime();
      setResults(q.trim() === '' ? [] : await searchFoods(rt.store, q));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const pickFood = (food: Food) => setSelected(food);

  const logSelected = async (quantity: number, unitId: string) => {
    if (selected === null) return;
    try {
      const rt = await getFoodLogRuntime();
      await addLogEntry(
        rt.store,
        { foodId: selected.id, meal, quantity, unitId, loggedAt: rt.nowUtc() },
        rt.toLocalDate,
      );
      setSelected(null);
      onClose();
      onLogged();
      void rt.sync(true); // opportunistic push; offline is fine, outbox retries
    } catch (e) {
      setLogError(e instanceof Error ? e.message : String(e));
    }
  };

  const mealLabel = MEALS.find((m) => m.key === meal)?.label ?? meal;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <View style={[styles.handle, { backgroundColor: t.wash }]} />

          {selected !== null ? (
            <View style={styles.sheetBody}>
              <Text style={[type.title, { color: t.ink }]}>{selected.name}</Text>
              <Text style={[type.caption, { color: t.muted }]}>
                {Math.round(selected.kcalPer100g)} kcal / 100g · adding to {mealLabel}
              </Text>
              <PortionForm
                foodId={selected.id}
                units={units}
                initialQuantity="1"
                initialUnitId={selected.defaultUnitId}
                submitTitle={`Log to ${mealLabel}`}
                cancelTitle="Back"
                onSubmit={logSelected}
                onCancel={() => setSelected(null)}
              />
              {logError !== null && (
                <Text style={[type.caption, { color: t.danger }]}>{logError}</Text>
              )}
            </View>
          ) : showCreate ? (
            <CreateFoodForm
              defaultUnitId={units[0]?.id ?? ''}
              units={units}
              initialValues={{ name: query }}
              onDone={(food) => {
                setShowCreate(false);
                pickFood(food);
              }}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
            <View style={styles.sheetBody}>
              <Text style={[type.heading, { color: t.ink }]}>Add to {mealLabel}</Text>
              {error !== null && <Text style={[type.caption, { color: t.danger }]}>{error}</Text>}
              <Field placeholder="Search your foods…" value={query} onChangeText={runSearch} autoFocus />
              <ScrollView style={styles.resultList} keyboardShouldPersistTaps="handled">
                {query.trim() === '' && favorites.length > 0 && (
                  <>
                    <Text style={[type.overline, { color: t.muted, marginBottom: space.s }]}>Favorites</Text>
                    {favorites.map((f) => (
                      <FoodRow key={f.id} food={f} isFavorite onToggleFavorite={onToggleFavorite} onPick={pickFood} t={t} />
                    ))}
                  </>
                )}
                {query.trim() !== '' && (
                  <>
                    {results.map((f) => (
                      <FoodRow
                        key={f.id}
                        food={f}
                        isFavorite={favoriteIds.has(f.id)}
                        onToggleFavorite={onToggleFavorite}
                        onPick={pickFood}
                        t={t}
                      />
                    ))}
                    {results.length === 0 && (
                      <View style={styles.noMatch}>
                        <Text style={[type.caption, { color: t.muted }]}>No matches for “{query}”.</Text>
                        <AppButton title={`Create “${query}”`} onPress={() => setShowCreate(true)} variant="secondary" small />
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
              <AppButton
                title="Estimate from photo/text →"
                onPress={() => router.push({ pathname: '/estimate-meal', params: { meal } })}
                variant="secondary"
                small
              />
              <AppButton title="Close" onPress={onClose} variant="ghost" />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Quantity + unit + editable grams-per-unit. A changed g/unit is saved as a
 * per-food unit override (Food-Log BRD §3) before submit, so the entry resolves
 * with it and it sticks for next time. Hidden for the gram unit (1g is 1g).
 */
function PortionForm({
  foodId,
  units,
  initialQuantity,
  initialUnitId,
  submitTitle,
  cancelTitle,
  onSubmit,
  onCancel,
}: {
  foodId: string;
  units: Unit[];
  initialQuantity: string;
  initialUnitId: string;
  submitTitle: string;
  cancelTitle: string;
  onSubmit: (quantity: number, unitId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unitId, setUnitId] = useState(initialUnitId);
  const [perUnitGrams, setPerUnitGrams] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const rt = await getFoodLogRuntime();
      const override = await rt.store.getOverride(foodId, unitId);
      const unit = await rt.store.getUnit(unitId);
      if (alive) setPerUnitGrams(String(override?.grams ?? unit?.defaultGrams ?? ''));
    })();
    return () => {
      alive = false;
    };
  }, [foodId, unitId]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    if (unitId !== 'gram') {
      const per = Number(perUnitGrams);
      if (Number.isFinite(per) && per > 0) {
        const rt = await getFoodLogRuntime();
        const override = await rt.store.getOverride(foodId, unitId);
        const unit = await rt.store.getUnit(unitId);
        if (per !== (override?.grams ?? unit?.defaultGrams)) {
          await setFoodUnitOverride(rt.store, foodId, unitId, per);
        }
      }
    }
    await onSubmit(qty, unitId);
  };

  return (
    <>
      <Row gap={space.m}>
        <Field
          label="Quantity"
          keyboardType="decimal-pad"
          value={quantity}
          onChangeText={setQuantity}
          style={styles.qty}
        />
        {unitId !== 'gram' && (
          <Field
            label={`g per ${units.find((u) => u.id === unitId)?.name ?? 'unit'}`}
            keyboardType="decimal-pad"
            value={perUnitGrams}
            onChangeText={setPerUnitGrams}
            style={styles.qty}
          />
        )}
      </Row>
      <View style={{ gap: 6 }}>
        <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>Unit</Text>
        <Row style={styles.wrap} gap={6}>
          {units.map((u) => (
            <Chip key={u.id} label={u.name} active={unitId === u.id} onPress={() => setUnitId(u.id)} />
          ))}
        </Row>
      </View>
      <AppButton title={submitTitle} onPress={submit} />
      <AppButton title={cancelTitle} onPress={onCancel} variant="ghost" />
    </>
  );
}

/** Deliberate per-entry actions — replaces the old instant-delete ✕ (accidental-touch hazard). */
function EntryActionSheet({
  entry,
  foodName,
  unitName,
  units,
  onClose,
  onChanged,
}: {
  entry: LogEntry;
  foodName: string;
  unitName: string;
  units: Unit[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const confirmDelete = () => {
    Alert.alert('Delete entry?', `${foodName} · ${Math.round(entry.kcal)} kcal`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const rt = await getFoodLogRuntime();
              await rt.store.deleteEntry(entry.id, rt.nowUtc());
              onClose();
              onChanged();
              void rt.sync(true); // opportunistic push; propagates the soft-delete
            } catch (e) {
              Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
            }
          })();
        },
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <View style={[styles.handle, { backgroundColor: t.wash }]} />
          <View style={styles.sheetBody}>
            <Text style={[type.title, { color: t.ink }]}>{foodName}</Text>
            <Text style={[type.caption, { color: t.muted }]}>
              {entry.quantity} × {unitName} · {Math.round(entry.grams)}g · {Math.round(entry.kcal)} kcal
            </Text>
            {editing ? (
              <>
                <PortionForm
                  foodId={entry.foodId}
                  units={units}
                  initialQuantity={String(entry.quantity)}
                  initialUnitId={entry.unitId}
                  submitTitle="Save changes"
                  cancelTitle="Back"
                  onSubmit={async (quantity, unitId) => {
                    try {
                      const rt = await getFoodLogRuntime();
                      await editLogEntry(rt.store, entry, { quantity, unitId }, rt.nowUtc());
                      onClose();
                      onChanged();
                      void rt.sync(true); // opportunistic push; offline is fine, outbox retries
                    } catch (e) {
                      setEditError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  onCancel={() => setEditing(false)}
                />
                {editError !== null && (
                  <Text style={[type.caption, { color: t.danger }]}>{editError}</Text>
                )}
              </>
            ) : (
              <>
                <AppButton title="Edit" onPress={() => setEditing(true)} />
                <AppButton title="Delete" onPress={confirmDelete} variant="danger" />
                <AppButton title="Cancel" onPress={onClose} variant="ghost" />
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FoodRow({
  food,
  isFavorite,
  onToggleFavorite,
  onPick,
  t,
}: {
  food: Food;
  isFavorite: boolean;
  onToggleFavorite: (foodId: string) => void;
  onPick: (food: Food) => void;
  t: Theme;
}) {
  return (
    <Row style={styles.foodRow}>
      <TouchableOpacity style={styles.flex} onPress={() => onPick(food)}>
        <Text style={[type.body, { color: t.ink, fontWeight: '500' }]}>{food.name}</Text>
        <Text style={[type.caption, { color: t.muted }]}>{Math.round(food.kcalPer100g)} kcal/100g</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onToggleFavorite(food.id)} hitSlop={8}>
        <Text style={{ fontSize: 20, color: isFavorite ? t.accent : t.muted }}>
          {isFavorite ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
    </Row>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
  spaceBetween: { justifyContent: 'space-between' },
  list: { padding: space.l, paddingTop: space.s, paddingBottom: space.xl },
  summary: { gap: space.m, marginBottom: space.s },
  sectionHeader: { marginTop: space.l, marginBottom: space.s },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.m,
    paddingHorizontal: space.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    marginBottom: 6,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: space.xl,
    maxHeight: '85%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 10 },
  sheetBody: { padding: space.l, gap: space.m },
  resultList: { maxHeight: 320 },
  qty: { width: 110 },
  foodRow: { paddingVertical: 10 },
  noMatch: { gap: space.s, alignItems: 'flex-start', paddingVertical: space.s },
});
