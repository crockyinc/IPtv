import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Settings2,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import type { Channel } from '@/types/iptv';
import { useHlsPlayer } from '@/hooks/useHlsPlayer';
import { useAppStore } from '@/store/useAppStore';
import { cn, copyText } from '@/lib/utils';

interface VideoPlayerProps {
  channel: Channel;
  /** Advances to the next channel in the up-next rail. */
  onNextChannel: () => void;
  /** Reports the manifest currently in use so the info bar can mirror it. */
  onActiveSourceChange?: (url: string | null) => void;
}

const CONTROLS_HIDE_MS = 2800;

/**
 * Custom 16:9 HLS player: autoplay-with-failover, quality menu, volume,
 * fullscreen, PiP and a friendly offline overlay.
 */
export function VideoPlayer({ channel, onNextChannel, onActiveSourceChange }: VideoPlayerProps) {
  const volume = useAppStore((state) => state.volume);
  const muted = useAppStore((state) => state.muted);
  const setVolume = useAppStore((state) => state.setVolume);
  const setMuted = useAppStore((state) => state.setMuted);
  const addRecentChannel = useAppStore((state) => state.addRecentChannel);
  const pushNotice = useAppStore((state) => state.pushNotice);

  const sources = useMemo(() => channel.streams.map((stream) => stream.url), [channel.streams]);

  const player = useHlsPlayer({
    sources,
    autoPlay: true,
    volume,
    muted,
    onVolumeChange: setVolume,
    onMutedChange: setMuted,
    onStarted: () => addRecentChannel(channel.id),
  });

  const [controlsVisible, setControlsVisible] = useState(true);
  const [qualityOpen, setQualityOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qualityRef = useRef<HTMLDivElement>(null);

  const {
    videoRef,
    containerRef,
    status,
    error,
    isPlaying,
    isBuffering,
    isLive,
    levels,
    activeLevel,
    isAutoQuality,
    sourceIndex,
    sourceCount,
    isMuted,
    volume: playerVolume,
    isFullscreen,
    isPipActive,
    play,
    togglePlay,
    retry,
    setQuality,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    seekToLiveEdge,
    togglePip,
  } = player;

  const interactive = status !== 'error';

  useEffect(() => {
    onActiveSourceChange?.(player.currentUrl);
  }, [onActiveSourceChange, player.currentUrl]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, [videoRef]);

  useEffect(() => {
    revealControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [revealControls]);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  }, [isPlaying]);

  // Dismiss the quality popover on outside click / Escape.
  useEffect(() => {
    if (!qualityOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!qualityRef.current?.contains(event.target as Node)) setQualityOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQualityOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [qualityOpen]);

  // Keyboard shortcuts: space/k play, m mute, f fullscreen, arrow up/down volume.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true ||
        target?.closest('[data-controls]') !== null
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ':
        case 'k':
          event.preventDefault();
          togglePlay();
          revealControls();
          break;
        case 'm':
          toggleMute();
          revealControls();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'arrowup':
          event.preventDefault();
          changeVolume(playerVolume + 0.1);
          revealControls();
          break;
        case 'arrowdown':
          event.preventDefault();
          changeVolume(playerVolume - 0.1);
          revealControls();
          break;
        case 'p':
          togglePip();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeVolume, playerVolume, revealControls, toggleFullscreen, toggleMute, togglePip, togglePlay]);

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-controls]')) return;
    togglePlay();
    revealControls();
  };

  const handleCopyUrl = async () => {
    const url = player.currentUrl ?? channel.streams[0]?.url;
    if (!url) return;
    const ok = await copyText(url);
    pushNotice(ok ? 'Stream URL copied to clipboard' : 'Clipboard is unavailable in this browser', ok ? 'default' : 'error');
  };

  const VolumeIcon = isMuted || playerVolume === 0 ? VolumeX : playerVolume < 0.5 ? Volume1 : Volume2;
  const qualityLabel = isAutoQuality
    ? 'Auto'
    : levels.find((level) => level.index === activeLevel)?.label ?? 'Auto';

  const showBigPlay = interactive && !isPlaying && !isBuffering;
  const supportsHls = player.supportsHls;
  const showFailover = status === 'loading' && sourceIndex > 0 && sourceCount > 1;

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (isPlaying) setControlsVisible(false);
      }}
      onTouchStart={revealControls}
      onClick={handleContainerClick}
      onDoubleClick={toggleFullscreen}
      className={cn(
        'player-shell group/player select-none',
        !controlsVisible && isPlaying && 'cursor-none',
      )}
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        className="h-full w-full bg-black object-contain"
        aria-label={`${channel.name} live stream`}
      />

      {/* Buffering */}
      {isBuffering && interactive && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35">
          <Loader2 size={38} className="animate-spin text-white/85" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-widest text-white/70">
            {showFailover ? 'Switching source' : 'Tuning in'}
          </p>
        </div>
      )}

      {/* Failover banner */}
      {showFailover && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur">
          <RotateCcw size={12} className="animate-spin-slow" aria-hidden />
          Backup stream {sourceIndex + 1} of {sourceCount}
        </div>
      )}

      {/* Big play button */}
      {showBigPlay && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <button
            type="button"
            data-controls
            onClick={(event) => {
              event.stopPropagation();
              play();
            }}
            aria-label="Play stream"
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/25 backdrop-blur transition-transform hover:scale-105 hover:bg-black/75"
          >
            <Play size={26} fill="white" strokeWidth={0} aria-hidden />
          </button>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#160a0a]/95 via-black/95 to-black px-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-yt-live/15 text-yt-live">
            <WifiOff size={26} aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {supportsHls ? 'Stream offline or geo-restricted' : 'Playback is not supported here'}
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/65">
              {error ??
                'This feed is not responding. Broadcasters frequently rotate or region-lock their streams.'}
            </p>
            {sourceCount > 1 && (
              <p className="mt-1 text-[11px] text-white/40">
                All {sourceCount} known sources for {channel.name} were tried.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              data-controls
              onClick={(event) => {
                event.stopPropagation();
                retry();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <RotateCcw size={15} aria-hidden />
              Retry
            </button>
            <button
              type="button"
              data-controls
              onClick={(event) => {
                event.stopPropagation();
                onNextChannel();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/20"
            >
              <SkipForward size={15} aria-hidden />
              Try next channel
            </button>
            <button
              type="button"
              data-controls
              onClick={(event) => {
                event.stopPropagation();
                void handleCopyUrl();
              }}
              className="rounded-full px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
            >
              Copy stream URL
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      {interactive && (
        <div
          data-controls
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 px-2 pb-2 pt-10 transition-opacity duration-200 sm:px-3',
            'player-controls',
            controlsVisible || !isPlaying ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <div className="flex items-center gap-1 text-white">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-white/15"
            >
              {isPlaying ? <Pause size={18} fill="white" aria-hidden /> : <Play size={18} fill="white" aria-hidden />}
            </button>

            {/* Volume */}
            <div className="group/volume flex items-center">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-white/15"
              >
                <VolumeIcon size={18} aria-hidden />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : playerVolume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                aria-label="Volume"
                className="volume-slider mr-1 w-0 opacity-0 transition-all duration-200 focus:w-20 focus:opacity-100 group-hover/volume:w-20 group-hover/volume:opacity-100 sm:w-16 sm:opacity-100"
                style={{
                  background: `linear-gradient(to right, #fff ${(isMuted ? 0 : playerVolume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : playerVolume) * 100}%)`,
                }}
              />
            </div>

            {/* LIVE indicator */}
            <button
              type="button"
              onClick={seekToLiveEdge}
              title={isLive ? 'Jump to the live edge' : 'This feed is a live event'}
              className={cn(
                'ml-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors',
                isLive ? 'text-white hover:bg-white/10' : 'text-white/50',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  isLive ? 'animate-pulse-live bg-yt-live' : 'bg-white/40',
                )}
                aria-hidden
              />
              Live
            </button>

            <div className="flex-1" />

            <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 sm:inline">
              {channel.resolutionLabel ?? 'HLS'}
            </span>

            {/* Quality */}
            <div ref={qualityRef} className="relative">
              <button
                type="button"
                onClick={() => setQualityOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={qualityOpen}
                aria-label={`Playback quality: ${qualityLabel}`}
                className="flex h-9 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors hover:bg-white/15"
              >
                <Settings2 size={17} aria-hidden />
                <span className="hidden sm:inline">{qualityLabel}</span>
              </button>

              {qualityOpen && (
                <div
                  role="menu"
                  className="absolute bottom-11 right-0 w-44 overflow-hidden rounded-lg border border-white/10 bg-[#212121]/98 py-1 text-[13px] shadow-pop backdrop-blur"
                >
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Quality
                  </p>
                  <QualityOption
                    label="Auto"
                    hint={levels[0] ? `up to ${levels[0].label}` : 'adaptive'}
                    selected={isAutoQuality}
                    onSelect={() => {
                      setQuality(-1);
                      setQualityOpen(false);
                    }}
                  />
                  {levels.map((level) => (
                    <QualityOption
                      key={level.index}
                      label={level.label}
                      hint={`${Math.round(level.bitrate / 1000)} kbps`}
                      selected={!isAutoQuality && activeLevel === level.index}
                      onSelect={() => {
                        setQuality(level.index);
                        setQualityOpen(false);
                      }}
                    />
                  ))}
                  {levels.length === 0 && (
                    <p className="px-3 py-2 text-[11px] leading-relaxed text-white/40">
                      This feed publishes a single rendition.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={togglePip}
              aria-label="Picture in picture"
              aria-pressed={isPipActive}
              className="hidden h-9 w-9 place-items-center rounded-full transition-colors hover:bg-white/15 sm:grid"
            >
              <PictureInPicture2 size={18} aria-hidden />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-white/15"
            >
              {isFullscreen ? <Minimize size={18} aria-hidden /> : <Maximize size={18} aria-hidden />}
            </button>
          </div>
        </div>
      )}

      {/* Click-catcher for paused state when controls are hidden */}
      {!controlsVisible && !isPlaying && interactive && (
        <button
          type="button"
          aria-label="Show controls"
          onClick={revealControls}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
        />
      )}

      <span className="sr-only" aria-live="polite">
        {status === 'playing' ? `Playing ${channel.name}` : status === 'error' ? `Playback error for ${channel.name}` : ''}
      </span>

    </div>
  );
}

interface QualityOptionProps {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}

function QualityOption({ label, hint, selected, onSelect }: QualityOptionProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/10',
        selected ? 'text-white' : 'text-white/80',
      )}
    >
      <span className="w-4 shrink-0">
        {selected && <Check size={14} className="text-[#3ea6ff]" aria-hidden />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/40">{hint}</span>
    </button>
  );
}
