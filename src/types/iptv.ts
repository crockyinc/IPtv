/**
 * Type definitions for the public iptv-org dataset and AnyStream's
 * normalized in-memory catalog.
 *
 * The raw interfaces mirror the JSON served from https://iptv-org.github.io/api
 * (all fields are treated as optional/defensive because the upstream dataset is
 * community-maintained and shapes drift over time).
 */

/* -------------------------------------------------------------------------- */
/*                              Raw API payloads                              */
/* -------------------------------------------------------------------------- */

export interface RawCountry {
  name: string;
  code: string;
  languages?: string[];
  flag?: string;
}

export interface RawChannel {
  id: string;
  name: string;
  alt_names?: string[];
  network?: string | null;
  owners?: string[];
  country?: string;
  subdivision?: string;
  city?: string;
  categories?: string[];
  is_nsfw?: boolean;
  launched?: string | null;
  closed?: string | null;
  replaced_by?: string | null;
  website?: string | null;
}

export interface RawStream {
  channel: string | null;
  feed?: string | null;
  url: string;
  referrer?: string | null;
  user_agent?: string | null;
  quality?: string | null;
  title?: string | null;
}

export interface RawLogo {
  channel: string;
  feed?: string | null;
  tags?: string[];
  width?: number;
  height?: number;
  format?: string;
  url: string;
}

export interface RawCategory {
  id: string;
  name: string;
}

/** Upstream publishes blocklist.json as objects (`{ channel, reason, ref }`). */
export interface RawBlocklistEntry {
  channel?: string | null;
  reason?: string;
  ref?: string;
}

export type BlocklistEntry = RawBlocklistEntry | string;

/* -------------------------------------------------------------------------- */
/*                            Normalized domain model                         */
/* -------------------------------------------------------------------------- */

export type StreamQuality =
  | '4k'
  | '1080p'
  | '720p'
  | '576p'
  | '480p'
  | '360p'
  | 'sd'
  | 'unknown';

export interface StreamSource {
  /** Playable HLS manifest URL. */
  url: string;
  /** Normalized quality label parsed from upstream metadata / URL hints. */
  quality: StreamQuality;
  /** Human label for the quality chip, e.g. "1080p" or "SD". */
  qualityLabel: string;
  isHttps: boolean;
  /** Optional upstream hints — exposed for copy-to-player utilities only. */
  referrer: string | null;
  userAgent: string | null;
  feed: string | null;
}

export interface ChannelLogo {
  url: string;
  format: 'png' | 'svg' | 'jpg' | 'webp' | 'other';
  width: number | null;
  height: number | null;
  isSquare: boolean;
}

export interface Channel {
  id: string;
  name: string;
  altNames: string[];
  network: string | null;
  countryCode: string;
  countryName: string;
  /** ISO 3166-1 alpha-2 flag emoji derived from the country code. */
  countryFlag: string;
  categoryIds: string[];
  /** Primary category id used for the card pill / sidebar filter. */
  primaryCategoryId: string | null;
  primaryCategoryName: string | null;
  logo: ChannelLogo | null;
  /** Ordered by preference: HTTPS + highest quality first. Index 0 is primary. */
  streams: StreamSource[];
  /** Highest quality label across all streams, used for the card badge. */
  resolutionLabel: string | null;
  isNsfw: boolean;
  website: string | null;
  /** Pre-computed lowercase haystack for search (name + network + alt names). */
  searchKey: string;
}

export interface CountryOption {
  code: string;
  name: string;
  /** Emoji flag derived from the ISO code (falls back to upstream flag field). */
  flag: string;
  /** Exact number of channels with at least one playable .m3u8 stream. */
  channelCount: number;
  languages: string[];
}

export interface CategoryOption {
  id: string;
  name: string;
  /** Number of playable channels carrying this category in the active country. */
  channelCount: number;
}

export interface Catalog {
  /** Every playable channel, sorted by name. */
  channels: Channel[];
  channelById: Map<string, Channel>;
  channelsByCountry: Map<string, Channel[]>;
  /** Category counts scoped to a country: countryCode -> categoryId -> count. */
  categoryCountsByCountry: Map<string, Map<string, number>>;
  /** All resolved logos keyed by channel id (including channels without streams). */
  countries: CountryOption[];
  countryByCode: Map<string, CountryOption>;
  /** Category metadata from categories.json, sorted by name. */
  categories: CategoryOption[];
  /** Timestamp (ms) when the catalog finished assembling. */
  builtAt: number;
  /** Diagnostics surfaced in the UI footer/about popover. */
  stats: CatalogStats;
}

export interface CatalogStats {
  totalChannels: number;
  playableChannels: number;
  blockedChannels: number;
  nsfwChannels: number;
  withoutStreams: number;
  totalStreams: number;
  countriesWithChannels: number;
  fetchMs: number;
}

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Persisted user preferences (localStorage). */
export interface UserPreferences {
  countryCode: string | null;
  sidebarCollapsed: boolean;
  recentChannelIds: string[];
  muted: boolean;
  volume: number;
}

export type CategoryFilter = 'all' | 'recent' | string;
