import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Tv, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

/** Bottom-centre toast for transient confirmations (copy, no-stream notices). */
export function NoticeToast() {
  const notice = useAppStore((state) => state.notice);
  const dismiss = useAppStore((state) => state.dismissNotice);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 safe-bottom"
    >
      <div
        className={cn(
          'pointer-events-auto flex max-w-[92vw] items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm shadow-pop backdrop-blur-md animate-fade-in',
          notice.tone === 'error'
            ? 'border-yt-live/40 bg-[#2a0b0b]/95 text-[#ffc9c9]'
            : 'border-white/15 bg-[#1f1f1f]/95 text-yt-text',
        )}
      >
        {notice.tone === 'error' ? (
          <AlertTriangle size={16} className="shrink-0 text-yt-live" aria-hidden />
        ) : (
          <CheckCircle2 size={16} className="shrink-0 text-[#3ea6ff]" aria-hidden />
        )}
        <span className="min-w-0 truncate">{notice.message}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notification"
          className="ml-1 shrink-0 rounded-full p-0.5 text-white/70 transition-colors hover:bg-white/10"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-16 text-center',
        className,
      )}
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-yt-muted">
        {icon ?? <Tv size={24} aria-hidden />}
      </span>
      <h3 className="mt-4 text-base font-semibold text-yt-text">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-yt-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-yt-live/30 bg-yt-live/[0.06] px-6 py-10 text-center',
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-yt-live/15 text-yt-live">
        <AlertTriangle size={22} aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-yt-text">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-yt-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
        >
          <RefreshCw size={15} aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}
