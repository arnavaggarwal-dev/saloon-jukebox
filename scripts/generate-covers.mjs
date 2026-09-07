/**
 * Generates original, vintage record-label style cover art (one SVG per track).
 *
 * The artwork is generated from scratch here, so it carries no third-party image
 * licensing. See MUSIC_LICENSES.md — the *audio* is CC BY 4.0, the *artwork* is
 * part of this repository and released under the project's MIT license.
 *
 *   node scripts/generate-covers.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import songs from '../src/data/songs.json' with { type: 'json' };

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/covers');

/** Warm saloon palettes: [outer card, inner label, ink, accent/brass]. */
const PALETTES = [
  ['#2A1810', '#8C3A22', '#F6E7CE', '#E0A94F'],
  ['#231A11', '#6B4E1E', '#F7EBD6', '#D9A441'],
  ['#1E1512', '#7A2E2A', '#F5E3D0', '#C9963F'],
  ['#2B2015', '#4F5B37', '#F4EDDA', '#DCB262'],
  ['#241611', '#93502A', '#F8EAD4', '#E8BC6B'],
  ['#1C1512', '#3F4A55', '#EFE6D6', '#C6A052'],
  ['#2E1D14', '#A05829', '#FBEFD9', '#F0C878'],
  ['#1F1710', '#5C3A5A', '#F2E6D8', '#D2A75C'],
  ['#261A12', '#8A6220', '#F9EEDA', '#E9C46A'],
  ['#1A1310', '#6E2F35', '#F3E2D2', '#CDA04A'],
  ['#2C2118', '#3E5B4C', '#F4EBD9', '#DDB55E'],
  ['#221812', '#7E4420', '#F7E9D3', '#E5B457'],
  ['#1D1611', '#55432C', '#F1E7D5', '#C9A661'],
  ['#2A1C13', '#96442C', '#FAEDD8', '#EEC377'],
  ['#201812', '#44503A', '#F2EAD7', '#D4AC55'],
  ['#251A15', '#6D3524', '#F6E6D1', '#DFAE60'],
];

/** Deterministic small hash so a given slug always renders identically. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy wrap tuned for the label's inner width. */
function wrap(text, maxChars, maxLines) {
  const words = text.toUpperCase().split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length > maxLines
    ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].slice(0, maxChars - 1)}…`]
    : lines;
}

function cover(song, i) {
  const [card, label, ink, brass] = PALETTES[i % PALETTES.length];
  const h = hash(song.slug);
  const rot = ((h >> 3) % 14) - 7;
  const S = 640;
  const cx = S / 2;
  const cy = S / 2;

  const titleLines = wrap(song.title, 12, 3);
  // Shrink the type as the title grows so long names stay inside the label:
  // once by line count, then again by the widest line so nothing overruns the
  // ~330px of usable width inside the paper circle.
  const byLines = titleLines.length >= 3 ? 42 : titleLines.length === 2 ? 50 : 58;
  const widest = Math.max(...titleLines.map((l) => l.length));
  const titleSize = Math.floor(Math.min(byLines, 330 / (widest * 0.62)));
  const blockH = titleLines.length * titleSize * 1.04;
  const titleTop = cy - blockH / 2 + titleSize * 0.82;

  // Concentric record grooves radiating out from the paper label.
  const grooves = Array.from({ length: 13 }, (_, g) => {
    const r = 214 + g * 11;
    const op = (0.05 + ((h >> g) % 5) * 0.012).toFixed(3);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${brass}" stroke-opacity="${op}" stroke-width="1.4"/>`;
  }).join('');

  // Brass studs around the frame, like a jukebox bezel.
  const studs = Array.from({ length: 8 }, (_, s) => {
    const a = (Math.PI / 4) * s + Math.PI / 8;
    const x = (cx + Math.cos(a) * 292).toFixed(1);
    const y = (cy + Math.sin(a) * 292).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="${brass}" fill-opacity="0.5"/>`;
  }).join('');

  const star = (x, y, r, fill) => {
    const pts = Array.from({ length: 10 }, (_, k) => {
      const rr = k % 2 === 0 ? r : r * 0.42;
      const a = (Math.PI / 5) * k - Math.PI / 2;
      return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${fill}"/>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${esc(song.title)} by ${esc(song.artist)}">
  <defs>
    <radialGradient id="vig" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="${label}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.62"/>
    </radialGradient>
    <radialGradient id="lbl" cx="42%" cy="34%" r="78%">
      <stop offset="0%" stop-color="${ink}"/>
      <stop offset="100%" stop-color="${ink}" stop-opacity="0.86"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="42%" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.16"/>
    </linearGradient>
    <filter id="paper" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${h % 1000}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
  </defs>

  <rect width="${S}" height="${S}" fill="${card}"/>
  <rect width="${S}" height="${S}" fill="url(#vig)"/>
  ${grooves}
  <rect width="${S}" height="${S}" fill="url(#sheen)"/>

  <rect x="26" y="26" width="${S - 52}" height="${S - 52}" rx="14" fill="none" stroke="${brass}" stroke-opacity="0.55" stroke-width="2.5"/>
  <rect x="38" y="38" width="${S - 76}" height="${S - 76}" rx="10" fill="none" stroke="${brass}" stroke-opacity="0.26" stroke-width="1.2"/>
  ${studs}

  <g transform="rotate(${rot} ${cx} ${cy})">
    <circle cx="${cx}" cy="${cy}" r="206" fill="${label}" stroke="${brass}" stroke-opacity="0.7" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="196" fill="url(#lbl)"/>
    <circle cx="${cx}" cy="${cy}" r="182" fill="none" stroke="${label}" stroke-opacity="0.5" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="176" fill="none" stroke="${label}" stroke-opacity="0.3" stroke-width="1"/>

    <text x="${cx}" y="${cy - 118}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
          font-size="19" letter-spacing="7" fill="${label}" fill-opacity="0.85">SALOON</text>
    ${star(cx - 62, cy - 112, 7, label)}
    ${star(cx + 62, cy - 112, 7, label)}

    <g font-family="Georgia, 'Times New Roman', serif" font-weight="bold" fill="${label}">
      ${titleLines
        .map(
          (l, k) =>
            `<text x="${cx}" y="${(titleTop + k * titleSize * 1.04).toFixed(1)}" text-anchor="middle" font-size="${titleSize}" letter-spacing="1">${esc(l)}</text>`,
        )
        .join('\n      ')}
    </g>

    <line x1="${cx - 78}" y1="${cy + blockH / 2 + 26}" x2="${cx + 78}" y2="${cy + blockH / 2 + 26}" stroke="${label}" stroke-opacity="0.5" stroke-width="1.5"/>
    <text x="${cx}" y="${cy + blockH / 2 + 56}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
          font-size="21" letter-spacing="2" fill="${label}" fill-opacity="0.9">${esc(song.artist.toUpperCase())}</text>
    <text x="${cx}" y="${cy + 150}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
          font-size="14" letter-spacing="4" fill="${label}" fill-opacity="0.6">${esc((song.genre || 'SALOON').toUpperCase())}</text>
  </g>

  <rect width="${S}" height="${S}" filter="url(#paper)" fill="#ffffff" opacity="0.5"/>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
songs.forEach((song, i) => {
  writeFileSync(resolve(outDir, `${song.slug}.svg`), cover(song, i));
});
console.log(`Wrote ${songs.length} covers to public/covers/`);
