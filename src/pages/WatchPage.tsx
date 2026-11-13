import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Compass, Tv } from 'lucide-react';
import type { Channel } from '@/types/iptv';
import { VideoPlayer } from '@/components/watch/VideoPlayer';
import { ChannelInfoBar } from '@/components/watch/ChannelInfoBar';
import { UpNextList } from '@/components/watch/UpNextList';
import { EmptyState, ErrorState } from '@/components/Feedback';
import { useCatalog } from '@/hooks/useCatalog';
import { useAppStore } from '@/store/useAppStore';

const UP_NEXT_LIMIT = 14;

export function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { catalog, status, error, retry } = useCatalog();
  const addRecentChannel = useAppStore((state) => state.addRecentChannel);
  const [activeSourceUrl, setActiveSourceUrl] = useState<string | null>(null);

  const channel: Channel | undefined = useMemo(
    () => (catalog && channelId ? catalog.channelById.get(channelId) : undefined),
    [catalog, channelId],
  );

  useEffect(() => {
    if (channel) addRecentChannel(channel.id);
    setActiveSourceUrl(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [channel, addRecentChannel]);

  const handleActiveSourceChange = useCallback((url: string | null) => {
    setActiveSourceUrl(url);
  }, []);

  const upNext = useMemo(() => {
    if (!catalog || !channel) return [];
    const pool = catalog.channelsByCountry.get(channel.countryCode) ?? [];
    const categoryId = channel.primaryCategoryId;

    const sameCategory: Channel[] = [];
    const otherCategory: Channel[] = [];
    for (const candidate of pool) {
      if (candidate.id === channel.id) continue;
      if (categoryId && candidate.categoryIds.includes(categoryId)) sameCategory.push(candidate);
      else otherCategory.push(candidate);
    }

    return [...sameCategory, ...otherCategory].slice(0, UP_NEXT_LIMIT);
  }, [catalog, channel]);

  const nextChannel = upNext[0] ?? null;

  const goToNextChannel = () => {
    if (nextChannel) navigate(`/watch/${nextChannel.id}`);
    else navigate('/');
  };

  if (status === 'error') {
    return (
      <div className="py-10">
        <ErrorState
          title="The channel catalogue could not load"
          message={error ?? 'Please try again.'}
          onRetry={retry}
        />
      </div>
    );
  }

  if (!channel) {
    const loading = status === 'loading' || status === 'idle';

    if (loading) {
      return (
        <div className="animate-fade-in">
          <div className="skeleton aspect-video w-full rounded-xl" />
          <div className="mt-4 space-y-2">
            <div className="skeleton h-5 w-1/2 rounded" />
            <div className="skeleton h-3.5 w-1/3 rounded" />
          </div>
        </div>
      );
    }

    return (
      <div className="py-10">
        <EmptyState
          icon={<Tv size={24} aria-hidden />}
          title="Channel not available"
          description={`We could not find “${channelId ?? 'this channel'}” in the current catalogue. It may have been removed from iptv-org, moved behind a paywall, or its streams went offline.`}
          action={
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
            >
              <Compass size={15} aria-hidden />
              Browse live channels
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="flex items-center justify-between gap-3 pb-3">
        <button
          type="button"
          onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium text-yt-muted transition-colors hover:bg-white/10 hover:text-yt-text"
        >
          <ArrowLeft size={16} aria-hidden />
          Back
        </button>
        <Link
          to="/"
          className="text-[11px] uppercase tracking-widest text-yt-dim transition-colors hover:text-yt-muted"
        >
          {channel.countryName} · Live TV
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_370px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <VideoPlayer
            key={channel.id}
            channel={channel}
            onNextChannel={goToNextChannel}
            onActiveSourceChange={handleActiveSourceChange}
          />
          <ChannelInfoBar channel={channel} activeStreamUrl={activeSourceUrl} />

          <div className="mt-6 xl:hidden">
            <UpNextList
              channels={upNext}
              title="Channel surfing"
              subtitle={`More live channels from ${channel.countryName}`}
            />
          </div>
        </div>

        <aside className="hidden min-w-0 xl:block">
          <UpNextList
            channels={upNext}
            title="Up next"
            subtitle={`More live channels from ${channel.countryName}`}
          />
        </aside>
      </div>
    </div>
  );
}
