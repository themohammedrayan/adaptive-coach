import { useLocalSearchParams } from 'expo-router';
import type { Meal } from '../food-log';
import { FoodDataProvider } from '../ui/food/FoodDataContext';
import { EstimateMealScreen } from '../ui/food/EstimateMealScreen';

export default function EstimateMealRoute() {
  const { meal } = useLocalSearchParams<{ meal?: Meal }>();
  return (
    <FoodDataProvider>
      <EstimateMealScreen meal={meal ?? null} />
    </FoodDataProvider>
  );
}
