/**
 * Client-side render smoke test.
 *
 * Boots jsdom, seeds the stores with a synthetic iptv-org catalogue, then mounts
 * the real pages through react-dom/client so effects, routing and the player's
 * unsupported-browser fallback all execute. No network access is required.
 *
 *   npm run verify:render
 */
import './jsdom-setup';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildCatalog } from '@/services/iptvApi';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useAppStore } from '@/store/useAppStore';
import { HomePage } from '@/pages/HomePage';
import { RecentPage } from '@/pages/RecentPage';
import { WatchPage } from '@/pages/WatchPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { CountryPickerModal } from '@/components/CountryPickerModal';
import { DataSourceBanner } from '@/components/DataSourceBanner';

/* ------------------------------- fixtures -------------------------------- */

const countries = [
  { code: 'US', name: 'United States', languages: ['eng'] },
  { code: 'JP', name: 'Japan', languages: ['jpn'] },
];

const categories = [
  { id: 'news', name: 'News' },
  { id: 'sports', name: 'Sports' },
  { id: 'music', name: 'Music' },
];

const channels = Array.from({ length: 8 }, (_, index) => ({
  id: `ch${index}`,
  name: `Test Network ${index + 1}`,
  country: index < 6 ? 'US' : 'JP',
  categories: [categories[index % categories.length]!.id],
  network: index % 2 === 0 ? 'TestNet' : undefined,
}));

const streams = channels.flatMap((channel, index) => [
  { channel: channel.id, url: `https://example.com/${channel.id}/index.m3u8`, quality: index % 2 === 0 ? '1080p' : undefined },
  { channel: channel.id, url: `https://backup.example.com/${channel.id}/index.m3u8` },
]);

const logos = channels.map((channel) => ({
  channel: channel.id,
  url: `https://example.com/${channel.id}.png`,
  width: 512,
  height: 512,
}));

const catalog = buildCatalog(
  { countries, channels, streams, logos, categories, blocklist: [] },
  1,
);

useCatalogStore.setState({ status: 'ready', catalog, error: null });
useAppStore.setState({
  countryCode: 'US',
  recentChannelIds: ['ch1', 'ch3'],
  categoryFilter: 'all',
  searchQuery: '',
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  countryPickerOpen: false,
  notice: null,
});

/* -------------------------------- harness -------------------------------- */

const checks: Array<[string, boolean, string?]> = [];
const expect = (name: string, pass: boolean, extra?: string) => checks.push([name, pass, extra]);
const expectIncludes = (name: string, haystack: string, needle: string) =>
  expect(name, haystack.includes(needle), `missing: ${needle}`);

const container = document.getElementById('root')!;
let root: Root | null = null;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderWith(element: ReactElement, path: string, route?: string): string {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  container.innerHTML = '';
  const host = document.createElement('div');
  container.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        {route ? (
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        ) : (
          element
        )}
      </MemoryRouter>,
    );
  });
  return host.innerHTML;
}

function clickByText(text: string): boolean {
  const nodes = Array.from(container.querySelectorAll('button'));
  const target = nodes.find((node) => (node.textContent ?? '').trim().includes(text));
  if (!target) return false;
  act(() => {
    target.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  return true;
}

/* --------------------------------- home ---------------------------------- */

const homeHtml = renderWith(<HomePage />, '/');
expectIncludes('home: renders channel cards', homeHtml, 'Test Network 1');
expectIncludes('home: renders region heading', homeHtml, 'Live from United States');
expectIncludes('home: renders category chip', homeHtml, 'Sports');
expectIncludes('home: renders live badge', homeHtml, 'Live');
expectIncludes('home: renders resolution badge', homeHtml, '1080p');
expectIncludes('home: renders sidebar-less country pill', homeHtml, 'US');
expect('home: renders every US channel', (homeHtml.match(/Test Network [1-6]/g) ?? []).length >= 6);

expect('category chip click works', clickByText('Sports'));
const sportsHtml = container.innerHTML;
expect('category chip filters the grid', sportsHtml.includes('Test Network 2'));
expect('category chip hides other categories', !sportsHtml.includes('Test Network 1'));

act(() => useAppStore.setState({ categoryFilter: 'all', searchQuery: 'network 3' }));
const searchHtml = renderWith(<HomePage />, '/');
expectIncludes('search: filters to the query', searchHtml, 'Test Network 3');
expect('search: hides non matches', !searchHtml.includes('Test Network 1'));

act(() => useAppStore.setState({ searchQuery: 'zzzz-no-match' }));
const emptyHtml = renderWith(<HomePage />, '/');
expectIncludes('empty state renders', emptyHtml, 'No channels match those filters');
act(() => useAppStore.setState({ searchQuery: '', categoryFilter: 'all' }));

/* --------------------------------- recent -------------------------------- */

const recentHtml = renderWith(<RecentPage />, '/recent');
expectIncludes('recent: renders watched channel', recentHtml, 'Test Network 2');
expectIncludes('recent: renders history heading', recentHtml, 'Recently watched');

/* -------------------------------- watch ---------------------------------- */

const watchHtml = renderWith(<WatchPage />, '/watch/ch0', '/watch/:channelId');
expectIncludes('watch: renders channel title', watchHtml, 'Test Network 1');
expectIncludes('watch: renders info bar', watchHtml, 'Active source');
expectIncludes('watch: renders primary url', watchHtml, 'https://example.com/ch0/index.m3u8');
expectIncludes('watch: renders up next rail', watchHtml, 'Up next');
expectIncludes('watch: lists a sibling channel', watchHtml, 'Test Network 2');
expect('watch: shows offline overlay without MediaSource', watchHtml.includes('Stream offline') || watchHtml.includes('cannot play'));

const missingHtml = renderWith(<WatchPage />, '/watch/does-not-exist', '/watch/:channelId');
expectIncludes('watch: handles unknown channel', missingHtml, 'Channel not available');

/* --------------------------------- picker -------------------------------- */

act(() => useAppStore.setState({ countryCode: null, countryPickerOpen: false }));
const pickerHtml = renderWith(<CountryPickerModal />, '/');
expectIncludes('picker: forces first-run open', pickerHtml, 'Choose where to watch from');
expectIncludes('picker: lists countries', pickerHtml, 'United States');
expectIncludes('picker: lists channel counts', pickerHtml, 'live');
expect('picker: choosing a country persists it', (() => {
  clickByText('Japan');
  return useAppStore.getState().countryCode === 'JP' && window.localStorage.getItem('anystream_country') === 'JP';
})());

/* ------------------------------ data source ------------------------------ */

const liveBannerHtml = renderWith(<DataSourceBanner />, '/');
expect('banner: hidden while live', !liveBannerHtml.includes('Offline snapshot'));

act(() =>
  useCatalogStore.setState({
    catalog: { ...catalog, source: 'fallback', liveError: 'Failed to fetch' },
  }),
);
const fallbackBannerHtml = renderWith(<DataSourceBanner />, '/');
expectIncludes('banner: explains the snapshot', fallbackBannerHtml, 'Offline snapshot');
expectIncludes('banner: shows the failure reason', fallbackBannerHtml, 'Failed to fetch');
expectIncludes('banner: offers a live retry', fallbackBannerHtml, 'Retry live data');
act(() => useCatalogStore.setState({ catalog }));

/* --------------------------------- 404 ----------------------------------- */

const notFoundHtml = renderWith(<NotFoundPage />, '/nope');
expectIncludes('404: renders', notFoundHtml, 'This page went off air');

if (root) act(() => root!.unmount());

/* -------------------------------- report --------------------------------- */

let failed = 0;
for (const [name, pass, extra] of checks) {
  if (pass) console.log(`ok    ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}
console.log(failed === 0 ? `\nAll ${checks.length} render checks passed.` : `\n${failed} check(s) failed.`);
if (failed > 0) process.exitCode = 1;
