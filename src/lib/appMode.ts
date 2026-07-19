import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type AppMode = 'health' | 'finance' | 'goals';

const STORAGE_KEY = 'appMode';
const DEFAULT_MODE: AppMode = 'goals';

/**
 * Which standalone app section (Goals, Health, or Finance) is currently
 * shown. A device UI preference, not user data — never cleared by
 * resetUserData(). Goals BRD §G.3 — Goals is the landing surface.
 */
export function useAppMode(): { mode: AppMode | null; setMode: (m: AppMode) => void } {
  const [mode, setModeState] = useState<AppMode | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      setModeState(stored === 'finance' || stored === 'health' ? stored : DEFAULT_MODE);
    });
  }, []);

  const setMode = (m: AppMode) => {
    setModeState(m);
    void AsyncStorage.setItem(STORAGE_KEY, m);
  };

  return { mode, setMode };
}
