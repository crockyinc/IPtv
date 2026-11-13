import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { CountryPickerModal } from '@/components/CountryPickerModal';
import { NoticeToast } from '@/components/Feedback';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HomePage } from '@/pages/HomePage';
import { RecentPage } from '@/pages/RecentPage';
import { WatchPage } from '@/pages/WatchPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { useCatalog } from '@/hooks/useCatalog';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

/** Resets scroll on route changes (the app is a single scroll container). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function Footer() {
  const { catalog } = useCatalog();
  const countryCode = useAppStore((state) => state.countryCode);
  const stats = catalog?.stats;
  const country = countryCode ? catalog?.countryByCode.get(countryCode) ?? null : null;

  return (
    <footer className="mt-14 border-t border-white/[0.07] pb-6 pt-5 text-[11px] leading-relaxed text-yt-dim">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="font-medium text-yt-muted">
            AnyStream — a client-side viewer for the public iptv-org dataset.
          </p>
          <p className="mt-1">
            Channels are streamed directly from their broadcasters; AnyStream hosts no video and
            stores no account data. Availability varies by region.
          </p>
        </div>
        <div className="shrink-0 text-right">
          {stats && (
            <p className="tabular-nums">
              {stats.playableChannels.toLocaleString()} playable channels ·{' '}
              {stats.countriesWithChannels} countries
            </p>
          )}
          <a
            href="https://github.com/iptv-org/iptv"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-block text-yt-muted underline decoration-white/20 underline-offset-2 transition-colors hover:text-yt-text"
          >
            Source dataset
          </a>
          <p className="mt-1">
            Region:{' '}
            <span className="text-yt-muted">
              {country ? `${country.flag} ${country.name}` : 'none selected'}
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const { catalog } = useCatalog();
  const isDesktop = useIsDesktop();

  const countryCode = useAppStore((state) => state.countryCode);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const openCountryPicker = useAppStore((state) => state.openCountryPicker);
  const pushNotice = useAppStore((state) => state.pushNotice);

  // A persisted country that disappeared from the catalogue forces a re-pick.
  useEffect(() => {
    if (!catalog || !countryCode) return;
    if (!catalog.countryByCode.has(countryCode)) {
      pushNotice(`No live channels left for “${countryCode}”. Pick another region.`, 'error');
      openCountryPicker();
    }
  }, [catalog, countryCode, openCountryPicker, pushNotice]);

  return (
    <div className="min-h-[100dvh] bg-yt-bg">
      <ScrollToTop />
      <TopBar />
      <Sidebar />

      <main
        className={cn(
          'min-h-[100dvh] pt-14 transition-[padding-left] duration-200 ease-out',
          isDesktop && (sidebarCollapsed ? 'lg:pl-rail' : 'lg:pl-sidebar'),
        )}
      >
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/recent" element={<RecentPage />} />
              <Route path="/watch/:channelId" element={<WatchPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
          <Footer />
        </div>
      </main>

      <CountryPickerModal />
      <NoticeToast />
    </div>
  );
}
