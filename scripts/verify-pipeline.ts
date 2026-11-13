/* Temporary pipeline smoke test (not shipped). */
import { buildCatalog, getCategoriesForCountry, rankStreams, isPlayableStreamUrl, detectQuality } from '@/services/iptvApi';

const countries = [
  { code: 'US', name: 'United States', languages: ['eng'] },
  { code: 'GB', name: 'United Kingdom', languages: ['eng'] },
  { code: 'DE', name: 'Germany', languages: ['deu'] },
];

const categories = [
  { id: 'news', name: 'News' },
  { id: 'sports', name: 'Sports' },
  { id: 'kids', name: 'Kids' },
  { id: 'general', name: 'General' },
];

const channels = [
  { id: 'a', name: 'Alpha News', country: 'US', categories: ['news'], network: 'AlphaNet' },
  { id: 'b', name: 'Beta Sports', country: 'US', categories: ['sports'] },
  { id: 'blocked', name: 'Blocked TV', country: 'US', categories: ['news'] },
  { id: 'nsfw', name: 'NSFW TV', country: 'US', categories: ['general'], is_nsfw: true },
  { id: 'nostream', name: 'No Stream TV', country: 'US', categories: ['news'] },
  { id: 'c', name: 'Charlie Kids', country: 'GB', categories: ['kids', 'general'], alt_names: ['CK'] },
  { id: 'd', name: 'Delta Eins', country: 'DE', categories: ['general'] },
  { id: 'e', name: 'Echo Only Http', country: 'DE', categories: ['general'] },
  { id: 'unknown-country', name: 'Zulu', country: 'ZZ', categories: ['news'] },
];

const streams = [
  { channel: 'a', url: 'https://cdn.example.com/a/720p/index.m3u8' },
  { channel: 'a', url: 'http://cdn.example.com/a/1080p/index.m3u8' },
  { channel: 'a', url: 'https://cdn.example.com/a/720p/index.m3u8' }, // duplicate
  { channel: 'b', url: 'https://cdn.example.com/b/1080/hevc.m3u8?token=1' },
  { channel: 'blocked', url: 'https://cdn.example.com/bl/x.m3u8' },
  { channel: 'nsfw', url: 'https://cdn.example.com/n/x.m3u8' },
  { channel: 'c', url: 'https://cdn.example.com/c/master.m3u8', quality: '4K' },
  { channel: 'd', url: 'https://cdn.example.com/d/master.m3u8' },
  { channel: 'e', url: 'http://cdn.example.com/e/master.m3u8' },
  { channel: 'unknown-country', url: 'https://cdn.example.com/z/master.m3u8' },
  { channel: null, url: 'https://cdn.example.com/dead/master.m3u8' },
  { channel: 'a', url: 'https://cdn.example.com/a/not-a-manifest.mp4' },
  { channel: 'a', url: 'ftp://cdn.example.com/a/x.m3u8' },
];

const logos = [
  { channel: 'a', url: 'https://logos.example.com/a/logo.png', width: 1080, height: 1080, format: 'PNG' },
  { channel: 'a', url: 'http://logos.example.com/a/logo.svg', width: 256, height: 256, format: 'SVG' },
  { channel: 'a', url: 'https://logos.example.com/a/wide.jpg', width: 1200, height: 300, format: 'JPEG' },
  { channel: 'b', url: 'https://logos.example.com/b/logo.webp', width: 100, height: 100 },
  { channel: 'b', url: 'broken.svg', format: 'SVG' },
  { channel: 'c', url: 'https://logos.example.com/c/logo.png', width: 40, height: 40 },
  { channel: 'nostream', url: 'https://logos.example.com/n/logo.png' },
];

const blocklist = [{ channel: 'blocked', reason: 'dmca' }, 'also-blocked'];

const catalog = buildCatalog({ countries, channels, streams, logos, categories, blocklist }, 12);

const checks: Array<[string, boolean, unknown?]> = [];
const push = (name: string, pass: boolean, extra?: unknown) => checks.push([name, pass, extra]);

push('playable channels = 5', catalog.channels.length === 5, catalog.channels.map((c) => c.id));
push('blocked removed', !catalog.channels.some((c) => c.id === 'blocked'));
push('nsfw removed', !catalog.channels.some((c) => c.id === 'nsfw'));
push('no-stream removed', !catalog.channels.some((c) => c.id === 'nostream'));
push('unknown country removed', !catalog.channels.some((c) => c.id === 'unknown-country'));

const alpha = catalog.channelById.get('a');
push('alpha https first', alpha?.streams[0]?.isHttps === true, alpha?.streams.map((s) => s.url));
push('alpha dedupe (2 streams)', alpha?.streams.length === 2, alpha?.streams.length);
push('alpha first is 720p (only https)', alpha?.streams[0]?.quality === '720p', alpha?.streams[0]?.quality);
push('alpha resolution label', alpha?.resolutionLabel === '720p', alpha?.resolutionLabel);

const beta = catalog.channelById.get('b');
push('beta quality 1080p from path', beta?.streams[0]?.quality === '1080p', beta?.streams[0]?.quality);

const charlie = catalog.channelById.get('c');
push('charlie 4k from hint', charlie?.streams[0]?.quality === '4k', charlie?.streams[0]?.quality);
push('charlie categories', charlie?.categoryIds.join(',') === 'kids,general', charlie?.categoryIds);
push('charlie alt names in search key', charlie?.searchKey.includes(' ck') === true, charlie?.searchKey);

push('logo prefers https square png', alpha?.logo?.url === 'https://logos.example.com/a/logo.png', alpha?.logo);
push('logo ignores relative url', beta?.logo?.url === 'https://logos.example.com/b/logo.webp', beta?.logo?.url);

push('country counts', catalog.countryByCode.get('US')?.channelCount === 2, catalog.countries.map((c) => [c.code, c.channelCount]));
push('GB flag emoji', catalog.countryByCode.get('GB')?.flag === '🇬🇧', catalog.countryByCode.get('GB')?.flag);
push('countries sorted by count', catalog.countries[0]?.code === 'DE' || catalog.countries[0]?.code === 'US', catalog.countries.map((c) => c.code));

const deCategories = getCategoriesForCountry(catalog, 'DE');
push('DE categories scoped', deCategories.length === 1 && deCategories[0]?.id === 'general', deCategories.map((c) => [c.id, c.channelCount]));

push('stats playable', catalog.stats.playableChannels === 5, catalog.stats);
push('stats blocked', catalog.stats.blockedChannels === 1, catalog.stats.blockedChannels);
push('stats nsfw', catalog.stats.nsfwChannels === 1, catalog.stats.nsfwChannels);
push('stats withoutStreams', catalog.stats.withoutStreams === 1, catalog.stats.withoutStreams);

push('url validation rejects mp4', isPlayableStreamUrl('https://x/y.mp4') === false);
push('url validation accepts query', isPlayableStreamUrl('https://x/y.m3u8?a=1') === true);
push('url validation rejects ftp', isPlayableStreamUrl('ftp://x/y.m3u8') === false);
push('quality detect hd hint', detectQuality({ channel: 'x', url: 'https://x/live/HD/master.m3u8' }) === '720p');

const ranked = rankStreams([
  { url: 'http://b', quality: '4k', qualityLabel: '4K', isHttps: false, referrer: null, userAgent: null, feed: null },
  { url: 'https://a', quality: '480p', qualityLabel: '480p', isHttps: true, referrer: null, userAgent: null, feed: null },
]);
push('https beats higher quality http', ranked[0]?.url === 'https://a', ranked.map((r) => r.url));

let failed = 0;
for (const [name, pass, extra] of checks) {
  if (!pass) {
    failed += 1;
    console.error(`FAIL  ${name}`, extra ?? '');
  } else {
    console.log(`ok    ${name}`);
  }
}
if (failed > 0) process.exitCode = 1;
else console.log(`\nAll ${checks.length} checks passed.`);
