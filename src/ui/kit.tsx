import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import { radius, space, type, useTheme } from './theme';

/* ---------------------------------------------------------------- surfaces */

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: radius.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.hairline,
          padding: space.l,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Overline({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <Text style={[type.overline, { color: t.muted }, style as object]}>{children}</Text>;
}

/* ----------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  small = false,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.accent : variant === 'secondary' ? t.wash : 'transparent';
  const fg =
    variant === 'primary'
      ? t.onAccent
      : variant === 'danger'
        ? t.danger
        : variant === 'ghost'
          ? t.accent
          : t.ink;
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.control,
        paddingVertical: small ? 7 : 13,
        paddingHorizontal: small ? space.m : space.l,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space.s,
        opacity: off ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      {busy && <ActivityIndicator size="small" color={fg} />}
      <Text style={{ color: fg, fontSize: small ? 13 : 15, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

/**
 * Circular bottom-right action button (e.g. "add weight", "ask coach") — the
 * app's one floating-action-button pattern, drawn with the same react-native-svg
 * approach as TabIcon since no icon font is installed.
 */
export function FAB({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: 'plus' | 'chat';
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const p = { stroke: t.onAccent, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        position: 'absolute',
        right: space.l,
        bottom: space.l,
        width: 56,
        height: 56,
        borderRadius: radius.pill,
        backgroundColor: t.accent,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      })}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24">
        {icon === 'plus' && (
          <>
            <Path d="M12 5v14" {...p} />
            <Path d="M5 12h14" {...p} />
          </>
        )}
        {icon === 'chat' && (
          <Path d="M20 11.5a7.5 6.5 0 0 1-7.5 6.5c-1 0-2-.15-2.9-.45L5 19l1.2-3.2A6.4 6.4 0 0 1 4.5 11.5 7.5 6.5 0 0 1 12.5 5 7.5 6.5 0 0 1 20 11.5Z" {...p} />
        )}
      </Svg>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ inputs */

export function Field({
  label,
  style,
  ...inputProps
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      {label !== undefined && (
        <Text style={[type.caption, { color: t.secondary, fontWeight: '500' }]}>{label}</Text>
      )}
      <TextInput
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        placeholderTextColor={t.muted}
        style={{
          backgroundColor: t.dark ? t.wash : t.card,
          borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
          borderColor: focused ? t.accent : t.hairline,
          borderRadius: radius.control,
          paddingHorizontal: space.l,
          paddingVertical: 12,
          fontSize: 15,
          color: t.ink,
        }}
      />
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: active ? t.accentSoft : t.wash,
        borderWidth: 1,
        borderColor: active ? t.accent : 'transparent',
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 7,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? t.accent : t.secondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const SEGMENT_PAD = 4;

/** Duolingo-style raised pill toggle — a sliding thumb animates behind the active option. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = (trackWidth - SEGMENT_PAD * 2) / options.length;
  const thumbX = useSharedValue(0);

  useEffect(() => {
    thumbX.value = withTiming(activeIndex * segmentWidth, { duration: 220 });
  }, [activeIndex, segmentWidth, thumbX]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.wash,
        borderRadius: radius.pill,
        padding: SEGMENT_PAD,
      }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: SEGMENT_PAD,
              bottom: SEGMENT_PAD,
              left: SEGMENT_PAD,
              width: segmentWidth,
              borderRadius: radius.pill,
              backgroundColor: t.card,
              elevation: 2,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
            },
            thumbStyle,
          ]}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: active ? '700' : '500',
                color: active ? t.ink : t.secondary,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AppSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <RNSwitch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: t.wash, true: t.accentSoft }}
      thumbColor={value ? t.accent : t.muted}
    />
  );
}

/* ------------------------------------------------------------------- misc */

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: t.wash, overflow: 'hidden' }}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: color ?? t.accent,
        }}
      />
    </View>
  );
}

/** Small colored dot used to tie legend/pill text to a chart series. */
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/* ---------------------------------------------------------------- tab icons */

export type TabIconName =
  | 'home'
  | 'food'
  | 'weight'
  | 'challenges'
  | 'coach'
  | 'profile'
  | 'overview'
  | 'transactions'
  | 'accounts'
  | 'reports';

/**
 * Hand-drawn 24px line icons — no icon font is installed (expo-symbols is
 * iOS-only), so the tab bar draws its own via react-native-svg.
 */
export function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Rect x={3.5} y={10.5} width={4} height={9} rx={1} {...p} />
          <Rect x={10} y={5.5} width={4} height={14} rx={1} {...p} />
          <Rect x={16.5} y={13} width={4} height={6.5} rx={1} {...p} />
        </>
      )}
      {name === 'food' && (
        <>
          <Path d="M4 11h16a8 8 0 0 1-16 0Z" {...p} />
          <Path d="M8 11c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5" {...p} />
          <Path d="M12 6.5V4.5" {...p} />
        </>
      )}
      {name === 'weight' && (
        <>
          <Rect x={3.5} y={3.5} width={17} height={17} rx={4} {...p} />
          <Path d="M8 9.5a5.5 4.5 0 0 1 8 0l-2.4 2.4a2 2 0 0 0-3.2 0Z" {...p} />
        </>
      )}
      {name === 'challenges' && (
        <>
          <Path d="M6 3.5v17" {...p} />
          <Path d="M6 4.5h11l-2.5 3.5L17 11.5H6" {...p} />
        </>
      )}
      {name === 'coach' && (
        <Path d="M20 11.5a7.5 6.5 0 0 1-7.5 6.5c-1 0-2-.15-2.9-.45L5 19l1.2-3.2A6.4 6.4 0 0 1 4.5 11.5 7.5 6.5 0 0 1 12.5 5 7.5 6.5 0 0 1 20 11.5Z" {...p} />
      )}
      {name === 'profile' && (
        <>
          <Circle cx={12} cy={8} r={3.6} {...p} />
          <Path d="M4.8 20a7.5 7.5 0 0 1 14.4 0" {...p} />
        </>
      )}
      {name === 'overview' && <Polyline points="4,16 9,11 12,14 20,5" {...p} />}
      {name === 'transactions' && (
        <>
          <Path d="M5 7h14" {...p} />
          <Path d="M5 12h14" {...p} />
          <Path d="M5 17h9" {...p} />
        </>
      )}
      {name === 'accounts' && (
        <>
          <Path d="M3.5 7V6a2 2 0 0 1 2-2h9" {...p} />
          <Rect x={3.5} y={7} width={17} height={11} rx={2} {...p} />
          <Rect x={14.5} y={11} width={5} height={4} rx={1} {...p} />
        </>
      )}
      {name === 'reports' && (
        <>
          <Rect x={5} y={13} width={3.5} height={7} rx={0.8} {...p} />
          <Rect x={10.5} y={9} width={3.5} height={11} rx={0.8} {...p} />
          <Rect x={16} y={5} width={3.5} height={15} rx={0.8} {...p} />
        </>
      )}
    </Svg>
  );
}

/* --------------------------------------------------------------- tab bar */

/** Shared bottom tab bar shape — Health and Finance each supply their own tab list. */
export function BottomTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; icon: TabIconName }[];
  active: T;
  onChange: (key: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[tabBarStyles.bar, { backgroundColor: t.card, borderTopColor: t.hairline }]}>
      {tabs.map(({ key, label, icon }) => {
        const isActive = key === active;
        const color = isActive ? t.accent : t.muted;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => [tabBarStyles.item, { opacity: pressed ? 0.6 : 1 }]}
          >
            <TabIcon name={icon} color={color} />
            <Text style={[tabBarStyles.label, { color, fontWeight: isActive ? '600' : '400' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 11 },
});

const MODE_OPTIONS: { value: 'health' | 'finance'; label: string; icon: TabIconName }[] = [
  { value: 'health', label: 'Health', icon: 'weight' },
  { value: 'finance', label: 'Finance', icon: 'accounts' },
];

/**
 * Top-right Health/Finance app-mode switcher — Duolingo app-picker style:
 * a colored icon tile per mode with a ring around the active one.
 */
export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: 'health' | 'finance';
  onChange: (mode: 'health' | 'finance') => void;
}) {
  const t = useTheme();
  const fill = { health: t.accent, finance: t.chart.protein };

  return (
    <View style={{ flexDirection: 'row', gap: space.s }}>
      {MODE_OPTIONS.map((o) => {
        const active = o.value === mode;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({ alignItems: 'center', gap: 3, opacity: pressed ? 0.7 : 1 })}
          >
            <View
              style={{
                padding: 3,
                borderRadius: radius.control + 3,
                borderWidth: 2,
                borderColor: active ? t.accent : 'transparent',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.control,
                  backgroundColor: fill[o.value],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TabIcon name={o.icon} color={t.onAccent} size={20} />
              </View>
            </View>
            <Text style={{ fontSize: 11, fontWeight: active ? '700' : '500', color: active ? t.ink : t.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------ empty states */

export function EmptyState({
  message,
  actionTitle,
  onAction,
}: {
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.m, paddingVertical: space.xl }}>
      <Text style={[type.body, { color: t.muted, textAlign: 'center' }]}>{message}</Text>
      {actionTitle !== undefined && onAction !== undefined && (
        <AppButton title={actionTitle} onPress={onAction} variant="secondary" small />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ layout */

export function Row({
  style,
  children,
  gap = space.s,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  gap?: number;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}
