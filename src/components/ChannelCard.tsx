import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { Channel } from '@/types/iptv';
import { ChannelAvatar, ChannelLogo } from '@/components/ChannelLogo';
import { cn } from '@/lib/utils';

interface ChannelCardProps {
  channel: Channel;
  className?: string;
}

/** 16:9 channel card used across the home feed. */
export function ChannelCard({ channel, className }: ChannelCardProps) {
  const resolution = channel.resolutionLabel;
  const secondary = channel.network ?? channel.primaryCategoryName ?? 'Live TV';

  return (
    <Link
      to={`/watch/${channel.id}`}
      className={cn('channel-card group/card', className)}
      aria-label={`Watch ${channel.name} live`}
    >
      <div className="channel-card__thumb">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(255,255,255,0.09),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 120%, rgba(255,0,0,0.16), transparent 60%)',
          }}
        />

        <div className="relative z-10 flex h-full w-full items-center justify-center px-6 py-5">
          <ChannelLogo
            channel={channel}
            imageClassName="max-h-[60%] max-w-[74%] object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.65)] transition-transform duration-300 ease-out group-hover/card:scale-[1.06]"
            fallbackClassName="text-3xl"
          />
        </div>

        <span className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1 rounded bg-yt-live px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-wide text-white shadow-sm">
          <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-white" aria-hidden />
          Live
        </span>

        {resolution && (
          <span className="absolute left-2 top-2 z-20 rounded bg-black/70 px-1.5 py-[3px] text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
            {resolution}
          </span>
        )}

        <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/60 ring-1 ring-white/25 backdrop-blur-sm">
            <Play size={18} fill="white" strokeWidth={0} aria-hidden />
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3 px-0.5">
        <ChannelAvatar channel={channel} size="md" className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-snug text-yt-text transition-colors group-hover/card:text-white">
            {channel.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-yt-muted">
            {secondary}
            {channel.primaryCategoryName && channel.network
              ? ` · ${channel.primaryCategoryName}`
              : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {channel.primaryCategoryName ? (
            <span className="max-w-[104px] truncate rounded-full bg-yt-chip px-2 py-[3px] text-[10px] font-medium text-yt-muted">
              {channel.primaryCategoryName}
            </span>
          ) : null}
          <span className="text-[10px] font-medium uppercase tracking-wide text-yt-dim">
            <span aria-hidden>{channel.countryFlag}</span> {channel.countryCode}
            {resolution ? ` · ${resolution}` : ''}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Loading placeholder matching the card's footprint. */
export function ChannelCardSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="skeleton aspect-video w-full rounded-xl" />
      <div className="mt-3 flex items-start gap-3">
        <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-3.5 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
        <div className="skeleton h-4 w-10 rounded-full" />
      </div>
    </div>
  );
}
