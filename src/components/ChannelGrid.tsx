import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Channel } from '@/types/iptv';
import { ChannelCard, ChannelCardSkeleton } from '@/components/ChannelCard';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 48;
const PAGE_STEP = 36;

interface ChannelGridProps {
  channels: Channel[];
  loading?: boolean;
  /** Shown when the grid is empty and not loading. */
  emptyState?: ReactNode;
  className?: string;
}

export function ChannelGrid({ channels, loading = false, emptyState, className }: ChannelGridProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listKey =
    channels.length > 0
      ? `${channels.length}:${channels[0]?.id ?? ''}:${channels[channels.length - 1]?.id ?? ''}`
      : '0';

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [listKey]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(current + PAGE_STEP, channels.length));
        }
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [channels.length, listKey]);

  if (loading) {
    return (
      <div
        className={cn(
          'grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
          className,
        )}
        aria-busy
        aria-live="polite"
      >
        {Array.from({ length: 12 }, (_, index) => (
          <ChannelCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return <>{emptyState}</>;
  }

  const visible = channels.slice(0, visibleCount);

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {visible.map((channel) => (
          <ChannelCard key={channel.id} channel={channel} />
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {visibleCount < channels.length && (
        <div className="mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => Math.min(current + PAGE_STEP, channels.length))}
            className="btn-pill px-5 py-2"
          >
            Load more channels
            <span className="ml-1 text-xs text-yt-muted">
              ({visibleCount.toLocaleString()} of {channels.length.toLocaleString()})
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
