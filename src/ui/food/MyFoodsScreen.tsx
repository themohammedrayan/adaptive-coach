import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inferDefaultUnitId, normalizeFoodName, type Food } from '../../food-log';
import { AppButton, Card, EmptyState, Field, Row } from '../kit';
import { space, type, useTheme, type Theme } from '../theme';
import { CreateFoodForm } from './CreateFoodForm';
import { FOOD_PHOTO_BUCKET, useFoodData } from './FoodDataContext';
import { FoodEditorModal } from './components/FoodEditorModal';
import { FoodPhoto } from './components/FoodPhoto';

/**
 * Browse and edit the food catalog outside of logging a meal.
 *
 * Until this existed the only route to a food's definition was: open the log →
 * pick a meal → open the add sheet → type enough of the name to search →
 * long-press the row. Foods you had never favourited were invisible until
 * searched for, and the edit gesture was undocumented. This is the same data
 * with a list you can actually scroll and a visible Edit on every row.
 *
 * Archived foods are shown behind a toggle rather than dropped: "remove" is a
 * local hide, not a delete (the catalog is shared and append-only), so a hidden
 * food is exactly the thing a user comes here to bring back.
 */
export function MyFoodsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { foods, units, favoriteIds, loading, error, toggleFavorite } = useFoodData();

  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const q = normalizeFoodName(query);
    return foods
      .filter((f) => (showArchived ? f.archivedAt !== null : f.archivedAt === null))
      .filter((f) => q === '' || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, query, showArchived]);

  const activeCount = foods.filter((f) => f.archivedAt === null).length;
  const archivedCount = foods.length - activeCount;

  if (creating) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.page }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card>
            <CreateFoodForm
              defaultUnitId={inferDefaultUnitId(query, units)}
              units={units}
              initialValues={{ name: query }}
              onDone={() => setCreating(false)}
              onCancel={() => setCreating(false)}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.page }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Row style={styles.spaceBetween}>
          <Text style={[type.heading, { color: t.ink }]}>My foods</Text>
          <AppButton title="Back" onPress={() => router.back()} variant="ghost" small />
        </Row>

        {error !== null && <Text style={[type.caption, { color: t.danger }]}>{error}</Text>}

        <Field placeholder="Search your foods…" value={query} onChangeText={setQuery} />

        <Row gap={space.s}>
          <AppButton
            title={showArchived ? `Hidden (${archivedCount})` : `Active (${activeCount})`}
            onPress={() => setShowArchived((v) => !v)}
            variant="secondary"
            small
          />
          <AppButton title="New food" onPress={() => setCreating(true)} variant="secondary" small />
        </Row>

        {loading && visible.length === 0 ? (
          <EmptyState message="Loading your foods…" />
        ) : visible.length === 0 ? (
          <EmptyState
            message={
              query.trim() !== ''
                ? `No ${showArchived ? 'hidden' : 'active'} foods match “${query}”.`
                : showArchived
                  ? 'Nothing hidden. Foods you remove from your list show up here.'
                  : 'No foods yet. Create one, or add a meal from the food log.'
            }
            actionTitle={query.trim() !== '' && !showArchived ? `Create “${query}”` : undefined}
            onAction={query.trim() !== '' && !showArchived ? () => setCreating(true) : undefined}
          />
        ) : (
          <Card>
            {visible.map((food) => (
              <CatalogRow
                key={food.id}
                food={food}
                unitName={units.find((u) => u.id === food.defaultUnitId)?.name ?? food.defaultUnitId}
                isFavorite={favoriteIds.has(food.id)}
                onToggleFavorite={() => void toggleFavorite(food.id)}
                onEdit={() => setEditing(food)}
                t={t}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <FoodEditorModal visible={editing !== null} food={editing} onClose={() => setEditing(null)} />
    </SafeAreaView>
  );
}

function CatalogRow({
  food,
  unitName,
  isFavorite,
  onToggleFavorite,
  onEdit,
  t,
}: {
  food: Food;
  unitName: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  t: Theme;
}) {
  return (
    <Row style={[styles.row, { borderBottomColor: t.hairline }]} gap={space.m}>
      <FoodPhoto
        bucket={FOOD_PHOTO_BUCKET}
        photoPath={food.photoPath}
        photoLocalUri={food.photoLocalUri}
        size={36}
      />
      <TouchableOpacity style={styles.flex} onPress={onEdit}>
        <Text style={[type.body, { color: t.ink, fontWeight: '500' }]}>{food.name}</Text>
        <Text style={[type.caption, { color: t.muted }]}>
          {Math.round(food.kcalPer100g)} kcal/100g · logs in {unitName}
          {food.macrosComplete ? '' : ' · kcal only'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleFavorite} hitSlop={8}>
        <Text style={{ fontSize: 20, color: isFavorite ? t.accent : t.muted }}>
          {isFavorite ? '★' : '☆'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onEdit} hitSlop={8}>
        <Text style={[type.caption, { color: t.muted }]}>Edit</Text>
      </TouchableOpacity>
    </Row>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: space.l, gap: space.m, paddingBottom: space.xl },
  spaceBetween: { justifyContent: 'space-between' },
  row: {
    paddingVertical: 10,
    paddingHorizontal: space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
