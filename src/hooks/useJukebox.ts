import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { backend } from '../lib/backend';
import { JukeboxError } from '../lib/backend/types';
import { getGuestName } from '../lib/guest';
import type {
  ConnectionStatus,
  JukeboxState,
  QueueEntry,
  RequestRow,
  Song,
} from '../types/database';

const IDLE_PLAYBACK = {
  id: 1,
  current_queue_id: null,
  is_playing: false,
  position_seconds: 0,
  position_updated_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const humanError = (err: unknown, fallback: string) =>
  err instanceof JukeboxError ? err.message : fallback;

/**
 * Owns all *shared* jukebox state: the library, the queue, and the single
 * playback row. Local-only concerns (volume, whether this browser has been
 * unlocked for audio) deliberately live elsewhere.
 */
export function useJukebox(onError: (message: string) => void) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [state, setState] = useState<JukeboxState>({
    queue: [],
    playback: IDLE_PLAYBACK,
    serverTime: Date.now(),
  });
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const guestName = useMemo(() => getGuestName(), []);

  /**
   * Difference between the backend's clock and this browser's, in ms.
   * Every playhead calculation goes through this so that a client whose system
   * clock is minutes off still lands on the right spot in the song.
   */
  const clockOffsetRef = useRef(0);

  const applyState = useCallback((next: JukeboxState) => {
    clockOffsetRef.current = next.serverTime - Date.now();
    setState(next);
    setLoadingQueue(false);
  }, []);

  // Library: read once. It's static content, so there's nothing to subscribe to.
  useEffect(() => {
    let cancelled = false;
    backend
      .getSongs()
      .then((rows) => {
        if (cancelled) return;
        setSongs(rows);
        setLibraryError(
          rows.length === 0
            ? "The saloon's record shelf is empty. Run the seed step in the README to stock it."
            : null,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setLibraryError(humanError(err, "Couldn't load the saloon's record collection."));
      })
      .finally(() => !cancelled && setLoadingLibrary(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Shared state: read once, then keep it live.
  useEffect(() => {
    let cancelled = false;
    backend
      .getState()
      .then((s) => !cancelled && applyState(s))
      .catch(() => {
        if (cancelled) return;
        setLoadingQueue(false);
        setStatus('offline');
        onError("Couldn't reach the saloon's queue. Retrying…");
      });

    backend.getRequests().then(setRequests).catch(() => undefined);

    const unsubscribe = backend.subscribe({
      onState: (s) => !cancelled && applyState(s),
      onRequests: (r) => !cancelled && setRequests(r),
      onStatus: (s) => !cancelled && setStatus(s),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyState, onError]);

  const { queue, playback } = state;

  /** The entry that is (or should be) sounding right now. */
  const currentEntry = useMemo<QueueEntry | null>(
    () => queue.find((e) => e.id === playback.current_queue_id) ?? null,
    [queue, playback.current_queue_id],
  );

  /** Everything still waiting, in play order. */
  const upNext = useMemo(
    () => queue.filter((e) => e.status === 'queued' && e.id !== playback.current_queue_id),
    [queue, playback.current_queue_id],
  );

  const history = useMemo(
    () => queue.filter((e) => e.status === 'played').slice(-20).reverse(),
    [queue],
  );

  /**
   * Where the playhead should be, in seconds, according to the shared clock.
   * This is the number every client converges on.
   */
  const expectedPosition = useCallback(() => {
    const base = playback.position_seconds;
    if (!playback.is_playing) return base;
    const since = Date.now() + clockOffsetRef.current - new Date(playback.position_updated_at).getTime();
    return base + Math.max(0, since) / 1000;
  }, [playback]);

  // --- Actions. Each is one atomic backend call. ---------------------------

  const run = useCallback(
    async (fn: () => Promise<JukeboxState>, fallbackMessage: string) => {
      try {
        applyState(await fn());
      } catch (err) {
        onError(humanError(err, fallbackMessage));
      }
    },
    [applyState, onError],
  );

  const addToQueue = useCallback(
    (songId: string) =>
      run(() => backend.addToQueue(songId, guestName), "Couldn't add that to the queue. Try again."),
    [run, guestName],
  );

  const removeFromQueue = useCallback(
    (queueId: string) =>
      run(() => backend.removeFromQueue(queueId), "Couldn't pull that record from the queue."),
    [run],
  );

  const advance = useCallback(
    (expectedCurrentId: string | null) =>
      run(() => backend.advance(expectedCurrentId), "Couldn't move to the next track."),
    [run],
  );

  const skip = useCallback(
    () => advance(playback.current_queue_id),
    [advance, playback.current_queue_id],
  );

  const setPlaying = useCallback(
    (isPlaying: boolean, position?: number) =>
      run(
        () => backend.setPlaying(isPlaying, position ?? expectedPosition()),
        isPlaying ? "Couldn't start the music." : "Couldn't pause the music.",
      ),
    [run, expectedPosition],
  );

  const seek = useCallback(
    (position: number) => run(() => backend.seek(position), "Couldn't move the needle."),
    [run],
  );

  /** Restart the current track, or step back to the previously played one. */
  const previous = useCallback(async () => {
    if (expectedPosition() > 4 || history.length === 0) {
      await seek(0);
      return;
    }
    try {
      // Re-queue the last played record at the front by adding it again.
      applyState(await backend.addToQueue(history[0].song.id, guestName));
      applyState(await backend.advance(playback.current_queue_id));
    } catch (err) {
      onError(humanError(err, "Couldn't go back a track."));
    }
  }, [expectedPosition, history, seek, applyState, guestName, playback.current_queue_id, onError]);

  const addRequest = useCallback(
    async (message: string) => {
      try {
        setRequests(await backend.addRequest(message, guestName));
      } catch (err) {
        onError(humanError(err, "Couldn't pin that request to the wall."));
      }
    },
    [guestName, onError],
  );

  return {
    songs,
    queue,
    upNext,
    history,
    currentEntry,
    playback,
    requests,
    status,
    guestName,
    mode: backend.mode,
    loadingLibrary,
    loadingQueue,
    libraryError,
    expectedPosition,
    addToQueue,
    removeFromQueue,
    advance,
    skip,
    previous,
    setPlaying,
    seek,
    addRequest,
  };
}

export type Jukebox = ReturnType<typeof useJukebox>;
