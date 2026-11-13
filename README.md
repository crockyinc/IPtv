# AnyStream

A YouTube-inspired, **100% client-side** live IPTV browser. AnyStream joins the public
[`iptv-org`](https://github.com/iptv-org/iptv) JSON datasets in the browser, throws away everything
that cannot actually be played, and renders a dark, fast, TV-guide-like experience with a custom
`hls.js` player.

There is **no backend, no build-time data snapshot, no API key and no tracking**.

![AnyStream](public/icons/icon-512.png)

---

## Features

| Area | What you get |
| --- | --- |
| Country picker | Blocking first-run modal, searchable by name or ISO code, flags + exact playable channel counts, A–Z / most-channels sort. Region can be switched any time from the top bar. |
| Top bar (56px) | Hamburger, brand mark, YouTube-style pill search with clear button, live filtering by channel **name, network or alternate names**, country switcher avatar. |
| Sidebar | 240px expanded / 72px icon rail / slide-over drawer on mobile. Home, Recently Watched, and every category that has at least one playable channel in the selected country (with counts). |
| Home feed | Sticky category chips synced with the sidebar, responsive 1 / 2 / 3–4 column grid, 16:9 cards with logo canvas, hover zoom, `● LIVE` badge, resolution badge and metadata row. Infinite "Load more" paging. |
| Watch page | Two-column theatre layout (~70/30), custom HLS player, channel info bar with copy-stream-URL, and an "Up next / channel surfing" rail scoped to the same country and category. |
| Player | hls.js with native Safari fallback, play/pause, mute + volume slider, adaptive quality menu, PiP, fullscreen, LIVE indicator with jump-to-live, keyboard shortcuts, 8s failover watchdog. |
| Resilience | Primary stream → automatic backup failover → clean "offline / geo-restricted" overlay with Retry and "Try next channel". Broken logos fall back to stylised initials on a gradient. |
| Offline shell | `public/sw.js` precaches the app shell and stale-while-revalidate caches the iptv-org JSON. Video segments are never intercepted. |
| Degraded mode | If the live API cannot be reached at all (restricted network, offline, corporate firewall), AnyStream falls back to a bundled snapshot of real iptv-org data and says so in a banner. Retry once the network allows it. |
| Persistence | Country, sidebar state, watch history, volume/mute — all in `localStorage`, all optional. |

---

## Tech stack

- **React 18** + **TypeScript** (strict, `noUncheckedIndexedAccess`) via **Vite 5**
- **Tailwind CSS 3** with a YouTube-dark design token set (`#0f0f0f`, `#272727`, `#f1f1f1`, `#aaaaaa`, `#ff0000`)
- **lucide-react** icons
- **hls.js** (`^1.5`) with native HLS fallback
- **zustand** for app state + preference persistence
- **react-router-dom** for `/`, `/recent`, `/watch/:channelId`

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm run verify:pipeline   # 28-assertion smoke test of the data pipeline
npm run verify:render     # 31-assertion jsdom render test of the real pages
npm run verify:fallback   # 15-assertion test of live -> offline-snapshot handling
npm run snapshot          # regenerate public/fallback/*.json from upstream data
```

Optional: point the app at a self-hosted mirror of the JSON documents (defaults to
`https://iptv-org.github.io/api`):

```bash
# .env.local
VITE_IPTV_API_BASE=https://my-mirror.example.com/api
```

---

## Project structure

```
index.html                  Document shell, theme bootstrap, manifest links
public/
  sw.js                     Service worker: app shell + iptv-org JSON caching
  fallback/*.json           Offline snapshot (same shape as the public API)
  favicon.svg               Brand mark
  manifest.webmanifest      PWA manifest
  icons/                    Install icons (192/512/maskable)
src/
  main.tsx                  React root + service worker registration
  App.tsx                   Shell: top bar, sidebar, routes, picker, toasts
  styles.css                Tailwind layers, YouTube-ish component classes
  types/
    iptv.ts                 Raw API shapes + normalized domain model
  services/
    iptvApi.ts              Fetch (Promise.all + retries + memory cache),
                            blocklist/NSFW filtering, stream & logo ranking,
                            country/category aggregation
  store/
    useAppStore.ts          Preferences + ephemeral UI state (zustand)
    useCatalogStore.ts      Catalog load status
  hooks/
    useCatalog.ts           Data selectors + channel search/category filters
    useHlsPlayer.ts         Player state machine, failover, quality, fullscreen
    useMediaQuery.ts        Desktop / mobile breakpoints
  components/
    TopBar.tsx  Sidebar.tsx  CategoryChips.tsx  CountryPickerModal.tsx
    ChannelCard.tsx  ChannelGrid.tsx  ChannelLogo.tsx  BrandLogo.tsx
    Feedback.tsx            Toast, empty and error states
    ErrorBoundary.tsx       Recoverable render-error card
    watch/VideoPlayer.tsx   Custom HLS player UI
    watch/ChannelInfoBar.tsx  watch/UpNextList.tsx
  pages/
    HomePage.tsx  RecentPage.tsx  WatchPage.tsx  NotFoundPage.tsx
  lib/
    utils.ts                Flags, initials, gradients, clipboard, debounce
    storage.ts              Safe localStorage helpers
scripts/
  build-fallback-snapshot.mjs  Regenerates public/fallback from upstream CSV/M3U
  verify-pipeline.ts        Node smoke test for the join/filter rules
  verify-render.tsx         jsdom test that mounts the real pages
  verify-fallback.ts        Live -> snapshot fallback test with a stubbed network
  jsdom-setup.ts            Browser shims used by the render test
.env.example                Optional mirror of the iptv-org JSON
```

---

## Data pipeline

All six documents are requested concurrently with `Promise.all`:

```
countries.json  channels.json  streams.json  logos.json  categories.json  blocklist.json
```

Then, in one synchronous pass (`buildCatalog`):

1. **Blocklist + NSFW** — any channel id present in `blocklist.json` (objects *or* plain strings) is
   dropped, as is anything with `is_nsfw === true`.
2. **Streams** — only `http(s)` URLs that are HLS manifests (`.m3u8` / `.m3u`) survive. Channels
   with zero valid manifests never enter the catalog. URLs are de-duplicated, HTTPS is ranked above
   HTTP, and within a protocol the highest perceived quality comes first. The rest become ordered
   failover backups.
3. **Logos** — `logos.json` is scored per channel: HTTPS ≫ HTTP, SVG > PNG > WebP > JPEG, square
   aspect boosted, absurdly large rasters penalised, non-image/relative URLs discarded. The winner
   is stored; if it fails to load at runtime the UI shows channel initials on a deterministic
   gradient.
4. **Countries & categories** — playable counts are aggregated per ISO code (with `UK→GB` style
   aliases normalized) and category counts are aggregated **per country**, so the sidebar and chips
   only ever show categories that actually have content in the active region.
5. **Search index** — a lowercase `name + network + alt_names` haystack is precomputed once per
   channel so keystroke filtering never touches the network or re-normalizes strings.

Parsing/joining happens a single time per session; the resulting `Catalog` (Maps keyed by id and by
country) is kept in memory and shared across route changes. Only the JSON documents are also cached
by the service worker.

### Offline snapshot (degraded mode)

`loadCatalog()` gives the live API a hard 20-second budget. If any required document fails — offline,
DNS/proxy block, CORS, HTTP error, timeout — the six documents are instead read from
`public/fallback/`, the exact same pipeline runs, and the catalogue is tagged `source: 'fallback'`.
The UI then shows an amber "Offline snapshot" banner with the failure reason and a **Retry live
data** button; the footer and country picker label the data source too. Nothing is faked: the
snapshot is a trimmed export of the real iptv-org database (30 countries, 50 channels each, one logo
and up to three HLS sources per channel, ~835 KB).

Regenerate it at any time (needs the two upstream archives, both fetched from codeload.github.com):

```bash
curl -L -o db.tgz   https://codeload.github.com/iptv-org/database/tar.gz/refs/heads/master
curl -L -o iptv.tgz https://codeload.github.com/iptv-org/iptv/tar.gz/refs/heads/master
tar -xzf db.tgz -C /tmp && tar -xzf iptv.tgz -C /tmp
npm run snapshot -- --database /tmp/database-master/data --streams /tmp/iptv-master/streams \
                  --countries 30 --per-country 50
```

---

## Player behaviour

- `Hls.isSupported()` → hls.js. Otherwise native `video.src` (Safari/iOS).
- A **8 second watchdog** starts with every source; if no frames are rendered the next backup
  source is tried automatically. Fatal `NETWORK_ERROR` / `MEDIA_ERROR` events also trigger failover
  (with one `startLoad()` / `recoverMediaError()` retry first).
- When every source is exhausted the player renders a non-crashing overlay with Retry, "Try next
  channel" (advances the up-next rail) and "Copy stream URL".
- Unmuted autoplay is usually blocked by browsers; the player falls back to muted autoplay and the
  controls expose the volume slider.
- Shortcuts: `space`/`k` play-pause, `m` mute, `f` fullscreen, `p` picture-in-picture,
  `↑`/`↓` volume, `/` focus search (global).

---

## Preferences stored on this device

| Key | Meaning |
| --- | --- |
| `anystream_country` | Selected ISO country code (its absence triggers the first-run picker) |
| `anystream_sidebar` | `true` / `false` collapsed state |
| `anystream_recent` | JSON array of recently opened channel ids (max 24) |
| `anystream_volume` | Last volume, 0–1 |
| `anystream_muted` | Last mute state |

---

## Deployment

Any static host works. Because routing uses the History API, configure a single-page fallback to
`index.html`:

- **Netlify** — `/* /index.html 200`
- **Vercel** — framework preset "Vite", rewrites `{ "source": "/(.*)", "destination": "/index.html" }`
- **GitHub Pages** — copy `dist/index.html` to `dist/404.html`, or deploy with an action that does.
- **Nginx** — `try_files $uri $uri/ /index.html;`

Ship the whole `dist/` folder: it contains `/fallback/*.json`, which is what keeps the app useful
when the public API is blocked from the visitor's network.

Serve over **HTTPS**: browsers block HTTP HLS manifests on secure pages, and the clipboard,
fullscreen and picture-in-picture APIs require a secure context.

`sw.js` is registered in production builds only. Bump the `VERSION` constant inside it when you want
to invalidate the cached JSON.

---

## Browser support

Chrome/Edge 90+, Firefox 90+, Safari 14+ (native HLS on iOS). Requires `fetch`, `AbortController`,
`IntersectionObserver` and `Intl` — all baseline. Media Source Extensions are required for hls.js;
without them the app uses the native HLS path or shows a clear message.

---

## Legal

AnyStream hosts nothing. It is a viewer for the community-maintained
[iptv-org](https://github.com/iptv-org/iptv) index, which links to streams published by third-party
broadcasters. Availability, legality and geo-restrictions of those streams are outside this
project's control; respect the rights of broadcasters in your jurisdiction.
