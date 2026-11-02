import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * A Salesforce object list page (Leads, and later Accounts, Contacts, Opportunities).
 *
 * Verified in the real org so far: the Leads tab and its "New" button.
 * There is no "find a record in the list" helper on purpose. The Leads tab opens the
 * Lead Intelligence View, which has no search box, no default sort order, and only
 * renders part of the rows, so a lookup there is not reliable. Open records by id instead
 * (see RecordPage.open).
 */
export class ListPage extends BasePage {
  /** Opens a list by clicking its tab in the Global navigation bar, e.g. open('Leads'). */
  async open(tabName: string): Promise<void> {
    await this.page
      .getByRole('navigation', { name: 'Global' })
      .getByRole('link', { name: tabName, exact: true })
      .click();

    // The list page shows the tab name as its level-1 heading.
    await expect(
      this.page.getByRole('heading', { name: tabName, level: 1, exact: true })
    ).toBeVisible();
  }

  /** Clicks the page-header "New" button. The dialog is handled by RecordFormDialog. */
  async clickNew(): Promise<void> {
    await this.page.getByRole('button', { name: 'New', exact: true }).click();
  }
}
