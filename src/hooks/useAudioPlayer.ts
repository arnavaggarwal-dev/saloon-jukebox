import { useCallback, useEffect, useRef, useState } from 'react';

import { describeMediaError, resolveAssetUrl } from '../lib/audio';
import type { Jukebox } from './useJukebox';

/** Hard-resync if we drift further than this from the shared clock. */
const SYNC_THRESHOLD_S = 2.5;
/** Only resync when the gap is real; avoids fighting normal decode jitter. */
const SYNC_TARGET_S = 0.25;
/** How far past the end we tolerate before forcing the queue forward. */
const END_GRACE_S = 1;

const VOLUME_KEY = 'saloon-jukebox:volume';
const MUTED_KEY = 'saloon-jukebox:muted';

function readStored<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Drives a single <audio> element from the shared playback row.
 *
 * The element is never the source of truth — the database is. This hook's job
 * is to keep the local element agreeing with the shared clock, and to report
 * local-only facts (buffering, errors, volume) back to the UI.
 */
export function useAudioPlayer(jukebox: Jukebox) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { currentEntry, playback, expectedPosition, advance, setPlaying } = jukebox;

  /** This browser has had a user gesture, so audio is allowed to make sound. */
  const [hasJoined, setHasJoined] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const [volume, setVolumeState] = useState(() =>
    readStored(VOLUME_KEY, (raw) => Math.min(1, Math.max(0, Number(raw))), 0.8),
  );
  const [muted, setMutedState] = useState(() => readStored(MUTED_KEY, (raw) => raw === 'true', false));

  // Refs mirror state for use inside event handlers/intervals without
  // re-subscribing on every render.
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;
  const hasJoinedRef = useRef(hasJoined);
  hasJoinedRef.current = hasJoined;
  const advanceLockRef = useRef<string | null>(null);
  /**
   * Timestamp until which drift correction stands down.
   *
   * A shared seek takes a round trip to land. Without this, the sync loop sees
   * "you're 3 minutes ahead of the shared clock" in that window and drags the
   * playhead straight back — so seeking would appear to do nothing.
   */
  const seekGuardUntilRef = useRef(0);

  const currentSong = currentEntry?.song ?? null;
  const songUrl = currentSong ? resolveAssetUrl(currentSong.audio_url) : '';
  /** Prefer the real decoded length; fall back to the catalogue value. */
  const effectiveDuration = duration || currentSong?.duration || 0;

  // --- Local volume (never shared: one person's ears are their own) --------

  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.volume = volume;
      el.muted = muted;
    }
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
      localStorage.setItem(MUTED_KEY, String(muted));
    } catch {
      /* Storage unavailable — volume simply won't persist. */
    }
  }, [volume, muted]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    // Nudging the slider up from silence should also unmute.
    if (clamped > 0) setMutedState(false);
  }, []);

  const toggleMute = useCallback(() => setMutedState((m) => !m), []);

  // --- Source loading -----------------------------------------------------

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!songUrl) {
      el.removeAttribute('src');
      el.load();
      setLoadState('idle');
      setAudioError(null);
      setDuration(0);
      setDisplayTime(0);
      return;
    }

    setLoadState('loading');
    setAudioError(null);
    setDuration(0);
    el.src = songUrl;
    el.load();

    // Land on the shared playhead straight away, so a late joiner drops into
    // the middle of the song like walking into the bar.
    const target = expectedPosition();
    const onMeta = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
      if (target > 0.5 && target < (el.duration || Infinity)) {
        try {
          el.currentTime = target;
        } catch {
          /* Seeking before the media is seekable — the drift loop will fix it. */
        }
      }
    };
    el.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => el.removeEventListener('loadedmetadata', onMeta);
    // `expectedPosition` intentionally excluded: this must run per *track*,
    // not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songUrl]);

  // --- Media element events ------------------------------------------------

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onCanPlay = () => {
      setLoadState('ready');
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onWaiting = () => setLoadState((s) => (s === 'error' ? s : 'loading'));
    const onPlaying = () => {
      setLoadState('ready');
      setNeedsGesture(false);
    };
    const onDurationChange = () => Number.isFinite(el.duration) && setDuration(el.duration);
    const onError = () => {
      setLoadState('error');
      setAudioError(describeMediaError(el.error));
    };
    const onEnded = () => {
      // Whoever's element finishes first proposes the transition; the backend
      // makes sure only one actually takes effect.
      void advance(playback.current_queue_id);
    };

    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('error', onError);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('error', onError);
      el.removeEventListener('ended', onEnded);
    };
  }, [advance, playback.current_queue_id]);

  // --- Play/pause follows the shared row ----------------------------------

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !songUrl) return;

    if (playback.is_playing && hasJoined) {
      const p = el.play();
      if (p) {
        p.catch((err: unknown) => {
          // Autoplay policy, or the tab lost the right to make noise.
          if ((err as DOMException)?.name === 'NotAllowedError') {
            setNeedsGesture(true);
          } else if ((err as DOMException)?.name !== 'AbortError') {
            setLoadState('error');
            // A failed source rejects play() *and* fires `error`. The MediaError
            // says something specific ("the file is missing…"), so prefer it
            // over this generic fallback rather than overwriting it.
            setAudioError(
              (prev) =>
                prev ??
                (el.error
                  ? describeMediaError(el.error)
                  : "Couldn't start this track. Try skipping to the next song."),
            );
          }
        });
      }
    } else {
      el.pause();
    }
  }, [playback.is_playing, playback.current_queue_id, hasJoined, songUrl]);

  // --- The sync + watchdog loop -------------------------------------------

  useEffect(() => {
    const tick = () => {
      const el = audioRef.current;
      const expected = expectedPosition();

      const guarded = Date.now() < seekGuardUntilRef.current;

      // Progress readout: listeners read their own element, onlookers follow
      // the shared clock, so the bar moves for everyone.
      if (!scrubbingRef.current) {
        setDisplayTime(hasJoinedRef.current && el && el.readyState > 0 ? el.currentTime : expected);
      }

      // Nudge a drifting element back onto the shared playhead.
      if (
        el &&
        hasJoinedRef.current &&
        playback.is_playing &&
        !scrubbingRef.current &&
        !guarded &&
        !el.seeking &&
        el.readyState >= 2 &&
        Math.abs(el.currentTime - expected) > SYNC_THRESHOLD_S &&
        expected < (el.duration || Infinity)
      ) {
        try {
          el.currentTime = expected + SYNC_TARGET_S;
        } catch {
          /* Not seekable yet; try again next tick. */
        }
      }

      // Watchdog: keep the queue moving even if the tab that was playing has
      // gone away, or the `ended` event never fires. Guarded by the same
      // expected-id check, plus a local latch so we only ask once per track.
      if (
        playback.is_playing &&
        playback.current_queue_id &&
        !guarded &&
        effectiveDuration > 0 &&
        expected > effectiveDuration + END_GRACE_S &&
        advanceLockRef.current !== playback.current_queue_id
      ) {
        advanceLockRef.current = playback.current_queue_id;
        // Small jitter so twenty phones don't all fire in the same millisecond.
        setTimeout(() => void advance(playback.current_queue_id), Math.random() * 600);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expectedPosition, playback.is_playing, playback.current_queue_id, effectiveDuration, advance]);

  // Reset the one-shot advance latch whenever the track actually changes.
  useEffect(() => {
    advanceLockRef.current = null;
  }, [playback.current_queue_id]);

  // --- Gestures ------------------------------------------------------------

  /** Unlock audio for this browser. Must be called from a real user gesture. */
  const join = useCallback(async () => {
    setHasJoined(true);
    setNeedsGesture(false);
    const el = audioRef.current;
    if (el) {
      el.muted = muted;
      el.volume = volume;
      try {
        // Priming inside the gesture is what buys us autoplay later.
        await el.play();
      } catch {
        /* Nothing loaded yet (empty queue) — that's fine. */
      }
    }
    // An idle-but-loaded jukebox should start when someone asks it to.
    if (playback.current_queue_id && !playback.is_playing) await setPlaying(true);
  }, [muted, volume, playback.current_queue_id, playback.is_playing, setPlaying]);

  const togglePlay = useCallback(async () => {
    if (!hasJoined) {
      await join();
      return;
    }
    await setPlaying(!playback.is_playing, expectedPosition());
  }, [hasJoined, join, setPlaying, playback.is_playing, expectedPosition]);

  // --- Seeking -------------------------------------------------------------

  const beginScrub = useCallback((value: number) => {
    setScrubbing(true);
    setScrubValue(value);
    setDisplayTime(value);
  }, []);

  const updateScrub = useCallback((value: number) => {
    setScrubValue(value);
    setDisplayTime(value);
  }, []);

  const commitScrub = useCallback(
    async (value: number) => {
      setScrubbing(false);
      // Hold the sync loop off until the shared clock reflects this seek.
      seekGuardUntilRef.current = Date.now() + 2500;
      const el = audioRef.current;
      if (el && el.readyState > 0) {
        try {
          el.currentTime = value;
        } catch {
          /* The shared seek below still moves everyone. */
        }
      }
      await jukebox.seek(value);
    },
    [jukebox],
  );

  return {
    audioRef,
    hasJoined,
    needsGesture,
    loadState,
    audioError,
    /** Seconds into the current track, for display. */
    currentTime: scrubbing ? scrubValue : displayTime,
    duration: effectiveDuration,
    volume,
    muted,
    scrubbing,
    setVolume,
    toggleMute,
    join,
    togglePlay,
    beginScrub,
    updateScrub,
    commitScrub,
    clearAudioError: () => setAudioError(null),
  };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
