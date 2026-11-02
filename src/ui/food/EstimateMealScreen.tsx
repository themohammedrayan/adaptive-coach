import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inferDefaultUnitId, type Food, type Meal } from '../../food-log';
import {
  EstimateUnavailableError,
  estimateMeal,
  mealEstimateToCreateFoodInput,
  type MealEstimate,
} from '../../meal-estimate';
import { AppButton, Card, EmptyState, Field, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { CreateFoodForm } from './CreateFoodForm';
import { MEAL_PHOTO_BUCKET, useFoodData } from './FoodDataContext';
import { PortionForm } from './FoodLogScreen';
import { FoodPhoto } from './components/FoodPhoto';
import { useImagePick } from './useImagePick';
import { showAlert } from '../../lib/alert';

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/**
 * v2 — AI meal estimation. Reached from FoodLogScreen's add-food modal.
 * Nothing here can reach saveFood()/logEntry() without passing through the
 * same editable CreateFoodForm manual entry uses — that review step is the real
 * safety net, not the model's output.
 *
 * The round trip now ends in the log rather than back at search: after the
 * review it lands on the normal portion step, pre-filled from the estimate's
 * `estimatedGrams`, and logs the entry. The photo the estimate was made from is
 * kept — on the entry (so you can re-check what the model looked at) and, for a
 * newly created food, as the catalog thumbnail.
 */
export function EstimateMealScreen({ meal }: { meal: Meal | null }) {
  const t = useTheme();
  const router = useRouter();
  const { units, loading, logEntry, toggleFavorite } = useFoodData();
  const image = useImagePick();

  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [reviewed, setReviewed] = useState<Food | null>(null);

  const targetMeal: Meal = meal ?? 'snack';
  const mealLabel = MEAL_LABELS[targetMeal];
  // Seeded from the estimated food's name rather than always units[0] (gram),
  // so a saved "Boiled egg" defaults to eggs and "Milk" to ml next time it is
  // logged. CreateFoodForm still shows this as an editable choice.
  const defaultUnitId = inferDefaultUnitId(estimate?.name ?? description, units);

  const runEstimate = async () => {
    if (description.trim() === '' && image.photo === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await estimateMeal({
        description: description.trim() === '' ? undefined : description.trim(),
        imageBase64: image.photo?.base64,
      });
      setEstimate(result);
    } catch (e) {
      if (e instanceof EstimateUnavailableError) {
        setUnavailable(true);
      } else {
        setError("Couldn't reach the estimator. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const logReviewed = async (quantity: number, unitId: string) => {
    if (reviewed === null) return;
    try {
      await logEntry({ foodId: reviewed.id, meal: targetMeal, quantity, unitId }, image.photo);
      // Favoriting keeps the estimate flow's old convenience: the food is one
      // tap away next time without re-searching for it.
      await toggleFavorite(reviewed.id, targetMeal);
      router.back();
    } catch (e) {
      showAlert('Couldn’t log that', e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    setEstimate(null);
    setUnavailable(false);
    setReviewed(null);
  };

  // Step 3 — portion, pre-filled from the estimate, then logged.
  if (reviewed !== null) {
    // estimatedGrams is the model's read of the whole portion, so it seeds the
    // gram unit at that quantity rather than being discarded as it used to be.
    const grams = estimate?.estimatedGrams ?? null;
    const useGrams = grams !== null && units.some((u) => u.id === 'gram');
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.card}>
            <Text style={[type.title, { color: t.ink }]}>{reviewed.name}</Text>
            <Text style={[type.caption, { color: t.muted }]}>
              {Math.round(reviewed.kcalPer100g)} kcal / 100g · adding to {mealLabel}
            </Text>
            {image.photo !== null && (
              <FoodPhoto bucket={MEAL_PHOTO_BUCKET} photoPath={null} photoLocalUri={image.photo.uri} />
            )}
            <PortionForm
              foodId={reviewed.id}
              units={units}
              initialQuantity={useGrams ? String(Math.round(grams)) : '1'}
              initialUnitId={useGrams ? 'gram' : reviewed.defaultUnitId}
              submitTitle={`Log to ${mealLabel}`}
              cancelTitle="Back"
              onSubmit={logReviewed}
              onCancel={() => setReviewed(null)}
            />
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  // Step 2 — review the estimate (or fall back to manual entry).
  if (estimate !== null || unavailable) {
    return (
      <Screen>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={[type.caption, { color: estimate !== null ? t.muted : t.warning }]}>
              {estimate !== null
                ? `Estimated with ${estimate.confidence} confidence — review and edit before saving.`
                : "Couldn't produce a confident estimate — enter the food manually instead."}
            </Text>
            <CreateFoodForm
              defaultUnitId={defaultUnitId}
              units={units}
              initialValues={
                estimate !== null
                  ? {
                      ...mealEstimateToCreateFoodInput(estimate, defaultUnitId),
                      source: 'estimate',
                      photo: image.photo,
                    }
                  : { name: description.trim(), photo: image.photo }
              }
              submitTitle="Save and choose portion"
              onDone={setReviewed}
              onCancel={reset}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // Step 1 — describe and/or photograph the meal.
  return (
    <Screen>
      <View style={styles.header}>
        <AppButton title="← Back" onPress={() => router.back()} variant="ghost" small />
        <Text style={[type.heading, { color: t.ink }]}>Estimate a meal</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.card}>
            <Field
              label="Describe the meal"
              placeholder="Two rotis with dal and a katori of rice"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <Row gap={space.m}>
              <AppButton title="Take photo" onPress={() => void image.pick('camera')} variant="secondary" small />
              <AppButton title="Choose from library" onPress={() => void image.pick('library')} variant="secondary" small />
            </Row>
            {image.photo !== null && (
              <FoodPhoto bucket={MEAL_PHOTO_BUCKET} photoPath={null} photoLocalUri={image.photo.uri} />
            )}
            {(error ?? image.error) !== null && (
              <Text style={[type.caption, { color: t.danger }]}>{error ?? image.error}</Text>
            )}
            <AppButton
              title="Estimate"
              onPress={runEstimate}
              busy={busy}
              disabled={description.trim() === '' && image.photo === null}
            />
          </Card>
          {units.length === 0 && (
            <EmptyState message={loading ? 'Loading your units…' : "Couldn't load your units."} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.l,
    paddingVertical: space.s,
  },
  headerSpacer: { width: 60 },
  scroll: { padding: space.l, gap: space.m },
  card: { gap: space.m },
});
