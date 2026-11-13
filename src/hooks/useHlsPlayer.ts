import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';

/**
 * Resilient HLS playback hook.
 *
 * - Uses hls.js where MSE is available, with a native `<video src>` fallback for
 *   Safari / iOS (which handle `.m3u8` natively).
 * - Auto-failover: if a fatal hls.js error is raised, or nothing is playing
 *   within LOAD_TIMEOUT_MS, the next backup source is tried automatically.
 * - When every source is exhausted the hook settles into an `error` state that
 *   the UI renders as a friendly "offline / geo-restricted" overlay.
 */

const LOAD_TIMEOUT_MS = 8_000;
const STALL_TIMEOUT_MS = 18_000;

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface QualityLevel {
  index: number;
  label: string;
  height: number | null;
  bitrate: number;
}

export interface UseHlsPlayerOptions {
  /** Ordered playlist: index 0 is primary, the rest are failover backups. */
  sources: string[];
  autoPlay?: boolean;
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onMutedChange: (muted: boolean) => void;
  /** Fired the first time a source actually renders frames. */
  onStarted?: () => void;
  /** Restart playback when the (VOD) source ends — used by the bundled demo feed. */
  loop?: boolean;
}

export interface UseHlsPlayerResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  status: PlayerStatus;
  error: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  isLive: boolean;
  levels: QualityLevel[];
  activeLevel: number;
  isAutoQuality: boolean;
  sourceIndex: number;
  sourceCount: number;
  currentUrl: string | null;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  isPipActive: boolean;
  supportsHls: boolean;
  usesNativePlayback: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  retry: () => void;
  setQuality: (index: number) => void;
  changeVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  seekToLiveEdge: () => void;
  togglePip: () => void;
}

function describeError(details: string, httpCode: number | undefined): string {
  if (httpCode === 403 || httpCode === 401) {
    return 'This channel blocked the request — it is usually geo-restricted or requires an authorized referrer.';
  }
  if (httpCode === 404) {
    return 'The stream address no longer exists (404). The broadcaster likely moved the feed.';
  }
  if (httpCode === 429) {
    return 'The broadcaster is rate-limiting this feed (429). Give it a moment and retry.';
  }

  switch (details) {
    case 'manifestLoadError':
    case 'manifestLoadTimeOut':
      return 'The stream is offline, moved, or blocking browser access (CORS).';
    case 'manifestParsingError':
      return 'The broadcaster returned an unreadable HLS manifest.';
    case 'levelLoadError':
    case 'fragLoadError':
      return 'Chunks of this stream failed to load — the source is unstable.';
    case 'bufferStalledError':
      return 'Playback stalled: the source stopped sending video data.';
    case 'bufferAppendError':
      return 'This browser could not decode the stream format.';
    default:
      return `Playback failed (${details.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}).`;
  }
}

export function useHlsPlayer(options: UseHlsPlayerOptions): UseHlsPlayerResult {
  const {
    sources,
    autoPlay = true,
    volume,
    muted,
    onVolumeChange,
    onMutedChange,
    onStarted,
    loop = false,
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const startedRef = useRef(false);
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const callbacksRef = useRef({ onVolumeChange, onMutedChange, onStarted });
  callbacksRef.current = { onVolumeChange, onMutedChange, onStarted };
  /** Latest volume/mute values for event handlers created inside effects. */
  const prefsRef = useRef({ volume, muted });
  prefsRef.current = { volume, muted };

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [isLive, setIsLive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [usesNativePlayback, setUsesNativePlayback] = useState(false);
  const [supportsHls, setSupportsHls] = useState(true);

  const sourceIndexRef = useRef(0);
  sourceIndexRef.current = sourceIndex;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const sourcesKey = useMemo(() => sources.join('\n'), [sources]);
  const currentUrl = sources[sourceIndex] ?? null;

  // Reset the playlist cursor when the channel (source list) changes.
  useEffect(() => {
    startedRef.current = false;
    setSourceIndex(0);
    setLevels([]);
    setActiveLevel(-1);
    setStatus('loading');
    setError(null);
  }, [sourcesKey]);

  const advanceSource = useCallback((message: string) => {
    const nextIndex = sourceIndexRef.current + 1;
    if (nextIndex < sourcesRef.current.length) {
      setError(message);
      setStatus('loading');
      setSourceIndex(nextIndex);
      return;
    }
    setStatus('error');
    setError(message);
  }, []);

  /* ------------------------------- Playback ------------------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentUrl) return;

    let disposed = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let mediaRecoveryAttempted = false;
    let networkRetryAttempted = false;

    setStatus((prev) => (prev === 'error' ? 'loading' : prev === 'playing' ? prev : 'loading'));
    setError(null);
    video.loop = loop;

    const clearTimers = () => {
      if (loadTimer) clearTimeout(loadTimer);
      if (stallTimer) clearTimeout(stallTimer);
      loadTimer = undefined;
      stallTimer = undefined;
    };

    const startStallWatchdog = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (disposed) return;
        if (video.readyState < 3) return; // already re-buffering is handled by hls.js
        advanceSource('Stream stopped delivering video. Trying another source…');
      }, STALL_TIMEOUT_MS);
    };

    const markPlaying = () => {
      if (disposed) return;
      clearTimers();
      setStatus('playing');
      setError(null);
      startStallWatchdog();
      if (!startedRef.current) {
        startedRef.current = true;
        callbacksRef.current.onStarted?.();
      }
    };

    const attemptPlay = () => {
      if (!autoPlayRef.current) {
        setStatus('paused');
        return;
      }
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch((playError: unknown) => {
          if (disposed) return;
          const name = playError instanceof DOMException ? playError.name : '';
          if (name === 'NotAllowedError' && !video.muted) {
            // Browsers block unmuted autoplay: start muted, user can unmute.
            video.muted = true;
            callbacksRef.current.onMutedChange(true);
            video.play().catch(() => setStatus('paused'));
            return;
          }
          if (name !== 'AbortError') setStatus('paused');
        });
      }
    };

    const onPlaying = () => markPlaying();
    const onPause = () => {
      if (disposed) return;
      if (!video.ended && !video.seeking) setStatus('paused');
    };
    const onWaiting = () => {
      if (disposed) return;
      setStatus((prev) => (prev === 'error' ? prev : 'loading'));
    };
    const onVolumeChange = () => {
      if (disposed) return;
      const nextMuted = video.muted;
      const nextVolume = video.volume;
      const { onMutedChange: emitMuted, onVolumeChange: emitVolume } = callbacksRef.current;
      if (nextMuted !== prefsRef.current.muted) emitMuted(nextMuted);
      if (Math.abs(nextVolume - prefsRef.current.volume) > 0.01) emitVolume(nextVolume);
    };
    const onNativeError = () => {
      if (disposed) return;
      advanceSource(
        'This stream could not be played by the browser. It may be offline or geo-restricted.',
      );
    };
    const onDurationChange = () => setIsLive(!Number.isFinite(video.duration));

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('stalled', onWaiting);

    // 8 second watchdog: no frames yet -> failover.
    loadTimer = setTimeout(() => {
      if (disposed) return;
      if (video.readyState >= 2 || !video.paused) return;
      advanceSource(
        'Stream did not respond within 8 seconds. It may be offline, geo-restricted, or blocked by CORS.',
      );
    }, LOAD_TIMEOUT_MS);

    const nativeSupported = video.canPlayType('application/vnd.apple.mpegurl') !== '';
    const hlsSupported = Hls.isSupported();

    if (hlsSupported) {
      setUsesNativePlayback(false);
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        manifestLoadingTimeOut: 8_000,
        manifestLoadingMaxRetry: 1,
        levelLoadingTimeOut: 8_000,
        fragLoadingTimeOut: 12_000,
        fragLoadingMaxRetry: 2,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.loadSource(currentUrl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (disposed) return;
        const parsed: QualityLevel[] = data.levels
          .map((level, index) => ({
            index, // original hls.js level index — required by setQuality()
            height: typeof level.height === 'number' ? level.height : null,
            bitrate: level.bitrate,
            label:
              (typeof level.height === 'number' && level.height > 0
                ? `${level.height}p`
                : null) ??
              (level.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : `Level ${index + 1}`),
          }))
          .sort((a, b) => (b.height ?? b.bitrate) - (a.height ?? a.bitrate));

        setLevels(parsed);
        setActiveLevel(-1);
        attemptPlay();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (disposed) return;
        setActiveLevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (disposed) return;
        setIsLive(Boolean(data.details.live));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (disposed || !data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.MEDIA_ERROR: {
            if (!mediaRecoveryAttempted) {
              mediaRecoveryAttempted = true;
              hls.recoverMediaError();
              return;
            }
            advanceSource('The stream uses a codec this browser cannot decode.');
            return;
          }
          case Hls.ErrorTypes.NETWORK_ERROR: {
            if (!networkRetryAttempted) {
              networkRetryAttempted = true;
              hls.startLoad();
              return;
            }
            advanceSource(describeError(data.details, data.response?.code));
            return;
          }
          default:
            advanceSource(describeError(data.details, data.response?.code));
        }
      });
    } else if (nativeSupported) {
      setUsesNativePlayback(true);
      setIsLive(true);
      video.addEventListener('error', onNativeError);
      video.src = currentUrl;
      video.load();
      const onLoadedMetadata = () => attemptPlay();
      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      if (video.readyState >= 1) attemptPlay();    } else {
      setSupportsHls(false);
      setStatus('error');
      setError('This browser cannot play HLS streams. Try Chrome, Edge, Firefox or Safari 17+.');
    }

    return () => {
      disposed = true;
      clearTimers();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('stalled', onWaiting);
      video.removeEventListener('error', onNativeError);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (!hlsSupported) {
        video.removeAttribute('src');
        video.load();
      }
    };
    // `volume`/`muted` are intentionally excluded: they are applied by the effect
    // below and must not tear down the media source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, attempt, advanceSource]);

  /* ---------------------------- Volume / mute ----------------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.volume - volume) > 0.005) video.volume = volume;
    if (video.muted !== muted) video.muted = muted;
  }, [volume, muted, currentUrl]);

  /* ------------------------------ Fullscreen ------------------------------ */
  useEffect(() => {
    const onChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const active = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      const container = containerRef.current;
      setIsFullscreen(Boolean(active && container && container.contains(active)));
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  /* ---------------------- Picture-in-picture tracking --------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setIsPipActive(true);
    const onLeave = () => setIsPipActive(false);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  /* -------------------------------- Actions ------------------------------- */
  const play = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => setStatus('paused'));
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else pause();
  }, [pause, play]);

  const retry = useCallback(() => {
    setError(null);
    setStatus('loading');
    setSourceIndex(0);
    setAttempt((value) => value + 1);
  }, []);

  const setQuality = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index === -1 ? -1 : index;
    setActiveLevel(hls.autoLevelEnabled ? -1 : hls.currentLevel);
  }, []);

  const changeVolume = useCallback(
    (next: number) => {
      const clamped = Math.min(1, Math.max(0, next));
      callbacksRef.current.onVolumeChange(clamped);
      if (clamped > 0 && muted) callbacksRef.current.onMutedChange(false);
    },
    [muted],
  );

  const toggleMute = useCallback(() => {
    callbacksRef.current.onMutedChange(!muted);
  }, [muted]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const active = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

    if (active) {
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
      else void doc.webkitExitFullscreen?.().catch(() => undefined);
      return;
    }

    const request = container.requestFullscreen?.bind(container);
    if (request) {
      void request().catch(() => undefined);
      return;
    }

    const webkitContainer = container as HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (webkitContainer.webkitRequestFullscreen) {
      void webkitContainer.webkitRequestFullscreen().catch(() => undefined);
      return;
    }

    // iOS Safari only supports fullscreen on the video element itself.
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    video?.webkitEnterFullscreen?.();
  }, []);

  const seekToLiveEdge = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video) return;
    if (hls && typeof hls.liveSyncPosition === 'number' && hls.liveSyncPosition > 0) {
      video.currentTime = hls.liveSyncPosition;
    } else if (Number.isFinite(video.duration)) {
      video.currentTime = Math.max(0, video.duration - 1);
    }
    play();
  }, [play]);

  const togglePip = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const doc = document as Document & { pictureInPictureEnabled?: boolean };
    if (!doc.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    } else {
      void video.requestPictureInPicture?.().catch(() => undefined);
    }
  }, []);

  const isPlaying = status === 'playing';
  const isBuffering = status === 'loading';

  return {
    videoRef,
    containerRef,
    status,
    error,
    isPlaying,
    isBuffering,
    isLive,
    levels,
    activeLevel,
    isAutoQuality: activeLevel === -1,
    sourceIndex,
    sourceCount: sources.length,
    currentUrl,
    isMuted: muted,
    volume,
    isFullscreen,
    isPipActive,
    supportsHls,
    usesNativePlayback,
    play,
    pause,
    togglePlay,
    retry,
    setQuality,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    seekToLiveEdge,
    togglePip,
  };
}
