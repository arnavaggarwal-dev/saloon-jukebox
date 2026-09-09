import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
// E2E_BASE_URL=https://…/saloon-jukebox/ npm test  -> tests a deployment
const DEPLOYED = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests',
  workers: 1, // one shared queue, so specs must not overlap
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: DEPLOYED ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // Headless Chromium has no audio device; without this, play() is rejected
    // and we couldn't verify real playback.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: DEPLOYED
    ? undefined
    : { command: `npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`, port: PORT, reuseExistingServer: true },
});
