import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  collapsed?: boolean;
  className?: string;
}

/** AnyStream wordmark with the red play badge. */
export function BrandLogo({ collapsed = false, className }: BrandLogoProps) {
  return (
    <Link
      to="/"
      aria-label="AnyStream — home"
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-90',
        className,
      )}
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#ff3333] to-[#c00000] shadow-[0_2px_10px_-2px_rgba(255,0,0,0.7)]">
        <Play size={16} strokeWidth={0} fill="#ffffff" className="translate-x-[1px]" aria-hidden />
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-yt-live ring-2 ring-yt-bg" />
      </span>
      {!collapsed && (
        <span className="text-[19px] font-semibold leading-none tracking-[-0.03em] text-yt-text">
          Any<span className="text-yt-text/90">Stream</span>
        </span>
      )}
    </Link>
  );
}
