import { CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useCatalogStore } from '@/store/useCatalogStore';
import { formatCount } from '@/lib/utils';

/**
 * Shown only when the live iptv-org API could not be reached and AnyStream is
 * serving the bundled offline snapshot. Keeps the degraded mode explicit
 * instead of silently pretending the data is live.
 */
export function DataSourceBanner() {
  const catalog = useCatalogStore((state) => state.catalog);
  const status = useCatalogStore((state) => state.status);
  const ensureLoaded = useCatalogStore((state) => state.ensureLoaded);

  if (!catalog || catalog.source !== 'fallback') return null;

  const retrying = status === 'loading';

  return (
    <div
      role="status"
      className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-100/90"
    >
      <CloudOff size={15} className="shrink-0 text-amber-300" aria-hidden />

      <p className="min-w-0 flex-1">
        <span className="font-semibold text-amber-200">Offline snapshot.</span> The live iptv-org
        API is unreachable from this network
        <span className="text-amber-100/60" title={catalog.liveError ?? undefined}>
          {catalog.liveError ? ` (${catalog.liveError.replace(/\.$/, '')})` : ''}
        </span>
        , so you are browsing {formatCount(catalog.channels.length)} channels from{' '}
        {catalog.countries.length} countries bundled with the app. Deploy anywhere with open
        internet access to get the complete live catalogue.
      </p>

      <button
        type="button"
        onClick={() => void ensureLoaded(true)}
        disabled={retrying}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition-colors hover:bg-amber-200/20 disabled:cursor-wait disabled:opacity-70"
      >
        {retrying ? (
          <Loader2 size={12} className="animate-spin" aria-hidden />
        ) : (
          <RefreshCw size={12} aria-hidden />
        )}
        {retrying ? 'Retrying live data' : 'Retry live data'}
      </button>
    </div>
  );
}
