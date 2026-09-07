# 🤠 Saloon Jukebox

A collaborative web jukebox with a stylized old-west saloon skin. Open the link,
browse the saloon's records, drop one in the queue — everyone connected hears
the same track at the same moment.

**No account. No app. No paid service anywhere in the stack.**

> **Live demo:** _see the Deployment section — the URL is printed by the Pages workflow._

<!-- prettier-ignore -->
| | |
|---|---|
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS v4 |
| **Audio** | The browser's native `<audio>` element |
| **Backend** | Supabase (Postgres + Realtime) |
| **Hosting** | GitHub Pages (any static host works) |
| **Music** | 16 tracks, Creative Commons Attribution 4.0 |
| **Cost** | $0 — every tier used here is free |

---

## Features

- **Shared queue.** Anyone with the link can add a record. Everyone sees it
  appear instantly, with no refresh.
- **Genuinely synchronized playback.** Clients don't just agree on _what_ is
  playing, they agree on _where_ in the song. Walk in halfway through a track
  and you drop in at the right moment.
- **Real audio.** One `<audio>` element, actually loading and decoding MP3s.
  Nothing about the player is faked.
- **Full transport** — play, pause, previous, skip, seekable progress bar, and
  volume. Play/pause/skip/seek are shared; **volume is local to your browser**,
  so turning yourself down never turns anyone else down.
- **Automatic advancement.** When a track ends the queue moves on by itself —
  and it does so exactly once, no matter how many browsers are watching (see
  [Architecture](#architecture)).
- **Instant search** across title, artist, album and genre, plus genre filters.
- **No accounts.** You get a random handle like `Ranger17` so your additions are
  attributable in the queue. No personal data is collected.
- **Request line.** A wall for "what should we play next?" notes.
- **Responsive** from a 390px phone to a widescreen desktop.
- **Accessible** — semantic controls, keyboard shortcuts, visible focus rings,
  labelled sliders, alt text, and respect for `prefers-reduced-motion`.
- **Degrades gracefully.** Missing audio, a dropped socket, a blocked autoplay,
  an empty queue — each has a real, human-readable state.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause (shared) |
| `N` or `Shift`+`→` | Skip to next |
| `M` | Mute / unmute (local) |
| `←` `→` on the seek bar | Scrub |

---

## Quick start

```bash
git clone https://github.com/arnavaggarwal-dev/saloon-jukebox.git
cd saloon-jukebox
npm install
npm run dev
```

Open http://localhost:5173.

**It works immediately with no configuration.** With no Supabase credentials the
app runs on a local fallback backend that keeps the queue in sync between tabs
of the same browser — enough to see the whole thing working. To share a queue
across *devices*, set up Supabase below.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check and build to `dist/` |
| `npm run build:local` | Build ignoring Supabase creds (forces fallback mode) |
| `npm run preview` | Serve the production build |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run build:library` | Regenerate `songs.json`, `seed.sql`, `MUSIC_LICENSES.md` |
| `npm run build:covers` | Regenerate the album artwork SVGs |
| `npm run lint` | oxlint |

---

## Supabase setup

The free tier is enough. No card required.

**1. Create a project** at [supabase.com](https://supabase.com) → *New project*.
Keep the database password for yourself; this app never needs it.

**2. Run the schema.** Open the project's **SQL Editor**, paste the whole of
[`supabase/setup.sql`](supabase/setup.sql), and press **Run**. That single file
contains both the schema and the 16-track seed, and is safe to run repeatedly.

<details>
<summary>Prefer to run the pieces separately?</summary>

```
supabase/migrations/001_initial_schema.sql   tables, RLS, functions, realtime
supabase/seed.sql                            the library
```

With the Supabase CLI: `supabase db push`, then apply the seed.
</details>

**3. Point the app at it.** Copy the credentials from
**Project Settings → API Keys**:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # or the older eyJ... anon key
```

**4. Restart `npm run dev`.** The header pill should read **LIVE**, and the
"this browser only" badge should disappear.

**Realtime needs no dashboard clicking** — the migration adds `queue`,
`playback` and `requests` to the `supabase_realtime` publication itself.

### A note on keys

The **anon / publishable** key is *designed* to be public: it is compiled into
the JavaScript bundle that every visitor downloads. It is safe here because:

- RLS is on for every table, and the anon role gets **`SELECT` only**.
- Every mutation goes through a `SECURITY DEFINER` function that validates its
  input and takes a row lock. There is no path from the browser to an arbitrary
  write. (Try it: a direct `POST /rest/v1/queue` returns `42501`.)

**Never put the `service_role` key in this project.** It bypasses RLS entirely
and would let any visitor do anything.

---

## Architecture

```text
   Browser A            Browser B            Browser C
      │                     │                    │
      │  React UI + one <audio> element each     │
      │                     │                    │
      └──────────┬──────────┴─────────┬──────────┘
                 │                    │
         writes: RPC only      reads: Realtime push
                 │                    │
                 ▼                    ▼
        ┌────────────────────────────────────┐
        │            Supabase                │
        │                                    │
        │  Postgres                          │
        │    songs     the library           │
        │    queue     ordered, with status  │
        │    playback  ← ONE row: the truth  │
        │    requests  the wish wall         │
        │                                    │
        │  SECURITY DEFINER functions        │
        │    jukebox_state()                 │
        │    jukebox_add_to_queue()          │
        │    jukebox_remove_from_queue()     │
        │    jukebox_advance()      ← atomic │
        │    jukebox_set_playing()           │
        │    jukebox_seek()                  │
        │                                    │
        │  Realtime  → change notifications  │
        └────────────────────────────────────┘
```

### The one genuinely hard problem

Every browser has its own `<audio>` element. When a song ends, *all of them*
fire `ended` at roughly the same instant and all want to advance the queue. Done
naively, five open tabs skip five songs.

The fix is a compare-and-set, in one atomic statement:

```sql
select current_queue_id into v_current from public.playback where id = 1 for update;

if v_current is distinct from p_expected_current_id then
  return public.jukebox_state();   -- someone already advanced; do nothing
end if;
```

Each client passes the entry it *believes* is playing. The row lock serialises
every caller; the first one through advances, and everyone else discovers their
expectation is stale and becomes a no-op. No leader election, no host client, no
lock table.

> Verified, not assumed: firing 20 simultaneous `jukebox_advance` calls against
> a 9-track queue advances the queue **exactly one** track. 16 simultaneous adds
> produce 16 distinct queue positions.

### Keeping the needle in the same place

The `playback` row stores a playhead plus the moment it was set. Any client can
compute where the song should be right now:

```ts
expected = position_seconds + (is_playing ? serverNow - position_updated_at : 0)
```

`jukebox_state()` returns the server's clock alongside the data, so each client
measures its own skew and corrects for it — a browser with a wrong system clock
still lands in the right place. A loop nudges the local element back whenever it
drifts more than 2.5s, and stands down briefly after a user seek so it doesn't
fight a change that hasn't finished its round trip.

If the browser that was playing simply closes, a watchdog on any remaining
client notices the expected position has run past the end and calls the same
idempotent `advance`. The music keeps going.

### Autoplay

Browsers refuse to make sound before a user gesture, so the first visit shows a
**PLAY JUKEBOX** door. It is not a wall: *"Just browsing"* dismisses it, and you
can still search and queue records silently. If the browser cuts audio off later,
the prompt returns instead of the app failing quietly.

### Project layout

```text
src/
├── components/
│   ├── reactbits/          vendored React Bits components (see Credits)
│   ├── Background.tsx      Topography shader + film grain
│   ├── Header.tsx          wordmark, connection pill, guest handle
│   ├── NowPlaying.tsx      artwork, split-flap title, progress
│   ├── MusicLibrary.tsx    search, genre filters, grid
│   ├── TrackCard.tsx       one record + "add to queue"
│   ├── Queue.tsx           up next + recently played
│   ├── PlayerBar.tsx       transport, seek, volume
│   ├── Scrubber.tsx        accessible seek bar
│   ├── RequestLine.tsx     the wish wall
│   ├── JoinOverlay.tsx     the autoplay gate
│   ├── FlapBoard.tsx       auto-sizing split-flap wrapper
│   ├── EmptyState.tsx      · Toast.tsx
├── hooks/
│   ├── useJukebox.ts       shared state: library, queue, playback, realtime
│   ├── useAudioPlayer.ts   drives the single <audio>, clock sync, watchdog
│   └── useToast.tsx
├── lib/
│   ├── backend/            the swappable backend
│   │   ├── types.ts        the contract both implement
│   │   ├── supabaseBackend.ts
│   │   └── localBackend.ts zero-config cross-tab fallback
│   ├── supabase.ts  · audio.ts  · guest.ts
├── data/songs.json         the library (generated)
└── types/database.ts

supabase/
├── migrations/001_initial_schema.sql
├── seed.sql                (generated)
└── setup.sql               (generated) both of the above, for one paste

scripts/
├── library.source.json     catalogue metadata — the source of truth
├── build-library.mjs       → songs.json, seed.sql, MUSIC_LICENSES.md
└── generate-covers.mjs     → public/covers/*.svg

tests/jukebox.spec.ts       end-to-end suite
```

### Why two backends?

`JukeboxBackend` is a small interface with one implementation per environment.
`localBackend` (localStorage + `BroadcastChannel`) means a fresh clone is never
a dead page, and the e2e suite can run without credentials. `supabaseBackend` is
the real one. The UI can't tell them apart; the header says which is active so
nobody is misled about whether the queue really crosses devices.

---

## Music licensing

**Every track ships under Creative Commons Attribution 4.0**, which explicitly
permits redistribution — the thing this project actually needs, and the thing
"free to listen to" does *not* give you.

- **Composer:** Kevin MacLeod
- **Source:** [incompetech.com](https://incompetech.com/music/royalty-free/music.html) — the composer's own site
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Modification:** files were re-encoded to 128 kbps MP3 for web delivery

Full per-track attribution, source URLs and ISRCs are in
**[MUSIC_LICENSES.md](MUSIC_LICENSES.md)**. Attribution also appears in the app
itself, under the library.

The album artwork is **not** third-party art — `scripts/generate-covers.mjs`
draws it from scratch, so there is no image license to honour.

### Adding your own music

1. Drop the audio in `public/music/`.
2. Add an entry to `scripts/library.source.json`.
3. `npm run build:library && npm run build:covers`.
4. Apply the regenerated `supabase/seed.sql`.
5. **Record the license in `MUSIC_LICENSES.md`.**

If you can't name a license that permits redistribution, don't add the track.
Do not rip from Spotify, Apple Music or YouTube — none of that is licensed for
this, and this project will not help you do it.

---

## Deployment

### GitHub Pages (configured here)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (Stored as secrets for tidiness. They aren't really secret — they ship in the
   bundle. Omit them and the site deploys in fallback mode.)
3. Push. The workflow prints the URL.

The workflow sets `VITE_BASE=/<repo-name>/` so assets resolve under the project
path, writes `.nojekyll`, and copies `index.html` to `404.html` for deep links.

### Vercel / Netlify / Cloudflare Pages

All work unchanged — the output is plain static files.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Serving from a domain root? Leave `VITE_BASE` unset; it defaults to `/`.

Audio lives in `public/music/` (~49 MB) and deploys with the frontend — the
simplest thing that works. If your library outgrows static hosting, move the
files to Supabase Storage and put the absolute URL in `songs.audio_url`;
`resolveAssetUrl()` already passes absolute URLs straight through.

---

## Testing

```bash
npm run build:local && npm run test:e2e     # fallback backend
npm run build && npm run test:e2e           # against your Supabase project
```

Run on Chromium at desktop (1440×900) and mobile (Pixel 7) viewports. The suite
covers what actually matters rather than snapshotting markup:

- **Audio is real** — the element loads the MP3, `readyState ≥ 2`, no
  `MediaError`, decoded duration matches the file, and `currentTime` advances.
- Pause genuinely stops the element; seek moves it; mute is local.
- A track ending advances the queue on its own.
- A 404 on an audio file surfaces a readable error and an escape hatch.
- Queue order, duplicates, and removal.
- **Two clients see one queue** — and with credentials set, a second spec runs
  two *independent browser contexts* (no shared storage at all) to prove the
  sync is genuinely server-side.
- Controls are labelled and keyboard-reachable; no horizontal overflow.

> ⚠️ **Don't point the suite at a project people are listening to.** The specs
> skip tracks and drain the queue between cases, and the queue is genuinely
> shared — anyone connected will hear songs cut off after a few seconds. Use a
> separate Supabase project for testing, or run `npm run build:local` and test
> against the fallback backend.

To run the cross-browser realtime spec, export the credentials so the harness
can reset the shared queue between tests:

```bash
export E2E_SUPABASE_URL=https://YOURPROJECT.supabase.co
export E2E_SUPABASE_ANON_KEY=sb_publishable_...
npm run test:e2e
```

The queue-advance concurrency guarantees were verified separately against a real
Postgres — see [Architecture](#the-one-genuinely-hard-problem).

---

## Credits

- **Music** — Kevin MacLeod, [incompetech.com](https://incompetech.com), CC BY 4.0.
- **UI components** — several are adapted from
  [React Bits](https://reactbits.dev) (MIT): `Topography`, `Noise`,
  `ClickSpark`, `Magnet`, `StarBorder`, `GlareHover`, `SplitFlapText`,
  `ShinyText`, `CountUp`, `RotatingText`, `SpotlightCard`, `ElasticSlider`.
  Two carry local fixes, noted in their file headers: `ElasticSlider` gained a
  controlled `value`/`onChange` plus keyboard and ARIA slider semantics (it was
  pointer-only), and `CountUp` no longer resets to zero on every update.
- **Icons** — [Lucide](https://lucide.dev) (ISC).
- **Type** — Rye, Oswald and Inter via Google Fonts.

## License

Code and generated artwork: [MIT](LICENSE).
Audio: CC BY 4.0 — see [MUSIC_LICENSES.md](MUSIC_LICENSES.md). The two are
separate; forking the code does not relicense the music.
