import { StyleSheet, Text } from 'react-native';
import { ROUTINE_CATEGORIES } from '../../calendar/types';
import { Dot, Row } from '../kit';
import { space, type, useTheme } from '../theme';

/** Category color key — reused by the Day view and the Week grid. */
export function CategoryLegend() {
  const t = useTheme();
  return (
    <Row style={styles.wrap} gap={space.m}>
      {ROUTINE_CATEGORIES.map((c) => (
        <Row key={c} gap={space.xs}>
          <Dot color={t.calendarCategory[c]} />
          <Text style={[type.caption, { color: t.secondary }]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
        </Row>
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  wrap: { flexWrap: 'wrap' },
});
