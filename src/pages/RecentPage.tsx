import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { History, Trash2 } from 'lucide-react';
import type { Channel } from '@/types/iptv';
import { ChannelGrid } from '@/components/ChannelGrid';
import { EmptyState } from '@/components/Feedback';
import { useCatalog } from '@/hooks/useCatalog';
import { useAppStore } from '@/store/useAppStore';

export function RecentPage() {
  const { catalog, status } = useCatalog();
  const recentIds = useAppStore((state) => state.recentChannelIds);
  const clearRecent = useAppStore((state) => state.clearRecentChannels);

  const channels = useMemo<Channel[]>(() => {
    if (!catalog) return [];
    const resolved: Channel[] = [];
    for (const id of recentIds) {
      const channel = catalog.channelById.get(id);
      if (channel) resolved.push(channel);
    }
    return resolved;
  }, [catalog, recentIds]);

  const loading = status === 'loading' || status === 'idle';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-5 pt-5">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-yt-dim">
            <History size={12} aria-hidden />
            Your history
          </p>
          <h1 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight sm:text-2xl">
            Recently watched
          </h1>
          <p className="mt-1 text-[13px] text-yt-muted">
            {loading
              ? 'Loading…'
              : `${channels.length} ${channels.length === 1 ? 'channel' : 'channels'} · stored on this device only`}
          </p>
        </div>

        {channels.length > 0 && (
          <button
            type="button"
            onClick={clearRecent}
            className="btn-pill"
            aria-label="Clear watch history"
          >
            <Trash2 size={15} aria-hidden />
            Clear history
          </button>
        )}
      </div>

      <ChannelGrid
        channels={channels}
        loading={loading}
        emptyState={
          <EmptyState
            icon={<History size={24} aria-hidden />}
            title="Nothing watched yet"
            description="Channels you open will appear here so you can jump straight back in. History stays in this browser — no account, no tracking."
            action={
              <Link
                to="/"
                className="rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
              >
                Browse live channels
              </Link>
            }
          />
        }
      />
    </div>
  );
}
