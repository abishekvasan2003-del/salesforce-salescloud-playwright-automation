'use strict';

/**
 * Save an authenticated Salesforce browser session for Playwright tests.
 *
 * Usage: npm run auth:save
 *
 * What it does:
 *  1. Opens a fresh, headed Chromium window (its own profile, not the MCP browser).
 *  2. Goes to SF_BASE_URL from .env (Salesforce redirects to the org login page).
 *  3. Waits up to 5 minutes while YOU log in and complete MFA by hand.
 *  4. Only after a successful login, saves the session to playwright/.auth/user.json.
 *
 * Security rules for this script:
 *  - It never reads, logs, or prints cookies, tokens, storage contents, or URLs.
 *  - On failure it prints a fixed message only (Playwright errors can contain URLs).
 *  - It records no video, trace, screenshot, or HAR.
 *  - playwright/.auth/ is ignored by Git (see .gitignore).
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const AUTH_FILE = path.join(ROOT, 'playwright', '.auth', 'user.json');
const AUTH_FILE_DISPLAY = 'playwright/.auth/user.json';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for manual login + MFA

/** Returns true if SF_BASE_URL looks like a real https URL (value is never printed). */
function isUsableBaseUrl(value) {
  if (!value || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.hostname.includes('your-domain');
  } catch {
    return false;
  }
}

async function main() {
  const baseUrl = (process.env.SF_BASE_URL || '').trim();

  if (!isUsableBaseUrl(baseUrl)) {
    console.error(
      'SF_BASE_URL is missing, invalid, or still the placeholder. Set it in .env (see .env.example).'
    );
    process.exitCode = 1;
    return;
  }

  let browser;
  try {
    // Fresh headed browser and a brand-new context: no reuse of any other session.
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Opening the Salesforce login page in a new browser window.');
    console.log('Log in and complete MFA there. Waiting up to 5 minutes...');

    await page.goto(baseUrl);

    // Login is complete once we land on a Lightning page. The login and MFA pages
    // use other paths, so checking the path (not the query string) avoids false matches.
    await page.waitForURL((url) => url.pathname.startsWith('/lightning/'), {
      timeout: LOGIN_TIMEOUT_MS,
    });

    // Write the file only now, after a successful login. Restrict it to the owner.
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true, mode: 0o700 });
    const state = await context.storageState();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state), { mode: 0o600 });
    fs.chmodSync(AUTH_FILE, 0o600);

    console.log(`Saved authentication state to ${AUTH_FILE_DISPLAY}`);
  } catch (error) {
    // Never print error.message: Playwright errors can include URLs.
    if (error && error.name === 'TimeoutError') {
      console.error('Timed out waiting for login to finish. Nothing was saved.');
    } else {
      console.error('The browser was closed or an error occurred. Nothing was saved.');
    }
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

main();
