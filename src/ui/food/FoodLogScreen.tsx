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
import { searchFoods, sumEntryMacros, type Food, type LogEntry, type Meal, type Unit } from '../../food-log';
import { getFoodLogRuntime } from '../../food-log/runtime';
import { AppButton, Card, Chip, Dot, EmptyState, Field, Row } from '../kit';
import { radius, space, type, useTheme, type Theme } from '../theme';
import { CreateFoodForm } from './CreateFoodForm';
import { FOOD_PHOTO_BUCKET, MEAL_PHOTO_BUCKET, useFoodData } from './FoodDataContext';
import { FoodEditorModal } from './components/FoodEditorModal';
import { FoodPhoto } from './components/FoodPhoto';
import { useImagePick } from './useImagePick';

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export function FoodLogScreen() {
  const t = useTheme();
  const { entries, units, foodsById, unitNames, favoriteIds, error, refresh, copyYesterday, toggleFavorite } =
    useFoodData();

  const [activeMeal, setActiveMeal] = useState<Meal | null>(null);
  const [actionEntry, setActionEntry] = useState<LogEntry | null>(null);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Picks up whatever /estimate-meal or /coach-log logged while we were away.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

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

  const onCopyYesterday = async () => {
    setBusy(true);
    setCopyError(null);
    try {
      await copyYesterday();
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onToggleFavorite = async (foodId: string) => {
    try {
      await toggleFavorite(foodId, activeMeal);
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
                onPress={onCopyYesterday}
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
        renderItem={({ item }) => {
          const food = foodsById.get(item.foodId);
          const ownPhoto = item.photoPath !== null || item.photoLocalUri !== null;
          return (
            <TouchableOpacity
              style={[styles.entryRow, { backgroundColor: t.card, borderColor: t.hairline }]}
              onPress={() => setActionEntry(item)}
            >
              {/* The meal's own photo when there is one, else the catalog thumbnail. */}
              <FoodPhoto
                bucket={ownPhoto ? MEAL_PHOTO_BUCKET : FOOD_PHOTO_BUCKET}
                photoPath={ownPhoto ? item.photoPath : (food?.photoPath ?? null)}
                photoLocalUri={ownPhoto ? item.photoLocalUri : (food?.photoLocalUri ?? null)}
                size={40}
              />
              <View style={styles.entryText}>
                <Text style={[type.body, { color: t.ink, fontWeight: '500' }]} numberOfLines={1}>
                  {food?.name ?? 'Food'}
                </Text>
                <Text style={[type.caption, { color: t.muted }]}>
                  {item.quantity} × {unitNames.get(item.unitId) ?? item.unitId} · {Math.round(item.grams)}g
                </Text>
              </View>
              <Text style={[type.body, { color: t.secondary }]}>{Math.round(item.kcal)} kcal</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<EmptyState message={error ?? 'Nothing logged today yet.'} />}
      />

      {activeMeal !== null && (
        <AddSheet
          meal={activeMeal}
          units={units}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          onEditFood={(food) => {
            setActiveMeal(null);
            setEditingFood(food);
          }}
          onClose={() => setActiveMeal(null)}
        />
      )}

      {actionEntry !== null && (
        <EntryActionSheet
          entry={actionEntry}
          foodName={foodsById.get(actionEntry.foodId)?.name ?? 'Food'}
          unitName={unitNames.get(actionEntry.unitId) ?? actionEntry.unitId}
          units={units}
          onClose={() => setActionEntry(null)}
        />
      )}

      <FoodEditorModal
        visible={editingFood !== null}
        food={editingFood}
        onClose={() => setEditingFood(null)}
      />
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
  onEditFood,
  onClose,
}: {
  meal: Meal;
  units: Unit[];
  favoriteIds: Set<string>;
  onToggleFavorite: (foodId: string) => void;
  onEditFood: (food: Food) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const { foods, foodsById, favorites, logEntry } = useFoodData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const favoriteFoods = useMemo(
    () =>
      favorites
        .map((f) => foodsById.get(f.foodId))
        .filter((f): f is Food => f !== undefined && f.archivedAt === null),
    [favorites, foodsById],
  );

  // `foods` is a dependency so a food created mid-sheet lands in the results.
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (query.trim() === '') {
        if (alive) setResults([]);
        return;
      }
      try {
        const rt = await getFoodLogRuntime();
        const found = await searchFoods(rt.store, query);
        if (alive) {
          setResults(found);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [query, foods]);

  const logSelected = async (quantity: number, unitId: string) => {
    if (selected === null) return;
    try {
      await logEntry({ foodId: selected.id, meal, quantity, unitId });
      setSelected(null);
      onClose();
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
                setSelected(food);
              }}
              onCancel={() => setShowCreate(false)}
            />
          ) : (
            <View style={styles.sheetBody}>
              <Text style={[type.heading, { color: t.ink }]}>Add to {mealLabel}</Text>
              {error !== null && <Text style={[type.caption, { color: t.danger }]}>{error}</Text>}
              <Field placeholder="Search foods…" value={query} onChangeText={setQuery} autoFocus />
              <ScrollView style={styles.resultList} keyboardShouldPersistTaps="handled">
                {query.trim() === '' && favoriteFoods.length > 0 && (
                  <>
                    <Text style={[type.overline, { color: t.muted, marginBottom: space.s }]}>Favorites</Text>
                    {favoriteFoods.map((f) => (
                      <FoodRow
                        key={f.id}
                        food={f}
                        isFavorite
                        onToggleFavorite={onToggleFavorite}
                        onPick={setSelected}
                        onEdit={onEditFood}
                        t={t}
                      />
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
                        onPick={setSelected}
                        onEdit={onEditFood}
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
                title="Tell the coach what you ate →"
                onPress={() => router.push({ pathname: '/coach-log', params: { meal } })}
                variant="secondary"
                small
              />
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
export function PortionForm({
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
  const { units: allUnits, getOverrideGrams, setUnitOverride } = useFoodData();
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unitId, setUnitId] = useState(initialUnitId);
  const [perUnitGrams, setPerUnitGrams] = useState('');
  const [busy, setBusy] = useState(false);

  const unitDefault = allUnits.find((u) => u.id === unitId)?.defaultGrams;
  const currentPerUnit = getOverrideGrams(foodId, unitId) ?? unitDefault;

  useEffect(() => {
    setPerUnitGrams(String(currentPerUnit ?? ''));
  }, [currentPerUnit]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    setBusy(true);
    try {
      if (unitId !== 'gram') {
        const per = Number(perUnitGrams);
        if (Number.isFinite(per) && per > 0 && per !== currentPerUnit) {
          await setUnitOverride(foodId, unitId, per);
        }
      }
      await onSubmit(qty, unitId);
    } finally {
      setBusy(false);
    }
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
      <AppButton title={submitTitle} onPress={submit} busy={busy} />
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
}: {
  entry: LogEntry;
  foodName: string;
  unitName: string;
  units: Unit[];
  onClose: () => void;
}) {
  const t = useTheme();
  const { editEntry, deleteEntry, setEntryPhoto } = useFoodData();
  const image = useImagePick();
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const hasPhoto = entry.photoPath !== null || entry.photoLocalUri !== null;

  // The picker is async and lands its result in `image.photo`; upload as soon as
  // one arrives rather than making the user confirm a second time.
  const picked = image.photo;
  useEffect(() => {
    if (picked === null) return;
    image.clear();
    void setEntryPhoto(entry, picked).catch((e: unknown) =>
      setEditError(e instanceof Error ? e.message : String(e)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const confirmDelete = () => {
    Alert.alert('Delete entry?', `${foodName} · ${Math.round(entry.kcal)} kcal`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteEntry(entry.id);
              onClose();
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
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={[type.title, { color: t.ink }]}>{foodName}</Text>
            <Text style={[type.caption, { color: t.muted }]}>
              {entry.quantity} × {unitName} · {Math.round(entry.grams)}g · {Math.round(entry.kcal)} kcal
            </Text>
            {hasPhoto && (
              <FoodPhoto
                bucket={MEAL_PHOTO_BUCKET}
                photoPath={entry.photoPath}
                photoLocalUri={entry.photoLocalUri}
              />
            )}
            {entry.photoLocalUri !== null && entry.photoPath === null && (
              <Text style={[type.caption, { color: t.warning }]}>
                Photo is on this device only — the upload didn’t go through. Replace it to try again.
              </Text>
            )}
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
                      await editEntry(entry, { quantity, unitId });
                      onClose();
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
                <Row gap={space.s}>
                  <AppButton
                    title={hasPhoto ? 'Replace photo' : 'Add photo'}
                    onPress={() => void image.pick('camera')}
                    variant="secondary"
                    small
                  />
                  <AppButton title="Choose" onPress={() => void image.pick('library')} variant="secondary" small />
                </Row>
                {(editError ?? image.error) !== null && (
                  <Text style={[type.caption, { color: t.danger }]}>{editError ?? image.error}</Text>
                )}
                <AppButton title="Delete" onPress={confirmDelete} variant="danger" />
                <AppButton title="Cancel" onPress={onClose} variant="ghost" />
              </>
            )}
          </ScrollView>
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
  onEdit,
  t,
}: {
  food: Food;
  isFavorite: boolean;
  onToggleFavorite: (foodId: string) => void;
  onPick: (food: Food) => void;
  onEdit: (food: Food) => void;
  t: Theme;
}) {
  return (
    <Row style={styles.foodRow} gap={space.m}>
      <FoodPhoto
        bucket={FOOD_PHOTO_BUCKET}
        photoPath={food.photoPath}
        photoLocalUri={food.photoLocalUri}
        size={36}
      />
      <TouchableOpacity style={styles.flex} onPress={() => onPick(food)} onLongPress={() => onEdit(food)}>
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
    gap: space.m,
    padding: space.m,
    paddingHorizontal: space.l,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.control,
    marginBottom: 6,
  },
  entryText: { flex: 1 },
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
