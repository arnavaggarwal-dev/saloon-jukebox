// Shared jukebox state + the single <audio> element.
//
// The database is the source of truth for what plays and where the needle is;
// this hook keeps the local element agreeing with it. Volume stays local.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, asset, guest, watch } from './jukebox';

const DRIFT = 2.5; // resync if we're further than this from the shared clock

// No callback prop: an inline arrow from the caller changes identity every
// render, which would tear down and rebuild the realtime subscription each
// time. Owning the message here keeps the effect's dependencies stable.
export function usePlayer() {
  const audio = useRef(null);
  const [songs, setSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [pb, setPb] = useState({ current_queue_id: null, is_playing: false, position_seconds: 0, position_updated_at: 0 });
  const [status, setStatus] = useState('wait');
  const [joined, setJoined] = useState(false);
  const [gate, setGate] = useState(true); // the one-tap audio unlock
  const [now, setNow] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(() => Number(localStorage.getItem('saloon:vol') ?? 0.8));
  const [muted, setMuted] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(true);
  const [toast, setToast] = useState(null);
  const [scrub, setScrub] = useState(null); // seek bar value while dragging

  const skew = useRef(0);      // server clock minus ours
  const seenAt = useRef(0);    // newest snapshot applied, to drop stale ones
  const held = useRef(null);   // a seek we've made that the server hasn't echoed
  const fired = useRef(null);  // one advance per track
  const scrubT = useRef(null);
  const name = useRef(guest());

  const say = useCallback((m) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 3000);
  }, []);

  const apply = useCallback((s) => {
    if (!s) return;
    const t = new Date(s.server_time).getTime();
    if (t < seenAt.current) return; // out-of-order response
    seenAt.current = t;
    skew.current = t - Date.now();
    setPb(s.playback);
    setQueue((s.queue ?? []).filter((e) => e.song));
    setBusy(false);
  }, []);

  const run = useCallback(
    (make) => Promise.resolve().then(make).then(apply).catch(() => say('The saloon wire is down. Retrying…')),
    [apply, say],
  );

  /**
   * Adds only: three quick clicks fired in parallel can reach the server in any
   * order and land in the queue shuffled, so they go one at a time. Transport
   * controls deliberately do *not* queue behind them — a pause should take
   * effect now, not after someone's pending additions.
   */
  const chain = useRef(Promise.resolve());
  const runOrdered = useCallback(
    (make) => (chain.current = chain.current.then(() => run(make))),
    [run],
  );

  useEffect(() => {
    api.songs().then(setSongs).catch(() => say("Couldn't load the records."));
    run(() => api.state());
    return watch(apply, setStatus);
  }, [apply, run, say]);

  /** Where the needle should be right now, per the shared clock. */
  const want = useCallback(() => {
    const base = Number(pb.position_seconds) || 0;
    if (!pb.is_playing) return base;
    return base + Math.max(0, Date.now() + skew.current - new Date(pb.position_updated_at).getTime()) / 1000;
  }, [pb]);

  const entry = queue.find((e) => e.id === pb.current_queue_id) ?? null;
  const upNext = queue.filter((e) => e.status === 'queued' && e.id !== pb.current_queue_id);
  const history = queue.filter((e) => e.status === 'played').slice(-12).reverse();
  const src = entry ? asset(entry.song.audio_url) : '';
  const length = dur || entry?.song.duration || 0;

  // Load a track, dropping in at the shared position like walking into the bar.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    setErr(null);
    setDur(0);
    if (!src) return void el.removeAttribute('src');
    el.src = src;
    const at = want();
    const onMeta = () => {
      setDur(el.duration || 0);
      if (at > 0.5 && at < el.duration) el.currentTime = at;
    };
    el.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => el.removeEventListener('loadedmetadata', onMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const el = audio.current;
    if (el) { el.volume = vol; el.muted = muted; }
    localStorage.setItem('saloon:vol', String(vol));
  }, [vol, muted]);

  // Follow the shared transport.
  useEffect(() => {
    const el = audio.current;
    if (!el || !src) return;
    if (pb.is_playing && joined) el.play().catch(() => setJoined(false));
    else el.pause();
  }, [pb.is_playing, pb.current_queue_id, joined, src]);

  // Sync loop: report progress, correct drift, and keep the queue moving.
  useEffect(() => {
    const el = audio.current;
    const id = setInterval(() => {
      const at = want();
      if (held.current && (Math.abs(at - held.current.to) < 2 || Date.now() > held.current.until)) held.current = null;
      const holding = Boolean(held.current) || scrub !== null;

      setNow(joined && el?.readyState ? el.currentTime : at);

      if (el && joined && pb.is_playing && !holding && el.readyState >= 2 && Math.abs(el.currentTime - at) > DRIFT) {
        el.currentTime = at;
      }
      // Whoever notices the track has run out proposes the move; the SQL
      // function makes sure only one of them actually takes effect.
      if (pb.is_playing && pb.current_queue_id && length && !holding && at > length + 1 && fired.current !== pb.current_queue_id) {
        fired.current = pb.current_queue_id;
        run(() => api.next(pb.current_queue_id));
      }
    }, 250);
    return () => clearInterval(id);
  }, [want, joined, pb, length, run, scrub]);

  useEffect(() => { fired.current = null; held.current = null; }, [pb.current_queue_id]);

  const join = async () => {
    setJoined(true);
    setGate(false);
    try { await audio.current?.play(); } catch { /* nothing queued yet */ }
    if (pb.current_queue_id && !pb.is_playing) run(() => api.play(true, want()));
  };

  return {
    audio, songs, queue, upNext, history, entry, status, busy, err, joined, gate,
    browse: () => setGate(false),
    playing: pb.is_playing, now, length, vol, muted, guest: name.current, toast, say,
    setVol: (v) => { setVol(v); if (v > 0) setMuted(false); },
    toggleMute: () => setMuted((m) => !m),
    add: (id) => runOrdered(() => api.add(id, name.current)),
    remove: (id) => run(() => api.remove(id)),
    skip: () => run(() => api.next(pb.current_queue_id)),
    prev: () => (want() > 4 ? run(() => api.seek(0)) : run(() => api.prev())),
    toggle: () => (joined ? run(() => api.play(!pb.is_playing, want())) : join()),
    scrub,
    /**
     * Hold the bar's value locally, then send one seek once the user settles.
     *
     * The bar is a controlled input, so without this a re-render between the
     * `input` and `change` events resets it and we send the *old* position —
     * the seek appears to do nothing. Debouncing also means dragging sends one
     * request instead of fifty.
     */
    scrubTo: (v) => {
      setScrub(v);
      clearTimeout(scrubT.current);
      scrubT.current = setTimeout(() => {
        setScrub(null);
        held.current = { to: v, until: Date.now() + 10000 };
        if (audio.current?.readyState) audio.current.currentTime = v;
        run(() => api.seek(v));
      }, 180);
    },
    onEnded: () => run(() => api.next(pb.current_queue_id)),
    onAudioError: () => setErr("Couldn't play this record. Try skipping ahead."),
    join,
  };
}
