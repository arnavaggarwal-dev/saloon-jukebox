// Everything that talks to Supabase. The queue lives in Postgres; each mutation
// is one atomic SQL function, which is what stops two browsers fighting over
// the queue. See supabase/setup.sql.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const configured = Boolean(url && key);

// Only the public anon key ever reaches the browser. RLS makes the tables
// read-only to it; writes go through SECURITY DEFINER functions.
export const db = configured
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;

/** `music/x.mp3` -> `/saloon-jukebox/music/x.mp3`. Absolute URLs pass through. */
export const asset = (p) =>
  !p ? '' : /^(https?:)?\/\//.test(p) ? p : `${import.meta.env.BASE_URL}${p}`.replace(/\/{2,}/g, '/');

/** 195 -> "3:15" */
export const time = (s) =>
  !Number.isFinite(s) || s < 0 ? '0:00' : `${(s / 60) | 0}:${String((s | 0) % 60).padStart(2, '0')}`;

/** A throwaway handle so queue entries have a name. No accounts, no data. */
export function guest() {
  const k = 'saloon:guest';
  try {
    const saved = localStorage.getItem(k);
    if (saved) return saved;
    const n = `${['Cowboy', 'Ranger', 'Drifter', 'Outlaw', 'Barkeep', 'Marshal', 'Gambler'][(Math.random() * 7) | 0]}${(Math.random() * 90 + 10) | 0}`;
    localStorage.setItem(k, n);
    return n;
  } catch {
    return 'Guest';
  }
}

const call = async (fn, args = {}) => {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data;
};

export const api = {
  songs: async () => {
    const { data, error } = await db.from('songs').select('*').order('title');
    if (error) throw error;
    return data ?? [];
  },
  state: () => call('jukebox_state'),
  add: (songId, by) => call('jukebox_add_to_queue', { p_song_id: songId, p_added_by: by }),
  remove: (id) => call('jukebox_remove_from_queue', { p_queue_id: id }),
  next: (expected) => call('jukebox_advance', { p_expected_current_id: expected }),
  play: (on, at) => call('jukebox_set_playing', { p_is_playing: on, p_position_seconds: Math.max(0, at) }),
  seek: (at) => call('jukebox_seek', { p_position_seconds: Math.max(0, at) }),
  // Falls back to "restart track" if migration 002 isn't applied yet.
  prev: () => call('jukebox_previous').catch(() => call('jukebox_seek', { p_position_seconds: 0 })),
};

/** Realtime says *something* changed; we re-read the authoritative snapshot. */
export function watch(onChange, onStatus) {
  let timer;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => api.state().then(onChange).catch(() => onStatus('down')), 80);
  };
  const ch = db
    .channel('saloon')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'playback' }, refresh)
    .subscribe((s) => {
      onStatus(s === 'SUBSCRIBED' ? 'live' : s === 'CLOSED' ? 'down' : 'wait');
      if (s === 'SUBSCRIBED') refresh();
    });
  // Safety net for a silently stalled socket (sleeping laptop, flaky wifi).
  const poll = setInterval(refresh, 20000);
  return () => {
    clearTimeout(timer);
    clearInterval(poll);
    db.removeChannel(ch);
  };
}
