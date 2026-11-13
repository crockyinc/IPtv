import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Baby,
  Briefcase,
  Car,
  Clapperboard,
  CloudSun,
  Coffee,
  Compass,
  Cpu,
  ExternalLink,
  Film,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  History,
  House,
  Landmark,
  Mountain,
  Music2,
  Newspaper,
  Plane,
  Radio,
  ShoppingBag,
  Smile,
  Sparkles,
  Tag,
  Trophy,
  Tv,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useCatalogStore } from '@/store/useCatalogStore';
import { useCategoriesForCountry } from '@/hooks/useCatalog';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn, formatCount } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  news: Newspaper,
  sports: Trophy,
  entertainment: Clapperboard,
  music: Music2,
  kids: Baby,
  movies: Film,
  general: Tv,
  family: Users,
  education: GraduationCap,
  culture: Landmark,
  religion: Radio,
  shop: ShoppingBag,
  travel: Plane,
  weather: CloudSun,
  lifestyle: Coffee,
  comedy: Smile,
  series: Tv,
  auto: Car,
  business: Briefcase,
  science: FlaskConical,
  tech: Cpu,
  cooking: Coffee,
  quiz: HelpCircle,
  animation: Sparkles,
  outdoor: Mountain,
  documentary: Compass,
};

function iconForCategory(id: string): LucideIcon {
  return CATEGORY_ICONS[id] ?? Tag;
}

interface SidebarBodyProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function SidebarBody({ collapsed, onNavigate }: SidebarBodyProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const countryCode = useAppStore((state) => state.countryCode);
  const categoryFilter = useAppStore((state) => state.categoryFilter);
  const setCategoryFilter = useAppStore((state) => state.setCategoryFilter);
  const recentChannelIds = useAppStore((state) => state.recentChannelIds);
  const catalog = useCatalogStore((state) => state.catalog);
  const categories = useCategoriesForCountry(catalog, countryCode);
  const country = countryCode ? catalog?.countryByCode.get(countryCode) ?? null : null;

  const totalChannels = country?.channelCount ?? 0;
  const recentCount = Math.min(recentChannelIds.length, 24);

  const onHome = location.pathname === '/';
  const onRecent = location.pathname === '/recent';

  const goHome = () => {
    setCategoryFilter('all');
    navigate('/');
    onNavigate?.();
  };

  const goCategory = (id: string) => {
    setCategoryFilter(id);
    navigate('/');
    onNavigate?.();
  };

  const goRecent = () => {
    navigate('/recent');
    onNavigate?.();
  };

  const visibleCategories = useMemo(() => categories.slice(0, 18), [categories]);

  if (collapsed) {
    return (
      <nav aria-label="Primary" className="flex flex-col items-center gap-1 py-2">
        <RailItem icon={House} label="All live" active={onHome && categoryFilter === 'all'} onClick={goHome} />
        <RailItem icon={History} label="Recently watched" active={onRecent} onClick={goRecent} />
        <div className="my-1 h-px w-9 bg-white/10" />
        {visibleCategories.slice(0, 8).map((category) => (
          <RailItem
            key={category.id}
            icon={iconForCategory(category.id)}
            label={`${category.name} · ${formatCount(category.channelCount)}`}
            active={onHome && categoryFilter === category.id}
            onClick={() => goCategory(category.id)}
          />
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="px-3 pt-3">
        <SidebarItem
          icon={House}
          label="Home"
          hint={country ? formatCount(totalChannels) : undefined}
          active={onHome && categoryFilter === 'all'}
          onClick={goHome}
        />
        <SidebarItem
          icon={History}
          label="Recently watched"
          hint={recentCount > 0 ? String(recentCount) : undefined}
          active={onRecent}
          onClick={goRecent}
        />
      </div>

      <div className="divider mx-3" />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        <p className="px-3 pb-2 pt-1 text-[13px] font-medium uppercase tracking-wide text-yt-muted">
          {country ? `Categories in ${country.name}` : 'Categories'}
        </p>

        {visibleCategories.length === 0 ? (
          <p className="px-3 py-2 text-[13px] leading-relaxed text-yt-dim">
            Pick a country to see the categories with live channels.
          </p>
        ) : (
          visibleCategories.map((category) => (
            <SidebarItem
              key={category.id}
              icon={iconForCategory(category.id)}
              label={category.name}
              hint={formatCount(category.channelCount)}
              active={onHome && categoryFilter === category.id}
              onClick={() => goCategory(category.id)}
            />
          ))
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3 text-[11px] leading-relaxed text-yt-dim">
        <p className="flex items-center gap-1.5">
          <Radio size={12} aria-hidden />
          {country
            ? `${formatCount(totalChannels)} live channels in ${country.name}`
            : 'No region selected'}
        </p>
        <a
          href="https://github.com/iptv-org/iptv"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-flex items-center gap-1 text-yt-muted transition-colors hover:text-yt-text"
        >
          Stream data by iptv-org
          <ExternalLink size={11} aria-hidden />
        </a>
      </div>
    </nav>
  );
}

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}

function SidebarItem({ icon: Icon, label, hint, active, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn('nav-item w-full', active && 'nav-item-active')}
    >
      <Icon size={20} strokeWidth={active ? 2.4 : 1.9} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {hint && (
        <span className="ml-1 shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-yt-muted">
          {hint}
        </span>
      )}
    </button>
  );
}

interface RailItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function RailItem({ icon: Icon, label, active, onClick }: RailItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full flex-col items-center gap-1 rounded-lg py-3.5 transition-colors duration-150 hover:bg-white/10',
        active && 'bg-white/10',
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
      <span className="max-w-[64px] truncate text-[10px] leading-tight text-yt-muted">
        {label.split(' · ')[0]}
      </span>
    </button>
  );
}

/** Desktop rail/sidebar and the mobile drawer share one body implementation. */
export function Sidebar() {
  const isDesktop = useIsDesktop();
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const mobileSidebarOpen = useAppStore((state) => state.mobileSidebarOpen);
  const setMobileSidebarOpen = useAppStore((state) => state.setMobileSidebarOpen);

  if (isDesktop) {
    return (
      <aside
        className={cn(
          'fixed bottom-0 left-0 top-14 z-sidebar hidden border-r border-white/[0.06] bg-yt-bg transition-[width] duration-200 ease-out lg:block',
          sidebarCollapsed ? 'w-rail' : 'w-sidebar',
        )}
      >
        <div className="h-full overflow-hidden">
          <SidebarBody collapsed={sidebarCollapsed} />
        </div>
      </aside>
    );
  }

  return (
    <>
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-sidebar bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed bottom-0 left-0 top-0 z-sidebar flex w-[280px] max-w-[82vw] flex-col border-r border-white/10 bg-yt-bg shadow-pop transition-transform duration-200 ease-out lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!mobileSidebarOpen}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3">
          <Link to="/" onClick={() => setMobileSidebarOpen(false)} className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#ff3333] to-[#c00000]">
              <Radio size={15} className="text-white" aria-hidden />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">AnyStream</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
            className="btn-icon"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarBody collapsed={false} onNavigate={() => setMobileSidebarOpen(false)} />
        </div>
      </aside>
    </>
  );
}
