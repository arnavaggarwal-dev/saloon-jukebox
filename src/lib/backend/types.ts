import type { ConnectionStatus, JukeboxState, RequestRow, Song } from '../../types/database';

/**
 * The contract both backends implement.
 *
 * Everything that mutates shared state is a single atomic call, so two browsers
 * racing each other can never interleave into a broken queue. In Supabase these
 * map to `SECURITY DEFINER` SQL functions that take a row lock; in the local
 * fallback they map to a compare-and-set on a versioned localStorage document.
 */
export interface JukeboxBackend {
  readonly mode: 'supabase' | 'local';

  /** Static library. Read once at startup. */
  getSongs(): Promise<Song[]>;

  /** A consistent snapshot of queue + playback + server clock. */
  getState(): Promise<JukeboxState>;

  /** Append a song. Starts playback immediately if the jukebox was idle. */
  addToQueue(songId: string, addedBy: string): Promise<JukeboxState>;

  /** Drop a still-queued entry. No-op if it already started playing. */
  removeFromQueue(queueId: string): Promise<JukeboxState>;

  /**
   * Move to the next track.
   *
   * `expectedCurrentId` makes this idempotent: whichever client gets there
   * first wins, and every other caller becomes a no-op instead of skipping an
   * extra song. This is the whole answer to the multi-browser race.
   */
  advance(expectedCurrentId: string | null): Promise<JukeboxState>;

  /** Shared transport control. `positionSeconds` is where the playhead is now. */
  setPlaying(isPlaying: boolean, positionSeconds: number): Promise<JukeboxState>;

  /** Shared seek — everyone jumps together. */
  seek(positionSeconds: number): Promise<JukeboxState>;

  /** Optional "request line" wall. */
  getRequests(): Promise<RequestRow[]>;
  addRequest(message: string, requestedBy: string): Promise<RequestRow[]>;

  /**
   * Subscribe to shared-state changes. `onState` fires with a fresh snapshot
   * whenever the queue or playback row changes anywhere.
   */
  subscribe(handlers: {
    onState: (state: JukeboxState) => void;
    onRequests?: (requests: RequestRow[]) => void;
    onStatus: (status: ConnectionStatus) => void;
  }): () => void;
}

/** Thrown for anything we want to surface to a human in plain language. */
export class JukeboxError extends Error {
  /** The underlying Supabase/network error, kept for the console only. */
  readonly detail: unknown;

  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = 'JukeboxError';
    this.detail = detail;
    if (detail) console.error('[saloon-jukebox]', message, detail);
  }
}
