import { create } from 'zustand';
import type { Catalog, DataStatus } from '@/types/iptv';
import { clearCatalogCache, getCachedCatalog, loadCatalog } from '@/services/iptvApi';

interface CatalogState {
  status: DataStatus;
  catalog: Catalog | null;
  error: string | null;
  /** Kicks off the load. Safe to call from multiple mounted components. */
  ensureLoaded: (force?: boolean) => Promise<void>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  status: getCachedCatalog() ? 'ready' : 'idle',
  catalog: getCachedCatalog(),
  error: null,

  ensureLoaded: async (force = false) => {
    const { status } = get();
    if (!force && (status === 'loading' || status === 'ready')) return;

    if (force) {
      clearCatalogCache();
      // Keep the current catalogue on screen while refreshing so the UI never
      // flashes back to skeletons (or loses the offline snapshot banner).
      set({ status: 'loading', error: null });
    } else {
      set({ status: 'loading', error: null });
    }

    try {
      const catalog = await loadCatalog();
      set({ status: 'ready', catalog, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to reach the iptv-org API right now.';
      const previous = get().catalog;
      set({
        status: previous ? 'ready' : 'error',
        catalog: previous,
        error: `${message} Check your connection or an ad-blocker / firewall rule that may be blocking iptv-org.github.io.`,
      });
    }
  },
}));
