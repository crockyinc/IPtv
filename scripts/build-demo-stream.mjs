#!/usr/bin/env node
/**
 * Renders the bundled player test feed (`public/demo/`) — a 10 second,
 * two-rendition HLS stream served from the app origin.
 *
 * Why it exists: public IPTV manifests live on broadcaster CDNs. Networks that
 * block third-party hosts (corporate firewalls, this preview sandbox) cannot
 * play them at all, which makes the player impossible to evaluate. This local
 * feed exercises every player feature — multi-bitrate quality menu, hls.js
 * pipeline, fullscreen, PiP — without leaving the origin.
 *
 * Requires ffmpeg (system install or `@ffmpeg-installer/ffmpeg`):
 *   npm run demo:stream
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolveFfmpeg() {
  try {
    const installer = require('@ffmpeg-installer/ffmpeg');
    return /** @type {string} */ (installer.path);
  } catch {
    return 'ffmpeg';
  }
}

const FFMPEG = resolveFfmpeg();
const OUT = join(process.cwd(), 'public', 'demo');
const FONT_DIR = '/usr/share/fonts/truetype/dejavu';
const FONT_BOLD = join(FONT_DIR, 'DejaVuSans-Bold.ttf');
const FONT = join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_MONO = join(FONT_DIR, 'DejaVuSansMono-Bold.ttf');

const DURATION = 10;
const SEGMENT_SECONDS = 2;

/** Shared test-card composition, parameterised by output size. */
function testCard(width, height, qualityLabel) {
  const scale = width / 1280;
  const s = (value) => Math.round(value * scale);
  const title = s(104);
  const sub = s(34);

  return [
    `drawbox=x=0:y=0:w=iw:h=${Math.max(3, s(6))}:color=0xff1a1a@0.9:t=fill`,
    `drawtext=fontfile=${FONT_BOLD}:text='ANYSTREAM':fontcolor=0xf1f1f1:fontsize=${title}:x=(w-text_w)/2:y=${s(230)}`,
    `drawtext=fontfile=${FONT}:text='HLS PLAYER TEST FEED':fontcolor=0xaaaaaa:fontsize=${sub}:x=(w-text_w)/2:y=${s(370)}`,
    `drawtext=fontfile=${FONT_MONO}:text='%{pts\\:hms}':fontcolor=0x3ea6ff:fontsize=${s(52)}:x=(w-text_w)/2:y=${s(430)}`,
    `drawtext=fontfile=${FONT}:text='${qualityLabel} · MULTI-BITRATE':fontcolor=0x777777:fontsize=${s(26)}:x=(w-text_w)/2:y=${s(520)}`,
    `drawbox=x=${s(90)}:y=${s(600)}:w=iw-${s(180)}:h=${Math.max(2, s(4))}:color=white@0.16:t=fill`,
    `drawbox=x=${s(90)}:y=${s(598)}:w='(iw-${s(180)})*t/${DURATION}':h=${Math.max(4, s(8))}:color=0xff1a1a@0.95:t=fill`,
    `drawbox=x=0:y=ih-${Math.max(3, s(6))}:w=iw:h=${Math.max(3, s(6))}:color=0xff1a1a@0.9:t=fill`,
  ].join(',');
}

function encodeRendition({ width, height, bitrate, folder, qualityLabel }) {
  const dir = join(OUT, 'hls', folder);
  mkdirSync(dir, { recursive: true });

  execFileSync(
    FFMPEG,
    [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=0x0d0d0d:s=${width}x${height}:r=30:d=${DURATION}`,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-filter_complex', `[0:v]${testCard(width, height, qualityLabel)},format=yuv420p[v]`,
      '-map', '[v]',
      '-map', '1:a',
      '-t', String(DURATION),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-profile:v', 'main',
      '-level', width >= 1280 ? '3.1' : '3.0',
      '-b:v', `${bitrate}k`,
      '-maxrate', `${bitrate}k`,
      '-bufsize', `${bitrate * 2}k`,
      '-g', '60',
      '-keyint_min', '60',
      '-sc_threshold', '0',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-ac', '2',
      '-f', 'hls',
      '-hls_time', String(SEGMENT_SECONDS),
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', join(dir, 'seg_%03d.ts'),
      join(dir, 'index.m3u8'),
    ],
    { stdio: 'inherit' },
  );

  console.log(`  ${folder.padEnd(6)} ${width}x${height} @ ${bitrate}k → ${dir}`);
}

console.log(`Rendering demo feed with ${FFMPEG}`);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'hls'), { recursive: true });

const renditions = [
  { folder: '720p', width: 1280, height: 720, bitrate: 700, qualityLabel: '720p' },
  { folder: '360p', width: 640, height: 360, bitrate: 220, qualityLabel: '360p' },
];

for (const rendition of renditions) encodeRendition(rendition);

const master = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-INDEPENDENT-SEGMENTS',
  '#EXT-X-STREAM-INF:BANDWIDTH=800000,AVERAGE-BANDWIDTH=720000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2",NAME="720p"',
  '720p/index.m3u8',
  '#EXT-X-STREAM-INF:BANDWIDTH=300000,AVERAGE-BANDWIDTH=260000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2",NAME="360p"',
  '360p/index.m3u8',
  '',
].join('\n');
writeFileSync(join(OUT, 'hls', 'master.m3u8'), master);

// Poster frame for cards / the info bar.
execFileSync(
  FFMPEG,
  ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '3', '-i', join(OUT, 'hls', '720p', 'index.m3u8'), '-frames:v', '1', join(OUT, 'poster.jpg')],
  { stdio: 'inherit' },
);

const bytes = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const path = join(dir, entry.name);
    return total + (entry.isDirectory() ? bytes(path) : statSync(path).size);
  }, 0);

console.log(`\nDemo feed ready: ${(bytes(OUT) / 1024).toFixed(0)} KB in public/demo`);
console.log(`master playlist: public/demo/hls/master.m3u8`);
