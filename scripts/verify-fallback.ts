/**
 * End-to-end test of the live → offline-snapshot strategy in `loadCatalog()`.
 * Network access is stubbed: iptv-org requests fail the way a locked-down
 * network fails, the bundled snapshot is served from disk.
 *
 *   npm run verify:fallback
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog, clearCatalogCache, loadCatalog } from '@/services/iptvApi';

const SNAPSHOT_DIR = join(process.cwd(), 'public', 'fallback');
const API_HOST = 'https://iptv-org.github.io';

const checks: Array<[string, boolean, unknown?]> = [];
const expect = (name: string, pass: boolean, extra?: unknown) => checks.push([name, pass, extra]);

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const snapshotResponse = (path: string): Response => {
  const file = path.replace(/^.*\/fallback\//, '');
  const body = readFileSync(join(SNAPSHOT_DIR, file), 'utf8');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const offlineFetch: FetchImpl = async (input) => {
  const url = String(input);
  if (url.startsWith(API_HOST)) throw new TypeError('Failed to fetch');
  if (url.includes('/fallback/')) return snapshotResponse(url);
  throw new TypeError(`Unexpected request in offline test: ${url}`);
};

/* --------------------------- offline behaviour --------------------------- */

globalThis.fetch = offlineFetch as typeof fetch;

const offlineCatalog = await loadCatalog();

expect('falls back to the snapshot when the API is blocked', offlineCatalog.source === 'fallback');
expect('records the network failure', /Failed to fetch/.test(offlineCatalog.liveError ?? ''), offlineCatalog.liveError);
expect('snapshot has channels', offlineCatalog.channels.length > 500, offlineCatalog.channels.length);
expect('snapshot has countries', offlineCatalog.countries.length >= 20, offlineCatalog.countries.length);
expect(
  'every snapshot channel has an HLS source',
  offlineCatalog.channels.every((channel) => channel.streams.length > 0 && /m3u8/i.test(channel.streams[0]!.url)),
);
expect(
  'snapshot channels carry a known country',
  offlineCatalog.channels.every((channel) => offlineCatalog.countryByCode.has(channel.countryCode)),
);
expect(
  'country counts match the grid',
  offlineCatalog.countries.every(
    (country) => (offlineCatalog.channelsByCountry.get(country.code)?.length ?? 0) === country.channelCount,
  ),
);
expect(
  'categories are present',
  offlineCatalog.categories.length > 5,
  offlineCatalog.categories.map((category) => category.id),
);
expect(
  'search key is populated',
  offlineCatalog.channelById.get(offlineCatalog.channels[0]!.id)?.searchKey.length ? true : false,
);

/* ---------------------------- live behaviour ----------------------------- */

const liveFixture = {
  countries: [{ name: 'Narnia', code: 'NR', languages: ['eng'] }],
  channels: [{ id: 'lantern.nr', name: 'Lantern TV', country: 'NR', categories: ['general'] }],
  streams: [{ channel: 'lantern.nr', url: 'https://example.com/lantern/index.m3u8' }],
  logos: [],
  categories: [{ id: 'general', name: 'General' }],
  blocklist: [],
};

const liveFetch: FetchImpl = async (input) => {
  const url = String(input);
  if (!url.startsWith(API_HOST)) throw new TypeError(`Unexpected request in live test: ${url}`);
  const key = url.split('/').pop()?.replace('.json', '') as keyof typeof liveFixture;
  return new Response(JSON.stringify(liveFixture[key] ?? []), { status: 200 });
};

globalThis.fetch = liveFetch as typeof fetch;
clearCatalogCache();

const liveCatalog = await loadCatalog();

expect('uses the live API when it answers', liveCatalog.source === 'live');
expect('live catalogue is not flagged', liveCatalog.liveError === null);
expect('live catalogue contains the fixture channel', liveCatalog.channelById.has('lantern.nr'));

/* ------------------------------ totals sanity ---------------------------- */

const rebuilt = buildCatalog(
  {
    countries: JSON.parse(readFileSync(join(SNAPSHOT_DIR, 'countries.json'), 'utf8')),
    channels: JSON.parse(readFileSync(join(SNAPSHOT_DIR, 'channels.json'), 'utf8')),
    streams: JSON.parse(readFileSync(join(SNAPSHOT_DIR, 'streams.json'), 'utf8')),
    logos: JSON.parse(readFileSync(join(SNAPSHOT_DIR, 'logos.json'), 'utf8')),
    categories: JSON.parse(readFileSync(join(SNAPSHOT_DIR, 'categories.json'), 'utf8')),
    blocklist: [],
  },
  0,
  { source: 'fallback', liveError: 'test' },
);

expect('snapshot rebuild is deterministic', rebuilt.channels.length === offlineCatalog.channels.length);
expect('snapshot logos resolve for most channels', rebuilt.channels.filter((c) => c.logo).length > rebuilt.channels.length * 0.8, {
  withLogo: rebuilt.channels.filter((c) => c.logo).length,
  total: rebuilt.channels.length,
});
expect('snapshot keeps multi-source failover', rebuilt.channels.some((c) => c.streams.length > 1));

let failed = 0;
for (const [name, pass, extra] of checks) {
  if (pass) console.log(`ok    ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`, extra ?? '');
  }
}
console.log(failed === 0 ? `\nAll ${checks.length} fallback checks passed.` : `\n${failed} check(s) failed.`);
if (failed > 0) process.exitCode = 1;
