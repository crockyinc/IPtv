import { useState } from 'react';
import { Copy, Check, ExternalLink, Radio, RefreshCw } from 'lucide-react';
import type { Channel } from '@/types/iptv';
import { ChannelAvatar } from '@/components/ChannelLogo';
import { copyText } from '@/lib/utils';

interface ChannelInfoBarProps {
  channel: Channel;
  activeStreamUrl: string | null;
}

export function ChannelInfoBar({ channel, activeStreamUrl }: ChannelInfoBarProps) {
  const [copied, setCopied] = useState(false);

  const streamUrl = activeStreamUrl ?? channel.streams[0]?.url ?? '';

  const handleCopy = async () => {
    if (!streamUrl) return;
    const ok = await copyText(streamUrl);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section aria-label="Channel information" className="mt-4">
      <div className="flex flex-wrap items-start gap-3">
        <ChannelAvatar channel={channel} size="lg" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-semibold leading-tight tracking-tight text-yt-text sm:text-xl">
            {channel.name}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-yt-muted">
            {channel.primaryCategoryName && (
              <span className="rounded-full bg-yt-chip px-2 py-0.5 text-[11px] font-medium text-yt-text">
                {channel.primaryCategoryName}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>{channel.countryFlag}</span>
              {channel.countryName}
            </span>
            {channel.resolutionLabel && (
              <>
                <span className="text-yt-dim">·</span>
                <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {channel.resolutionLabel}
                </span>
              </>
            )}
            <span className="text-yt-dim">·</span>
            <span className="inline-flex items-center gap-1">
              <Radio size={12} aria-hidden />
              {channel.streams.length} {channel.streams.length === 1 ? 'source' : 'sources'}
            </span>
            {channel.network && (
              <>
                <span className="text-yt-dim">·</span>
                <span className="truncate">{channel.network}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="btn-pill"
            aria-label="Copy the active stream URL"
          >
            {copied ? <Check size={15} className="text-[#2ecc71]" aria-hidden /> : <Copy size={15} aria-hidden />}
            {copied ? 'Copied' : 'Copy stream URL'}
          </button>
          {channel.website && (
            <a
              href={channel.website}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-pill"
              aria-label={`Open ${channel.name} website`}
            >
              <ExternalLink size={15} aria-hidden />
              <span className="hidden sm:inline">Website</span>
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-yt-dim">
            <RefreshCw size={11} aria-hidden />
            Active source
          </p>
          <span className="text-[10px] text-yt-dim">
            {channel.streams.filter((stream) => stream.isHttps).length} HTTPS ·{' '}
            {channel.streams.length} total
          </span>
        </div>
        <p className="mt-1.5 truncate font-mono text-[11px] leading-relaxed text-yt-muted" title={streamUrl}>
          {streamUrl || 'No manifest available'}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-yt-dim">
          AnyStream plays the feed straight from the broadcaster. If this source fails, the player
          automatically falls back to the next known mirror for {channel.name}.
        </p>
      </div>
    </section>
  );
}
