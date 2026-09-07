/**
 * Anonymous display names. No accounts, no personal data — a random handle is
 * generated per browser and kept in localStorage purely so your own additions
 * read consistently in the queue.
 */
const HANDLES = [
  'Cowboy',
  'Ranger',
  'Sheriff',
  'Drifter',
  'Outlaw',
  'Barkeep',
  'Prospector',
  'Wrangler',
  'Marshal',
  'Gambler',
  'Rustler',
  'Deputy',
  'Bandit',
  'Pioneer',
  'Maverick',
  'Trailhand',
];

const KEY = 'saloon-jukebox:guest';

export function getGuestName(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
  } catch {
    /* Private mode — fall through and just use an ephemeral name. */
  }
  const name = `${HANDLES[Math.floor(Math.random() * HANDLES.length)]}${Math.floor(Math.random() * 90) + 10}`;
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* Nothing to persist to; the name lives for this page view only. */
  }
  return name;
}
