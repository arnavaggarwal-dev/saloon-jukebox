import { motion } from 'motion/react';
import { Play } from 'lucide-react';

import Magnet from './reactbits/Magnet';
import StarBorder from './reactbits/StarBorder';

interface JoinOverlayProps {
  onJoin: () => void;
  /** Leave without starting audio — browsing and queueing still work. */
  onDismiss: () => void;
  /** True when playback was blocked mid-session rather than at first load. */
  interrupted: boolean;
  nowPlayingTitle: string | null;
}

/**
 * Browsers refuse to make noise before a user gesture. Rather than failing
 * silently (or crashing on a rejected play() promise), we ask for one deliberate
 * click — which doubles as the "walk into the saloon" moment.
 */
export function JoinOverlay({ onJoin, onDismiss, interrupted, nowPlayingTitle }: JoinOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onKeyDown={(e) => e.key === 'Escape' && onDismiss()}
      className="bg-wood-950/85 fixed inset-0 z-80 grid place-items-center px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-title"
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="flex max-w-md flex-col items-center text-center"
      >
        <p className="text-brass-400/80 mb-3 text-[11px] font-semibold tracking-[0.34em] uppercase">
          {interrupted ? 'Playback paused by your browser' : 'Push through the swinging doors'}
        </p>

        <h2 id="join-title" className="font-display text-parchment-100 text-shadow-saloon text-3xl sm:text-4xl">
          {interrupted ? 'Tap to listen again' : 'Saloon Jukebox'}
        </h2>

        <p className="text-parchment-400 mt-4 text-sm leading-relaxed">
          {nowPlayingTitle ? (
            <>
              The saloon is already playing <span className="text-parchment-200">{nowPlayingTitle}</span>.
              Tap below and you'll drop in exactly where everyone else is.
            </>
          ) : (
            <>
              Your browser needs one tap before it will play audio. After that the queue rolls on by
              itself.
            </>
          )}
        </p>

        <Magnet padding={110} magnetStrength={5} wrapperClassName="mt-8">
          <StarBorder
            as="button"
            type="button"
            onClick={onJoin}
            color="#f6dda6"
            speed="5s"
            thickness={2}
            backgroundColor="#221812"
            borderColor="#a5722a"
            textColor="#f6ebd7"
            className="cursor-pointer"
          >
            <span className="font-sign flex items-center gap-2.5 px-4 py-1 text-base font-semibold tracking-[0.18em] uppercase">
              <Play className="size-4" fill="currentColor" aria-hidden="true" />
              Play Jukebox
            </span>
          </StarBorder>
        </Magnet>

        {/* Nobody should be trapped behind this. Browsing and queueing work
            perfectly well without audio, so offer a way past it. */}
        <button
          type="button"
          onClick={onDismiss}
          className="text-parchment-400 hover:text-brass-300 mt-6 text-xs underline decoration-dotted underline-offset-4 transition"
        >
          Just browsing — let me pick records without the sound
        </button>

        <p className="text-parchment-400/60 mt-8 text-[11px] leading-relaxed">
          No account needed. Volume is yours alone — the queue is everyone's.
        </p>
      </motion.div>
    </motion.div>
  );
}
