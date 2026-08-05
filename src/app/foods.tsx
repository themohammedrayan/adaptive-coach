import { FoodDataProvider } from '../ui/food/FoodDataContext';
import { MyFoodsScreen } from '../ui/food/MyFoodsScreen';

export default function FoodsRoute() {
  return (
    <FoodDataProvider>
      <MyFoodsScreen />
    </FoodDataProvider>
  );
}
