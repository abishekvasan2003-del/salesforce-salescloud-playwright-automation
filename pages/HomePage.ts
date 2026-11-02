import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** The Salesforce Lightning home page (shown in the Sales app for our user). */
export class HomePage extends BasePage {
  private readonly appNavigation: Locator;
  private readonly appName: Locator;

  constructor(page: Page) {
    super(page);
    this.appNavigation = page.getByRole('navigation', { name: 'App' });
    this.appName = page.getByRole('heading', { name: 'Sales', level: 1, exact: true });
  }

  /**
   * Opens the Lightning home page using the configured baseURL (SF_BASE_URL) and
   * checks we are logged in. Fails with an actionable message if we are not.
   */
  async open(): Promise<void> {
    await this.page.goto('/lightning/page/home');
    await this.waitForAuthenticated(this.appNavigation);
  }

  /** Confirms the Sales app interface is showing. */
  async expectSalesApp(): Promise<void> {
    await expect(this.page).toHaveURL(/\/lightning\//);
    await expect(this.appNavigation).toBeVisible();
    await expect(this.appName).toBeVisible();
  }
}
