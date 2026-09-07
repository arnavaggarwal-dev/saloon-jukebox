import { useEffect, useRef, useState } from 'react';
import { Check, ListPlus, Music2 } from 'lucide-react';

import SpotlightCard from './reactbits/SpotlightCard';
import { formatTime, resolveAssetUrl } from '../lib/audio';
import type { Song } from '../types/database';

interface TrackCardProps {
  song: Song;
  queuedCount: number;
  isPlaying: boolean;
  onAdd: (songId: string) => Promise<void> | void;
}

export function TrackCard({ song, queuedCount, isPlaying, onAdd }: TrackCardProps) {
  const [justAdded, setJustAdded] = useState(false);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const handleAdd = async () => {
    // Confirm optimistically — the click should feel instant even on 3G.
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1600);
    await onAdd(song.id);
  };

  return (
    <SpotlightCard
      className={`group border-brass-600/20 bg-wood-850/70 relative rounded-[var(--radius-saloon)] border p-3 transition-colors duration-300 ${
        isPlaying ? 'border-brass-400/60 bg-wood-800/80' : 'hover:border-brass-500/45'
      }`}
      spotlightColor="rgba(224, 169, 79, 0.16)"
    >
      <div className="bg-wood-900 relative mb-3 aspect-square overflow-hidden rounded-lg">
        {artworkFailed ? (
          <div className="text-brass-600/60 flex h-full items-center justify-center">
            <Music2 className="size-10" aria-hidden="true" />
          </div>
        ) : (
          <img
            src={resolveAssetUrl(song.cover_url)}
            alt={`Album artwork for ${song.title} by ${song.artist}`}
            loading="lazy"
            decoding="async"
            onError={() => setArtworkFailed(true)}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}

        {isPlaying && (
          <div className="bg-wood-950/75 absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
              {[0, 0.18, 0.36].map((d) => (
                <span
                  key={d}
                  className="bg-brass-300 w-[3px] origin-bottom rounded-full"
                  style={{ height: '100%', animation: `vu-bounce 0.85s ${d}s ease-in-out infinite` }}
                />
              ))}
            </span>
            <span className="text-brass-300 text-[10px] font-semibold tracking-[0.14em] uppercase">
              On the turntable
            </span>
          </div>
        )}

        {/* Shown even while this record is on the turntable — knowing it's
            queued twice more is exactly when the count matters. */}
        {queuedCount > 0 && (
          <span
            className="bg-wood-950/85 text-brass-300 border-brass-500/40 absolute top-2 right-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm"
            title={`Already in the queue ${queuedCount} time${queuedCount > 1 ? 's' : ''}`}
          >
            ×{queuedCount} queued
          </span>
        )}
      </div>

      <h3 className="text-parchment-100 truncate text-sm leading-tight font-semibold" title={song.title}>
        {song.title}
      </h3>
      <p className="text-parchment-400 mt-0.5 truncate text-xs" title={song.artist}>
        {song.artist}
      </p>
      <p className="text-parchment-400/70 mt-0.5 flex items-center gap-1.5 truncate text-[11px]">
        {song.album && <span className="truncate">{song.album}</span>}
        {song.album && song.duration ? <span aria-hidden="true">·</span> : null}
        {song.duration ? <span className="tabular-nums">{formatTime(song.duration)}</span> : null}
      </p>

      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Add ${song.title} by ${song.artist} to the queue`}
        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold tracking-wide uppercase transition-all duration-200 active:scale-[0.97] ${
          justAdded
            ? 'border-sage-400/60 bg-sage-500/25 text-sage-400'
            : 'border-brass-500/45 bg-brass-500/10 text-brass-300 hover:bg-brass-500/25 hover:text-brass-200'
        }`}
      >
        {justAdded ? (
          <>
            <Check className="size-3.5" aria-hidden="true" /> Queued
          </>
        ) : (
          <>
            <ListPlus className="size-3.5" aria-hidden="true" /> Add to queue
          </>
        )}
      </button>
    </SpotlightCard>
  );
}
