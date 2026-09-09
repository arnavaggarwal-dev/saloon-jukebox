import { useMemo, useState } from 'react';
import { Disc3, ListPlus, Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';

import ElasticSlider from './ElasticSlider';
import ShinyText from './ShinyText';
import SpotlightCard from './SpotlightCard';
import StarBorder from './StarBorder';
import { asset, configured, time } from './jukebox';
import { usePlayer } from './usePlayer';

export default function App() {
  const [q, setQ] = useState('');
  const p = usePlayer();

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s
      ? p.songs
      : p.songs.filter((x) =>
          [x.title, x.artist, x.album, x.genre].some((f) => (f ?? '').toLowerCase().includes(s)),
        );
  }, [p.songs, q]);

  if (!configured) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <p className="max-w-sm text-parchment-300">
          No Supabase credentials. Copy <code className="text-brass-300">.env.example</code> to{' '}
          <code className="text-brass-300">.env.local</code>, fill it in, and restart. See the README.
        </p>
      </main>
    );
  }

  const song = p.entry?.song;

  return (
    <div className="min-h-dvh pb-28" data-ready={p.busy ? 'no' : 'yes'}>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-brass-600/20 bg-wood-950/85 px-4 py-3 backdrop-blur">
        <Disc3 className="size-6 shrink-0 text-brass-400" style={{ animation: 'spin 8s linear infinite' }} aria-hidden="true" />
        <h1 className="font-display text-lg">
          <ShinyText text="Saloon Jukebox" />
        </h1>
        <span className="ml-auto flex items-center gap-2 text-[10px] tracking-[0.2em] text-parchment-400 uppercase">
          <span className={`size-2 rounded-full ${p.status === 'live' ? 'bg-sage-400' : 'bg-brass-500'}`} />
          {p.status === 'live' ? 'Live' : 'Connecting'}
        </span>
        <span className="hidden text-xs text-parchment-400 sm:inline">{p.guest}</span>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        {/* Now playing */}
        <section className="rounded-xl border border-brass-600/25 bg-wood-850/70 p-5 lg:col-span-2" aria-label="Now playing">
          {song ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <img src={asset(song.cover_url)} alt={`${song.title} cover`} className="w-40 rounded-lg shadow-lg" />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="mb-1 text-[10px] tracking-[0.28em] text-brass-400 uppercase">
                  {p.playing ? 'Now Playing' : 'Paused'}
                </p>
                <h2 className="truncate font-display text-2xl">{song.title}</h2>
                <p className="text-parchment-400">{song.artist}</p>
                {p.entry.added_by && (
                  <p className="mt-1 text-xs text-parchment-400/70">
                    requested by <span className="text-brass-400">{p.entry.added_by}</span>
                  </p>
                )}
                {p.err && (
                  <p role="alert" className="mt-3 text-sm text-oxblood-400">
                    {p.err} <button onClick={p.skip} className="underline">Skip</button>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="py-10 text-center font-display text-xl text-brass-300">
              {p.busy ? 'Opening the saloon…' : 'The jukebox is quiet — pick a record.'}
            </p>
          )}
        </section>

        {/* Library */}
        <section aria-label="Music library" className="rounded-xl border border-brass-600/25 bg-wood-850/70 p-4">
          <input
            aria-label="Search the library"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, artist, album…"
            className="mb-3 w-full rounded-full border border-brass-600/25 bg-wood-900/70 px-4 py-2 text-sm outline-none focus:border-brass-500"
          />
          {found.length === 0 ? (
            <p className="py-8 text-center text-sm text-parchment-400">No tracks found.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {found.map((s) => (
                <li key={s.id}>
                  <SpotlightCard className={`rounded-lg border p-2 ${s.id === song?.id ? 'border-brass-400/60' : 'border-brass-600/20'}`}>
                    <img src={asset(s.cover_url)} alt={`${s.title} cover`} loading="lazy" className="mb-2 aspect-square w-full rounded object-cover" />
                    <p className="truncate text-sm font-medium" title={s.title}>{s.title}</p>
                    <p className="truncate text-xs text-parchment-400">{s.genre} · {time(s.duration)}</p>
                    <button
                      onClick={() => { p.add(s.id); p.say(`Added “${s.title}”`); }}
                      aria-label={`Add ${s.title} to the queue`}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-full border border-brass-500/45 bg-brass-500/10 py-1.5 text-xs font-semibold text-brass-300 uppercase transition hover:bg-brass-500/25"
                    >
                      <ListPlus className="size-3" aria-hidden="true" /> Queue
                    </button>
                  </SpotlightCard>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-brass-600/15 pt-3 text-[11px] text-parchment-400/70">
            Music by <a className="text-brass-400 underline" href="https://incompetech.com/music/royalty-free/music.html">Kevin MacLeod</a>,{' '}
            <a className="text-brass-400 underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </p>
        </section>

        {/* Queue */}
        <section aria-label="Up next" className="rounded-xl border border-brass-600/25 bg-wood-850/70 p-4">
          <h2 className="mb-3 text-[11px] tracking-[0.28em] text-brass-300 uppercase">
            Up Next · {p.upNext.length}
          </h2>
          {p.upNext.length === 0 ? (
            <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-parchment-400">
              <Music2 className="size-6 text-brass-500/60" aria-hidden="true" />
              The queue is empty.
            </p>
          ) : (
            <ol data-testid="up-next" className="space-y-2">
              {p.upNext.map((e, i) => (
                <li key={e.id} className="group flex items-center gap-2 rounded-lg border border-brass-600/20 bg-wood-900/50 p-2">
                  <span className="w-4 text-center text-xs text-brass-400/70">{i + 1}</span>
                  <img src={asset(e.song.cover_url)} alt="" className="size-9 rounded object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{e.song.title}</span>
                    <span className="block truncate text-[11px] text-parchment-400">{e.added_by}</span>
                  </span>
                  <button onClick={() => p.remove(e.id)} aria-label={`Remove ${e.song.title} from the queue`} className="rounded-full p-1 text-parchment-400 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-oxblood-400">
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>

      {/* Player */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-brass-600/25 bg-wood-900/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <span className="hidden min-w-0 flex-1 truncate text-xs text-parchment-400 sm:block">
            {song ? `${song.title} — ${song.artist}` : 'Nothing on the turntable'}
          </span>
          <button onClick={p.prev} disabled={!song} aria-label="Previous track" className="p-2 text-parchment-300 disabled:opacity-30 hover:text-brass-300">
            <SkipBack className="size-4" aria-hidden="true" />
          </button>
          <button onClick={p.toggle} aria-label={p.playing ? 'Pause for everyone' : 'Play for everyone'} className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-brass-300 to-brass-500 text-wood-950 transition active:scale-95">
            {p.playing ? <Pause className="size-5" fill="currentColor" aria-hidden="true" /> : <Play className="ml-0.5 size-5" fill="currentColor" aria-hidden="true" />}
          </button>
          <button onClick={p.skip} disabled={!song} aria-label="Skip to the next track" className="p-2 text-parchment-300 disabled:opacity-30 hover:text-brass-300">
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

          <button onClick={p.toggleMute} aria-label={p.muted ? 'Unmute' : 'Mute'} className="p-2 text-parchment-300 hover:text-brass-300">
            {p.muted || !p.vol ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
          </button>
          <div className="hidden w-28 md:block">
            <ElasticSlider value={p.muted ? 0 : p.vol} onChange={p.setVol} label="Volume (this browser only)" />
          </div>
        </div>
      </footer>

      {/* Browsers won't make noise before a gesture; this is that gesture. */}
      {p.gate && (
        <div role="dialog" aria-label="Start the jukebox" className="fixed inset-0 z-40 grid place-items-center bg-wood-950/85 p-6 text-center backdrop-blur-sm">
          <div>
            <h2 className="mb-4 font-display text-3xl">Saloon Jukebox</h2>
            <p className="mb-6 max-w-xs text-sm text-parchment-400">The queue is shared. Your volume is your own.</p>
            <StarBorder as="button" onClick={p.join}>
              <span className="font-sign tracking-[0.18em] uppercase">Play Jukebox</span>
            </StarBorder>
            {/* Never trap anyone behind this: browsing and queueing work fine
                without audio. */}
            <button onClick={p.browse} className="mt-5 block w-full text-xs text-parchment-400 underline decoration-dotted underline-offset-4 hover:text-brass-300">
              Just browsing — no sound
            </button>
          </div>
        </div>
      )}

      {p.toast && (
        <p role="status" className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-brass-500/45 bg-wood-800/95 px-4 py-2 text-sm shadow-lg">
          {p.toast}
        </p>
      )}

      {/* The one audio element for the whole app. */}
      <audio ref={p.audio} preload="auto" onEnded={p.onEnded} onError={p.onAudioError} />
    </div>
  );
}
