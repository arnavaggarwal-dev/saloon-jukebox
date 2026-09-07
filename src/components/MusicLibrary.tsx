import { useDeferredValue, useMemo, useState } from 'react';
import { Library, Search, TriangleAlert, X } from 'lucide-react';

import { TrackCard } from './TrackCard';
import { EmptyState } from './EmptyState';
import type { QueueEntry, Song } from '../types/database';

interface MusicLibraryProps {
  songs: Song[];
  queue: QueueEntry[];
  currentSongId: string | null;
  loading: boolean;
  error: string | null;
  onAdd: (songId: string) => Promise<void> | void;
}

export function MusicLibrary({
  songs,
  queue,
  currentSongId,
  loading,
  error,
  onAdd,
}: MusicLibraryProps) {
  const [query, setQuery] = useState('');
  // Keeps typing smooth while the (client-side) filter re-runs.
  const deferredQuery = useDeferredValue(query);

  const [genre, setGenre] = useState<string | null>(null);

  const genres = useMemo(
    () => [...new Set(songs.map((s) => s.genre).filter((g): g is string => Boolean(g)))].sort(),
    [songs],
  );

  /** How many times each song is currently waiting, for the ×N badge. */
  const queuedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of queue) {
      if (entry.status === 'queued') {
        counts.set(entry.song_id, (counts.get(entry.song_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [queue]);

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return songs.filter((song) => {
      if (genre && song.genre !== genre) return false;
      if (!q) return true;
      // Title, artist and album, as specified — plus genre, which people type.
      return (
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        (song.album ?? '').toLowerCase().includes(q) ||
        (song.genre ?? '').toLowerCase().includes(q)
      );
    });
  }, [songs, deferredQuery, genre]);

  return (
    <section aria-labelledby="library-heading" className="saloon-panel flex min-h-0 flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Library className="text-brass-400 size-4 shrink-0" aria-hidden="true" />
        <h2 id="library-heading" className="saloon-heading">
          Music Library
        </h2>
        <span className="text-parchment-400 ml-auto text-xs tabular-nums">
          {loading ? '—' : `${results.length} of ${songs.length}`}
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search
          className="text-parchment-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <label htmlFor="library-search" className="sr-only">
          Search the library by title, artist, album or genre
        </label>
        <input
          id="library-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, artist, album…"
          autoComplete="off"
          className="border-brass-600/25 bg-wood-900/70 text-parchment-100 placeholder:text-parchment-400/70 focus:border-brass-500/60 w-full rounded-full border py-2.5 pr-9 pl-9 text-sm transition-colors outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="text-parchment-400 hover:text-parchment-100 hover:bg-wood-600/60 absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 transition"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Genre filters */}
      {genres.length > 1 && (
        <div className="scrollbar-saloon mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip active={genre === null} onClick={() => setGenre(null)}>
            All
          </FilterChip>
          {genres.map((g) => (
            <FilterChip key={g} active={genre === g} onClick={() => setGenre(genre === g ? null : g)}>
              {g}
            </FilterChip>
          ))}
        </div>
      )}

      <div className="scrollbar-saloon -mx-1 min-h-0 flex-1 overflow-y-auto px-1 lg:max-h-[min(64vh,640px)]">
        {error ? (
          <EmptyState
            icon={TriangleAlert}
            title="The record shelf is bare"
            body={error}
            tone="error"
          />
        ) : loading ? (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
            role="status"
            aria-label="Loading the saloon's records"
          >
            <span className="sr-only">Loading the saloon's records…</span>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="border-brass-600/15 bg-wood-850/50 animate-pulse rounded-[var(--radius-saloon)] border p-3"
                style={{ animationDelay: `${i * 70}ms` }}
                aria-hidden="true"
              >
                <div className="bg-wood-700/60 mb-3 aspect-square rounded-lg" />
                <div className="bg-wood-700/60 h-3 w-3/4 rounded" />
                <div className="bg-wood-700/40 mt-2 h-2.5 w-1/2 rounded" />
                <div className="bg-wood-700/30 mt-3 h-8 rounded-full" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No tracks found."
            body={
              query
                ? `Nothing in the saloon matches “${query.trim()}”. Try another title, artist or genre.`
                : 'No records in this genre.'
            }
            action={
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setGenre(null);
                }}
                className="border-brass-500/45 text-brass-300 hover:bg-brass-500/20 rounded-full border px-4 py-2 text-xs font-semibold tracking-wide uppercase transition"
              >
                Show every record
              </button>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {results.map((song) => (
              <li key={song.id}>
                <TrackCard
                  song={song}
                  queuedCount={queuedCounts.get(song.id) ?? 0}
                  isPlaying={song.id === currentSongId}
                  onAdd={onAdd}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CC BY 4.0 requires visible credit wherever the music is used. */}
      <p className="text-parchment-400/70 border-brass-600/15 mt-3 border-t pt-3 text-[11px] leading-relaxed">
        Music by{' '}
        <a
          href="https://incompetech.com/music/royalty-free/music.html"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brass-400 hover:text-brass-300 underline underline-offset-2"
        >
          Kevin MacLeod
        </a>{' '}
        · licensed under{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer noopener"
          className="text-brass-400 hover:text-brass-300 underline underline-offset-2"
        >
          CC BY 4.0
        </a>
      </p>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase transition ${
        active
          ? 'border-brass-400/70 bg-brass-500/25 text-brass-200'
          : 'border-brass-600/25 bg-wood-900/50 text-parchment-400 hover:border-brass-500/45 hover:text-parchment-200'
      }`}
    >
      {children}
    </button>
  );
}
