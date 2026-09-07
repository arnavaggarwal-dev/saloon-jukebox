import { Loader2, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';

import ElasticSlider from './reactbits/ElasticSlider';
import Magnet from './reactbits/Magnet';
import { Scrubber } from './Scrubber';
import { resolveAssetUrl } from '../lib/audio';
import type { AudioPlayer } from '../hooks/useAudioPlayer';
import type { QueueEntry } from '../types/database';

interface PlayerBarProps {
  player: AudioPlayer;
  entry: QueueEntry | null;
  isPlaying: boolean;
  canSkip: boolean;
  onSkip: () => void;
  onPrevious: () => void;
}

export function PlayerBar({ player, entry, isPlaying, canSkip, onSkip, onPrevious }: PlayerBarProps) {
  const {
    currentTime,
    duration,
    volume,
    muted,
    loadState,
    hasJoined,
    togglePlay,
    setVolume,
    toggleMute,
    beginScrub,
    updateScrub,
    commitScrub,
  } = player;

  const song = entry?.song ?? null;
  const busy = loadState === 'loading' && isPlaying;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="border-brass-600/25 bg-wood-900/95 fixed inset-x-0 bottom-0 z-60 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Mobile: scrubber gets its own row so the controls stay tappable. */}
        <div className="mb-1.5 sm:hidden">
          <Scrubber
            value={currentTime}
            max={duration}
            disabled={!song}
            onScrubStart={beginScrub}
            onScrub={updateScrub}
            onScrubEnd={commitScrub}
          />
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          {/* Track identity */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:max-w-[240px] lg:max-w-[300px]">
            {song ? (
              <>
                <img
                  src={resolveAssetUrl(song.cover_url)}
                  alt=""
                  className="bg-wood-800 size-10 shrink-0 rounded-md object-cover sm:size-11"
                />
                <div className="min-w-0">
                  <p className="text-parchment-100 truncate text-xs font-medium sm:text-sm">
                    {song.title}
                  </p>
                  <p className="text-parchment-400 truncate text-[11px]">{song.artist}</p>
                </div>
              </>
            ) : (
              <p className="text-parchment-400 truncate text-xs">Nothing on the turntable</p>
            )}
          </div>

          {/* Transport */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!song}
              aria-label="Previous track (or restart this one)"
              className="text-parchment-300 hover:text-brass-300 hover:bg-wood-700/70 rounded-full p-2 transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <SkipBack className="size-4 sm:size-[18px]" aria-hidden="true" />
            </button>

            <Magnet padding={60} magnetStrength={6} wrapperClassName="shrink-0">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={
                  !hasJoined ? 'Start the jukebox' : isPlaying ? 'Pause for everyone' : 'Play for everyone'
                }
                aria-pressed={isPlaying}
                className="from-brass-300 to-brass-500 text-wood-950 hover:from-brass-200 hover:to-brass-400 grid size-12 place-items-center rounded-full bg-gradient-to-br shadow-[0_6px_20px_-4px_rgb(224_169_79/0.6)] transition-all active:scale-95 sm:size-13"
              >
                {busy ? (
                  <Loader2 className="size-5 animate-spin sm:size-6" aria-hidden="true" />
                ) : isPlaying ? (
                  <Pause className="size-5 sm:size-6" fill="currentColor" aria-hidden="true" />
                ) : (
                  <Play className="ml-0.5 size-5 sm:size-6" fill="currentColor" aria-hidden="true" />
                )}
              </button>
            </Magnet>

            <button
              type="button"
              onClick={onSkip}
              disabled={!canSkip}
              aria-label="Skip to the next track"
              className="text-parchment-300 hover:text-brass-300 hover:bg-wood-700/70 rounded-full p-2 transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <SkipForward className="size-4 sm:size-[18px]" aria-hidden="true" />
            </button>
          </div>

          {/* Desktop scrubber */}
          <div className="hidden flex-1 sm:block">
            <Scrubber
              value={currentTime}
              max={duration}
              disabled={!song}
              onScrubStart={beginScrub}
              onScrub={updateScrub}
              onScrubEnd={commitScrub}
            />
          </div>

          {/* Volume — local to this browser only. */}
          <div className="hidden shrink-0 items-center gap-1 md:flex md:w-40 lg:w-48">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-pressed={muted}
              title="Volume is yours alone — it doesn't change what anyone else hears."
              className="text-parchment-300 hover:text-brass-300 hover:bg-wood-700/70 shrink-0 rounded-full p-2 transition"
            >
              <VolumeIcon className="size-[18px]" aria-hidden="true" />
            </button>
            <ElasticSlider
              value={muted ? 0 : volume * 100}
              onChange={(v) => setVolume(v / 100)}
              startingValue={0}
              maxValue={100}
              className="w-full"
              ariaLabel="Volume (this browser only)"
              formatValue={(v) => `${Math.round(v)}%`}
              leftIcon={null}
              rightIcon={null}
              trackClassName="bg-wood-600/80"
              fillClassName="bg-gradient-to-r from-brass-600 to-brass-300"
            />
          </div>

          {/* Compact volume for narrow screens. */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            className="text-parchment-300 hover:text-brass-300 hover:bg-wood-700/70 shrink-0 rounded-full p-2 transition md:hidden"
          >
            <VolumeIcon className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
