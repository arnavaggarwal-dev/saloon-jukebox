# 🤠 Saloon Jukebox

A collaborative web jukebox with an old-west saloon skin. Open the link, browse
the records, drop one in the queue — everyone connected hears the same track at
the same moment.

**▶ Live: https://arnavaggarwal-dev.github.io/saloon-jukebox-ai-PoC/**

No account, no app, no paid service anywhere in the stack.

| | |
|---|---|
| Frontend | React + Vite + Tailwind, plain JavaScript |
| Output | **one self-contained `index.html`** (~554 KB) |
| Audio | the browser's native `<audio>` element |
| Backend | Supabase (Postgres + Realtime) |
| Music | 16 tracks, CC BY 4.0 |
| UI | [React Bits](https://reactbits.dev) — spiral library, drifting wall, option wheel, strands visualiser, three cursors |

## The standalone file

`npm run build` produces **`dist/index.html`** with React, every component and
all the CSS inlined — no bundle beside it, no build step to open it. Download
that one file and it works: it talks to Supabase over `fetch` and a WebSocket,
and pulls audio and artwork from `VITE_MEDIA_BASE`. That file is committed, so
you can grab it straight from the repo.

## Features

- **A spiral of records** — the library is an `InfiniteSpiral` of covers.
  **Drag one onto the queue**, or click it.
- **Shared queue** — anyone with the link adds records; everyone sees it instantly.
- **A strands visualiser** behind Now Playing that answers to the music, a
  drifting wall of recently played, an option wheel for genre, and three
  switchable cursor effects (glow, target, swarm).
- **Synchronized playback** — clients agree not just on *what* is playing but
  *where* in the song, so you drop in mid-track like walking into a bar.
- **Real audio** — one `<audio>` element actually loading and decoding MP3s.
- **Play, pause, skip, previous, seek** — all shared. **Volume is local**, so
  turning yourself down never turns anyone else down.
- **Automatic advancement**, exactly once no matter how many browsers watch.
- Instant search, no accounts, responsive, keyboard-reachable, graceful errors.

## Quick start

```bash
npm install
cp .env.example .env.local     # add your Supabase URL + anon key
npm run dev
```

| Command | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | build to `dist/` |
| `npm run preview` | serve the build |
| `npm test` | Playwright end-to-end suite |
| `npm run generate` | rebuild covers, `seed.sql`, `setup.sql`, `MUSIC_LICENSES.md` |

## Supabase setup

Free tier, no card.

1. Create a project at [supabase.com](https://supabase.com).
2. Paste all of [`supabase/setup.sql`](supabase/setup.sql) into the **SQL Editor**
   and press Run. It creates the schema, the functions, realtime and the 16
   tracks, and is safe to re-run.
3. Put the **Project URL** and **anon/publishable key** (Settings → API Keys)
   in `.env.local`.

The anon key is *meant* to be public — it ships in the bundle. It's safe because
RLS gives it `SELECT` only, and every write goes through a `SECURITY DEFINER`
function. A direct `POST /rest/v1/queue` returns `42501`. **Never** put the
`service_role` key in this project.

## How it works

```text
  Browser A         Browser B         Browser C
      │                 │                 │
      │   React UI + one <audio> each     │
      └────────┬────────┴────────┬────────┘
         writes: RPC        reads: Realtime
               │                  │
        ┌──────┴──────────────────┴──────┐
        │  Supabase / Postgres           │
        │    songs                       │
        │    queue     ordered + status  │
        │    playback  ← ONE row: truth  │
        │                                │
        │  jukebox_state / add / remove  │
        │  advance / previous / seek     │
        │  set_playing     (all atomic)  │
        └────────────────────────────────┘
```

### The hard part

Every browser has its own `<audio>`. When a song ends they *all* fire `ended`
and all try to advance. Done naively, five tabs skip five songs.

The fix is a compare-and-set under a row lock:

```sql
select current_queue_id into v_current from public.playback where id = 1 for update;
if v_current is distinct from p_expected_current_id then
  return public.jukebox_state();   -- someone already advanced; do nothing
end if;
```

Each client passes the entry it *believes* is playing. The lock serialises
callers; the first advances, the rest become no-ops. No leader election, no host
client. Verified: 20 simultaneous `advance` calls move the queue exactly one
track; 16 simultaneous adds produce 16 distinct positions.

### Staying in step

`playback` stores a playhead plus when it was set, so any client can compute
where the needle should be:

```js
expected = position_seconds + (is_playing ? serverNow - position_updated_at : 0)
```

`jukebox_state()` returns the server clock too, so each client corrects its own
skew. A loop nudges the local element back when it drifts >2.5s, and stands down
while a seek is still in flight. If the browser that was playing just closes, a
watchdog on any other client calls the same idempotent `advance`.

### Files

```text
src/
  App.jsx           the whole UI
  usePlayer.js      shared state, the <audio> element, clock sync, watchdog
  jukebox.js        Supabase over fetch + WebSocket (no client library)
  main.jsx          entry
  reactbits/        InfiniteSpiral · DriftWall · OptionWheel · Strands
                    GlowCursor · TargetCursor · SwarmCursor · ElasticSlider
supabase/
  migrations/       001 schema · 002 previous-track
  setup.sql         both + seed, generated, for one paste
scripts/
  generate.mjs      covers, seed, setup.sql, MUSIC_LICENSES.md
  library.source.json
tests/jukebox.spec.js
```

## Music licensing

All 16 tracks are by **Kevin MacLeod** ([incompetech.com](https://incompetech.com/music/royalty-free/music.html))
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), which permits
redistribution with attribution — the thing this project needs, and the thing
"free to listen to" does *not* grant. Per-track detail is in
[MUSIC_LICENSES.md](MUSIC_LICENSES.md); credit also appears in the app.

Cover art is generated by `scripts/generate.mjs`, so there's no third-party
image licence to honour.

**Adding music:** drop it in `public/music/`, add an entry to
`scripts/library.source.json`, run `npm run generate`, apply `seed.sql`, and
record the licence. No nameable redistribution licence, no track. Don't rip from
Spotify, Apple Music or YouTube.

## Deployment

`.github/workflows/deploy.yml` publishes to GitHub Pages on push to `main`.
Set **Settings → Pages → Source: GitHub Actions**, and add repo secrets
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Vercel/Netlify/Cloudflare work unchanged: build `npm run build`, output `dist`.
The media (`music/`, `covers/`) is copied next to the file so `VITE_MEDIA_BASE`
resolves; point that variable elsewhere to host the audio somewhere else.

## Testing

```bash
E2E_SUPABASE_URL=… E2E_SUPABASE_ANON_KEY=… npm test
```

Chromium, desktop and mobile viewports. Asserts the real things: the element
loads and decodes the MP3, `readyState ≥ 2`, no `MediaError`, the playhead
advances, pause actually stops it, a finished track advances the queue, and two
*independent browser contexts* see one queue.

> ⚠️ Don't point the suite at a jukebox people are listening to — it skips
> tracks and drains the queue between cases, which sounds exactly like a bug.

## Credits

Music by Kevin MacLeod (CC BY 4.0). UI components adapted from
[React Bits](https://reactbits.dev) (MIT): InfiniteSpiral, DriftWall, OptionWheel, Strands,
ElasticSlider, and three cursors. Two carry local fixes: `ElasticSlider` gained
an `onChange` plus keyboard and ARIA slider semantics (it reported nothing and
was pointer-only, so volume was unreachable), and `InfiniteSpiral` gained an
`itemProps` hook so its cards can carry drag handlers. Icons by
[Lucide](https://lucide.dev). Type: Rye, Oswald, Inter.

## License

Code and generated artwork: [MIT](LICENSE). Audio: CC BY 4.0, see
[MUSIC_LICENSES.md](MUSIC_LICENSES.md) — forking the code doesn't relicense the
music.
