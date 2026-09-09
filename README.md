# 🤠 Saloon Jukebox

A collaborative web jukebox with an old-west saloon skin. Open the link, browse
the records, drop one in the queue — everyone connected hears the same track at
the same moment.

**▶ Live: https://arnavaggarwal-dev.github.io/saloon-jukebox/**

No account, no app, no paid service anywhere in the stack.

| | |
|---|---|
| Frontend | React + Vite + Tailwind, plain JavaScript |
| Audio | the browser's native `<audio>` element |
| Backend | Supabase (Postgres + Realtime) |
| Music | 16 tracks, CC BY 4.0 |
| Size | 8 source files, ~600 lines |

## Features

- **Shared queue** — anyone with the link adds records; everyone sees it instantly.
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
  jukebox.js        Supabase client + queue/playback calls + realtime
  main.jsx          entry
  ShinyText.jsx  SpotlightCard.jsx  StarBorder.jsx  ElasticSlider.jsx
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
Serving from a domain root? Leave `VITE_BASE` unset.

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
[React Bits](https://reactbits.dev) (MIT): ShinyText, SpotlightCard, StarBorder,
ElasticSlider — the last gained a controlled value, keyboard support and ARIA
slider semantics, since the original was pointer-only. Icons by
[Lucide](https://lucide.dev). Type: Rye, Oswald, Inter.

## License

Code and generated artwork: [MIT](LICENSE). Audio: CC BY 4.0, see
[MUSIC_LICENSES.md](MUSIC_LICENSES.md) — forking the code doesn't relicense the
music.
