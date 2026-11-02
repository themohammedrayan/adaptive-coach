/**
 * Tiny synchronous JSON wrapper over window.localStorage for the web build.
 * Every access is guarded: storage can be missing (SSR, tests) or throw
 * (private mode, quota), and callers must keep working in-memory either way.
 */
export function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal: state stays in memory for this session.
  }
}
