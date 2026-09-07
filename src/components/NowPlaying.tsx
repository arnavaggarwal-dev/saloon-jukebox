import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Music4, TriangleAlert } from 'lucide-react';

import { FlapBoard } from './FlapBoard';
import GlareHover from './reactbits/GlareHover';
import ShinyText from './reactbits/ShinyText';
import { formatTime, resolveAssetUrl } from '../lib/audio';
import type { LoadState } from '../hooks/useAudioPlayer';
import type { QueueEntry } from '../types/database';

interface NowPlayingProps {
  entry: QueueEntry | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loadState: LoadState;
  audioError: string | null;
  upNextTitle: string | null;
  onSkip: () => void;
}

export function NowPlaying({
  entry,
  isPlaying,
  currentTime,
  duration,
  loadState,
  audioError,
  upNextTitle,
  onSkip,
}: NowPlayingProps) {
  const [artworkFailed, setArtworkFailed] = useState(false);
  const song = entry?.song ?? null;

  if (!song) {
    return (
      <section
        aria-labelledby="now-playing-heading"
        className="saloon-panel flex flex-col items-center justify-center px-6 py-14 text-center sm:py-20"
      >
        <h2 id="now-playing-heading" className="sr-only">
          Now playing
        </h2>
        <Music4 className="text-brass-500/50 mb-4 size-10" aria-hidden="true" />
        <p className="font-display text-brass-300 text-xl sm:text-3xl">The jukebox is quiet</p>
        <p className="text-parchment-400 mt-3 max-w-sm text-sm leading-relaxed">
          Add a song to the queue to get started. Everyone in the saloon hears whatever you pick.
        </p>
      </section>
    );
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <section aria-labelledby="now-playing-heading" className="saloon-panel overflow-hidden">
      <div className="flex flex-col items-center gap-6 p-5 sm:p-7 md:flex-row md:items-center md:gap-8 md:p-8">
        {/* Artwork */}
        <div className="relative w-full max-w-[260px] shrink-0 md:w-[240px] lg:w-[280px] lg:max-w-none">
          <GlareHover
            width="100%"
            height="auto"
            background="transparent"
            borderColor="transparent"
            borderRadius="14px"
            glareColor="#ffe6b0"
            glareOpacity={0.28}
            glareAngle={-38}
            glareSize={220}
            transitionDuration={900}
            className="!block !h-auto !w-full"
            style={{ aspectRatio: '1 / 1' }}
          >
            <div className="bg-wood-900 relative size-full overflow-hidden rounded-[14px] shadow-[0_18px_50px_-14px_rgb(0_0_0/0.95)]">
              {artworkFailed ? (
                <div className="text-brass-600/60 grid h-full place-items-center">
                  <Music4 className="size-16" aria-hidden="true" />
                </div>
              ) : (
                <img
                  src={resolveAssetUrl(song.cover_url)}
                  alt={`Album artwork for ${song.title} by ${song.artist}`}
                  onError={() => setArtworkFailed(true)}
                  className="size-full object-cover"
                />
              )}
              {loadState === 'loading' && (
                <div className="bg-wood-950/60 absolute inset-0 grid place-items-center backdrop-blur-[2px]">
                  <Loader2 className="text-brass-300 size-8 animate-spin" aria-hidden="true" />
                </div>
              )}
            </div>
          </GlareHover>

          {/* A record peeking out from behind the sleeve. */}
          <div
            aria-hidden="true"
            className="from-wood-700 to-wood-900 border-wood-600 absolute top-1/2 -right-5 -z-10 hidden size-[86%] -translate-y-1/2 rounded-full border bg-gradient-to-br shadow-[0_10px_30px_-8px_rgb(0_0_0/0.9)] md:block"
            style={isPlaying ? { animation: 'spin-record 4s linear infinite' } : undefined}
          >
            <div className="bg-brass-600/40 absolute top-1/2 left-1/2 size-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          </div>
        </div>

        {/* Details */}
        <div className="flex w-full min-w-0 flex-1 flex-col items-center text-center md:items-start md:text-left">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex h-3.5 items-end gap-[3px]"
              aria-hidden="true"
              style={{ opacity: isPlaying ? 1 : 0.3 }}
            >
              {[0, 0.15, 0.3, 0.45].map((d) => (
                <span
                  key={d}
                  className="bg-brass-400 w-[3px] origin-bottom rounded-full"
                  style={{
                    height: '100%',
                    animation: isPlaying ? `vu-bounce 0.9s ${d}s ease-in-out infinite` : undefined,
                    transform: isPlaying ? undefined : 'scaleY(0.3)',
                  }}
                />
              ))}
            </span>
            <h2 id="now-playing-heading" className="saloon-heading">
              <ShinyText
                text={isPlaying ? 'Now Playing' : 'Paused'}
                color="#efc978"
                shineColor="#fff6e0"
                speed={5}
                spread={70}
              />
            </h2>
          </div>

          {/* Split-flap board, like an old station display. The real title is
              rendered for assistive tech below. */}
          <div className="mb-3 w-full max-w-full">
            <FlapBoard text={song.title} maxFontSize={30} />
          </div>

          <h3 className="sr-only">
            {song.title} by {song.artist}
          </h3>

          <p className="font-display text-parchment-100 text-shadow-saloon text-lg break-words sm:text-xl">
            {song.artist}
          </p>

          <div className="text-parchment-400 mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs md:justify-start">
            {song.album && <span>{song.album}</span>}
            {song.album && song.genre && <span aria-hidden="true">·</span>}
            {song.genre && (
              <span className="border-brass-600/30 bg-wood-800/60 text-brass-300 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                {song.genre}
              </span>
            )}
            {entry?.added_by && (
              <span className="text-parchment-400/80">
                requested by <span className="text-brass-400">{entry.added_by}</span>
              </span>
            )}
          </div>

          {/* Read-only progress; the seekable control lives in the player bar. */}
          <div className="mt-5 w-full">
            <div
              className="bg-wood-700/70 h-1.5 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              aria-label="Track progress"
            >
              <div
                className="from-brass-600 via-brass-400 to-brass-200 h-full rounded-full bg-gradient-to-r transition-[width] duration-200 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-parchment-400 mt-1.5 flex justify-between font-mono text-[11px] tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <AnimatePresence>
            {audioError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="border-oxblood-400/50 bg-oxblood-600/20 mt-4 flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left"
              >
                <TriangleAlert className="text-oxblood-400 mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-parchment-100 text-sm">{audioError}</p>
                  <button
                    type="button"
                    onClick={onSkip}
                    className="text-brass-300 hover:text-brass-200 mt-1 text-xs font-semibold underline underline-offset-2"
                  >
                    Skip to the next song
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {upNextTitle && (
            <p className="text-parchment-400/80 mt-4 truncate text-xs">
              Up next: <span className="text-parchment-200">{upNextTitle}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
