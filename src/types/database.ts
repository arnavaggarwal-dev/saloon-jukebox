/** Row shapes shared by the Supabase backend, the local backend and the UI. */

export type QueueStatus = 'queued' | 'playing' | 'played';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  /** Seconds. Used to drive the shared clock and the queue watchdog. */
  duration: number | null;
  /** Relative path (`music/foo.mp3`) or an absolute URL. See `resolveAssetUrl`. */
  audio_url: string;
  cover_url: string | null;
  genre: string | null;
  created_at: string;
}

export interface QueueRow {
  id: string;
  song_id: string;
  added_at: string;
  /** Monotonic ordering key. Ties are broken by `added_at`, then `id`. */
  position: number;
  status: QueueStatus;
  added_by: string | null;
}

/** A queue row joined to its song, which is what the UI actually renders. */
export interface QueueEntry extends QueueRow {
  song: Song;
}

/**
 * The single source of truth for "what is playing, and where are we in it".
 *
 * There is exactly one row (`id = 1`). Every client derives its playhead from
 * it rather than keeping its own, which is what keeps browsers in sync:
 *
 *   expected = position_seconds + (is_playing ? serverNow - position_updated_at : 0)
 */
export interface PlaybackRow {
  id: number;
  current_queue_id: string | null;
  is_playing: boolean;
  position_seconds: number;
  position_updated_at: string;
  updated_at: string;
}

export interface RequestRow {
  id: string;
  message: string;
  requested_by: string | null;
  created_at: string;
}

/** One consistent snapshot of the shared world, plus the server's clock. */
export interface JukeboxState {
  queue: QueueEntry[];
  playback: PlaybackRow;
  /** `now()` as the backend sees it (ms). Used to correct client clock skew. */
  serverTime: number;
}

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';
