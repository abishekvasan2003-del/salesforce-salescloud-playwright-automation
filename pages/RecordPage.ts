import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * A Salesforce record page (a Lead, and later an Account, Contact or Opportunity).
 *
 * Verified in the real org so far, for a Lead: the browser title format, the Details tab,
 * the field labels and values on it, and the success notification.
 */
export class RecordPage extends BasePage {
  /** `recordType` is the object's singular label as shown in the title, e.g. 'Lead'. */
  constructor(
    page: Page,
    private readonly recordType: string
  ) {
    super(page);
  }

  /** Matches this object's record address: /lightning/r/<Object>/<15 or 18 character id>/view */
  private get recordUrlPattern(): RegExp {
    return new RegExp(`/lightning/r/${this.recordType}/([a-zA-Z0-9]{15,18})/view`);
  }

  /**
   * The current page path with id-like segments replaced by <id> and the query string
   * and fragment dropped. Safe to show in error messages (no ids, tokens or parameters).
   */
  private currentPathShape(): string {
    try {
      const pathname = new URL(this.page.url()).pathname;
      return pathname
        .split('/')
        .map((segment) =>
          /^[a-zA-Z0-9]{15,}$/.test(segment) && /\d/.test(segment) ? '<id>' : segment
        )
        .join('/')
        .slice(0, 120);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Waits for Salesforce to open the record page (it does this right after Save) and
   * returns the record id from the page address.
   *
   * Uses expect(page).toHaveURL, which keeps re-checking the current address. Unlike
   * waitForURL, it does not also wait for a page "load" event, which Lightning's
   * in-page navigation may never fire again.
   *
   * Only the id is extracted. The full address and the id are never logged. If the wait
   * fails, the error says what kind of failure it was and the sanitized path shape.
   */
  async waitForRecordId(): Promise<string> {
    try {
      await expect(this.page).toHaveURL(this.recordUrlPattern, { timeout: 30_000 });
    } catch (error) {
      // Not error.message: Playwright's message contains the full address.
      const kind = error instanceof Error ? error.name : typeof error;
      throw new Error(
        `Salesforce did not open a ${this.recordType} record page, so the record id could not be read. ` +
          `(failure type: ${kind}; page path was: ${this.currentPathShape()})`
      );
    }

    const match = this.recordUrlPattern.exec(this.page.url());
    if (!match) {
      throw new Error(
        `Could not read the ${this.recordType} record id from the page address ` +
          `(page path was: ${this.currentPathShape()}).`
      );
    }
    return match[1];
  }

  /** Opens a record directly by its id (no list lookup) and checks the session is still valid. */
  async open(recordId: string): Promise<void> {
    if (!/^[a-zA-Z0-9]{15,18}$/.test(recordId)) {
      throw new Error(`The ${this.recordType} record id is not a valid 15 or 18 character id.`);
    }

    await this.page.goto(`/lightning/r/${this.recordType}/${recordId}/view`);

    // Record pages have a Details tab; the login page does not (see BasePage).
    await this.waitForAuthenticated(this.page.getByRole('tab', { name: 'Details', exact: true }));
  }

  /** Salesforce shows the success notification right after Save. */
  async expectCreatedToast(recordName: string): Promise<void> {
    const toast = this.page
      .getByRole('status')
      .filter({ hasText: recordName })
      .filter({ hasText: 'was created' });
    await expect(toast).toBeVisible();
  }

  /** The browser title of a record page is "<name> | <type> | Salesforce". */
  async expectTitle(recordName: string): Promise<void> {
    await expect(this.page).toHaveTitle(`${recordName} | ${this.recordType} | Salesforce`);
  }

  async openDetails(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Details', exact: true }).click();
  }

  /**
   * Checks one saved field on the Details tab, e.g. expectDetail('Company', 'Acme').
   * First and Last Name are shown together under the label "Name".
   * The check is "contains", because each field also carries its hidden edit-button text.
   */
  async expectDetail(label: string, value: string): Promise<void> {
    const field = this.page
      .getByRole('tabpanel', { name: 'Details', exact: true })
      .getByRole('listitem')
      .filter({ has: this.page.getByText(label, { exact: true }) });
    await expect(field).toContainText(value);
  }
}
