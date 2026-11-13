import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, X, ArrowLeft, ChevronDown } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useAppStore } from '@/store/useAppStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { flagEmoji } from '@/lib/utils';

/** 56px sticky top navigation: menu, brand, search, country switcher. */
export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const mobileSidebarOpen = useAppStore((state) => state.mobileSidebarOpen);
  const setMobileSidebarOpen = useAppStore((state) => state.setMobileSidebarOpen);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const countryCode = useAppStore((state) => state.countryCode);
  const openCountryPicker = useAppStore((state) => state.openCountryPicker);
  const country = useCatalogStore((state) =>
    countryCode ? (state.catalog?.countryByCode.get(countryCode) ?? null) : null,
  );

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const handleMenu = () => {
    if (isDesktop) toggleSidebar();
    else setMobileSidebarOpen(!mobileSidebarOpen);
  };

  const commitSearch = () => {
    if (location.pathname !== '/') navigate('/');
    setMobileSearchOpen(false);
  };

  // "/" focuses search, Escape clears it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;

      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearchQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSearchQuery]);

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchRef.current?.focus();
  }, [mobileSearchOpen]);

  const activeCountryFlag = country?.flag || flagEmoji(countryCode) || '🌐';
  const activeCountryCode = countryCode ?? '—';

  return (
    <header className="fixed inset-x-0 top-0 z-navbar h-14 border-b border-white/10 bg-yt-bg/95 backdrop-blur supports-[backdrop-filter]:bg-yt-bg/80">
      <div className="flex h-full items-center gap-2 px-3 sm:gap-4 sm:px-4">
        {/* Left cluster */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleMenu}
            aria-label={isDesktop ? 'Toggle sidebar' : 'Open navigation'}
            aria-expanded={isDesktop ? !sidebarCollapsed : mobileSidebarOpen}
            className="btn-icon"
          >
            <Menu size={22} aria-hidden />
          </button>
          <BrandLogo />
        </div>

        {/* Center search (desktop) */}
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            commitSearch();
          }}
          className="mx-auto hidden w-full max-w-[600px] flex-1 items-center justify-center md:flex"
        >
          <div className="flex h-10 w-full items-center rounded-full border border-white/15 bg-[#121212] pl-4 transition-colors focus-within:border-[#1c62b9] focus-within:bg-black/40 hover:border-white/25">
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search channels or networks"
              aria-label="Search channels or networks"
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-yt-text outline-none placeholder:text-yt-dim [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-yt-muted transition-colors hover:bg-white/10 hover:text-yt-text"
              >
                <X size={18} aria-hidden />
              </button>
            )}
            {!searchQuery && (
              <kbd className="mr-2 hidden h-6 min-w-6 items-center justify-center rounded border border-white/15 px-1.5 text-[10px] font-medium text-yt-dim lg:flex">
                /
              </kbd>
            )}
            <button
              type="submit"
              aria-label="Search"
              className="mr-0.5 flex h-9 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-yt-chip text-yt-text transition-colors hover:bg-yt-chipHover"
            >
              <Search size={18} aria-hidden />
            </button>
          </div>
        </form>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Open search"
            className="btn-icon md:hidden"
          >
            <Search size={21} aria-hidden />
          </button>

          <button
            type="button"
            onClick={openCountryPicker}
            aria-label={`Change country. Currently ${country?.name ?? activeCountryCode}`}
            title={country ? `Watching ${country.name}` : 'Choose a country'}
            className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-2 pr-2.5 transition-colors hover:border-white/25 hover:bg-white/10"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[15px] leading-none">
              <span aria-hidden>{activeCountryFlag}</span>
            </span>
            <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-yt-text sm:inline">
              {activeCountryCode}
            </span>
            <ChevronDown
              size={14}
              aria-hidden
              className="hidden text-yt-muted transition-transform group-hover:translate-y-0.5 sm:block"
            />
          </button>
        </div>
      </div>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-2 bg-yt-bg px-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(false)}
            aria-label="Close search"
            className="btn-icon"
          >
            <ArrowLeft size={21} aria-hidden />
          </button>
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              commitSearch();
            }}
            className="flex h-10 flex-1 items-center rounded-full border border-white/15 bg-[#121212] px-4"
          >
            <input
              ref={mobileSearchRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search channels"
              aria-label="Search channels"
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-yt-text outline-none placeholder:text-yt-dim [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  mobileSearchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="flex h-8 w-8 items-center justify-center rounded-full text-yt-muted"
              >
                <X size={18} aria-hidden />
              </button>
            )}
          </form>
          <button
            type="button"
            onClick={commitSearch}
            className="btn-icon text-[#3ea6ff]"
            aria-label="Apply search"
          >
            <Search size={21} aria-hidden />
          </button>
        </div>
      )}
    </header>
  );
}
