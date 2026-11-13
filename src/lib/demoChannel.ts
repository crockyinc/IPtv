import type { Catalog, Channel, CountryOption } from '@/types/iptv';

/**
 * A player self-test channel backed by the HLS feed bundled in `public/demo`.
 * It lives outside the iptv-org catalogue so it never pollutes real channel
 * counts, but it can be opened directly (/watch/anystream.demo) and is promoted
 * on the home feed whenever the live catalogue is unreachable.
 */
export const DEMO_CHANNEL_ID = 'anystream.demo';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}`.replace(/\/+$/, '');

export const DEMO_POSTER_URL = `${BASE}/demo/poster.jpg`;
export const DEMO_STREAM_URL = `${BASE}/demo/hls/master.m3u8`;

/** Builds the demo channel, adopting the selected region for context. */
export function createDemoChannel(country: CountryOption | null | undefined): Channel {
  const isSecure =
    typeof window === 'undefined' ? true : window.location.protocol !== 'http:';

  return {
    id: DEMO_CHANNEL_ID,
    name: 'AnyStream Demo Feed',
    altNames: ['Player test feed', 'HLS test stream'],
    network: 'AnyStream',
    countryCode: country?.code ?? 'US',
    countryName: country?.name ?? 'AnyStream',
    countryFlag: country?.flag ?? '🎬',
    categoryIds: ['general'],
    primaryCategoryId: 'general',
    primaryCategoryName: 'Test feed',
    logo: {
      url: DEMO_POSTER_URL,
      format: 'jpg',
      width: 1280,
      height: 720,
      isSquare: false,
    },
    streams: [
      {
        url: DEMO_STREAM_URL,
        quality: '720p',
        qualityLabel: '720p',
        isHttps: isSecure,
        referrer: null,
        userAgent: null,
        feed: 'demo',
      },
    ],
    resolutionLabel: '720p',
    isNsfw: false,
    website: null,
    searchKey: 'anystream demo feed player test feed hls test stream',
  };
}

export function isDemoChannelId(id: string | null | undefined): boolean {
  return id === DEMO_CHANNEL_ID;
}

/**
 * Resolves a route id to a channel, transparently handling the bundled demo
 * feed so watch links and history entries keep working.
 */
export function resolveChannel(
  catalog: Catalog | null,
  id: string | null | undefined,
  countryCode: string | null,
): Channel | undefined {
  if (!id) return undefined;
  if (isDemoChannelId(id)) {
    const country = catalog && countryCode ? catalog.countryByCode.get(countryCode) ?? null : null;
    return createDemoChannel(country);
  }
  return catalog?.channelById.get(id);
}
