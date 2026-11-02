import { type Locator, type Page } from '@playwright/test';

/** Shown whenever Salesforce sends us to the login page instead of the app. */
export const SESSION_EXPIRED_MESSAGE =
  'Salesforce session is missing or expired. Run npm run auth:save and retry.';

/** Base class for all page objects: holds the Playwright page and shared checks. */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Waits for either the logged-in app (identified by `appMarker`) or the Salesforce
   * login page, then fails with SESSION_EXPIRED_MESSAGE if we landed on the login page.
   *
   * Only locators are used here. This never reads cookies, storage state or URLs.
   */
  protected async waitForAuthenticated(appMarker: Locator): Promise<void> {
    const loginButton = this.page.getByRole('button', { name: 'Log In', exact: true });

    // Whichever shows up first tells us if the saved login worked.
    await appMarker.or(loginButton).first().waitFor({ timeout: 30_000 });

    if (await loginButton.isVisible()) {
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }
  }
}
