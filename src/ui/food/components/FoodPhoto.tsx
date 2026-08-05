import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { radius, type, useTheme } from '../../theme';
import { useFoodData } from '../FoodDataContext';

/**
 * Renders a stored or not-yet-uploaded food photo.
 *
 * `photoLocalUri` wins over `photoPath` because it only exists when an upload
 * hasn't landed — showing the device copy means a photo taken offline still
 * appears immediately instead of leaving a blank square until the next sync.
 */
export function FoodPhoto({
  bucket,
  photoPath,
  photoLocalUri,
  size,
  fallback = '🍽',
}: {
  bucket: string;
  photoPath: string | null;
  photoLocalUri: string | null;
  /** Square edge in points; omit for a full-width 16:9 banner. */
  size?: number;
  fallback?: string;
}) {
  const t = useTheme();
  const { photoUrl } = useFoodData();

  const uri = photoLocalUri ?? photoUrl(bucket, photoPath);
  const shape =
    size === undefined
      ? { width: '100%' as const, aspectRatio: 16 / 9 }
      : { width: size, height: size };

  if (uri === undefined) {
    return (
      <View style={[styles.placeholder, shape, { backgroundColor: t.wash }]}>
        <Text style={[type.caption, { color: t.muted }]}>{fallback}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={[styles.image, shape]} contentFit="cover" transition={120} />;
}

const styles = StyleSheet.create({
  image: { borderRadius: radius.control },
  placeholder: { borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
