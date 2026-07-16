import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addDays } from '../engine';
import {
  addFavorite,
  addLogEntry,
  copyDay,
  createFood,
  listFavorites,
  removeFavorite,
  searchFoods,
  sumEntryMacros,
  type Favorite,
  type Food,
  type LogEntry,
  type Meal,
  type Unit,
} from '../food-log';
import { getFoodLogRuntime } from '../food-log/runtime';

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export function FoodLogScreen() {
  const [today, setToday] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const rt = await getFoodLogRuntime();
    const localDate = rt.toLocalDate(rt.nowUtc());
    setToday(localDate);
    setEntries(await rt.store.listEntriesByDate(localDate));
    setUnits(await rt.store.listUnits());
    const favs = await rt.store.listFavorites();
    setFavoriteIds(new Set(favs.map((f: Favorite) => f.foodId)));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sections = useMemo(
    () =>
      MEALS.map(({ key, label }) => {
        const data = entries.filter((e) => e.meal === key);
        const subtotal = sumEntryMacros(data);
        return { key, meal: key, title: `${label} · ${Math.round(subtotal.kcal)} kcal`, data };
      }),
    [entries],
  );

  const dayTotal = useMemo(() => sumEntryMacros(entries), [entries]);

  const copyYesterday = async () => {
    if (today === null) return;
    setBusy(true);
    try {
      const rt = await getFoodLogRuntime();
      await copyDay(rt.store, addDays(today, -1), today, rt.nowUtc());
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteEntry = async (id: string) => {
    const rt = await getFoodLogRuntime();
    await rt.store.deleteEntry(id);
    await refresh();
  };

  const toggleFavorite = async (foodId: string) => {
    const rt = await getFoodLogRuntime();
    if (favoriteIds.has(foodId)) {
      await removeFavorite(rt.store, foodId);
    } else {
      await addFavorite(rt.store, foodId, activeMeal, rt.nowUtc());
    }
    await refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.totalLine}>
          {Math.round(dayTotal.kcal)} kcal · P {Math.round(dayTotal.protein)}g · C{' '}
          {Math.round(dayTotal.carb)}g · F {Math.round(dayTotal.fat)}g · Fiber{' '}
          {Math.round(dayTotal.fiber)}g
          {dayTotal.macrosIncomplete ? ' (macros incomplete)' : ''}
        </Text>
        <Button title={busy ? 'Copying…' : 'Copy yesterday'} onPress={copyYesterday} disabled={busy} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Button title="+ Add" onPress={() => setActiveMeal(section.meal)} />
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <Text style={styles.entryName}>
              {item.quantity} × {item.unitId} ({Math.round(item.grams)}g)
            </Text>
            <Text style={styles.entryKcal}>{Math.round(item.kcal)} kcal</Text>
            <TouchableOpacity onPress={() => deleteEntry(item.id)}>
              <Text style={styles.deleteLabel}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nothing logged today yet.</Text>}
      />

      {activeMeal !== null && (
        <AddPanel
          meal={activeMeal}
          units={units}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          onClose={() => setActiveMeal(null)}
          onLogged={refresh}
        />
      )}
    </View>
  );
}

function AddPanel({
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unitId, setUnitId] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadFavorites = useCallback(async () => {
    const rt = await getFoodLogRuntime();
    setFavorites(await listFavorites(rt.store));
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const runSearch = useCallback(async (q: string) => {
    setQuery(q);
    const rt = await getFoodLogRuntime();
    setResults(q.trim() === '' ? [] : await searchFoods(rt.store, q));
  }, []);

  const pickFood = (food: Food) => {
    setSelected(food);
    setUnitId(food.defaultUnitId);
    setQuantity('1');
  };

  const logSelected = async () => {
    if (selected === null) return;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const rt = await getFoodLogRuntime();
    await addLogEntry(
      rt.store,
      { foodId: selected.id, meal, quantity: qty, unitId, loggedAt: rt.nowUtc() },
      rt.toLocalDate,
    );
    setSelected(null);
    onClose();
    onLogged();
  };

  if (selected !== null) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{selected.name}</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.qtyInput}
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={setQuantity}
          />
          <View style={styles.unitRow}>
            {units.map((u) => (
              <TouchableOpacity key={u.id} onPress={() => setUnitId(u.id)}>
                <Text style={[styles.unitChip, unitId === u.id && styles.unitChipActive]}>
                  {u.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.addRow}>
          <Button title="Log" onPress={logSelected} />
          <Button title="Back" onPress={() => setSelected(null)} />
        </View>
      </View>
    );
  }

  if (showCreate) {
    return <CreateFoodForm defaultUnitId={units[0]?.id ?? ''} units={units} onDone={(food) => { setShowCreate(false); pickFood(food); }} onCancel={() => setShowCreate(false)} />;
  }

  return (
    <View style={styles.panel}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Search your foods…"
          value={query}
          onChangeText={runSearch}
        />
        <Button title="Close" onPress={onClose} />
      </View>

      {query.trim() === '' && favorites.length > 0 && (
        <>
          <Text style={styles.panelSubtitle}>Favorites</Text>
          {favorites.map((f) => (
            <FoodRow key={f.id} food={f} isFavorite onToggleFavorite={onToggleFavorite} onPick={pickFood} />
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
            />
          ))}
          {results.length === 0 && (
            <View style={styles.addRow}>
              <Text style={styles.empty}>No matches for "{query}".</Text>
              <Button title={`Create '${query}'`} onPress={() => setShowCreate(true)} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function FoodRow({
  food,
  isFavorite,
  onToggleFavorite,
  onPick,
}: {
  food: Food;
  isFavorite: boolean;
  onToggleFavorite: (foodId: string) => void;
  onPick: (food: Food) => void;
}) {
  return (
    <View style={styles.foodRow}>
      <TouchableOpacity style={styles.foodRowMain} onPress={() => onPick(food)}>
        <Text style={styles.foodName}>{food.name}</Text>
        <Text style={styles.foodMeta}>{Math.round(food.kcalPer100g)} kcal/100g</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onToggleFavorite(food.id)}>
        <Text style={styles.star}>{isFavorite ? '★' : '☆'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreateFoodForm({
  defaultUnitId,
  units,
  onDone,
  onCancel,
}: {
  defaultUnitId: string;
  units: Unit[];
  onDone: (food: Food) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [kcalOnly, setKcalOnly] = useState(false);
  const [protein, setProtein] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [kcal, setKcal] = useState('');

  const save = async () => {
    if (name.trim() === '') return;
    const rt = await getFoodLogRuntime();
    const food = await createFood(
      rt.store,
      kcalOnly
        ? {
            name,
            proteinPer100g: null,
            carbPer100g: null,
            fatPer100g: null,
            fiberPer100g: fiber === '' ? null : Number(fiber),
            kcalPer100g: Number(kcal),
            defaultUnitId,
          }
        : {
            name,
            proteinPer100g: Number(protein) || 0,
            carbPer100g: Number(carb) || 0,
            fatPer100g: Number(fat) || 0,
            fiberPer100g: fiber === '' ? null : Number(fiber),
            defaultUnitId,
          },
      rt.nowUtc(),
    );
    onDone(food);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>New food (per 100g)</Text>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TouchableOpacity onPress={() => setKcalOnly(!kcalOnly)}>
        <Text style={styles.toggleLabel}>
          {kcalOnly ? '☑' : '☐'} kcal-only (I don't know the macros)
        </Text>
      </TouchableOpacity>
      {kcalOnly ? (
        <TextInput
          style={styles.input}
          placeholder="Calories per 100g"
          keyboardType="decimal-pad"
          value={kcal}
          onChangeText={setKcal}
        />
      ) : (
        <View style={styles.addRow}>
          <TextInput style={styles.qtyInput} placeholder="Protein g" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} />
          <TextInput style={styles.qtyInput} placeholder="Carb g" keyboardType="decimal-pad" value={carb} onChangeText={setCarb} />
          <TextInput style={styles.qtyInput} placeholder="Fat g" keyboardType="decimal-pad" value={fat} onChangeText={setFat} />
        </View>
      )}
      <TextInput style={styles.input} placeholder="Fiber g (optional)" keyboardType="decimal-pad" value={fiber} onChangeText={setFiber} />
      {units.length > 0 && <Text style={styles.panelSubtitle}>Default unit: {units.find((u) => u.id === defaultUnitId)?.name}</Text>}
      <View style={styles.addRow}>
        <Button title="Save" onPress={save} />
        <Button title="Cancel" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  totalLine: { fontSize: 14, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f4f4f5',
  },
  sectionTitle: { fontWeight: '600' },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  entryName: { flex: 1 },
  entryKcal: { color: '#666', marginHorizontal: 8 },
  deleteLabel: { color: '#c00' },
  empty: { textAlign: 'center', color: '#999', padding: 12 },
  panel: { padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: '#ddd', maxHeight: '55%' },
  panelTitle: { fontWeight: '700', fontSize: 16 },
  panelSubtitle: { color: '#666', marginTop: 8 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, minWidth: 120 },
  qtyInput: { width: 70, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  unitChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  unitChipActive: { backgroundColor: '#e8f0fe', borderColor: '#1a56db', color: '#1a56db' },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  foodRowMain: { flex: 1 },
  foodName: { fontWeight: '600' },
  foodMeta: { color: '#666', fontSize: 12 },
  star: { fontSize: 18, paddingHorizontal: 8 },
  toggleLabel: { color: '#1a56db' },
});
