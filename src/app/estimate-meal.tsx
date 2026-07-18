import { useLocalSearchParams } from 'expo-router';
import type { Meal } from '../food-log';
import { EstimateMealScreen } from '../ui/EstimateMealScreen';

export default function EstimateMealRoute() {
  const { meal } = useLocalSearchParams<{ meal?: Meal }>();
  return <EstimateMealScreen meal={meal ?? null} />;
}
