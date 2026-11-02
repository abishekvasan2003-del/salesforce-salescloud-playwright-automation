import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Authentication
 *
 * Tests named *.auth.spec.ts run in the "authenticated" project and reuse the saved
 * Salesforce login. All other tests run in the "unauthenticated" project (logged out).
 * The saved login is created by `npm run auth:save` and is ignored by Git.
 * This file only checks that it exists. It never reads or prints its contents.
 */
const AUTH_FILE = path.resolve(__dirname, 'playwright', '.auth', 'user.json');
const AUTH_TEST_PATTERN = /\.auth\.spec\.ts$/;

/* Authenticated tests are excluded from CI for now (no saved login there). */
const includeAuthenticatedProject = !process.env.CI;

/* Warn once (not once per worker) if the saved login is missing. */
if (includeAuthenticatedProject && !fs.existsSync(AUTH_FILE) && !process.env.PW_AUTH_WARNING_SHOWN) {
  process.env.PW_AUTH_WARNING_SHOWN = '1';
  console.warn(
    '\n[auth] Saved Salesforce login not found at playwright/.auth/user.json.\n' +
      '[auth] Authenticated tests (*.auth.spec.ts) will fail until you run: npm run auth:save\n'
  );
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Tests share one Salesforce org and login, so run them one at a time for now */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* One worker everywhere until tests are isolated and use unique data */
  workers: 1,
  /*
   * Reporters. See https://playwright.dev/docs/test-reporters
   * Locally: console list + HTML report. In CI: GitHub annotations, console list, HTML report
   * and JUnit XML. The JUnit file goes in test-results/, which is git-ignored generated output.
   */
  reporter: process.env.CI
    ? [
        ['github'],
        ['list'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : [['list'], ['html', { open: 'never' }]],

  /* Salesforce Lightning renders slowly, so use generous timeouts */
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. Set SF_BASE_URL in the environment. */
    baseURL: process.env.SF_BASE_URL,

    actionTimeout: 15_000,
    navigationTimeout: 45_000,

    /* Keep evidence for failed tests only. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    /* Logged-out tests (login smoke test, sample test). No storage state is loaded. */
    {
      name: 'unauthenticated',
      testIgnore: AUTH_TEST_PATTERN,
      use: {
        ...devices['Desktop Chrome'],
        /* Set after the device preset so it takes effect */
        viewport: { width: 1440, height: 900 },
      },
    },

    /* Logged-in tests (*.auth.spec.ts). Reuses the saved login. Not run in CI for now. */
    ...(includeAuthenticatedProject
      ? [
          {
            name: 'authenticated',
            testMatch: AUTH_TEST_PATTERN,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 1440, height: 900 },
              storageState: AUTH_FILE,
            },
          },
        ]
      : []),

    /* Re-enable once these browsers are installed: */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    //
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
