/**
 * Generates everything derived from `scripts/library.source.json`:
 *
 *   public/covers/*.svg   original artwork (so no third-party image licensing)
 *   supabase/seed.sql     the songs table contents
 *   supabase/setup.sql    migrations + seed, for one paste into the SQL editor
 *   MUSIC_LICENSES.md     per-track attribution, as CC BY 4.0 requires
 *
 *   npm run generate
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(resolve(root, 'scripts/library.source.json'), 'utf8'));

/* ---------------------------------------------------------------- helpers */

/** Stable UUIDv5-style id, so re-running never duplicates a row. */
function uuidFor(slug) {
  const b = createHash('sha1')
    .update(Buffer.from('9f1b7c4e3a2d4b6f8e105c7a2d9b4e30', 'hex'))
    .update(slug)
    .digest()
    .subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Buffer.from(b).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Real decoded length beats the catalogue's rounded value. */
function probe(file) {
  try {
    const n = Math.round(
      Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim()),
    );
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

const sql = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The catalogue's own genres are coarse ("Unclassifiable", "World"), which
 * browses badly. These describe what each track actually sounds like.
 */
const GENRE = {
  'whiskey-on-the-mississippi': 'Blues', 'fig-leaf-rag': 'Ragtime', 'olde-timey': 'Ragtime',
  'barroom-ballet': 'Ragtime', 'hillbilly-swing': 'Bluegrass', 'drankin-song': 'Folk',
  'guts-and-bourbon': 'Country Rock', "matt-s-blues": 'Blues', 'southern-gothic': 'Southern Gothic',
  darxieland: 'Dixieland', 'lost-frontier': 'Western', 'neo-western': 'Western',
  'river-valley-breakdown': 'Bluegrass', cattails: 'Folk', 'still-pickin': 'Bluegrass',
  'fiddles-mcginty': 'Celtic',
};

const songs = source.map((t) => {
  const file = resolve(root, 'public/music', `${t.slug}.mp3`);
  if (!existsSync(file)) console.warn(`  ! missing audio: public/music/${t.slug}.mp3`);
  return {
    id: uuidFor(t.slug),
    slug: t.slug,
    title: t.title,
    artist: t.artist,
    album: /not in a collection|^misc$|^unclassifiable$/i.test(t.album ?? '') ? null : t.album,
    genre: GENRE[t.slug] ?? t.genre ?? null,
    duration: (existsSync(file) && probe(file)) || t.duration,
    audio_url: `music/${t.slug}.mp3`,
    cover_url: `covers/${t.slug}.svg`,
  };
});

/* ----------------------------------------------------------------- covers */

/** [card, label ink, paper, brass] — warm saloon palettes. */
const PALETTES = [
  ['#2A1810', '#8C3A22', '#F6E7CE', '#E0A94F'], ['#231A11', '#6B4E1E', '#F7EBD6', '#D9A441'],
  ['#1E1512', '#7A2E2A', '#F5E3D0', '#C9963F'], ['#2B2015', '#4F5B37', '#F4EDDA', '#DCB262'],
  ['#241611', '#93502A', '#F8EAD4', '#E8BC6B'], ['#1C1512', '#3F4A55', '#EFE6D6', '#C6A052'],
  ['#2E1D14', '#A05829', '#FBEFD9', '#F0C878'], ['#1F1710', '#5C3A5A', '#F2E6D8', '#D2A75C'],
  ['#261A12', '#8A6220', '#F9EEDA', '#E9C46A'], ['#1A1310', '#6E2F35', '#F3E2D2', '#CDA04A'],
  ['#2C2118', '#3E5B4C', '#F4EBD9', '#DDB55E'], ['#221812', '#7E4420', '#F7E9D3', '#E5B457'],
  ['#1D1611', '#55432C', '#F1E7D5', '#C9A661'], ['#2A1C13', '#96442C', '#FAEDD8', '#EEC377'],
  ['#201812', '#44503A', '#F2EAD7', '#D4AC55'], ['#251A15', '#6D3524', '#F6E6D1', '#DFAE60'],
];

/** Deterministic, so a slug always renders the same cover. */
const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

function wrap(text, max, maxLines) {
  const lines = [];
  let line = '';
  for (const w of text.toUpperCase().split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > max && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function cover(song, i) {
  const [card, label, paper, brass] = PALETTES[i % PALETTES.length];
  const h = hash(song.slug);
  const rot = ((h >> 3) % 14) - 7;
  const c = 320;

  const lines = wrap(song.title, 12, 3);
  // Shrink by line count, then by the widest line, so nothing overruns.
  const byLines = lines.length >= 3 ? 42 : lines.length === 2 ? 50 : 58;
  const size = Math.floor(Math.min(byLines, 330 / (Math.max(...lines.map((l) => l.length)) * 0.62)));
  const block = lines.length * size * 1.04;
  const top = c - block / 2 + size * 0.82;

  const grooves = Array.from({ length: 13 }, (_, g) =>
    `<circle cx="${c}" cy="${c}" r="${214 + g * 11}" fill="none" stroke="${brass}" stroke-opacity="${(0.05 + ((h >> g) % 5) * 0.012).toFixed(3)}" stroke-width="1.4"/>`).join('');

  const star = (x, y, r) => `<polygon points="${Array.from({ length: 10 }, (_, k) => {
    const rr = k % 2 ? r * 0.42 : r;
    const a = (Math.PI / 5) * k - Math.PI / 2;
    return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ')}" fill="${label}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640" role="img" aria-label="${esc(song.title)} by ${esc(song.artist)}">
  <defs>
    <radialGradient id="v" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="${label}" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0.62"/>
    </radialGradient>
    <filter id="p" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${h % 1000}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
  </defs>
  <rect width="640" height="640" fill="${card}"/><rect width="640" height="640" fill="url(#v)"/>
  ${grooves}
  <rect x="26" y="26" width="588" height="588" rx="14" fill="none" stroke="${brass}" stroke-opacity="0.55" stroke-width="2.5"/>
  <g transform="rotate(${rot} ${c} ${c})">
    <circle cx="${c}" cy="${c}" r="206" fill="${label}" stroke="${brass}" stroke-opacity="0.7" stroke-width="3"/>
    <circle cx="${c}" cy="${c}" r="196" fill="${paper}"/>
    <circle cx="${c}" cy="${c}" r="182" fill="none" stroke="${label}" stroke-opacity="0.5" stroke-width="2"/>
    <text x="${c}" y="${c - 118}" text-anchor="middle" font-family="Georgia, serif" font-size="19" letter-spacing="7" fill="${label}" fill-opacity="0.85">SALOON</text>
    ${star(c - 62, c - 112, 7)}${star(c + 62, c - 112, 7)}
    <g font-family="Georgia, serif" font-weight="bold" fill="${label}">
      ${lines.map((l, k) => `<text x="${c}" y="${(top + k * size * 1.04).toFixed(1)}" text-anchor="middle" font-size="${size}">${esc(l)}</text>`).join('\n      ')}
    </g>
    <line x1="${c - 78}" y1="${c + block / 2 + 26}" x2="${c + 78}" y2="${c + block / 2 + 26}" stroke="${label}" stroke-opacity="0.5" stroke-width="1.5"/>
    <text x="${c}" y="${c + block / 2 + 56}" text-anchor="middle" font-family="Georgia, serif" font-size="21" letter-spacing="2" fill="${label}" fill-opacity="0.9">${esc(song.artist.toUpperCase())}</text>
    <text x="${c}" y="${c + 150}" text-anchor="middle" font-family="Georgia, serif" font-size="14" letter-spacing="4" fill="${label}" fill-opacity="0.6">${esc((song.genre ?? 'SALOON').toUpperCase())}</text>
  </g>
  <rect width="640" height="640" filter="url(#p)" fill="#fff" opacity="0.5"/>
</svg>
`;
}

mkdirSync(resolve(root, 'public/covers'), { recursive: true });
songs.forEach((s, i) => writeFileSync(resolve(root, 'public/covers', `${s.slug}.svg`), cover(s, i)));

/* -------------------------------------------------------------- seed + sql */

const seed = `-- Saloon Jukebox library seed. Generated by scripts/generate.mjs.
-- Audio: Kevin MacLeod (incompetech.com), CC BY 4.0. See MUSIC_LICENSES.md.
-- Safe to re-run: rows match on a deterministic id.

insert into public.songs (id, title, artist, album, genre, duration, audio_url, cover_url)
values
${songs.map((s) => `  (${sql(s.id)}, ${sql(s.title)}, ${sql(s.artist)}, ${sql(s.album)}, ${sql(s.genre)}, ${s.duration}, ${sql(s.audio_url)}, ${sql(s.cover_url)})`).join(',\n')}
on conflict (id) do update set
  title = excluded.title, artist = excluded.artist, album = excluded.album,
  genre = excluded.genre, duration = excluded.duration,
  audio_url = excluded.audio_url, cover_url = excluded.cover_url;
`;
writeFileSync(resolve(root, 'supabase/seed.sql'), seed);

const migrations = readdirSync(resolve(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
writeFileSync(
  resolve(root, 'supabase/setup.sql'),
  `-- Saloon Jukebox — complete setup. Paste into the Supabase SQL editor and Run.
-- Safe to run more than once. Generated by scripts/generate.mjs.\n\n` +
    migrations.map((m) => readFileSync(resolve(root, 'supabase/migrations', m), 'utf8')).join('\n') +
    '\n' + seed,
);

/* ----------------------------------------------------------------- licenses */

const total = songs.reduce((n, s) => n + (s.duration ?? 0), 0);
writeFileSync(resolve(root, 'MUSIC_LICENSES.md'), `# Music Licenses

Every audio file in \`public/music/\` is listed here with its source, licence and
attribution. Nothing here is redistributed without a licence permitting it.

> **"Free to listen to" is not "free to redistribute."** Only add tracks whose
> licence explicitly allows hosting and redistribution.

| | |
|---|---|
| Tracks | ${songs.length} |
| Running time | ${Math.floor(total / 60)} min |
| Composer | Kevin MacLeod |
| Source | [incompetech.com](https://incompetech.com/music/royalty-free/music.html) |
| License | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Redistribution | Permitted, with attribution |
| Modification | Permitted (re-encoded to 128 kbps MP3 for the web) |

## Required attribution

CC BY 4.0 requires credit. It appears here, in the README, and in the app under
the library. If you fork this, keep it.

\`\`\`text
Music by Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0
https://creativecommons.org/licenses/by/4.0/
\`\`\`

## Tracks

| # | Track | Genre | Length | ISRC | Source |
|---|---|---|---|---|---|
${songs.map((s, i) => `| ${i + 1} | ${s.title} | ${s.genre ?? '—'} | ${Math.floor(s.duration / 60)}:${String(s.duration % 60).padStart(2, '0')} | ${source[i].isrc ?? '—'} | [link](${source[i].source_url}) |`).join('\n')}

All by **Kevin MacLeod**, all **CC BY 4.0**.

## Cover artwork

Not third-party art — \`scripts/generate.mjs\` draws it, so it falls under this
repository's own [MIT license](LICENSE).

## Adding your own music

1. Drop the audio in \`public/music/\`.
2. Add an entry to \`scripts/library.source.json\`.
3. \`npm run generate\`, then apply \`supabase/seed.sql\`.
4. **Record the licence above.** No nameable redistribution licence, no track.

Good sources: [Incompetech](https://incompetech.com/music/royalty-free/music.html) (CC BY),
[Free Music Archive](https://freemusicarchive.org/), [Musopen](https://musopen.org/)
(public-domain classical), [ccMixter](http://ccmixter.org/), or your own recordings.
Never rip from Spotify, Apple Music or YouTube.
`);

console.log(`Generated ${songs.length} covers, seed.sql, setup.sql and MUSIC_LICENSES.md.`);
