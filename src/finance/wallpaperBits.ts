import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IsoDate } from '../engine';
import { readFinanceCache } from './cache';
import { buildDebtOverview, simulatePayoff } from './debt';

const PEAK_DEBT_KEY = 'finance:peakDebt:v1';

interface PeakDebtRecord {
  peakMinor: number;
}

/** Privacy-first payload for the live wallpaper — ratios/counts only, never amounts. */
export interface FinanceWallpaperBits {
  /** 0..1, peak debt → zero. */
  payoffPct: number;
  /** Days until the current avalanche plan reaches zero, or null with no projectable plan. */
  daysToFreedom: number | null;
  /** Days until the soonest still-outstanding debt's statement due date. */
  nextDueDays: number | null;
}

async function readPeakDebt(): Promise<number> {
  const raw = await AsyncStorage.getItem(PEAK_DEBT_KEY);
  if (raw === null) return 0;
  try {
    return (JSON.parse(raw) as PeakDebtRecord).peakMinor ?? 0;
  } catch {
    return 0;
  }
}

/** Monotonic ratchet — the baseline only ever grows, so payoffPct always reads progress against the worst it's been. */
async function ratchetPeakDebt(currentMinor: number): Promise<number> {
  const stored = await readPeakDebt();
  const peak = Math.max(stored, currentMinor);
  if (peak !== stored) await AsyncStorage.setItem(PEAK_DEBT_KEY, JSON.stringify({ peakMinor: peak }));
  return peak;
}

/** Must be called from resetUserData() alongside clearFinanceCache/clearOutbox — nothing else clears this key. */
export async function clearPeakDebt(): Promise<void> {
  await AsyncStorage.removeItem(PEAK_DEBT_KEY);
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Headless — reads the finance cache (not FinanceDataContext, which is
 * React-only) so the dashboard/finance mutation sync paths can pull debt
 * state without mounting finance UI. Returns null when there's no cached
 * data yet or nothing outstanding — nothing to show on the wallpaper either
 * way.
 */
export async function computeFinanceWallpaperBits(today: IsoDate): Promise<FinanceWallpaperBits | null> {
  const cache = await readFinanceCache();
  if (cache === null) return null;

  const overview = buildDebtOverview(cache.accounts, cache.transactions, cache.valuations, today, 'avalanche');
  if (overview.lines.length === 0 || overview.totalOutstandingMinor <= 0) return null;

  const peakMinor = await ratchetPeakDebt(overview.totalOutstandingMinor);
  const payoffPct = peakMinor > 0 ? Math.max(0, Math.min(1, 1 - overview.totalOutstandingMinor / peakMinor)) : 0;

  // Best-available projection: pay exactly the combined minimums. simulatePayoff
  // returns null (no honest projection) when any active debt has no APR set —
  // daysToFreedom degrades to null rather than guessing.
  const plan = simulatePayoff(overview.lines, overview.totalMinimumDueMinor, 'avalanche', today);
  const daysToFreedom = plan === null ? null : daysBetween(today, plan.debtFreeDate);

  const dueDays = overview.lines.filter((l) => l.balanceMinor > 0).map((l) => daysBetween(today, l.cycle.due));
  const nextDueDays = dueDays.length > 0 ? Math.min(...dueDays) : null;

  return { payoffPct, daysToFreedom, nextDueDays };
}
