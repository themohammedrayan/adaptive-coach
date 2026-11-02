import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../ui/theme';

/** Web: screens are phone-first, so cap and center the column on wide viewports. */
const WEB_MAX_WIDTH = 860;
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function RootLayout() {
  const t = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    // Raw DOM/SVG (recharts) inherits from <body>; RN Text sets its own font.
    document.body.style.fontFamily = SYSTEM_FONT;
    document.body.style.backgroundColor = t.page;
  }, [t.page]);

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.page },
      }}
    />
  );

  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {Platform.OS === 'web' ? (
        <View style={[styles.webOuter, { backgroundColor: t.page }]}>
          <View style={styles.webColumn}>{stack}</View>
        </View>
      ) : (
        stack
      )}
    </>
  );
}

const styles = StyleSheet.create({
  webOuter: { flex: 1, alignItems: 'center' },
  webColumn: { flex: 1, width: '100%', maxWidth: WEB_MAX_WIDTH },
});
