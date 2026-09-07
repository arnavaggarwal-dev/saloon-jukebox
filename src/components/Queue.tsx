import { AnimatePresence, motion } from 'motion/react';
import { Clock, ListMusic, Music2, X } from 'lucide-react';

import { EmptyState } from './EmptyState';
import CountUp from './reactbits/CountUp';
import { formatDuration, formatTime, resolveAssetUrl } from '../lib/audio';
import type { QueueEntry } from '../types/database';

interface QueueProps {
  upNext: QueueEntry[];
  history: QueueEntry[];
  loading: boolean;
  onRemove: (queueId: string) => Promise<void> | void;
}

export function Queue({ upNext, history, loading, onRemove }: QueueProps) {
  const totalSeconds = upNext.reduce((n, e) => n + (e.song.duration ?? 0), 0);

  return (
    <section aria-labelledby="queue-heading" className="saloon-panel flex min-h-0 flex-col p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <ListMusic className="text-brass-400 size-4 shrink-0" aria-hidden="true" />
        <h2 id="queue-heading" className="saloon-heading">
          Up Next
        </h2>
        <span className="text-brass-300 ml-auto font-mono text-sm tabular-nums">
          <CountUp to={upNext.length} duration={0.5} />
        </span>
      </div>

      <p className="text-parchment-400/80 mb-3 text-[11px]">
        {upNext.length === 0
          ? 'Nothing waiting'
          : `${upNext.length} record${upNext.length === 1 ? '' : 's'} · ${formatDuration(totalSeconds)}`}
      </p>
      <div className="saloon-rule mb-3" />

      <div className="scrollbar-saloon -mx-1 min-h-0 flex-1 overflow-y-auto px-1 lg:max-h-[min(46vh,460px)]">
        {loading ? (
          <div role="status" className="space-y-2">
            <span className="sr-only">Loading queue…</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="border-brass-600/15 bg-wood-850/50 flex animate-pulse items-center gap-3 rounded-xl border p-2.5"
                aria-hidden="true"
              >
                <div className="bg-wood-700/60 size-11 shrink-0 rounded-md" />
                <div className="flex-1">
                  <div className="bg-wood-700/60 h-3 w-2/3 rounded" />
                  <div className="bg-wood-700/40 mt-2 h-2.5 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : upNext.length === 0 ? (
          <EmptyState
            icon={Music2}
            title="The queue is empty."
            body="Pick a record from the library and it'll play next."
            compact
          />
        ) : (
          <ol className="space-y-2" aria-label="Queued tracks" data-testid="up-next">
            <AnimatePresence initial={false}>
              {upNext.map((entry, index) => (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 24, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                  className="group border-brass-600/20 bg-wood-900/50 hover:border-brass-500/40 hover:bg-wood-800/60 flex items-center gap-2.5 rounded-xl border p-2 transition-colors"
                >
                  <span
                    className="text-brass-400/70 w-5 shrink-0 text-center font-mono text-xs tabular-nums"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>

                  <img
                    src={resolveAssetUrl(entry.song.cover_url)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="bg-wood-800 size-10 shrink-0 rounded-md object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-parchment-100 truncate text-sm font-medium" title={entry.song.title}>
                      {entry.song.title}
                    </p>
                    <p className="text-parchment-400 truncate text-[11px]">
                      {entry.song.artist}
                      {entry.added_by && (
                        <>
                          {' · '}
                          <span className="text-brass-400/80">{entry.added_by}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <span
                    className="text-parchment-400/70 shrink-0 font-mono text-[11px] tabular-nums"
                    aria-hidden="true"
                  >
                    {formatTime(entry.song.duration)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    aria-label={`Remove ${entry.song.title} from the queue`}
                    className="text-parchment-400 hover:bg-oxblood-600/30 hover:text-oxblood-400 shrink-0 rounded-full p-1.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>

      {history.length > 0 && (
        <details className="border-brass-600/15 mt-3 border-t pt-3">
          <summary className="text-parchment-400 hover:text-parchment-200 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase transition">
            <Clock className="size-3" aria-hidden="true" />
            Recently played ({history.length})
          </summary>
          <ol className="mt-2 space-y-1" aria-label="Recently played tracks" data-testid="history">
            {history.slice(0, 8).map((entry) => (
              <li key={entry.id} className="text-parchment-400/80 flex gap-2 truncate text-xs">
                <span className="truncate">{entry.song.title}</span>
                <span className="text-parchment-400/50 shrink-0">· {entry.song.artist}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
