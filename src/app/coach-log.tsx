import { useLocalSearchParams } from 'expo-router';
import type { Meal } from '../food-log';
import { CoachLogScreen } from '../ui/food/CoachLogScreen';
import { FoodDataProvider } from '../ui/food/FoodDataContext';

export default function CoachLogRoute() {
  const { meal } = useLocalSearchParams<{ meal?: Meal }>();
  return (
    <FoodDataProvider>
      <CoachLogScreen meal={meal ?? null} />
    </FoodDataProvider>
  );
}
