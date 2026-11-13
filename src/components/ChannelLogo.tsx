import { useEffect, useMemo, useState } from 'react';
import type { Channel } from '@/types/iptv';
import { useCatalogStore } from '@/store/useCatalogStore';
import { accentFor, channelInitials, cn, gradientFor } from '@/lib/utils';

type ChannelLike = Pick<Channel, 'id' | 'name' | 'logo'>;

/** How long to wait for a logo host before settling on the initials tile. */
const LOGO_TIMEOUT_MS = 3_000;

function isCrossOrigin(url: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return true;
  }
}

interface ChannelLogoProps {
  channel: ChannelLike;
  className?: string;
  imageClassName?: string;
  /** Initials size classes for the fallback state. */
  fallbackClassName?: string;
}

/**
 * Channel logo with a gradient/initials fallback that is always rendered first,
 * so a card never shows an empty box:
 *
 *  - images fade in over the fallback once decoded,
 *  - broken images fall back via `onError`,
 *  - silent hosts fall back after a 3s timeout (blocked CDNs often hang),
 *  - when the app is running on the offline snapshot the network is known to be
 *    restricted, so cross-origin logo hosts are skipped entirely.
 */
export function ChannelLogo({
  channel,
  className,
  imageClassName,
  fallbackClassName,
}: ChannelLogoProps) {
  const catalogSource = useCatalogStore((state) => state.catalog?.source);

  const logoUrl = channel.logo?.url ?? null;
  const remoteBlocked = useMemo(() => {
    if (!logoUrl) return false;
    return catalogSource === 'fallback' && isCrossOrigin(logoUrl);
  }, [logoUrl, catalogSource]);

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expired, setExpired] = useState(false);

  // Reset when the logo changes (channel cards are reused while paging).
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setExpired(false);
  }, [logoUrl]);

  const showImage = Boolean(logoUrl) && !remoteBlocked && !failed && !expired;

  useEffect(() => {
    if (!showImage || loaded) return;
    const timer = setTimeout(() => setExpired(true), LOGO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [showImage, loaded, logoUrl]);

  return (
    <span className={cn('relative flex h-full w-full items-center justify-center', className)}>
      {(!showImage || !loaded) && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-[inherit] bg-gradient-to-br ring-1 ring-inset ring-white/[0.06]',
            gradientFor(channel.id || channel.name),
          )}
        >
          <span
            className={cn(
              'font-semibold uppercase leading-none tracking-tight',
              fallbackClassName ?? 'text-2xl',
            )}
            style={{ color: accentFor(channel.id || channel.name) }}
          >
            {channelInitials(channel.name)}
          </span>
        </span>
      )}

      {showImage && (
        <img
          src={logoUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'relative z-10 h-full w-full object-contain transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
            imageClassName,
          )}
        />
      )}
    </span>
  );
}

interface ChannelAvatarProps {
  channel: ChannelLike;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AVATAR_SIZE: Record<NonNullable<ChannelAvatarProps['size']>, string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

/** Circular avatar used in card metadata rows and the watch page header. */
export function ChannelAvatar({ channel, size = 'md', className }: ChannelAvatarProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-inset ring-white/10',
        AVATAR_SIZE[size],
        className,
      )}
    >
      <ChannelLogo
        channel={channel}
        imageClassName="object-contain p-0.5"
        fallbackClassName={size === 'lg' ? 'text-base' : size === 'sm' ? 'text-[10px]' : 'text-xs'}
      />
    </span>
  );
}
