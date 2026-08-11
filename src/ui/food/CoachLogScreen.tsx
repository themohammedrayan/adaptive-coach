import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveMealItems, type CreateFoodInput, type Meal, type ResolvedMealItem } from '../../food-log';
import { EstimateUnavailableError, logMeal } from '../../meal-estimate';
import { AppButton, Card, EmptyState, Field, Row } from '../kit';
import { space, type, useTheme } from '../theme';
import { MEAL_PHOTO_BUCKET, useFoodData } from './FoodDataContext';
import { FoodPhoto } from './components/FoodPhoto';
import { MealItemCard, draftPortionKcal, type MealItemDraft } from './components/MealItemCard';
import { useImagePick } from './useImagePick';

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Catalog entries sent as grounding. Capped server-side too; this keeps the body small. */
const CATALOG_LIMIT = 200;

function numField(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}

function parseNonNeg(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toDraft(resolved: ResolvedMealItem): MealItemDraft {
  const macros = resolved.kind === 'new' ? resolved.draft : null;
  return {
    resolved,
    name: resolved.name,
    quantity: String(resolved.quantity),
    unitId: resolved.unitId,
    // Matched items need no approval — the food already exists. New ones do.
    approved: resolved.kind === 'matched',
    included: true,
    protein: numField(macros?.proteinPer100g),
    carb: numField(macros?.carbPer100g),
    fat: numField(macros?.fatPer100g),
    fiber: numField(macros?.fiberPer100g),
    kcal: numField(macros?.kcalPer100g),
  };
}

/**
 * "Tell the coach what you ate" — the conversational logging flow.
 *
 * Three steps, and the middle one is the point: the parse is reconciled against
 * the local catalog by resolveMealItems (a pure function, not the model), so a
 * food you already have is auto-selected and reused, and anything genuinely new
 * is blocked behind a per-item approval before it can be created. Nothing
 * reaches saveFood/logEntry that the user hasn't seen and accepted.
 *
 * This is deliberately a separate Edge Function from coach-chat rather than an
 * extension of it: coach-chat's number guard rejects any figure not already in
 * its payload, which is what keeps "the coach narrates, never computes" true
 * there. That rule stays untouched.
 */
export function CoachLogScreen({ meal }: { meal: Meal | null }) {
  const t = useTheme();
  const router = useRouter();
  const { foods, units, overrides, logEntry, saveFood } = useFoodData();
  const image = useImagePick();

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [clarification, setClarification] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<MealItemDraft[] | null>(null);

  const targetMeal: Meal = meal ?? 'snack';
  const mealLabel = MEAL_LABELS[targetMeal];

  const ask = async () => {
    if (message.trim() === '' && image.photo === null) return;
    setBusy(true);
    setError(null);
    setUnavailable(false);
    try {
      const catalog = foods
        .filter((f) => f.archivedAt === null)
        .slice(0, CATALOG_LIMIT)
        .map((f) => ({ catalogId: f.id, name: f.name }));

      const result = await logMeal({
        message: message.trim() === '' ? undefined : message.trim(),
        imageBase64: image.photo?.base64,
        catalog,
      });

      const resolved = resolveMealItems(result.items, {
        catalog: foods,
        units,
        overrides,
        fallbackUnitId: units[0]?.id ?? 'gram',
      });
      setDrafts(resolved.map(toDraft));
      setClarification(result.clarification);
    } catch (e) {
      if (e instanceof EstimateUnavailableError) {
        setUnavailable(true);
      } else {
        setError("Couldn't reach the coach. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const loggable = (drafts ?? []).filter((d) => d.included && d.approved);
  const awaitingApproval = (drafts ?? []).filter((d) => d.included && !d.approved).length;

  /**
   * Grams per unit for one draft, following the same precedence logEntry will:
   * the user's own per-food override first, then the unit default. Anything the
   * review screen shows has to be resolved the same way the entry is, or the
   * total previewed here wouldn't be the total that lands in the log.
   */
  const gramsPerUnitFor = (draft: MealItemDraft) => (unitId: string) => {
    const foodId = draft.resolved.kind === 'matched' ? draft.resolved.food.id : null;
    const override =
      foodId === null
        ? null
        : (overrides.find((o) => o.foodId === foodId && o.unitId === unitId && o.deletedAt === null) ??
          null);
    if (override !== null) return override.grams;
    return units.find((u) => u.id === unitId)?.defaultGrams ?? 1;
  };

  const portions = loggable.map((d) => draftPortionKcal(d, gramsPerUnitFor(d)(d.unitId)));
  const totalKcal = portions.reduce((sum, p) => sum + (p?.kcal ?? 0), 0);
  const totalIncomplete = portions.some((p) => p === null);

  const logAll = async () => {
    if (loggable.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const draft of loggable) {
        const quantity = Number(draft.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Enter a quantity for ${draft.name}.`);
        }

        let foodId: string;
        if (draft.resolved.kind === 'matched') {
          foodId = draft.resolved.food.id;
        } else {
          const protein = parseNonNeg(draft.protein);
          const carb = parseNonNeg(draft.carb);
          const fat = parseNonNeg(draft.fat);
          const kcal = parseNonNeg(draft.kcal);
          const macrosComplete = protein !== null && carb !== null && fat !== null;
          if (!macrosComplete && kcal === null) {
            throw new Error(`Enter macros or calories for ${draft.name}.`);
          }

          const input: CreateFoodInput = {
            name: draft.name.trim(),
            proteinPer100g: macrosComplete ? protein : null,
            carbPer100g: macrosComplete ? carb : null,
            fatPer100g: macrosComplete ? fat : null,
            fiberPer100g: parseNonNeg(draft.fiber),
            kcalPer100g: macrosComplete ? undefined : (kcal as number),
            defaultUnitId: draft.unitId,
            source: 'coach',
          };
          const created = await saveFood(null, input);
          foodId = created.food.id;
        }

        await logEntry({ foodId, meal: targetMeal, quantity, unitId: draft.unitId }, image.photo);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (index: number, next: MealItemDraft) => {
    setDrafts((prev) => (prev === null ? prev : prev.map((d, i) => (i === index ? next : d))));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <AppButton
          title="← Back"
          onPress={() => (drafts === null ? router.back() : setDrafts(null))}
          variant="ghost"
          small
        />
        <Text style={[type.heading, { color: t.ink }]}>
          {drafts === null ? 'What did you eat?' : `Review · ${mealLabel}`}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {drafts === null ? (
            <Card style={styles.card}>
              <Field
                label={`Tell the coach what you had for ${mealLabel.toLowerCase()}`}
                placeholder="Two rotis, dal and a katori of rice"
                value={message}
                onChangeText={setMessage}
                multiline
              />
              <Row gap={space.m}>
                <AppButton title="Take photo" onPress={() => void image.pick('camera')} variant="secondary" small />
                <AppButton
                  title="Choose from library"
                  onPress={() => void image.pick('library')}
                  variant="secondary"
                  small
                />
              </Row>
              {image.photo !== null && (
                <FoodPhoto bucket={MEAL_PHOTO_BUCKET} photoPath={null} photoLocalUri={image.photo.uri} />
              )}
              {unavailable && (
                <Text style={[type.caption, { color: t.warning }]}>
                  The coach couldn’t make sense of that. Try naming the foods and portions, or add them from
                  the log directly.
                </Text>
              )}
              {(error ?? image.error) !== null && (
                <Text style={[type.caption, { color: t.danger }]}>{error ?? image.error}</Text>
              )}
              <AppButton
                title="Ask the coach"
                onPress={ask}
                busy={busy}
                disabled={message.trim() === '' && image.photo === null}
              />
            </Card>
          ) : (
            <>
              {clarification !== null && (
                <Card>
                  <Text style={[type.caption, { color: t.secondary }]}>{clarification}</Text>
                </Card>
              )}
              {drafts.length === 0 && <EmptyState message="The coach didn’t find any foods in that." />}
              {drafts.map((draft, i) => (
                <MealItemCard
                  key={`${draft.resolved.name}-${i}`}
                  draft={draft}
                  units={units}
                  gramsPerUnit={gramsPerUnitFor(draft)}
                  onChange={(next) => updateDraft(i, next)}
                />
              ))}
              {loggable.length > 0 && (
                <Card>
                  <Row style={styles.spaceBetween}>
                    <Text style={[type.body, { color: t.secondary }]}>
                      {loggable.length === 1 ? '1 item' : `${loggable.length} items`} to {mealLabel}
                    </Text>
                    <Text style={[type.title, { color: t.ink }]}>
                      {totalIncomplete ? '≥ ' : ''}
                      {Math.round(totalKcal)}
                      <Text style={[type.caption, { color: t.muted }]}> kcal</Text>
                    </Text>
                  </Row>
                  {totalIncomplete && (
                    <Text style={[type.caption, { color: t.muted }]}>
                      Some items are still missing macros or a quantity, so they aren’t counted yet.
                    </Text>
                  )}
                </Card>
              )}
              {awaitingApproval > 0 && (
                <Text style={[type.caption, { color: t.warning }]}>
                  {awaitingApproval} new {awaitingApproval === 1 ? 'food needs' : 'foods need'} your approval
                  before {awaitingApproval === 1 ? 'it can' : 'they can'} be logged.
                </Text>
              )}
              {error !== null && <Text style={[type.caption, { color: t.danger }]}>{error}</Text>}
              <AppButton
                title={
                  loggable.length === 1
                    ? `Log 1 item to ${mealLabel}`
                    : `Log ${loggable.length} items to ${mealLabel}`
                }
                onPress={logAll}
                busy={busy}
                disabled={loggable.length === 0}
              />
              <AppButton title="Start over" onPress={() => setDrafts(null)} variant="ghost" />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  spaceBetween: { justifyContent: 'space-between', alignItems: 'center' },
});
