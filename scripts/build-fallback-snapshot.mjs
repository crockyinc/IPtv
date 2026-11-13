#!/usr/bin/env node
/**
 * Regenerates `public/fallback/*.json` — the offline snapshot AnyStream serves
 * when `iptv-org.github.io` is unreachable (blocked network, restrictive
 * firewall, offline demo). The output mirrors the public API documents exactly,
 * so the normal pipeline consumes it without special cases.
 *
 * Source data (both archives are fetched from codeload.github.com):
 *
 *   curl -L -o db.tgz   https://codeload.github.com/iptv-org/database/tar.gz/refs/heads/master
 *   curl -L -o iptv.tgz https://codeload.github.com/iptv-org/iptv/tar.gz/refs/heads/master
 *   tar -xzf db.tgz      # -> database-master/data/*.csv
 *   tar -xzf iptv.tgz    # -> iptv-master/streams/*.m3u
 *
 * Usage:
 *   node scripts/build-fallback-snapshot.mjs \
 *     --database /tmp/database-master/data \
 *     --streams  /tmp/iptv-master/streams
 *
 * Each country keeps a slice proportional to its real channel count, so the
 * picker's "most channels" ordering still reflects upstream popularity.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/* ------------------------------- arguments ------------------------------- */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const DATABASE_DIR = resolve(flag('database', '../database-master/data'));
const STREAMS_DIR = resolve(flag('streams', '../iptv-master/streams'));
const OUT_DIR = resolve(flag('out', 'public/fallback'));
const COUNTRY_LIMIT = Number(flag('countries', '30'));
const STREAMS_PER_CHANNEL = Number(flag('streams-per-channel', '3'));
/** kept = clamp(round(realChannels / DIVISOR), MIN_PER_COUNTRY, MAX_PER_COUNTRY) */
const COUNTRY_DIVISOR = Number(flag('divisor', '12'));
const MAX_PER_COUNTRY = Number(flag('max-per-country', '150'));
const MIN_PER_COUNTRY = Number(flag('min-per-country', '24'));

/* ------------------------------ CSV parsing ------------------------------ */

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF, embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((cells) => cells.some((cell) => cell !== ''));
  if (!header) return [];

  return body.map((cells) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? '';
    });
    return record;
  });
}

const readCsv = (file) => parseCsv(readFileSync(join(DATABASE_DIR, file), 'utf8'));
const splitList = (value) => (value ? value.split(';').map((item) => item.trim()).filter(Boolean) : []);

/* ------------------------------ M3U parsing ------------------------------ */

const M3U8 = /\.m3u8?(\?|#|$)/i;

/** Extracts `{ channel, feed, url, referrer, userAgent, quality, title }` tuples. */
function parsePlaylist(text) {
  const out = [];
  let pending = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const tvgId = /tvg-id="([^"]*)"/.exec(line)?.[1] ?? '';
      const name = line.slice(line.lastIndexOf(',') + 1).trim();
      const quality = /\((\d{3,4}p|4k|uhd|sd)\)/i.exec(name)?.[1] ?? null;
      const [channel, feed] = tvgId.split('@');
      pending = {
        channel: channel || null,
        feed: feed ? feed.toUpperCase() : null,
        quality: quality ? quality.toLowerCase() : null,
        title: name || null,
        referrer: null,
        userAgent: null,
        url: null,
      };
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:') && pending) {
      const option = line.slice('#EXTVLCOPT:'.length);
      if (option.startsWith('http-referrer=')) pending.referrer = option.slice(14) || null;
      else if (option.startsWith('http-user-agent=')) pending.userAgent = option.slice(16) || null;
      continue;
    }

    if (line.startsWith('#') || !pending) continue;

    pending.url = line;
    if (M3U8.test(line.split('?')[0] ?? line) && pending.channel) out.push(pending);
    pending = null;
  }

  return out;
}

/* --------------------------------- build --------------------------------- */

console.log(`Reading database from ${DATABASE_DIR}`);
const countriesCsv = readCsv('countries.csv');
const categoriesCsv = readCsv('categories.csv');
const channelsCsv = readCsv('channels.csv');
const logosCsv = readCsv('logos.csv');
const blocklistCsv = readCsv('blocklist.csv');

const blocked = new Set(blocklistCsv.map((entry) => entry.channel).filter(Boolean));
const countryNames = new Map(countriesCsv.map((row) => [row.code, row.name]));
const countryLanguages = new Map(countriesCsv.map((row) => [row.code, splitList(row.languages)]));
const countryFlags = new Map(countriesCsv.map((row) => [row.code, row.flag]));
const categoryIds = new Set(categoriesCsv.map((row) => row.id));

console.log(`Reading playlists from ${STREAMS_DIR}`);
const streamsByChannel = new Map();
let playlistCount = 0;

for (const file of readdirSync(STREAMS_DIR).filter((name) => name.endsWith('.m3u'))) {
  playlistCount += 1;
  const entries = parsePlaylist(readFileSync(join(STREAMS_DIR, file), 'utf8'));
  for (const entry of entries) {
    const bucket = streamsByChannel.get(entry.channel);
    if (bucket) bucket.push(entry);
    else streamsByChannel.set(entry.channel, [entry]);
  }
}

console.log(`Parsed ${playlistCount} playlists, ${streamsByChannel.size} channels with streams`);

/* Pick one logo per channel: prefer in-use HTTPS PNG/SVG, then anything HTTPS. */
const LOGO_FORMAT_RANK = { SVG: 3, PNG: 2, WEBP: 1, JPEG: 0, JPG: 0 };
const logoByChannel = new Map();
for (const row of logosCsv) {
  if (!row.channel || !/^https:\/\//i.test(row.url)) continue;
  const score =
    (row.in_use === 'TRUE' ? 10 : 0) + (LOGO_FORMAT_RANK[row.format?.toUpperCase()] ?? 0);
  const current = logoByChannel.get(row.channel);
  if (!current || score > current.score) {
    logoByChannel.set(row.channel, {
      score,
      logo: {
        channel: row.channel,
        url: row.url,
        width: row.width ? Number(row.width) : undefined,
        height: row.height ? Number(row.height) : undefined,
        format: row.format ? row.format.toUpperCase() : 'PNG',
      },
    });
  }
}

/* Filter channels exactly like the runtime does, then bucket them by country. */
const playableByCountry = new Map();
for (const row of channelsCsv) {
  if (!row.id || !row.name) continue;
  if (blocked.has(row.id)) continue;
  if (row.is_nsfw === 'TRUE') continue;
  if (!countryNames.has(row.country)) continue;
  if (!streamsByChannel.has(row.id)) continue;

  const bucket = playableByCountry.get(row.country);
  if (bucket) bucket.push(row);
  else playableByCountry.set(row.country, [row]);
}

const rankedCountries = [...playableByCountry.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, COUNTRY_LIMIT);

const selectedChannels = [];
const selectedStreams = [];
const selectedLogos = [];

for (const [, rows] of rankedCountries) {
  rows.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  const keep = Math.min(
    MAX_PER_COUNTRY,
    Math.max(MIN_PER_COUNTRY, Math.round(rows.length / COUNTRY_DIVISOR)),
  );

  for (const row of rows.slice(0, keep)) {
    selectedChannels.push({
      id: row.id,
      name: row.name,
      alt_names: splitList(row.alt_names),
      network: row.network || null,
      country: row.country,
      categories: splitList(row.categories).filter((id) => categoryIds.has(id)),
      is_nsfw: false,
      website: row.website || null,
    });

    const seen = new Set();
    const ranked = streamsByChannel
      .get(row.id)
      .filter((entry) => {
        const key = entry.url.replace(/\/+$/, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => Number(b.url.startsWith('https://')) - Number(a.url.startsWith('https://')));

    for (const entry of ranked.slice(0, STREAMS_PER_CHANNEL)) {
      selectedStreams.push({
        channel: row.id,
        feed: entry.feed,
        url: entry.url,
        referrer: entry.referrer,
        user_agent: entry.userAgent,
        quality: entry.quality,
        title: entry.title,
      });
    }

    const logo = logoByChannel.get(row.id);
    if (logo) selectedLogos.push(logo.logo);
  }
}

const usedCountries = [...new Set(selectedChannels.map((channel) => channel.country))].sort(
  (a, b) => a.localeCompare(b),
);

const output = {
  'countries.json': countriesCsv
    .filter((row) => usedCountries.includes(row.code))
    .map((row) => ({
      name: countryNames.get(row.code),
      code: row.code,
      languages: countryLanguages.get(row.code) ?? [],
      flag: countryFlags.get(row.code) ?? undefined,
    })),
  'categories.json': categoriesCsv.map((row) => ({ id: row.id, name: row.name })),
  'channels.json': selectedChannels,
  'streams.json': selectedStreams,
  'logos.json': selectedLogos,
  'blocklist.json': [],
};

mkdirSync(OUT_DIR, { recursive: true });

let totalBytes = 0;
for (const [file, payload] of Object.entries(output)) {
  const json = JSON.stringify(payload);
  writeFileSync(join(OUT_DIR, file), json);
  totalBytes += Buffer.byteLength(json);
  const label = Array.isArray(payload) ? `${payload.length} entries` : 'object';
  console.log(`${file.padEnd(16)} ${label.padEnd(14)} ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
}

console.log(
  `\n${selectedChannels.length} channels · ${selectedStreams.length} streams · ` +
    `${usedCountries.length} countries · ${(totalBytes / 1024).toFixed(1)} KB total`,
);
