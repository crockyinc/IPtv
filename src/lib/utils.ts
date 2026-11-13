/** Small, dependency-free helpers shared across the UI. */

/** Joins conditional class names. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Converts an ISO 3166-1 alpha-2 code into its regional-indicator flag emoji.
 * Falls back to an empty string for malformed input.
 */
export function flagEmoji(code: string | null | undefined): string {
  if (!code) return '';
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (normalized.codePointAt(0)! - 65),
    base + (normalized.codePointAt(1)! - 65),
  );
}

/** 1234 -> "1,234"; 12400 -> "12.4K". */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k >= 100 ? Math.round(k) : Number(k.toFixed(1))}K`;
  }
  return `${Number((value / 1_000_000).toFixed(1))}M`;
}

/** "BBC News HD" -> "BN" / "BBC" -> "BBC". */
export function channelInitials(name: string): string {
  const cleaned = name
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(hd|uhd|fhd|4k|sd|live|tv|channel)\b/gi, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

const GRADIENTS = [
  'from-[#1f2a44] to-[#0b1020]',
  'from-[#2a1f3d] to-[#120b1c]',
  'from-[#123029] to-[#071613]',
  'from-[#3a2118] to-[#180d09]',
  'from-[#1b2f3a] to-[#081116]',
  'from-[#33203a] to-[#150c18]',
  'from-[#2c2a12] to-[#141306]',
  'from-[#20263b] to-[#0a0d16]',
] as const;

/** Deterministic gradient for logo fallbacks, keyed by channel id/name. */
export function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length]!;
}

/** Trailing-accent) colour pair used behind initials. */
export function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 17 + seed.charCodeAt(i)) >>> 0;
  }
  const palette = ['#e5e5e5', '#f5d9c4', '#cfe3ff', '#d6c8ff', '#c8f0dd', '#ffe0e3'];
  return palette[hash % palette.length]!;
}

/** Clipboard write with an execCommand fallback for non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Debounces a callback — used by the search input. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): ((...args: Args) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return wrapped;
}

/** Escapes a string for safe use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Stable pseudo-random shuffle used to give the "surprise me" rail variety. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
