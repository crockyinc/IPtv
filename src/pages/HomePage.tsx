import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clapperboard, Globe2, Play, SearchX, SlidersHorizontal, Sparkles } from 'lucide-react';
import { ChannelGrid } from '@/components/ChannelGrid';
import { CategoryChips } from '@/components/CategoryChips';
import { EmptyState, ErrorState } from '@/components/Feedback';
import {
  filterByCategory,
  filterChannels,
  useCatalog,
  useCategoriesForCountry,
  useCountryChannels,
} from '@/hooks/useCatalog';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_CHANNEL_ID, DEMO_POSTER_URL } from '@/lib/demoChannel';

export function HomePage() {
  const navigate = useNavigate();
  const { catalog, status, error, retry } = useCatalog();

  const countryCode = useAppStore((state) => state.countryCode);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const categoryFilter = useAppStore((state) => state.categoryFilter);
  const setCategoryFilter = useAppStore((state) => state.setCategoryFilter);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const openCountryPicker = useAppStore((state) => state.openCountryPicker);

  const channels = useCountryChannels(catalog, countryCode);
  const categories = useCategoriesForCountry(catalog, countryCode);
  const country = countryCode ? catalog?.countryByCode.get(countryCode) ?? null : null;

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === categoryFilter) ?? null,
    [categories, categoryFilter],
  );

  const visibleChannels = useMemo(
    () =>
      filterByCategory(
        filterChannels(channels, searchQuery),
        categoryFilter === 'all' ? null : categoryFilter,
      ),
    [channels, searchQuery, categoryFilter],
  );

  // A background refresh keeps the previous catalogue on screen.
  const loading = status === 'idle' || (status === 'loading' && !catalog);
  const heading = searchQuery
    ? `Results for “${searchQuery.trim()}”`
    : activeCategory
      ? `${activeCategory.name} in ${country?.name ?? 'this region'}`
      : country
        ? `Live from ${country.name}`
        : 'Live TV';

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
  };

  const surpriseMe = () => {
    if (visibleChannels.length === 0) return;
    const pick = visibleChannels[Math.floor(Math.random() * visibleChannels.length)];
    if (pick) navigate(`/watch/${pick.id}`);
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

  return (
    <div>
      {!loading && channels.length > 0 && (
        <CategoryChips categories={categories} totalChannels={channels.length} />
      )}

      {catalog?.source === 'fallback' && (
        <Link
          to={`/watch/${DEMO_CHANNEL_ID}`}
          className="group mt-5 flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent transition-colors hover:border-white/20 sm:flex-row"
        >
          <div className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden bg-black sm:w-[248px]">
            <img
              src={DEMO_POSTER_URL}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-0 grid place-items-center bg-black/25">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/92 text-black shadow-lg">
                <Play size={18} fill="black" strokeWidth={0} aria-hidden />
              </span>
            </span>
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
              10s loop · 2 renditions
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-4 sm:px-5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3ea6ff]">
              <Clapperboard size={12} aria-hidden />
              Bundled test feed
            </p>
            <h2 className="text-[15px] font-semibold text-yt-text">See the player in action</h2>
            <p className="max-w-xl text-[12.5px] leading-relaxed text-yt-muted">
              Broadcaster CDNs are blocked on this network, so live channels cannot connect. This
              multi-bitrate HLS feed ships with AnyStream — quality selector, fullscreen, PiP and
              keyboard shortcuts all work.
            </p>
          </div>
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 pb-5 pt-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-yt-dim">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yt-live opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yt-live" />
            </span>
            Live now
          </p>
          <h1 className="mt-1.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-yt-text sm:text-2xl">
            {heading}
          </h1>
          <p className="mt-1 text-[13px] text-yt-muted">
            {loading
              ? 'Assembling the global channel catalogue…'
              : `${visibleChannels.length.toLocaleString()} ${
                  visibleChannels.length === 1 ? 'channel' : 'channels'
                } ready to stream`}
            {!loading && searchQuery ? ` · matching “${searchQuery.trim()}”` : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openCountryPicker}
            className="btn-pill"
            aria-label="Switch country"
          >
            <Globe2 size={15} aria-hidden />
            <span>{country ? country.code : 'Region'}</span>
          </button>
          <button
            type="button"
            onClick={surpriseMe}
            disabled={visibleChannels.length === 0}
            className="btn-pill disabled:cursor-not-allowed disabled:opacity-40"
            title="Open a random channel from this list"
          >
            <Sparkles size={15} aria-hidden />
            <span className="hidden sm:inline">Surprise me</span>
          </button>
        </div>
      </div>

      <ChannelGrid
        channels={visibleChannels}
        loading={loading}
        emptyState={
          searchQuery || categoryFilter !== 'all' ? (
            <EmptyState
              icon={<SearchX size={24} aria-hidden />}
              title="No channels match those filters"
              description={
                searchQuery
                  ? `Nothing in ${country?.name ?? 'this region'} matches “${searchQuery.trim()}”. Try a broader term, or switch regions.`
                  : 'This category has no live channels in the selected region right now.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-2 rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
                  >
                    <SlidersHorizontal size={15} aria-hidden />
                    Clear filters
                  </button>
                  <button
                    type="button"
                    onClick={openCountryPicker}
                    className="rounded-full bg-yt-chip px-4 py-2 text-sm font-medium text-yt-text transition-colors hover:bg-yt-chipHover"
                  >
                    Change region
                  </button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon={<Globe2 size={24} aria-hidden />}
              title="No playable channels here yet"
              description="The iptv-org dataset currently lists no working .m3u8 streams for this region. Try a different country — over a hundred are available."
              action={
                <button
                  type="button"
                  onClick={openCountryPicker}
                  className="rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
                >
                  Choose another country
                </button>
              }
            />
          )
        }
      />
    </div>
  );
}
