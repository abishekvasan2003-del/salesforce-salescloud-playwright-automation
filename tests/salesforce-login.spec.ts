import { test, expect } from '@playwright/test';

test('Salesforce login page should load successfully', async ({ page }) => {
  await page.goto('https://login.salesforce.com');

  await expect(
    page.getByRole('heading', { name: 'Salesforce login' })
  ).toBeVisible();

  await expect(page.locator('#username')).toBeVisible();

  await expect(
    page.getByRole('button', { name: 'Log In' })
  ).toBeVisible();

  await expect(
    page.getByRole('checkbox', { name: 'Remember me' })
  ).toBeVisible();

  await expect(
    page.getByRole('link', { name: 'Forgot Your Password?' })
  ).toBeVisible();
});