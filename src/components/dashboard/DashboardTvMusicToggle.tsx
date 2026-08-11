import { useMemo, useState } from 'react';
import { Music, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT_MUSIC_URL =
  'https://www.youtube.com/live/36YnV9STBqc?si=z7fueLnKriSc_uET';

function extractVideoId(url: string): string {
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (v) return v;
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length >= 8) return last;
    return '';
  } catch {
    return '';
  }
}

export function DashboardTvMusicToggle({
  url = DEFAULT_MUSIC_URL,
  className,
  playing: playingProp,
  onPlayingChange,
  hidden = false,
}: {
  url?: string;
  className?: string;
  playing?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  /** Mantém o iframe montado sem mostrar o botão (ex.: fullscreen). */
  hidden?: boolean;
}) {
  const [internalPlaying, setInternalPlaying] = useState(false);
  const controlled = playingProp !== undefined;
  const playing = controlled ? playingProp : internalPlaying;

  const setPlaying = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(playing) : next;
    if (!controlled) setInternalPlaying(value);
    onPlayingChange?.(value);
  };

  const videoId = useMemo(() => extractVideoId(url), [url]);

  const embedSrc = useMemo(() => {
    if (!videoId) return '';
    const params = new URLSearchParams({
      autoplay: '1',
      controls: '0',
      modestbranding: '1',
      rel: '0',
      playsinline: '1',
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [videoId]);

  return (
    <div className={cn('relative inline-flex', hidden && 'sr-only', className)}>
      {!hidden && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPlaying((p) => !p)}
          title={playing ? 'Pausar música' : 'Tocar música'}
          className={cn(
            playing &&
              'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
          )}
        >
          {playing ? <Pause className="size-4" /> : <Music className="size-4" />}
          <span
            className={cn(
              'size-2 rounded-full',
              playing ? 'animate-pulse bg-amber-500' : 'bg-muted-foreground/50'
            )}
          />
          Música
        </Button>
      )}

      {playing && embedSrc ? (
        <iframe
          title="dashboard-tv-music"
          src={embedSrc}
          allow="autoplay; encrypted-media"
          width={1}
          height={1}
          className="pointer-events-none absolute opacity-0"
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}
