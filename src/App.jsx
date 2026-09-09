import { useEffect, useMemo, useRef, useState } from 'react';
import { ListPlus, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';

import ElasticSlider from './reactbits/ElasticSlider';
import GlowCursor from './reactbits/GlowCursor';
import InfiniteSpiral from './reactbits/InfiniteSpiral';
import Strands from './reactbits/Strands';
import SwarmCursor from './reactbits/SwarmCursor';
import TargetCursor from './reactbits/TargetCursor';
import { asset, configured, time } from './jukebox';
import { usePlayer } from './usePlayer';

const CURSORS = ['Off', 'Glow', 'Target', 'Swarm'];

/**
 * The bass meter, kept in its own component.
 *
 * Strands needs new props to animate, but re-rendering App for that would drag
 * the whole library through React sixty times a second. Sampling here — and
 * only when the level moves a visible amount — keeps the churn to this subtree.
 */
function BassStrand({ bassRef, playing }) {
  const [level, setLevel] = useState(0);
  const last = useRef(0);

  useEffect(() => {
    let raf;
    const tick = () => {
      const v = Math.round((bassRef.current ?? 0) * 20) / 20; // 0.05 steps
      if (v !== last.current) {
        last.current = v;
        setLevel(v);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bassRef]);

  return (
    <Strands
      colors={['#e0a94f']}
      count={1}
      speed={playing ? 0.35 + level * 0.9 : 0.04}
      amplitude={playing ? 0.35 + level * 2.2 : 0.12}
      waviness={0.8 + level * 1.4}
      thickness={0.55 + level * 0.5}
      glow={1.4 + level * 3.2}
      intensity={0.4 + level * 0.6}
      taper={2.4}
      spread={0.8}
      scale={1.5}
    />
  );
}

export default function App() {
  const p = usePlayer();
  const [q, setQ] = useState('');
  // Off by default: these are fullscreen WebGL/GSAP effects, and one shouldn't
  // tax a phone or a weak GPU unless the visitor asks for it.
  const [cursor, setCursor] = useState('Off');
  const [over, setOver] = useState(false); // queue is a drop target

  // Pointer effects are meaningless without a real pointer.
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(pointer: fine)');
    const sync = () => setFine(m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? p.songs.filter((s) => [s.title, s.artist, s.album, s.genre].some((f) => (f || '').toLowerCase().includes(t)))
      : p.songs;
  }, [p.songs, q]);

  // The spiral takes {id, src, alt, label}; everything else it needs comes back
  // to us through itemProps below.
  const spiral = useMemo(
    () => shown.map((s) => ({ id: s.id, src: asset(s.cover_url), alt: `${s.title} by ${s.artist}`, label: s.title })),
    [shown],
  );

  const drop = (id) => {
    const s = p.songs.find((x) => x.id === id);
    if (!s) return;
    p.add(id);
    p.say(`Added “${s.title}”`);
  };

  if (!configured) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center text-parchment-300">
        <p className="max-w-sm">
          No Supabase credentials. Copy <code className="text-brass-300">.env.example</code> to{' '}
          <code className="text-brass-300">.env.local</code>, fill it in, and rebuild. See the README.
        </p>
      </main>
    );
  }

  const song = p.entry?.song;

  return (
    <div className="min-h-dvh pb-28" data-backend="supabase">
      {/*
        Only one cursor effect runs at a time — they each take over the pointer.
        GlowCursor and SwarmCursor size themselves to their *container*
        (h-full w-full), so bare they collapse to nothing; this fixed,
        click-through layer is what makes them visible.
      */}
      {fine && (cursor === 'Glow' || cursor === 'Swarm') && (
        <div className="pointer-events-none fixed inset-0 z-[60] h-screen w-screen">
          {cursor === 'Glow' ? <GlowCursor /> : <SwarmCursor />}
        </div>
      )}
      {fine && cursor === 'Target' && <TargetCursor targetSelector=".cursor-target" spinDuration={2.5} />}

      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-brass-600/20 bg-wood-950/85 px-4 py-3 backdrop-blur">
        <h1 className="font-display text-lg text-brass-400">Saloon Jukebox</h1>

        <span className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-parchment-400 uppercase">
          <span className={`size-2 rounded-full ${p.status === 'live' ? 'bg-sage-400' : 'bg-brass-500'}`} />
          {p.status === 'live' ? 'Live' : 'Connecting'}
        </span>

        <label className={`ml-auto flex items-center gap-2 text-[10px] tracking-[0.16em] text-parchment-400 uppercase ${fine ? '' : 'hidden'}`}>
          Cursor
          <select
            value={cursor}
            onChange={(e) => setCursor(e.target.value)}
            aria-label="Cursor effect"
            className="cursor-target rounded-full border border-brass-600/35 bg-wood-800 px-2 py-1 text-[11px] tracking-normal text-parchment-100 normal-case"
          >
            {CURSORS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <span className="text-xs text-parchment-400">{p.guest}</span>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-4">
        {/* Now playing, over the Strands visualiser */}
        <section aria-label="Now playing" className="relative overflow-hidden rounded-xl border border-brass-600/25 bg-wood-850/70">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            {/* One strand, driven by the actual low end — it swells and glows
                with the bass like the needle on an amp. */}
            <Strands
              colors={['#e0a94f']}
              count={1}
              speed={p.playing ? 0.35 + p.bass * 0.9 : 0.04}
              amplitude={p.playing ? 0.35 + p.bass * 2.2 : 0.12}
              waviness={0.8 + p.bass * 1.4}
              thickness={0.55 + p.bass * 0.5}
              glow={1.4 + p.bass * 3.2}
              intensity={0.4 + p.bass * 0.6}
              taper={2.4}
              spread={0.8}
              scale={1.5}
            />
          </div>

          <div className="relative flex flex-col items-center gap-5 p-6 sm:flex-row sm:p-8">
            {song ? (
              <>
                <img src={asset(song.cover_url)} alt={`${song.title} cover`} className="w-36 rounded-lg shadow-[0_16px_40px_-10px_rgb(0_0_0/0.9)]" />
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="mb-1 text-[10px] tracking-[0.28em] text-brass-400 uppercase">
                    {p.playing ? 'Now Playing' : 'Paused'}
                  </p>
                  <h2 className="font-display text-2xl break-words">{song.title}</h2>
                  <p className="text-parchment-400">{song.artist}</p>
                  {p.entry.added_by && (
                    <p className="mt-1 text-xs text-parchment-400/75">
                      requested by <span className="text-brass-400">{p.entry.added_by}</span>
                    </p>
                  )}
                  {p.err && (
                    <p role="alert" className="mt-3 text-sm text-oxblood-400">
                      {p.err} <button onClick={p.skip} className="underline">Skip ahead</button>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="w-full py-8 text-center font-display text-xl text-brass-300">
                {p.busy ? 'Opening the saloon…' : 'The jukebox is quiet — drag a record over.'}
              </p>
            )}
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* The library, as a spiral of covers */}
          <section aria-label="Music library" className="rounded-xl border border-brass-600/25 bg-wood-850/70 p-3">
            <h2 className="mb-1 text-[10px] tracking-[0.28em] text-brass-300 uppercase">
              The Spiral · {shown.length} records
            </h2>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, artist, album…"
              aria-label="Search the library"
                            className="cursor-target mb-2 w-full rounded-full border border-brass-600/25 bg-wood-900/70 px-4 py-2 text-sm outline-none focus:border-brass-500"
            />
            <p className="mb-2 text-[11px] text-parchment-400/80">
              Drag a record onto the queue — or just click it.
            </p>
            {shown.length === 0 ? (
              <p className="py-16 text-center text-sm text-parchment-400">No tracks found.</p>
            ) : (
            <div className="h-[520px]">
              <InfiniteSpiral
                items={spiral}
                radius={260}
                cardWidth={104}
                cardHeight={104}
                cardsPerTurn={13}
                /* must exceed the scaled card height, or they stack on top of
                   each other instead of reading as a spiral */
                verticalSpacing={86}
                speed={0.3}
                centerScale={1.15}
                edgeFade={0.3}
                edgeBlur={2}
                pauseOnHover
                itemProps={(item) => ({
                  className: 'cursor-target cursor-grab active:cursor-grabbing',
                  draggable: true,
                  onDragStart: (e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  },
                  onClick: () => drop(item.id),
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Add ${item.label} to the queue`,
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(item.id); }
                  },
                })}
              />
            </div>
            )}
          </section>

          {/* Queue — the drop target */}
          <section
            aria-label="Up next"
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              drop(e.dataTransfer.getData('text/plain'));
            }}
            className={`rounded-xl border p-4 transition-colors ${
              over ? 'border-brass-300 bg-brass-500/15' : 'border-brass-600/25 bg-wood-850/70'
            }`}
          >
            <h2 className="mb-3 text-[11px] tracking-[0.28em] text-brass-300 uppercase">
              Up Next · {p.upNext.length}
            </h2>

            {p.upNext.length === 0 ? (
              <p className="py-10 text-center text-sm text-parchment-400">
                {over ? 'Drop it in…' : 'The queue is empty. Drag a record here.'}
              </p>
            ) : (
              <ol data-testid="up-next" className="max-h-[380px] space-y-2 overflow-y-auto">
                {p.upNext.map((e, i) => (
                  <li key={e.id} className="group flex items-center gap-2 rounded-lg border border-brass-600/20 bg-wood-900/50 p-2">
                    <span className="w-4 text-center text-xs text-brass-400/70">{i + 1}</span>
                    <img src={asset(e.song.cover_url)} alt="" className="size-9 rounded object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{e.song.title}</span>
                      <span className="block truncate text-[11px] text-parchment-400">{e.added_by}</span>
                    </span>
                    <button
                      onClick={() => p.remove(e.id)}
                      aria-label={`Remove ${e.song.title} from the queue`}
                      className="cursor-target rounded-full p-1 text-parchment-400 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-oxblood-400"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <p className="mt-3 border-t border-brass-600/15 pt-3 text-[11px] text-parchment-400/70">
              Music by <a className="text-brass-400 underline" href="https://incompetech.com/music/royalty-free/music.html">Kevin MacLeod</a>,{' '}
              <a className="text-brass-400 underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
            </p>
          </section>
        </div>

      </main>

      {/* Player bar */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-brass-600/25 bg-wood-900/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          <span className="hidden min-w-0 flex-1 truncate text-xs text-parchment-400 sm:block">
            {song ? `${song.title} — ${song.artist}` : 'Nothing on the turntable'}
          </span>

          <button onClick={p.prev} disabled={!song} aria-label="Previous track" className="cursor-target p-2 text-parchment-300 disabled:opacity-30 hover:text-brass-300">
            <SkipBack className="size-4" aria-hidden="true" />
          </button>
          <button
            onClick={p.toggle}
            aria-label={p.playing ? 'Pause for everyone' : 'Play for everyone'}
            className="cursor-target grid size-11 place-items-center rounded-full bg-gradient-to-br from-brass-300 to-brass-500 text-wood-950 transition active:scale-95"
          >
            {p.playing ? <Pause className="size-5" fill="currentColor" aria-hidden="true" /> : <Play className="ml-0.5 size-5" fill="currentColor" aria-hidden="true" />}
          </button>
          <button onClick={p.skip} disabled={!song} aria-label="Skip to the next track" className="cursor-target p-2 text-parchment-300 disabled:opacity-30 hover:text-brass-300">
            <SkipForward className="size-4" aria-hidden="true" />
          </button>

          <span className="w-9 text-right text-[11px] text-parchment-400 tabular-nums">{time(p.now)}</span>
          <input
            type="range" min={0} max={p.length || 1} step={0.5}
            value={p.scrub ?? Math.min(p.now, p.length || 1)}
            disabled={!song}
            aria-label="Seek within the current track"
            onChange={(e) => p.scrubTo(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-wood-600 accent-brass-400"
          />
          <span className="w-9 text-[11px] text-parchment-400 tabular-nums">{time(p.length)}</span>

          <button onClick={p.toggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'} className="cursor-target p-2 text-parchment-300 hover:text-brass-300">
            {p.muted || !p.vol ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
          </button>
          <div className="hidden w-32 md:block">
            <ElasticSlider
              defaultValue={(p.muted ? 0 : p.vol) * 100}
              startingValue={0}
              maxValue={100}
              leftIcon={<span className="text-[10px] text-parchment-400">–</span>}
              rightIcon={<span className="text-[10px] text-parchment-400">+</span>}
              onChange={(v) => p.setVol(v / 100)}
              ariaLabel="Volume (this browser only)"
            />
          </div>
        </div>
      </footer>

      {p.gate && (
        <div role="dialog" aria-label="Start the jukebox" className="fixed inset-0 z-50 grid place-items-center bg-wood-950/90 p-6 text-center backdrop-blur-sm">
          <div>
            <h2 className="mb-3 font-display text-3xl">Saloon Jukebox</h2>
            <p className="mx-auto mb-7 max-w-xs text-sm text-parchment-400">
              The queue is shared. Your volume is your own.
            </p>
            <button
              onClick={p.join}
              className="cursor-target rounded-full border border-brass-500/60 bg-wood-800 px-8 py-3 font-sign tracking-[0.18em] uppercase transition hover:bg-wood-700"
            >
              Play Jukebox
            </button>
            {/* Never trap anyone: browsing and queueing work without sound. */}
            <button onClick={p.browse} className="mt-5 block w-full text-xs text-parchment-400 underline decoration-dotted underline-offset-4 hover:text-brass-300">
              Just browsing — no sound
            </button>
          </div>
        </div>
      )}

      {p.toast && (
        <p role="status" className="fixed bottom-24 left-1/2 z-45 -translate-x-1/2 rounded-full border border-brass-500/45 bg-wood-800/95 px-4 py-2 text-sm shadow-lg">
          {p.toast}
        </p>
      )}

      {/* The one audio element for the whole app. */}
      <audio ref={p.audio} preload="auto" onEnded={p.onEnded} onError={p.onAudioError} />
    </div>
  );
}
