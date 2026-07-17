import { useColorScheme } from 'react-native';

/**
 * Design tokens — warm-neutral surfaces, green accent, and a CVD-validated
 * chart palette (blue/aqua/yellow stepped per mode). All UI color goes
 * through these tokens; components read them via useTheme() so the whole
 * app follows the Android system light/dark setting.
 */
export interface Theme {
  dark: boolean;
  /** Screen background. */
  page: string;
  /** Card / sheet / tab-bar surface. */
  card: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  secondary: string;
  /** Muted text — captions, axis labels. */
  muted: string;
  /** Hairline borders. */
  hairline: string;
  /** Neutral fill — chips, tracks, secondary buttons. */
  wash: string;
  /** Accent (green) — primary actions, active tab, focus. */
  accent: string;
  /** Text/icon color on top of the accent fill. */
  onAccent: string;
  /** Translucent accent wash for selected chips. */
  accentSoft: string;
  danger: string;
  warning: string;
  good: string;
  chart: {
    protein: string;
    carb: string;
    fat: string;
    /** Weight trend line. */
    trend: string;
    /** Raw weigh-in dots. */
    dots: string;
    /** Goal reference line + adherence "logged" cells. */
    goal: string;
    /** Body-fat line. */
    bodyFat: string;
    grid: string;
    /** Ring / bar background track. */
    track: string;
  };
}

const light: Theme = {
  dark: false,
  page: '#F9F9F7',
  card: '#FCFCFB',
  ink: '#0B0B0B',
  secondary: '#52514E',
  muted: '#898781',
  hairline: 'rgba(11,11,11,0.10)',
  wash: '#EFEEE9',
  accent: '#047857',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(4,120,87,0.12)',
  danger: '#D03B3B',
  warning: '#B45309',
  good: '#0CA30C',
  chart: {
    protein: '#2A78D6',
    carb: '#1BAF7A',
    fat: '#EDA100',
    trend: '#0B0B0B',
    dots: '#898781',
    goal: '#0CA30C',
    bodyFat: '#2A78D6',
    grid: '#E1E0D9',
    track: '#EFEEE9',
  },
};

const dark: Theme = {
  dark: true,
  page: '#0D0D0D',
  card: '#1A1A19',
  ink: '#FFFFFF',
  secondary: '#C3C2B7',
  muted: '#898781',
  hairline: 'rgba(255,255,255,0.10)',
  wash: '#262624',
  accent: '#10B981',
  onAccent: '#04160F',
  accentSoft: 'rgba(16,185,129,0.16)',
  danger: '#E66767',
  warning: '#FAB219',
  good: '#0CA30C',
  chart: {
    protein: '#3987E5',
    carb: '#199E70',
    fat: '#C98500',
    trend: '#FFFFFF',
    dots: '#898781',
    goal: '#0CA30C',
    bodyFat: '#3987E5',
    grid: '#2C2C2A',
    track: '#262624',
  },
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Spacing scale — use these instead of magic numbers. */
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;

export const radius = { card: 16, control: 12, pill: 999 } as const;

/** Type scale (system sans; sizes/weights only). */
export const type = {
  hero: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 16, fontWeight: '600' as const },
  overline: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12.5, fontWeight: '400' as const },
} as const;
