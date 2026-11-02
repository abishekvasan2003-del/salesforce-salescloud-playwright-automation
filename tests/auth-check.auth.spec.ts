import { test, expect } from '../fixtures';

/*
 * This test runs in the "authenticated" project with the saved login.
 * Turn off screenshots, videos and traces so a failure cannot leave session data behind.
 */
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('saved login opens the authenticated Sales home page', async ({ page, homePage }) => {
  await homePage.open();

  await homePage.expectSalesApp();
  await expect(page).toHaveTitle(/Home \| Salesforce/);
});
