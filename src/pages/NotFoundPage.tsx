import { Link } from 'react-router-dom';
import { Compass, SearchX } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.06] text-yt-muted">
        <SearchX size={28} aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">This page went off air</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-yt-muted">
        The link you followed does not exist in AnyStream. Head back to the feed to pick a live
        channel.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
      >
        <Compass size={15} aria-hidden />
        Back to live TV
      </Link>
    </div>
  );
}
