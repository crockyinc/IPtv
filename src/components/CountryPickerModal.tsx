import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownAZ, Flame, Globe2, Search, X } from 'lucide-react';
import type { CountryOption } from '@/types/iptv';
import { useAppStore } from '@/store/useAppStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { cn, flagEmoji } from '@/lib/utils';

type SortMode = 'popular' | 'az';

/**
 * Mandatory region picker. Rendered as a blocking dialog until
 * `anystream_country` exists in localStorage; afterwards it is a switcher.
 */
export function CountryPickerModal() {
  const countryCode = useAppStore((state) => state.countryCode);
  const pickerOpen = useAppStore((state) => state.countryPickerOpen);
  const closePicker = useAppStore((state) => state.closeCountryPicker);
  const setCountry = useAppStore((state) => state.setCountry);
  const pushNotice = useAppStore((state) => state.pushNotice);

  const catalog = useCatalogStore((state) => state.catalog);
  const status = useCatalogStore((state) => state.status);
  const error = useCatalogStore((state) => state.error);
  const ensureLoaded = useCatalogStore((state) => state.ensureLoaded);

  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const inputRef = useRef<HTMLInputElement>(null);

  const mandatory = !countryCode;
  const open = pickerOpen || mandatory;

  useEffect(() => {
    if (open) {
      // Autofocus without scrolling the page behind the dialog.
      const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
      return () => clearTimeout(timer);
    }
    setQuery('');
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mandatory) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, mandatory]);

  const countries = useMemo(() => catalog?.countries ?? [], [catalog]);

  const filtered = useMemo<CountryOption[]>(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? countries.filter(
          (country) =>
            country.name.toLowerCase().includes(needle) ||
            country.code.toLowerCase() === needle ||
            country.code.toLowerCase().startsWith(needle),
        )
      : countries;

    const sorted = [...base];
    if (sortMode === 'az') sorted.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    else sorted.sort((a, b) => b.channelCount - a.channelCount || a.name.localeCompare(b.name, 'en'));
    return sorted;
  }, [countries, query, sortMode]);

  if (!open) return null;

  const handleSelect = (country: CountryOption) => {
    setCountry(country.code);
    setQuery('');
    if (country.channelCount === 0) {
      pushNotice(`${country.name} has no playable streams right now.`, 'error');
    }
  };

  const loading = status === 'loading' || status === 'idle';

  return (
    <div
      className="modal-backdrop animate-fade-in"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mandatory) closePicker();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="country-picker-title"
        aria-describedby="country-picker-description"
        className="modal-panel animate-modal-in"
      >
        {/* Header */}
        <div className="relative shrink-0 border-b border-white/10 px-5 pb-4 pt-6 sm:px-7">
          {!mandatory && (
            <button
              type="button"
              onClick={closePicker}
              aria-label="Close country picker"
              className="btn-icon absolute right-3 top-3"
            >
              <X size={20} aria-hidden />
            </button>
          )}

          <div className="flex items-start gap-3 pr-8">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-yt-live/15 text-yt-live">
              <Globe2 size={20} aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="country-picker-title" className="text-xl font-semibold tracking-tight">
                {mandatory ? 'Choose where to watch from' : 'Switch region'}
              </h2>
              <p id="country-picker-description" className="mt-1 text-[13px] leading-relaxed text-yt-muted">
                {mandatory
                  ? 'AnyStream shows live channels from one country at a time. You can switch regions anytime from the top bar.'
                  : 'Picking a different country reloads the live feed instantly.'}
              </p>
            </div>
          </div>

          {/* Search + sort */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex h-10 flex-1 items-center gap-2 rounded-full border border-white/15 bg-[#121212] px-4 transition-colors focus-within:border-[#1c62b9]">
              <Search size={17} className="shrink-0 text-yt-muted" aria-hidden />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search country or ISO code"
                aria-label="Search countries"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-yt-text outline-none placeholder:text-yt-dim [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear country search"
                  className="text-yt-muted transition-colors hover:text-yt-text"
                >
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] p-1">
              <button
                type="button"
                onClick={() => setSortMode('popular')}
                aria-pressed={sortMode === 'popular'}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  sortMode === 'popular' ? 'bg-white text-black' : 'text-yt-muted hover:text-yt-text',
                )}
              >
                <Flame size={13} aria-hidden />
                Popular
              </button>
              <button
                type="button"
                onClick={() => setSortMode('az')}
                aria-pressed={sortMode === 'az'}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  sortMode === 'az' ? 'bg-white text-black' : 'text-yt-muted hover:text-yt-text',
                )}
              >
                <ArrowDownAZ size={13} aria-hidden />
                A–Z
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
          {loading && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-busy aria-live="polite">
              {Array.from({ length: 10 }, (_, index) => (
                <div key={index} className="skeleton h-[62px] rounded-xl" />
              ))}
            </div>
          )}

          {!loading && status === 'error' && (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-yt-text">Could not load the country list</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-yt-muted">{error}</p>
              <button
                type="button"
                onClick={() => void ensureLoaded(true)}
                className="mt-4 rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && status === 'ready' && filtered.length === 0 && (
            <div className="px-3 py-12 text-center text-sm text-yt-muted">
              No country matches “{query}”. Try another name or ISO code.
            </div>
          )}

          {!loading && status === 'ready' && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {filtered.map((country) => {
                const active = country.code === countryCode;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleSelect(country)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-yt-live/60 bg-yt-live/10'
                        : 'border-transparent hover:border-white/10 hover:bg-white/[0.06]',
                    )}
                  >
                    <span className="grid h-9 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.07] text-xl leading-none ring-1 ring-inset ring-white/10">
                      <span aria-hidden>{country.flag || flagEmoji(country.code)}</span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-yt-text">
                          {country.name}
                        </span>
                        <span className="shrink-0 rounded bg-white/10 px-1 py-px text-[10px] font-semibold tracking-wide text-yt-muted">
                          {country.code}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-yt-dim">
                        {country.channelCount.toLocaleString()} live{' '}
                        {country.channelCount === 1 ? 'channel' : 'channels'}
                      </span>
                    </span>

                    <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-yt-muted group-hover:bg-white/15 group-hover:text-yt-text">
                      {country.channelCount.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-[11px] text-yt-dim sm:px-7">
          <span>
            {status === 'ready'
              ? `${filtered.length} of ${countries.length} countries with playable streams`
              : 'Loading the global channel catalogue…'}
          </span>
          {!mandatory && (
            <button
              type="button"
              onClick={closePicker}
              className="rounded-full px-3 py-1.5 font-medium text-yt-muted transition-colors hover:bg-white/10 hover:text-yt-text"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
