import type { SupabaseClient } from '@supabase/supabase-js';

import type {

  JukeboxState,
  PlaybackRow,
  QueueEntry,
  RequestRow,
  Song,
} from '../../types/database';
import { JukeboxError, type JukeboxBackend } from './types';

/** Shape returned by every mutating RPC (see 001_initial_schema.sql). */
interface RpcState {
  playback: PlaybackRow;
  queue: QueueEntry[];
  server_time: string;
}

function toState(raw: RpcState): JukeboxState {
  return {
    playback: raw.playback,
    // Defensive: an entry whose song was deleted would otherwise crash render.
    queue: (raw.queue ?? []).filter((entry) => Boolean(entry?.song)),
    serverTime: new Date(raw.server_time).getTime(),
  };
}

export function createSupabaseBackend(client: SupabaseClient): JukeboxBackend {
  /** Every mutation is one RPC round trip; the DB does the locking. */
  async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<JukeboxState> {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw new JukeboxError(`The saloon's wire is down (${fn}).`, error);
    if (!data) throw new JukeboxError(`The saloon sent back an empty answer (${fn}).`);
    return toState(data as RpcState);
  }

  return {
    mode: 'supabase',

    async getSongs() {
      const { data, error } = await client
        .from('songs')
        .select('*')
        .order('artist', { ascending: true })
        .order('title', { ascending: true });
      if (error) throw new JukeboxError("Couldn't load the saloon's record collection.", error);
      return (data ?? []) as Song[];
    },

    async getState() {
      return rpc('jukebox_state');
    },

    async addToQueue(songId, addedBy) {
      return rpc('jukebox_add_to_queue', { p_song_id: songId, p_added_by: addedBy });
    },

    async removeFromQueue(queueId) {
      return rpc('jukebox_remove_from_queue', { p_queue_id: queueId });
    },

    async advance(expectedCurrentId) {
      return rpc('jukebox_advance', { p_expected_current_id: expectedCurrentId });
    },

    async previous() {
      try {
        return await rpc('jukebox_previous');
      } catch (err) {
        // Project still on migration 001: the function doesn't exist yet.
        // Degrade to "restart this track" rather than showing an error.
        const code = (err as JukeboxError)?.detail as { code?: string } | undefined;
        if (code?.code === 'PGRST202' || code?.code === '42883') {
          return rpc('jukebox_seek', { p_position_seconds: 0 });
        }
        throw err;
      }
    },

    async setPlaying(isPlaying, positionSeconds) {
      return rpc('jukebox_set_playing', {
        p_is_playing: isPlaying,
        p_position_seconds: Math.max(0, positionSeconds),
      });
    },

    async seek(positionSeconds) {
      return rpc('jukebox_seek', { p_position_seconds: Math.max(0, positionSeconds) });
    },

    async getRequests() {
      const { data, error } = await client
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw new JukeboxError("Couldn't read the request line.", error);
      return (data ?? []) as RequestRow[];
    },

    async addRequest(message, requestedBy) {
      const { error } = await client
        .from('requests')
        .insert({ message: message.slice(0, 280), requested_by: requestedBy.slice(0, 40) });
      if (error) throw new JukeboxError("Couldn't pin that request to the wall.", error);
      return this.getRequests();
    },

    subscribe({ onState, onRequests, onStatus }) {
      let disposed = false;
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;
      // The socket's own state is the truth about whether we're *realtime*;
      // a successful poll shouldn't paper over a dead subscription.
      let channelLive = false;

      /**
       * Realtime tells us *that* something changed; we re-read the authoritative
       * snapshot rather than trying to patch rows locally. Coalescing a burst of
       * events into one read keeps a 10-song add from causing 10 round trips.
       */
      const refresh = () => {
        if (refreshTimer) return;
        refreshTimer = setTimeout(async () => {
          refreshTimer = null;
          if (disposed) return;
          try {
            onState(await rpc('jukebox_state'));
            // Recovered: clear a stale "reconnecting" left by an earlier blip.
            onStatus(channelLive ? 'live' : 'reconnecting');
          } catch {
            onStatus('reconnecting');
          }
        }, 90);
      };

      const channel = client
        .channel('saloon-jukebox')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'playback' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
          if (!onRequests) return;
          this.getRequests().then(onRequests).catch(() => undefined);
        })
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            channelLive = true;
            onStatus('live');
            // Re-sync on (re)connect so anything missed while away is picked up.
            refresh();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            channelLive = false;
            onStatus('reconnecting');
          } else if (status === 'CLOSED') {
            channelLive = false;
            onStatus('offline');
          }
        });

      /**
       * Safety net: realtime can silently stall (sleeping laptop, flaky wifi,
       * proxy timeouts). A slow poll costs almost nothing and guarantees the
       * queue eventually converges even if the socket is wedged.
       */
      const poll = setInterval(refresh, 20_000);
      const onWake = () => {
        if (document.visibilityState === 'visible') refresh();
      };
      document.addEventListener('visibilitychange', onWake);
      window.addEventListener('online', onWake);

      return () => {
        disposed = true;
        if (refreshTimer) clearTimeout(refreshTimer);
        clearInterval(poll);
        document.removeEventListener('visibilitychange', onWake);
        window.removeEventListener('online', onWake);
        client.removeChannel(channel);
      };
    },
  };
}
