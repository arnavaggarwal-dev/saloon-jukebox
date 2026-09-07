import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end checks for the things that actually matter: real audio playback,
 * working transport controls, and a queue that stays in sync between clients.
 *
 *   npm run test:e2e
 *
 * These run against the production build via `vite preview`. With no Supabase
 * credentials they exercise the local backend, where "two clients" means two
 * tabs in one browser context (which is the scope that backend syncs). Point
 * VITE_SUPABASE_* at a project and rebuild to exercise the same specs against
 * Supabase Realtime across independent contexts.
 */

/** Dismiss the autoplay gate and wait for the audio element to be wired up. */
async function enterSaloon(page: Page) {
  await page.goto('./');
  const join = page.getByRole('button', { name: /play jukebox/i });
  await expect(join).toBeVisible();
  await join.click();
  await expect(join).toBeHidden();
}

/** Dismiss the entry overlay WITHOUT enabling audio (the browsing path). */
async function browseOnly(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /just browsing/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function addTrack(page: Page, title: string) {
  await page.getByRole('button', { name: new RegExp(`add ${escapeRe(title)} .* to the queue`, 'i') }).click();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Scope to the Now Playing panel — track titles also appear on library cards. */
const nowPlaying = (page: Page) => page.getByRole('region', { name: /now playing|paused/i });

/** Snapshot of the single <audio> element's real state. */
async function audioState(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('audio') as HTMLAudioElement | null;
    if (!el) return null;
    return {
      src: el.currentSrc,
      paused: el.paused,
      currentTime: el.currentTime,
      duration: el.duration,
      readyState: el.readyState,
      volume: el.volume,
      muted: el.muted,
      error: el.error?.code ?? null,
    };
  });
}

/**
 * Against Supabase every spec shares one real queue, so wipe it between tests
 * using only the public RPCs a browser has (no service-role key involved).
 */
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SUPABASE_KEY = process.env.E2E_SUPABASE_ANON_KEY;
const usingSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

async function rpc(fn: string, body: unknown = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${fn} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function resetSharedQueue() {
  if (!usingSupabase) return;
  // A page from the previous test can still be closing and may push one last
  // change, so confirm the queue is really empty instead of assuming it.
  for (let attempt = 0; attempt < 4; attempt++) {
    let state = await rpc('jukebox_state');
    for (const entry of state.queue.filter((e: any) => e.status === 'queued')) {
      state = await rpc('jukebox_remove_from_queue', { p_queue_id: entry.id });
    }
    // Drain whatever is playing; with nothing queued this lands on silence.
    for (let i = 0; i < 6 && state.playback.current_queue_id; i++) {
      state = await rpc('jukebox_advance', {
        p_expected_current_id: state.playback.current_queue_id,
      });
    }
    const live = state.queue.filter((e: any) => e.status !== 'played');
    if (live.length === 0 && !state.playback.current_queue_id) return;
    await new Promise((r) => setTimeout(r, 400));
  }
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await resetSharedQueue();
});

test.describe('library', () => {
  test('loads the shelf and search filters it', async ({ page }) => {
    await browseOnly(page);
    const cards = page.getByRole('button', { name: /add .* to the queue/i });
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBe(16);

    // Search matches on title…
    await page.getByLabel(/search the library/i).fill('whiskey');
    await expect(cards).toHaveCount(1);
    await expect(page.getByText('Whiskey on the Mississippi').first()).toBeVisible();

    // …and on genre.
    await page.getByLabel(/search the library/i).fill('ragtime');
    await expect(cards).toHaveCount(3);

    // Empty state.
    await page.getByLabel(/search the library/i).fill('zzzznothing');
    await expect(cards).toHaveCount(0);
    await expect(page.getByText('No tracks found.')).toBeVisible();

    await page.getByRole('button', { name: /show every record/i }).click();
    await expect(cards).toHaveCount(16);
  });
});

test.describe('audio', () => {
  test('really plays, pauses, seeks and changes volume', async ({ page }) => {
    await enterSaloon(page);
    await addTrack(page, 'Barroom Ballet');

    // The <audio> element must have loaded the actual mp3 and be playing.
    await expect
      .poll(async () => (await audioState(page))?.src ?? '', { timeout: 15_000 })
      .toContain('barroom-ballet.mp3');

    await expect.poll(async () => (await audioState(page))?.readyState ?? 0).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => (await audioState(page))?.error).toBeNull();
    await expect.poll(async () => (await audioState(page))?.paused).toBe(false);

    // Real decoded duration, not a placeholder.
    const dur = (await audioState(page))!.duration;
    expect(dur).toBeGreaterThan(50);
    expect(dur).toBeLessThan(70);

    // The playhead genuinely advances.
    const t0 = (await audioState(page))!.currentTime;
    await page.waitForTimeout(1800);
    const t1 = (await audioState(page))!.currentTime;
    expect(t1).toBeGreaterThan(t0 + 0.5);

    // Pause is shared state, so the element must actually stop.
    await page.getByRole('button', { name: /pause for everyone/i }).click();
    await expect.poll(async () => (await audioState(page))?.paused).toBe(true);
    const tp = (await audioState(page))!.currentTime;
    await page.waitForTimeout(900);
    expect(Math.abs((await audioState(page))!.currentTime - tp)).toBeLessThan(0.25);

    // Resume.
    await page.getByRole('button', { name: /play for everyone/i }).click();
    await expect.poll(async () => (await audioState(page))?.paused).toBe(false);

    // Seek via the range input.
    const scrubber = page.getByLabel(/seek within the current track/i).filter({ visible: true });
    await scrubber.focus();
    await scrubber.fill('30');
    await scrubber.dispatchEvent('change');
    await scrubber.blur();
    await expect.poll(async () => (await audioState(page))!.currentTime, { timeout: 8000 }).toBeGreaterThan(25);

    // Volume is local: mute must change the element, not the shared state.
    await page.getByRole('button', { name: /^mute$/i }).first().click();
    await expect.poll(async () => (await audioState(page))?.muted).toBe(true);
    await page.getByRole('button', { name: /^unmute$/i }).first().click();
    await expect.poll(async () => (await audioState(page))?.muted).toBe(false);
  });

  test('advances to the next track automatically when one ends', async ({ page }) => {
    await enterSaloon(page);
    await addTrack(page, 'Barroom Ballet'); // ~57s, the shortest record
    await addTrack(page, 'Neo Western');

    await expect.poll(async () => (await audioState(page))?.src ?? '').toContain('barroom-ballet');

    // Wait for real metadata: reading duration too early yields NaN/0 and we
    // would "seek" to the start instead of the end.
    await expect
      .poll(async () => (await audioState(page))?.duration ?? 0, { timeout: 15_000 })
      .toBeGreaterThan(10);

    // Seek through the UI so the *shared* playhead moves too; poking
    // el.currentTime directly would just be corrected back by the sync loop.
    const dur = (await audioState(page))!.duration;
    const scrubber = page.getByLabel(/seek within the current track/i).filter({ visible: true });
    // The input has step=0.5, so the value must land on a valid step.
    await scrubber.fill(String(Math.floor(Math.max(0, dur - 2) * 2) / 2));
    await scrubber.dispatchEvent('change');
    await scrubber.blur();

    await expect
      .poll(async () => (await audioState(page))?.src ?? '', { timeout: 30_000 })
      .toContain('neo-western');
    await expect(nowPlaying(page).getByRole('heading', { name: /neo western/i })).toBeVisible();
  });

  test('skip moves on immediately', async ({ page }) => {
    await enterSaloon(page);
    await addTrack(page, 'Cattails');
    await addTrack(page, 'Fig Leaf Rag');
    await expect.poll(async () => (await audioState(page))?.src ?? '').toContain('cattails');

    await page.getByRole('button', { name: /skip to the next track/i }).click();
    await expect.poll(async () => (await audioState(page))?.src ?? '').toContain('fig-leaf-rag');
  });

  test('a missing audio file produces a useful error, not a crash', async ({ page }) => {
    await page.route('**/music/cattails.mp3', (route) => route.fulfill({ status: 404, body: '' }));
    await enterSaloon(page);
    await addTrack(page, 'Cattails');

    await expect(page.getByRole('alert').filter({ hasText: /couldn't load this track/i })).toBeVisible({
      timeout: 15_000,
    });
    // And the app still offers a way forward.
    await expect(page.getByRole('button', { name: /skip to the next song/i })).toBeVisible();
  });
});

test.describe('queue', () => {
  test('orders correctly, shows attribution, and removes', async ({ page }) => {
    await enterSaloon(page);
    await addTrack(page, 'Barroom Ballet');
    await addTrack(page, 'Cattails');
    await addTrack(page, 'Neo Western');

    const queueSection = page.getByRole('region', { name: /up next/i });
    const items = queueSection.getByTestId('up-next').locator('> li');
    await expect(items).toHaveCount(2); // first one is now playing

    await expect(items.nth(0)).toContainText('Cattails');
    await expect(items.nth(1)).toContainText('Neo Western');

    // Remove the first waiting track.
    await items.nth(0).hover();
    await queueSection.getByRole('button', { name: /remove cattails/i }).click();
    await expect(items).toHaveCount(1);
    await expect(items.nth(0)).toContainText('Neo Western');
  });

  test('the same song can be queued more than once', async ({ page }) => {
    await enterSaloon(page);
    await addTrack(page, 'Cattails');
    await addTrack(page, 'Cattails');
    await addTrack(page, 'Cattails');

    const items = page.getByTestId('up-next').locator('> li');
    await expect(items).toHaveCount(2);
    await expect(page.getByTitle(/already in the queue 2 times/i)).toBeVisible();
  });
});

test.describe('realtime sync', () => {
  test('two clients see one shared queue', async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();

    await enterSaloon(a);
    await browseOnly(b);

    // A adds -> B sees it with no reload.
    await addTrack(a, 'Barroom Ballet');
    await addTrack(a, 'Cattails');
    const bQueue = b.getByTestId('up-next').locator('> li');
    await expect(bQueue).toHaveCount(1, { timeout: 15_000 });
    await expect(bQueue.nth(0)).toContainText('Cattails');

    // B adds -> A sees it with no reload.
    await addTrack(b, 'Fiddles McGinty');
    const aQueue = a.getByTestId('up-next').locator('> li');
    await expect(aQueue).toHaveCount(2, { timeout: 15_000 });
    await expect(aQueue.nth(1)).toContainText('Fiddles McGinty');

    // Both agree on what is playing.
    await expect(nowPlaying(a).getByRole('heading', { name: /barroom ballet/i })).toBeVisible();
    await expect(nowPlaying(b).getByRole('heading', { name: /barroom ballet/i })).toBeVisible();

    // A skip on one client moves the other.
    await a.getByRole('button', { name: /skip to the next track/i }).click();
    await expect(nowPlaying(b).getByRole('heading', { name: /cattails/i })).toBeVisible({ timeout: 15_000 });

    await a.close();
    await b.close();
  });
});

test.describe('accessibility & layout', () => {
  test('core controls are reachable and labelled', async ({ page }) => {
    await enterSaloon(page);
    await addTrack(page, 'Cattails');

    await expect(page.getByRole('button', { name: /pause for everyone|play for everyone/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /skip to the next track/i })).toBeVisible();
    await expect(page.getByRole('slider', { name: /seek within the current track/i })).toBeAttached();
    await expect(page.getByRole('progressbar', { name: /track progress/i })).toBeVisible();

    // Every cover image carries alt text.
    const decorative = await page.locator('img[alt=""]').count();
    const described = await page.locator('img[alt]:not([alt=""])').count();
    expect(described).toBeGreaterThan(0);
    expect(await page.locator('img:not([alt])').count()).toBe(0);
    expect(decorative).toBeGreaterThanOrEqual(0);

    // Space toggles playback from the page body.
    await page.locator('body').click({ position: { x: 5, y: 400 } });
    const before = (await audioState(page))!.paused;
    await page.keyboard.press('Space');
    await expect.poll(async () => (await audioState(page))!.paused).toBe(!before);
  });

  test('no horizontal overflow at the tested viewport', async ({ page }) => {
    await enterSaloon(page);
    await addTrack(page, 'Whiskey on the Mississippi');
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('realtime across independent browsers', () => {
  // Two separate contexts share nothing client-side — no localStorage, no
  // BroadcastChannel. Passing this proves the sync is genuinely server-side.
  test.skip(!usingSupabase, 'Requires E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY');

  test('a queue added in one browser appears in a different browser', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();

    await enterSaloon(a);
    await browseOnly(b);
    await expect(b.getByText(/^Live$/i)).toBeVisible({ timeout: 20_000 });

    await addTrack(a, 'Barroom Ballet');
    await addTrack(a, 'Cattails');

    const bQueue = b.getByTestId('up-next').locator('> li');
    await expect(bQueue).toHaveCount(1, { timeout: 20_000 });
    await expect(bQueue.nth(0)).toContainText('Cattails');
    await expect(nowPlaying(b).getByRole('heading', { name: /barroom ballet/i })).toBeVisible();

    // …and back the other way.
    await addTrack(b, 'Fiddles McGinty');
    const aQueue = a.getByTestId('up-next').locator('> li');
    await expect(aQueue).toHaveCount(2, { timeout: 20_000 });
    await expect(aQueue.nth(1)).toContainText('Fiddles McGinty');

    // A skip in B moves A.
    await b.getByRole('button', { name: /skip to the next track/i }).click();
    await expect(nowPlaying(a).getByRole('heading', { name: /cattails/i })).toBeVisible({
      timeout: 20_000,
    });

    await ctxA.close();
    await ctxB.close();
  });
});
