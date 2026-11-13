import { useEffect, useState } from 'react';
import type { Channel } from '@/types/iptv';
import { accentFor, channelInitials, cn, gradientFor } from '@/lib/utils';

type ChannelLike = Pick<Channel, 'id' | 'name' | 'logo'>;

interface ChannelLogoProps {
  channel: ChannelLike;
  className?: string;
  imageClassName?: string;
  /** Initials size classes for the fallback state. */
  fallbackClassName?: string;
}

/**
 * Channel logo with a graceful gradient/initials fallback.
 * Broken upstream images (`onError`) degrade to the same fallback.
 */
export function ChannelLogo({
  channel,
  className,
  imageClassName,
  fallbackClassName,
}: ChannelLogoProps) {
  const [failed, setFailed] = useState(false);
  const logoUrl = channel.logo?.url ?? null;

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn('h-full w-full object-contain', imageClassName)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-1 rounded-md bg-gradient-to-br',
        gradientFor(channel.id || channel.name),
        className,
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
