/**
 * Typed localStorage access. Every key is namespaced with `anystream_` and
 * every read/write is wrapped so private-mode browsers (where localStorage
 * throws) degrade to in-memory defaults instead of a white screen.
 */

export const STORAGE_KEYS = {
  country: 'anystream_country',
  sidebar: 'anystream_sidebar',
  recent: 'anystream_recent',
  volume: 'anystream_volume',
  muted: 'anystream_muted',
} as const;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — preferences simply won't persist */
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function readString(key: string, fallback: string): string {
  return safeGet(key) ?? fallback;
}

export function readBoolean(key: string, fallback: boolean): boolean {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  return raw === 'true' || raw === '1' || raw === 'collapsed';
}

export function readNumber(key: string, fallback: number): number {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readJsonArray(key: string): string[] {
  const raw = safeGet(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function writeString(key: string, value: string | null): void {
  if (value === null) safeRemove(key);
  else safeSet(key, value);
}

export function writeBoolean(key: string, value: boolean): void {
  safeSet(key, String(value));
}

export function writeNumber(key: string, value: number): void {
  safeSet(key, String(value));
}

export function writeJsonArray(key: string, value: string[]): void {
  safeSet(key, JSON.stringify(value));
}
