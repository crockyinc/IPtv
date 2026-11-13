/**
 * iptv-org data pipeline.
 *
 * Everything here runs in the browser: the six public JSON documents are
 * fetched concurrently, then filtered, joined and normalized into a single
 * `Catalog` that the rest of the app reads synchronously.
 *
 * Joins performed:
 *   channels.id      <- streams.channel      (required: at least one .m3u8)
 *   channels.id      <- logos.channel        (optional: best logo wins)
 *   channels.country <- countries.code       (required: drives the picker)
 *   channels.categories[] <- categories.id   (optional: drives chips/sidebar)
 *   channels.id      -X blocklist            (blocked entries are dropped)
 */

import type {
  BlocklistEntry,
  Catalog,
  CategoryOption,
  Channel,
  ChannelLogo,
  CountryOption,
  RawBlocklistEntry,
  RawCategory,
  RawChannel,
  RawCountry,
  RawLogo,
  RawStream,
  StreamQuality,
  StreamSource,
} from '@/types/iptv';
import { flagEmoji } from '@/lib/utils';

/**
 * Upstream base URL. Overridable at build time (`VITE_IPTV_API_BASE`) so a
 * self-hosted mirror of the iptv-org JSON can be used — the default is the
 * public API and no server of our own is ever involved.
 */
const API_BASE = (
  import.meta.env?.VITE_IPTV_API_BASE ?? 'https://iptv-org.github.io/api'
).replace(/\/+$/, '');

export const ENDPOINTS = {
  countries: `${API_BASE}/countries.json`,
  channels: `${API_BASE}/channels.json`,
  streams: `${API_BASE}/streams.json`,
  logos: `${API_BASE}/logos.json`,
  categories: `${API_BASE}/categories.json`,
  blocklist: `${API_BASE}/blocklist.json`,
} as const;

export class IptvApiError extends Error {
  readonly url: string;

  constructor(url: string, message: string) {
    super(message);
    this.name = 'IptvApiError';
    this.url = url;
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Caching                                  */
/* -------------------------------------------------------------------------- */

/** Parsed JSON documents, keyed by URL. Survives route changes for the session. */
const jsonCache = new Map<string, unknown>();
/** In-flight requests so concurrent callers share a single network round-trip. */
const inflight = new Map<string, Promise<unknown>>();
/** The assembled catalog — the most expensive artefact to produce. */
let catalogCache: Catalog | null = null;
let catalogPromise: Promise<Catalog> | null = null;

const FETCH_TIMEOUT_MS = 25_000;
const FETCH_RETRIES = 2;

async function fetchJsonOnce<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      cache: 'default',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new IptvApiError(url, `Request failed with HTTP ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch + parse JSON with in-memory caching, request de-duplication and retries. */
async function fetchJson<T>(url: string): Promise<T> {
  if (jsonCache.has(url)) return jsonCache.get(url) as T;

  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
      try {
        const data = await fetchJsonOnce<T>(url);
        jsonCache.set(url, data);
        return data;
      } catch (error) {
        lastError = error;
        if (error instanceof IptvApiError && error.message.includes('HTTP 4')) {
          // Client errors will not succeed on retry.
          break;
        }
        // Linear backoff: 400ms, 800ms.
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new IptvApiError(url, 'Unknown network failure');
  })();

  inflight.set(url, request);

  try {
    return (await request) as T;
  } finally {
    inflight.delete(url);
  }
}

/* -------------------------------------------------------------------------- */
/*                               Stream helpers                               */
/* -------------------------------------------------------------------------- */

const M3U8_PATTERN = /\.m3u8?(\?|#|$)/i;

/** True when the URL is an http(s) HLS manifest that a browser can attempt. */
export function isPlayableStreamUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string' || rawUrl.length < 8) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return M3U8_PATTERN.test(parsed.pathname + parsed.search) || /m3u8/i.test(parsed.pathname);
}

const QUALITY_RANK: Record<StreamQuality, number> = {
  '4k': 70,
  '1080p': 60,
  '720p': 50,
  '576p': 40,
  '480p': 30,
  '360p': 20,
  sd: 10,
  unknown: 0,
};

const QUALITY_LABEL: Record<StreamQuality, string> = {
  '4k': '4K',
  '1080p': '1080p',
  '720p': '720p',
  '576p': '576p',
  '480p': '480p',
  '360p': '360p',
  sd: 'SD',
  unknown: 'LIVE',
};

export function qualityLabelFor(quality: StreamQuality): string {
  return QUALITY_LABEL[quality];
}

/**
 * Derives a quality label from the upstream `quality` hint and then from
 * filename hints (`..._1080p.m3u8`, `/hd/`, `/4k/`). Unknown stays unknown so
 * the UI can fall back to a neutral "LIVE" chip.
 */
export function detectQuality(stream: RawStream): StreamQuality {
  const hint = (stream.quality ?? '').toLowerCase().trim();
  const haystack = `${hint} ${stream.url} ${stream.title ?? ''}`.toLowerCase();

  if (/2160|4k|uhd/.test(haystack)) return '4k';
  if (/1080|fhd|fullhd/.test(haystack)) return '1080p';
  if (/720|\bhd\b|_hd|hd\./.test(haystack)) return '720p';
  if (/576|\bsd\b/.test(haystack)) return '576p';
  if (/480/.test(haystack)) return '480p';
  if (/360/.test(haystack)) return '360p';
  if (/(^|\s)sd(\s|$)/.test(haystack)) return 'sd';
  return 'unknown';
}

function toStreamSource(stream: RawStream): StreamSource {
  const quality = detectQuality(stream);
  return {
    url: stream.url.trim(),
    quality,
    qualityLabel: QUALITY_LABEL[quality],
    isHttps: stream.url.trim().toLowerCase().startsWith('https://'),
    referrer: stream.referrer?.trim() || null,
    userAgent: stream.user_agent?.trim() || null,
    feed: stream.feed?.trim() || null,
  };
}

/**
 * Orders streams for the player: HTTPS first, then best quality first, then
 * deduplicated by URL so failover never retries the same manifest.
 */
export function rankStreams(streams: StreamSource[]): StreamSource[] {
  const seen = new Set<string>();
  const unique: StreamSource[] = [];

  for (const stream of streams) {
    const key = stream.url.replace(/\/+$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(stream);
  }

  return unique.sort((a, b) => {
    if (a.isHttps !== b.isHttps) return a.isHttps ? -1 : 1;
    return QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality];
  });
}

/* -------------------------------------------------------------------------- */
/*                               Logo selection                               */
/* -------------------------------------------------------------------------- */

const LOGO_FORMAT_SCORE: Record<ChannelLogo['format'], number> = {
  svg: 6,
  png: 4,
  webp: 2,
  jpg: 1,
  other: 0,
};

function normalizeLogoFormat(url: string, explicit?: string): ChannelLogo['format'] {
  const candidate = (explicit ?? url.split('?')[0]?.split('.').pop() ?? '').toLowerCase();
  if (candidate === 'svg' || candidate.includes('svg')) return 'svg';
  if (candidate === 'png') return 'png';
  if (candidate === 'webp') return 'webp';
  if (candidate === 'jpg' || candidate === 'jpeg') return 'jpg';
  return 'other';
}

function scoreLogo(logo: RawLogo): number {
  const isHttps = logo.url.toLowerCase().startsWith('https://');
  const format = normalizeLogoFormat(logo.url, logo.format);
  const width = typeof logo.width === 'number' ? logo.width : null;
  const height = typeof logo.height === 'number' ? logo.height : null;

  let score = LOGO_FORMAT_SCORE[format];
  if (isHttps) score += 10;
  if (!/\.(svg|png|webp|jpe?g)(\?|$)/i.test(logo.url)) score -= 4; // unknown/redirect assets
  if (width && height && Math.abs(width - height) / Math.max(width, height) < 0.12) score += 3;
  if (width !== null && width >= 64 && width <= 512) score += 2;
  if (width !== null && width > 1200) score -= 2;
  if (logo.tags?.includes('horizontal')) score += 1;
  const runtimeTags = logo.tags ?? [];
  if (runtimeTags.includes('animated')) score -= 3;

  return score;
}

function toChannelLogo(logo: RawLogo): ChannelLogo {
  const width = typeof logo.width === 'number' ? logo.width : null;
  const height = typeof logo.height === 'number' ? logo.height : null;
  return {
    url: logo.url.trim(),
    format: normalizeLogoFormat(logo.url, logo.format),
    width,
    height,
    isSquare: Boolean(width && height && Math.abs(width - height) / Math.max(width, height) < 0.12),
  };
}

/* -------------------------------------------------------------------------- */
/*                              Catalog assembly                              */
/* -------------------------------------------------------------------------- */

interface RawBundle {
  countries: RawCountry[];
  channels: RawChannel[];
  streams: RawStream[];
  logos: RawLogo[];
  categories: RawCategory[];
  blocklist: BlocklistEntry[];
}

const FALLBACK_CATEGORY = 'general';

/**
 * A couple of legacy/alternative region codes appear in the wild. Normalizing
 * them keeps otherwise-valid channels out of the discarded pile.
 */
const COUNTRY_CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
  AN: 'NL',
};

function normalizeCountryCode(code: string): string {
  const upper = code.toUpperCase();
  return COUNTRY_CODE_ALIASES[upper] ?? upper;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Builds the normalized catalog. Exported for testability and so the shape of
 * the pipeline is explicit: streams -> channels -> countries/categories.
 */
export function buildCatalog(raw: RawBundle, fetchMs = 0): Catalog {
  const countries = asArray<RawCountry>(raw.countries);
  const rawChannels = asArray<RawChannel>(raw.channels);
  const rawStreams = asArray<RawStream>(raw.streams);
  const rawLogos = asArray<RawLogo>(raw.logos);
  const rawCategories = asArray<RawCategory>(raw.categories);
  const blocklist = asArray<BlocklistEntry>(raw.blocklist);

  /* ---------------------------- 1. Blocklist ----------------------------- */
  const blocked = new Set<string>();
  for (const entry of blocklist) {
    if (typeof entry === 'string') {
      if (entry) blocked.add(entry);
      continue;
    }
    const typed = entry as RawBlocklistEntry;
    const id = typed.channel ?? null;
    if (id) blocked.add(id);
  }

  /* -------------------------- 2. Categories ------------------------------ */
  const categoryNameById = new Map<string, string>();
  for (const category of rawCategories) {
    if (category?.id && category?.name) categoryNameById.set(category.id, category.name);
  }
  if (!categoryNameById.has(FALLBACK_CATEGORY)) {
    categoryNameById.set(FALLBACK_CATEGORY, 'General');
  }

  /* --------------------------- 3. Countries ------------------------------ */
  const countryNameByCode = new Map<string, string>();
  const countryLanguages = new Map<string, string[]>();
  const countryFlagOverride = new Map<string, string>();
  for (const country of countries) {
    if (!country?.code) continue;
    const code = country.code.toUpperCase();
    if (!country.name) continue;
    countryNameByCode.set(code, country.name);
    countryLanguages.set(code, asArray<string>(country.languages));
    if (country.flag) countryFlagOverride.set(code, country.flag);
  }

  /* ---------------------------- 4. Streams ------------------------------- */
  const streamsByChannel = new Map<string, StreamSource[]>();
  let totalStreams = 0;

  for (const stream of rawStreams) {
    if (!stream?.channel || typeof stream.url !== 'string') continue;
    if (!isPlayableStreamUrl(stream.url)) continue;
    totalStreams += 1;
    const source = toStreamSource(stream);
    const bucket = streamsByChannel.get(stream.channel);
    if (bucket) bucket.push(source);
    else streamsByChannel.set(stream.channel, [source]);
  }

  /* ----------------------------- 5. Logos -------------------------------- */
  const bestLogo = new Map<string, { logo: RawLogo; score: number }>();
  for (const logo of rawLogos) {
    if (!logo?.channel || typeof logo.url !== 'string' || !logo.url.trim()) continue;
    if (!/^https?:\/\//i.test(logo.url.trim())) continue;
    const score = scoreLogo(logo);
    const current = bestLogo.get(logo.channel);
    if (!current || score > current.score) {
      bestLogo.set(logo.channel, { logo, score });
    }
  }

  /* --------------------------- 6. Channels ------------------------------- */
  const channels: Channel[] = [];
  const channelsByCountry = new Map<string, Channel[]>();
  const categoryCountsByCountry = new Map<string, Map<string, number>>();

  let blockedCount = 0;
  let nsfwCount = 0;
  let withoutStreams = 0;

  for (const rawChannel of rawChannels) {
    if (!rawChannel?.id || !rawChannel.name) continue;

    if (blocked.has(rawChannel.id)) {
      blockedCount += 1;
      continue;
    }
    if (rawChannel.is_nsfw === true) {
      nsfwCount += 1;
      continue;
    }

    const rawCode = rawChannel.country ? normalizeCountryCode(rawChannel.country) : undefined;
    if (!rawCode || !countryNameByCode.has(rawCode)) continue;

    const channelStreams = streamsByChannel.get(rawChannel.id);
    if (!channelStreams || channelStreams.length === 0) {
      withoutStreams += 1;
      continue;
    }

    const streams = rankStreams(channelStreams);
    const categoryIds = asArray<string>(rawChannel.categories).filter((id) =>
      categoryNameById.has(id),
    );
    const primaryCategoryId = categoryIds[0] ?? null;
    const logoEntry = bestLogo.get(rawChannel.id);

    const altNames = asArray<string>(rawChannel.alt_names).filter(Boolean);
    const network = rawChannel.network?.trim() || null;

    const channel: Channel = {
      id: rawChannel.id,
      name: rawChannel.name.trim(),
      altNames,
      network,
      countryCode: rawCode,
      countryName: countryNameByCode.get(rawCode)!,
      countryFlag: countryFlagOverride.get(rawCode) || flagEmoji(rawCode),
      categoryIds,
      primaryCategoryId,
      primaryCategoryName: primaryCategoryId ? categoryNameById.get(primaryCategoryId)! : null,
      logo: logoEntry ? toChannelLogo(logoEntry.logo) : null,
      streams,
      resolutionLabel: streams[0] && streams[0].quality !== 'unknown' ? streams[0].qualityLabel : null,
      isNsfw: false,
      website: rawChannel.website?.trim() || null,
      searchKey: `${rawChannel.name} ${network ?? ''} ${altNames.join(' ')}`.toLowerCase(),
    };

    channels.push(channel);

    const countryBucket = channelsByCountry.get(rawCode);
    if (countryBucket) countryBucket.push(channel);
    else channelsByCountry.set(rawCode, [channel]);

    // Category counts are scoped per country for the sidebar + chip bar.
    let perCategory = categoryCountsByCountry.get(rawCode);
    if (!perCategory) {
      perCategory = new Map<string, number>();
      categoryCountsByCountry.set(rawCode, perCategory);
    }
    for (const categoryId of categoryIds) {
      perCategory.set(categoryId, (perCategory.get(categoryId) ?? 0) + 1);
    }
  }

  /* ------------------------- 7. Sort + summaries ------------------------- */
  channels.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const channelById = new Map<string, Channel>();
  for (const channel of channels) channelById.set(channel.id, channel);

  // Global category metadata, sorted by display name.
  const categories: CategoryOption[] = [...categoryNameById.entries()]
    .map(([id, name]) => ({ id, name, channelCount: 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  // Countries with at least one playable channel, sorted by availability.
  const countriesOut: CountryOption[] = [];
  for (const [code, list] of channelsByCountry) {
    countriesOut.push({
      code,
      name: countryNameByCode.get(code)!,
      flag: countryFlagOverride.get(code) || flagEmoji(code),
      channelCount: list.length,
      languages: countryLanguages.get(code) ?? [],
    });
  }
  countriesOut.sort((a, b) => b.channelCount - a.channelCount || a.name.localeCompare(b.name, 'en'));

  const countryByCode = new Map<string, CountryOption>();
  for (const country of countriesOut) countryByCode.set(country.code, country);

  const catalog: Catalog = {
    channels,
    channelById,
    channelsByCountry,
    categoryCountsByCountry,
    countries: countriesOut,
    countryByCode,
    categories,
    builtAt: Date.now(),
    stats: {
      totalChannels: rawChannels.length,
      playableChannels: channels.length,
      blockedChannels: blockedCount,
      nsfwChannels: nsfwCount,
      withoutStreams,
      totalStreams,
      countriesWithChannels: countriesOut.length,
      fetchMs,
    },
  };

  return catalog;
}

/* -------------------------------------------------------------------------- */
/*                                Public API                                  */
/* -------------------------------------------------------------------------- */

/** Returns the cached catalog if it has already been assembled. */
export function getCachedCatalog(): Catalog | null {
  return catalogCache;
}

/**
 * Concurrently loads every upstream document and assembles the catalog.
 * Concurrent callers share one promise; later callers get the cached result.
 */
export function loadCatalog(): Promise<Catalog> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (catalogPromise) return catalogPromise;

  const startedAt = performance.now();

  catalogPromise = (async () => {
    // blocklist / logos / categories degrade gracefully so a single upstream
    // hiccup never blanks the whole feed.
    const [countries, channels, streams, logos, categories, blocklist] = await Promise.all([
      fetchJson<RawCountry[]>(ENDPOINTS.countries),
      fetchJson<RawChannel[]>(ENDPOINTS.channels),
      fetchJson<RawStream[]>(ENDPOINTS.streams),
      fetchJson<RawLogo[]>(ENDPOINTS.logos).catch(() => [] as RawLogo[]),
      fetchJson<RawCategory[]>(ENDPOINTS.categories).catch(() => [] as RawCategory[]),
      fetchJson<BlocklistEntry[]>(ENDPOINTS.blocklist).catch(() => [] as BlocklistEntry[]),
    ]);

    if (!Array.isArray(countries) || countries.length === 0) {
      throw new IptvApiError(ENDPOINTS.countries, 'Country list could not be loaded.');
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      throw new IptvApiError(ENDPOINTS.channels, 'Channel catalogue could not be loaded.');
    }
    if (!Array.isArray(streams) || streams.length === 0) {
      throw new IptvApiError(ENDPOINTS.streams, 'Stream catalogue could not be loaded.');
    }

    const catalog = buildCatalog(
      { countries, channels, streams, logos, categories, blocklist },
      Math.round(performance.now() - startedAt),
    );

    catalogCache = catalog;
    return catalog;
  })();

  catalogPromise.catch(() => {
    // Allow a manual retry after a failure instead of caching the rejection.
    catalogPromise = null;
  });

  return catalogPromise;
}

/** Clears every cache (used by the "Reload data" action). */
export function clearCatalogCache(): void {
  jsonCache.clear();
  inflight.clear();
  catalogCache = null;
  catalogPromise = null;
}

/** Categories ordered for a country: curated first, then by channel volume. */
export function getCategoriesForCountry(
  catalog: Catalog,
  countryCode: string | null,
): CategoryOption[] {
  const counts = countryCode ? catalog.categoryCountsByCountry.get(countryCode) : null;
  if (!counts) return [];

  return catalog.categories
    .map((category) => ({ ...category, channelCount: counts.get(category.id) ?? 0 }))
    .filter((category) => category.channelCount > 0)
    .sort((a, b) => b.channelCount - a.channelCount || a.name.localeCompare(b.name, 'en'));
}
