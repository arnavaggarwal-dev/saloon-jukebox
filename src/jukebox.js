// Everything that talks to Supabase, over plain fetch and one WebSocket.
//
// The queue lives in Postgres; each mutation is a single atomic SQL function,
// which is what stops two browsers fighting over it. Realtime is a Phoenix
// channel — spoken directly here, which is less code than the client library
// and keeps the bundled single file smaller. See supabase/setup.sql.

const URL_ = import.meta.env.VITE_SUPABASE_URL?.trim();
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const configured = Boolean(URL_ && KEY);

// Only the public anon key is ever here. RLS makes the tables read-only to it
// and writes go through SECURITY DEFINER functions, so it is safe to ship.
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

/**
 * Where the audio and artwork live.
 *
 * The database stores relative paths so it stays portable. Baking an absolute
 * base in at build time is what lets the single-file build work opened from
 * disk or hosted anywhere, without a music folder beside it. Set
 * VITE_MEDIA_BASE to point at your own copy.
 */
const MEDIA = (import.meta.env.VITE_MEDIA_BASE ?? '').replace(/\/$/, '');

/** Absolute URLs pass straight through; relative ones hang off MEDIA. */
export const asset = (p) => {
  if (!p) return '';
  if (/^(https?:)?\/\//.test(p)) return p;
  const rel = p.replace(/^\//, '');
  return MEDIA ? `${MEDIA}/${rel}` : `${import.meta.env.BASE_URL}${rel}`.replace(/([^:]\/)\/+/g, '$1');
};

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

/**
 * One RPC call, retried on a dropped connection or a server-side blip.
 *
 * Without this, a moment of bad wifi silently loses whatever you asked for —
 * and because adds are queued in order, a lost one lets the next take its
 * place, so your first pick quietly becomes someone's second. Client errors
 * (4xx) are not retried: those won't get better.
 */
async function rpc(fn, body = {}, tries = 3) {
  for (let i = 1; ; i++) {
    let res;
    try {
      res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    } catch (networkError) {
      if (i >= tries) throw networkError;
      await new Promise((r) => setTimeout(r, 250 * i));
      continue;
    }
    if (res.ok) return res.json();
    if (res.status < 500 || i >= tries) throw new Error(`${fn}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 250 * i));
  }
}

export const api = {
  songs: async () => {
    const r = await fetch(`${URL_}/rest/v1/songs?select=*&order=title`, { headers: H });
    if (!r.ok) throw new Error('songs');
    return r.json();
  },
  state: () => rpc('jukebox_state', {}, 3),
  // NOT retried: a repeat would queue the same record twice.
  add: (songId, by) => rpc('jukebox_add_to_queue', { p_song_id: songId, p_added_by: by }),
  remove: (id) => rpc('jukebox_remove_from_queue', { p_queue_id: id }, 3),
  // Safe to repeat: the expected-id check makes a second call a no-op.
  next: (expected) => rpc('jukebox_advance', { p_expected_current_id: expected }, 3),
  play: (on, at) => rpc('jukebox_set_playing', { p_is_playing: on, p_position_seconds: Math.max(0, at) }, 3),
  seek: (at) => rpc('jukebox_seek', { p_position_seconds: Math.max(0, at) }, 3),
  // Falls back to "restart track" if migration 002 isn't applied yet.
  prev: () => rpc('jukebox_previous').catch(() => rpc('jukebox_seek', { p_position_seconds: 0 })),
};

/**
 * Subscribe to queue/playback changes.
 *
 * Realtime only says *that* something changed; we re-read the authoritative
 * snapshot rather than patching rows locally. A slow poll runs alongside so a
 * silently stalled socket can't strand the queue.
 */
export function watch(onChange, onStatus) {
  let ws, hb, tries = 0, dead = false, t;
  const refresh = () => {
    clearTimeout(t);
    t = setTimeout(() => api.state().then(onChange).catch(() => onStatus('wait')), 80);
  };

  const open = () => {
    if (dead) return;
    ws = new WebSocket(`${URL_.replace('http', 'ws')}/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`);
    ws.onopen = () => {
      tries = 0;
      ws.send(JSON.stringify({
        topic: 'realtime:saloon', event: 'phx_join', ref: '1', join_ref: '1',
        payload: {
          config: { postgres_changes: [
            { event: '*', schema: 'public', table: 'queue' },
            { event: '*', schema: 'public', table: 'playback' },
          ] },
          access_token: KEY,
        },
      }));
      hb = setInterval(
        () => ws.readyState === 1 && ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(Date.now()) })),
        25_000,
      );
      onStatus('live');
      refresh();
    };
    ws.onmessage = (m) => {
      if (JSON.parse(m.data).event === 'postgres_changes') refresh();
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      clearInterval(hb);
      if (dead) return;
      onStatus('wait');
      setTimeout(open, Math.min(1000 * 2 ** tries++, 15_000));
    };
  };

  open();
  const poll = setInterval(refresh, 20_000);
  return () => {
    dead = true;
    clearTimeout(t);
    clearInterval(poll);
    clearInterval(hb);
    ws?.close();
  };
}
