import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import type { Channel } from '@/types/iptv';
import { ChannelLogo } from '@/components/ChannelLogo';
import { cn } from '@/lib/utils';

interface UpNextListProps {
  channels: Channel[];
  title?: string;
  subtitle?: string;
}

/** Channel-surfing rail shown beside the player — one click switches feed. */
export function UpNextList({ channels, title = 'Up next', subtitle }: UpNextListProps) {
  return (
    <section aria-labelledby="up-next-heading" className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 id="up-next-heading" className="text-[15px] font-semibold text-yt-text">
          {title}
        </h2>
        <span className="flex items-center gap-1 text-[11px] text-yt-dim">
          <Radio size={11} aria-hidden />
          {channels.length} live
        </span>
      </div>
      {subtitle && <p className="mt-0.5 px-1 text-[12px] text-yt-muted">{subtitle}</p>}

      <div className="mt-2 flex flex-col gap-1 xl:max-h-[calc(100vh-190px)] xl:overflow-y-auto xl:pr-1">
        {channels.map((channel) => (
          <UpNextItem key={channel.id} channel={channel} />
        ))}
        {channels.length === 0 && (
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center text-[13px] text-yt-muted">
            No other live channels in this region right now.
          </p>
        )}
      </div>
    </section>
  );
}

function UpNextItem({ channel }: { channel: Channel }) {
  return (
    <Link
      to={`/watch/${channel.id}`}
      className={cn(
        'group flex gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-white/[0.07]',
        'focus-visible:bg-white/[0.07]',
      )}
    >
      <div className="relative flex aspect-video w-[124px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#1a1a1a] sm:w-[132px]">
        <ChannelLogo
          channel={channel}
          imageClassName="max-h-[58%] max-w-[78%] object-contain transition-transform duration-300 group-hover:scale-[1.06]"
          fallbackClassName="text-base"
        />
        <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-yt-live px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-white">
          <span className="h-1 w-1 rounded-full bg-white" aria-hidden />
          Live
        </span>
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-yt-text group-hover:text-white">
          {channel.name}
        </h3>
        <p className="mt-1 truncate text-[11px] text-yt-muted">
          {channel.network ?? channel.primaryCategoryName ?? 'Live TV'}
        </p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-yt-dim">
          <span aria-hidden>{channel.countryFlag}</span> {channel.countryCode}
          {channel.resolutionLabel ? ` · ${channel.resolutionLabel}` : ''}
        </p>
      </div>
    </Link>
  );
}
