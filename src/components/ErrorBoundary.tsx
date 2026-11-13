import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort guard so an unexpected render error shows a recoverable card
 * instead of a blank page (the player already handles its own failures).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AnyStream crashed while rendering:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-yt-live/15 text-yt-live">
          <AlertOctagon size={26} aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-yt-text">AnyStream hit a snag</h1>
        <p className="mt-2 text-sm leading-relaxed text-yt-muted">
          {error.message || 'An unexpected rendering error occurred.'} The live catalogue is still
          safe in memory — try reloading this view.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 rounded-full bg-yt-text px-4 py-2 text-sm font-semibold text-yt-bg transition-opacity hover:opacity-90"
          >
            <RotateCcw size={15} aria-hidden />
            Try again
          </button>
          <a
            href="/"
            className="rounded-full bg-yt-chip px-4 py-2 text-sm font-medium text-yt-text transition-colors hover:bg-yt-chipHover"
          >
            Back to live TV
          </a>
        </div>
      </div>
    );
  }
}
