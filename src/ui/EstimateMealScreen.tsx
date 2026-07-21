import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addFavorite, type Food, type Meal, type Unit } from '../food-log';
import { getFoodLogRuntime } from '../food-log/runtime';
import { EstimateUnavailableError, estimateMeal, mealEstimateToCreateFoodInput, type MealEstimate } from '../meal-estimate';
import { CreateFoodForm } from './CreateFoodForm';
import { AppButton, Card, EmptyState, Field, Row } from './kit';
import { radius, space, type, useTheme } from './theme';

/**
 * v2 — AI meal estimation. Reached from FoodLogScreen's add-food modal.
 * Nothing here can reach createFood()/addLogEntry() without passing
 * through the same editable CreateFoodForm manual entry uses — that
 * review step is the real safety net, not the model's output.
 */
export function EstimateMealScreen({ meal }: { meal: Meal | null }) {
  const t = useTheme();
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rt = await getFoodLogRuntime();
        setUnits(await rt.store.listUnits());
        setUnitsError(null);
      } catch (e) {
        setUnitsError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

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
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runEstimate = async () => {
    if (description.trim() === '' && !imageBase64) return;
    setBusy(true);
    setError(null);
    try {
      const result = await estimateMeal({
        description: description.trim() === '' ? undefined : description.trim(),
        imageBase64: imageBase64 ?? undefined,
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

  const onFoodCreated = async (food: Food) => {
    try {
      const rt = await getFoodLogRuntime();
      await addFavorite(rt.store, food.id, meal, rt.nowUtc());
      router.back();
    } catch (e) {
      Alert.alert('Couldn’t finish saving', e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    setEstimate(null);
    setUnavailable(false);
  };

  const defaultUnitId = units[0]?.id ?? '';

  if (estimate !== null) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={[type.caption, { color: t.muted }]}>
              Estimated with {estimate.confidence} confidence — review and edit before saving.
            </Text>
            <CreateFoodForm
              defaultUnitId={defaultUnitId}
              units={units}
              initialValues={mealEstimateToCreateFoodInput(estimate, defaultUnitId)}
              onDone={onFoodCreated}
              onCancel={reset}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (unavailable) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={[type.caption, { color: t.warning }]}>
              Couldn't produce a confident estimate — enter the food manually instead.
            </Text>
            <CreateFoodForm
              defaultUnitId={defaultUnitId}
              units={units}
              initialValues={{ name: description.trim() }}
              onDone={onFoodCreated}
              onCancel={reset}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.page }]} edges={['top', 'bottom']}>
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
              <AppButton title="Take photo" onPress={() => void pickImage('camera')} variant="secondary" small />
              <AppButton title="Choose from library" onPress={() => void pickImage('library')} variant="secondary" small />
            </Row>
            {imageUri !== null && <Image source={{ uri: imageUri }} style={styles.preview} />}
            {error !== null && <Text style={[type.caption, { color: t.danger }]}>{error}</Text>}
            <AppButton
              title="Estimate"
              onPress={runEstimate}
              busy={busy}
              disabled={description.trim() === '' && !imageBase64}
            />
          </Card>
          {units.length === 0 && (
            <EmptyState
              message={unitsError !== null ? `Couldn't load your units: ${unitsError}` : 'Loading your units…'}
            />
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
  preview: { width: '100%', height: 200, borderRadius: radius.card },
});
