import { test, expect } from '@playwright/test';

/*
 * Public smoke test: the Salesforce login form loads. It needs no login and never submits
 * the form.
 *
 * login.salesforce.com serves one of two layouts, so both are supported:
 *  - email-first:        "Email" textbox, "Continue" button, "Remember Me" checkbox
 *  - username/password:  #username, "Log In" button, "Remember Me" checkbox,
 *                        "Forgot Your Password?" link
 *
 * The layout is detected from the form fields themselves, not from heading text, which is
 * marketing copy. The page also embeds a promotional iframe that can show an error. It is
 * not part of the login form, so nothing inside it is checked.
 */
test('Salesforce login page should load successfully', async ({ page }) => {
  await page.goto('https://login.salesforce.com');

  const emailField = page.getByRole('textbox', { name: 'Email', exact: true });
  const usernameField = page.locator('#username');

  /* Wait for either layout, and fail with a clear message if neither appears. */
  try {
    await expect(emailField.or(usernameField)).toBeVisible();
  } catch {
    throw new Error(
      'Neither supported Salesforce login layout was found: no visible "Email" textbox ' +
        '(email-first) and no visible #username field (username/password).'
    );
  }

  /* Shared by both layouts. Case-insensitive because the label is "Remember Me" or "Remember me". */
  await expect(page.getByRole('checkbox', { name: /^remember me$/i })).toBeVisible();

  if (await usernameField.isVisible()) {
    // Username/password layout
    await expect(usernameField).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot Your Password?' })).toBeVisible();
  } else {
    // Email-first layout
    await expect(emailField).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
  }
});
