import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

// Point the same specs at a deployed site:
//   E2E_BASE_URL=https://…/saloon-jukebox/ npm run test:e2e
const DEPLOYED = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: DEPLOYED ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        // Headless Chromium has no audio device; without this, play() is
        // rejected and we couldn't verify real playback.
        '--autoplay-policy=no-user-gesture-required',
        '--mute-audio',
      ],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // No local server needed when testing a deployment.
  webServer: DEPLOYED
    ? undefined
    : {
        command: `npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
