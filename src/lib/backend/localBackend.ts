import type {
  JukeboxState,
  PlaybackRow,
  QueueEntry,
  QueueRow,
  RequestRow,
  Song,
} from '../../types/database';
import type { JukeboxBackend } from './types';

/**
 * Zero-config fallback used when no Supabase credentials are present.
 *
 * It implements the same contract against localStorage, and broadcasts changes
 * to other tabs on the same browser. That makes the app fully playable (and
 * genuinely collaborative *across tabs*) out of the box — useful for local dev
 * and for a first look at the deploy — but it is NOT a substitute for Supabase:
 * nothing here crosses to another device. Configure Supabase for real sharing.
 */
const KEY = 'saloon-jukebox:v1';
const CHANNEL = 'saloon-jukebox';

interface Doc {
  version: number;
  queue: QueueRow[];
  playback: PlaybackRow;
  requests: RequestRow[];
}

const emptyPlayback = (): PlaybackRow => ({
  id: 1,
  current_queue_id: null,
  is_playing: false,
  position_seconds: 0,
  position_updated_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

function emptyDoc(): Doc {
  return { version: 0, queue: [], playback: emptyPlayback(), requests: [] };
}

function readDoc(): Doc {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDoc();
    const parsed = JSON.parse(raw) as Doc;
    if (!parsed?.playback || !Array.isArray(parsed.queue)) return emptyDoc();
    return parsed;
  } catch {
    // Private mode, quota, corrupt JSON — degrade to an empty jukebox.
    return emptyDoc();
  }
}

function writeDoc(doc: Doc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    /* Storage unavailable: state stays in-memory for this tab only. */
  }
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createLocalBackend(songs: Song[]): JukeboxBackend {
  const songsById = new Map(songs.map((s) => [s.id, s]));
  const listeners = new Set<(state: JukeboxState) => void>();
  const requestListeners = new Set<(rows: RequestRow[]) => void>();
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

  const hydrate = (doc: Doc): JukeboxState => ({
    playback: doc.playback,
    queue: doc.queue
      .map((row) => {
        const song = songsById.get(row.song_id);
        return song ? ({ ...row, song } as QueueEntry) : null;
      })
      .filter((e): e is QueueEntry => e !== null)
      .sort((a, b) => a.position - b.position || a.added_at.localeCompare(b.added_at)),
    serverTime: Date.now(),
  });

  /**
   * Read-modify-write with a version check. localStorage access is synchronous
   * and same-origin tabs share one clock, so a re-read + compare is enough to
   * keep two tabs from both advancing the queue.
   */
  function mutate(fn: (doc: Doc) => void): JukeboxState {
    const doc = readDoc();
    fn(doc);
    doc.version += 1;
    writeDoc(doc);
    const state = hydrate(doc);
    bc?.postMessage({ type: 'state', version: doc.version });
    listeners.forEach((l) => l(state));
    return state;
  }

  const nowIso = () => new Date().toISOString();

  /** Start `entry` and reset the shared playhead to zero. */
  function startEntry(doc: Doc, entry: QueueRow | undefined) {
    if (entry) entry.status = 'playing';
    doc.playback = {
      ...doc.playback,
      current_queue_id: entry?.id ?? null,
      is_playing: entry ? true : false,
      position_seconds: 0,
      position_updated_at: nowIso(),
      updated_at: nowIso(),
    };
  }

  const nextQueued = (doc: Doc) =>
    doc.queue
      .filter((r) => r.status === 'queued')
      .sort((a, b) => a.position - b.position || a.added_at.localeCompare(b.added_at))[0];

  return {
    mode: 'local',

    async getSongs() {
      return songs;
    },

    async getState() {
      return hydrate(readDoc());
    },

    async addToQueue(songId, addedBy) {
      return mutate((doc) => {
        const maxPos = doc.queue.reduce((m, r) => Math.max(m, r.position), 0);
        const row: QueueRow = {
          id: uid(),
          song_id: songId,
          added_at: nowIso(),
          position: maxPos + 1,
          status: 'queued',
          added_by: addedBy,
        };
        doc.queue.push(row);
        // Idle jukebox: the first coin in the slot starts the music.
        const current = doc.queue.find((r) => r.id === doc.playback.current_queue_id);
        if (!current || current.status === 'played') startEntry(doc, row);
      });
    },

    async removeFromQueue(queueId) {
      return mutate((doc) => {
        const row = doc.queue.find((r) => r.id === queueId);
        if (row && row.status === 'queued') doc.queue = doc.queue.filter((r) => r.id !== queueId);
      });
    },

    async advance(expectedCurrentId) {
      return mutate((doc) => {
        // Someone else already moved us along — do nothing rather than
        // skipping an extra track.
        if (doc.playback.current_queue_id !== expectedCurrentId) return;
        const current = doc.queue.find((r) => r.id === doc.playback.current_queue_id);
        if (current) current.status = 'played';
        startEntry(doc, nextQueued(doc));
      });
    },

    async previous() {
      return mutate((doc) => {
        const played = doc.queue
          .filter((r) => r.status === 'played')
          .sort((a, b) => a.position - b.position || a.added_at.localeCompare(b.added_at));
        const prev = played[played.length - 1];

        // Nothing behind us: start the current record again.
        if (!prev) {
          doc.playback = {
            ...doc.playback,
            position_seconds: 0,
            position_updated_at: nowIso(),
            updated_at: nowIso(),
          };
          return;
        }

        const front = doc.queue
          .filter((r) => r.status === 'queued')
          .reduce((m, r) => Math.min(m, r.position), 0);

        // Don't discard what we're leaving — it plays again next.
        const current = doc.queue.find((r) => r.id === doc.playback.current_queue_id);
        if (current) {
          current.status = 'queued';
          current.position = front - 1;
        }
        prev.position = front - 2;
        startEntry(doc, prev);
      });
    },

    async setPlaying(isPlaying, positionSeconds) {
      return mutate((doc) => {
        doc.playback = {
          ...doc.playback,
          is_playing: isPlaying,
          position_seconds: Math.max(0, positionSeconds),
          position_updated_at: nowIso(),
          updated_at: nowIso(),
        };
      });
    },

    async seek(positionSeconds) {
      return mutate((doc) => {
        doc.playback = {
          ...doc.playback,
          position_seconds: Math.max(0, positionSeconds),
          position_updated_at: nowIso(),
          updated_at: nowIso(),
        };
      });
    },

    async getRequests() {
      return readDoc().requests;
    },

    async addRequest(message, requestedBy) {
      const doc = readDoc();
      doc.requests = [
        {
          id: uid(),
          message: message.slice(0, 280),
          requested_by: requestedBy.slice(0, 40),
          created_at: nowIso(),
        },
        ...doc.requests,
      ].slice(0, 30);
      doc.version += 1;
      writeDoc(doc);
      bc?.postMessage({ type: 'requests' });
      requestListeners.forEach((l) => l(doc.requests));
      return doc.requests;
    },

    subscribe({ onState, onRequests, onStatus }) {
      listeners.add(onState);
      if (onRequests) requestListeners.add(onRequests);
      onStatus('live');

      const push = () => onState(hydrate(readDoc()));
      const pushRequests = () => onRequests?.(readDoc().requests);

      const onBc = (e: MessageEvent) => (e.data?.type === 'requests' ? pushRequests() : push());
      // `storage` fires for other tabs; it also covers browsers without
      // BroadcastChannel.
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          push();
          pushRequests();
        }
      };

      bc?.addEventListener('message', onBc);
      window.addEventListener('storage', onStorage);

      return () => {
        listeners.delete(onState);
        if (onRequests) requestListeners.delete(onRequests);
        bc?.removeEventListener('message', onBc);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}
