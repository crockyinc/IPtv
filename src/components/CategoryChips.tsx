import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CategoryOption } from '@/types/iptv';
import { useAppStore } from '@/store/useAppStore';
import { cn, formatCount } from '@/lib/utils';

interface CategoryChipsProps {
  categories: CategoryOption[];
  totalChannels: number;
}

/**
 * Sticky, horizontally scrollable filter chips directly beneath the navbar.
 * Selection is shared with the sidebar through the app store.
 */
export function CategoryChips({ categories, totalChannels }: CategoryChipsProps) {
  const categoryFilter = useAppStore((state) => state.categoryFilter);
  const setCategoryFilter = useAppStore((state) => state.setCategoryFilter);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollHints();
    const node = scrollerRef.current;
    if (!node) return;
    const onResize = () => updateScrollHints();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateScrollHints, categories.length]);

  // Keep the active chip visible when the filter changes from the sidebar.
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const active = node.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [categoryFilter]);

  const scrollBy = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  const chips: Array<{ id: string; name: string; count: number }> = [
    { id: 'all', name: 'All', count: totalChannels },
    ...categories.slice(0, 24).map((category) => ({
      id: category.id,
      name: category.name,
      count: category.channelCount,
    })),
  ];

  return (
    <div className="sticky top-14 z-40 -mx-4 border-b border-white/[0.06] bg-yt-bg/95 px-2 backdrop-blur-md sm:-mx-6 sm:px-4">
      <div className="flex items-center gap-1 py-2.5">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll categories left"
          className={cn(
            'hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-yt-text transition-opacity hover:bg-white/10 md:flex',
            canScrollLeft ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>

        <div
          ref={scrollerRef}
          onScroll={updateScrollHints}
          role="tablist"
          aria-label="Channel categories"
          className="hide-scrollbar flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth px-2 md:px-1"
        >
          {chips.map((chip) => {
            const active = categoryFilter === chip.id || (chip.id === 'all' && categoryFilter === 'all');
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active}
                onClick={() => setCategoryFilter(chip.id)}
                className={cn('chip inline-flex items-center gap-1.5 whitespace-nowrap', active && 'chip-active')}
              >
                {chip.name}
                <span
                  className={cn(
                    'text-[10px] tabular-nums',
                    active ? 'text-black/55' : 'text-yt-dim',
                  )}
                >
                  {formatCount(chip.count)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll categories right"
          className={cn(
            'hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-yt-text transition-opacity hover:bg-white/10 md:flex',
            canScrollRight ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
