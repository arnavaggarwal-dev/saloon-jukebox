import { expect, test } from '@playwright/test';

/**
 * The things that actually matter: real audio, working controls, and a queue
 * that stays in sync between browsers.
 *
 *   npm test
 *
 * Needs Supabase credentials, since that is the only backend:
 *   E2E_SUPABASE_URL=… E2E_SUPABASE_ANON_KEY=… npm test
 */
const URL_ = process.env.E2E_SUPABASE_URL;
const KEY = process.env.E2E_SUPABASE_ANON_KEY;

const rpc = async (fn, body = {}) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.ok ? r.json() : null;
};

/** Specs share one real queue, so empty it first — and confirm it emptied. */
async function reset() {
  if (!URL_) return;
  for (let i = 0; i < 4; i++) {
    let s = await rpc('jukebox_state');
    for (const e of s.queue.filter((e) => e.status === 'queued')) s = await rpc('jukebox_remove_from_queue', { p_queue_id: e.id });
    for (let n = 0; n < 6 && s.playback.current_queue_id; n++) s = await rpc('jukebox_advance', { p_expected_current_id: s.playback.current_queue_id });
    if (!s.playback.current_queue_id && !s.queue.some((e) => e.status !== 'played')) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}

const enter = async (page) => {
  await page.goto('./'); // './' keeps the /saloon-jukebox/ path on Pages
  await page.getByRole('button', { name: /play jukebox/i }).click();
};

/** Dismiss the audio gate without enabling sound — the browsing path. */
const browse = async (page) => {
  await page.goto('./');
  await page.getByRole('button', { name: /just browsing/i }).click();
};

const add = (page, title) => page.getByRole('button', { name: `Add ${title} to the queue` }).click();

/** The real state of the one <audio> element. */
const audio = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('audio');
    return el && { src: el.currentSrc, paused: el.paused, t: el.currentTime, d: el.duration, ready: el.readyState, err: el.error?.code ?? null, muted: el.muted };
  });

test.beforeEach(async () => {
  test.skip(!URL_ || !KEY, 'Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY');
  await reset();
});

test('library loads and search filters it', async ({ page }) => {
  await browse(page);
  const cards = page.getByRole('button', { name: /add .* to the queue/i });
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(16);

  await page.getByLabel(/search the library/i).fill('whiskey');
  await expect(cards).toHaveCount(1);

  await page.getByLabel(/search the library/i).fill('ragtime'); // genre
  await expect(cards).toHaveCount(3);

  await page.getByLabel(/search the library/i).fill('zzzz');
  await expect(page.getByText('No tracks found.')).toBeVisible();
});

test('audio really plays, pauses, seeks and mutes', async ({ page }) => {
  await enter(page);
  await add(page, 'Barroom Ballet');

  await expect.poll(async () => (await audio(page))?.src ?? '', { timeout: 20000 }).toContain('barroom-ballet.mp3');
  await expect.poll(async () => (await audio(page))?.ready ?? 0).toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await audio(page))?.err).toBeNull();
  await expect.poll(async () => (await audio(page))?.paused, { timeout: 15000 }).toBe(false);

  // Real decoded length, not a placeholder.
  expect((await audio(page)).d).toBeGreaterThan(50);

  const t0 = (await audio(page)).t;
  await page.waitForTimeout(1500);
  expect((await audio(page)).t).toBeGreaterThan(t0 + 0.4);

  await page.getByRole('button', { name: /pause for everyone/i }).click();
  await expect.poll(async () => (await audio(page))?.paused, { timeout: 15000 }).toBe(true);
  await page.getByRole('button', { name: /play for everyone/i }).click();
  await expect.poll(async () => (await audio(page))?.paused, { timeout: 15000 }).toBe(false);

  const bar = page.getByLabel(/seek within the current track/i);
  await bar.fill('30');
  await expect.poll(async () => (await audio(page)).t, { timeout: 10000 }).toBeGreaterThan(25);

  await page.getByRole('button', { name: /^mute$/i }).click();
  await expect.poll(async () => (await audio(page))?.muted).toBe(true);
});

test('a finished track advances the queue on its own', async ({ page }) => {
  await enter(page);
  await add(page, 'Barroom Ballet');
  await add(page, 'Neo Western');
  await expect.poll(async () => (await audio(page))?.src ?? '', { timeout: 20000 }).toContain('barroom-ballet');
  await expect.poll(async () => (await audio(page))?.d ?? 0, { timeout: 15000 }).toBeGreaterThan(10);

  // Seek through the UI so the *shared* clock moves too; poking currentTime
  // directly would just be corrected back by the sync loop.
  const d = (await audio(page)).d;
  await page.getByLabel(/seek within the current track/i).fill(String(Math.floor((d - 2) * 2) / 2));
  await expect.poll(async () => (await audio(page))?.src ?? '', { timeout: 30000 }).toContain('neo-western');
});

test('skip and previous move between tracks', async ({ page }) => {
  // Without migration 002 the app correctly falls back to "restart track",
  // which is not what this asserts.
  test.skip(!(await rpc('jukebox_previous')), 'Apply supabase/migrations/002_previous_track.sql');
  await enter(page);
  await add(page, 'Barroom Ballet');
  await add(page, 'Cattails');
  await expect.poll(async () => (await audio(page))?.src ?? '', { timeout: 20000 }).toContain('barroom-ballet');

  await page.getByRole('button', { name: /skip to the next track/i }).click();
  await expect.poll(async () => (await audio(page))?.src ?? '', { timeout: 15000 }).toContain('cattails');

  // Back one — and the record we left should be waiting, not discarded.
  await page.getByRole('button', { name: /previous track/i }).click();
  await expect.poll(async () => (await audio(page))?.src ?? '', { timeout: 15000 }).toContain('barroom-ballet');
  await expect(page.getByTestId('up-next').locator('> li').first()).toContainText('Cattails');
});

test('queue keeps its order and can drop a track', async ({ page }) => {
  await enter(page);
  await add(page, 'Barroom Ballet');
  await add(page, 'Cattails');
  await add(page, 'Neo Western');

  const items = page.getByTestId('up-next').locator('> li');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Cattails');
  await expect(items.nth(1)).toContainText('Neo Western');

  await items.nth(0).hover();
  await page.getByRole('button', { name: /remove cattails/i }).click();
  await expect(items).toHaveCount(1);
});

test('a missing audio file shows a message instead of breaking', async ({ page }) => {
  await page.route('**/music/cattails.mp3', (r) => r.fulfill({ status: 404, body: '' }));
  await enter(page);
  await add(page, 'Cattails');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20000 });
});

test('two separate browsers share one queue', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();

  await enter(pa);
  await browse(pb);

  await add(pa, 'Barroom Ballet');
  await add(pa, 'Cattails');
  const bq = pb.getByTestId('up-next').locator('> li');
  await expect(bq).toHaveCount(1, { timeout: 25000 });
  await expect(bq.nth(0)).toContainText('Cattails');

  // …and back the other way.
  await add(pb, 'Neo Western');
  await expect(pa.getByTestId('up-next').locator('> li')).toHaveCount(2, { timeout: 25000 });

  await a.close();
  await b.close();
});

test('controls are labelled and the layout does not overflow', async ({ page }) => {
  await enter(page);
  await add(page, 'Cattails');
  await expect(page.getByRole('button', { name: /pause for everyone|play for everyone/i })).toBeVisible();
  await expect(page.getByRole('slider', { name: /volume/i }).or(page.getByLabel(/seek/i)).first()).toBeAttached();
  expect(await page.locator('img:not([alt])').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
