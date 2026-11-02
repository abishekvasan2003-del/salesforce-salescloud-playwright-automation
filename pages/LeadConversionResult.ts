import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RecordPage } from './RecordPage';

/** Ids of the records a conversion created. `opportunityId` is absent when none was created. */
export type ConvertedRecordIds = {
  accountId: string;
  contactId: string;
  opportunityId?: string;
};

type ConvertedObject = 'Account' | 'Contact' | 'Opportunity';

/**
 * What you can see AFTER the Convert Lead dialog closes, and the records it created.
 *
 * NEEDS RUNTIME VERIFICATION. Nothing in this class has been run: converting is a one-way
 * change, and the post-conversion screens were never inspected. Assumptions to confirm on
 * the first approved run:
 *  - A confirmation dialog headed "Your lead has been converted" appears, containing links
 *    to the new Account, Contact and (if created) Opportunity.
 *  - Those links point at /lightning/r/<Object>/<id>/view.
 *  - A converted Lead's Details tab shows "Lead Status" and the new records' Details tabs
 *    show "Name", "Account Name" and "Opportunity Name" as labelled below.
 *
 * Record ids are read from those links at run time. Ids and full links are never logged.
 */
export class LeadConversionResult extends BasePage {
  private readonly confirmation: Locator;

  constructor(page: Page) {
    super(page);
    this.confirmation = page
      .getByRole('dialog')
      .filter({
        has: page.getByRole('heading', { name: 'Your lead has been converted', exact: true }),
      });
  }

  // ---- Success state -----------------------------------------------------------------

  /** Waits for the confirmation dialog, failing with a clear message if it never shows. */
  async expectConfirmation(timeoutMs = 60_000): Promise<void> {
    try {
      await expect(this.confirmation).toBeVisible({ timeout: timeoutMs });
    } catch {
      throw new Error(
        `The "Your lead has been converted" confirmation did not appear within ${timeoutMs / 1000}s. ` +
          'The conversion may have failed, or this screen differs from what was assumed.'
      );
    }
  }

  /**
   * Reads the new records' ids from the confirmation links, scoped to the confirmation dialog.
   *
   * Why a CSS selector: the links' visible names are the record names, which vary, and the
   * dialog's link markup was never inspected. The link target (/lightning/r/<Object>/<id>/)
   * is the stable, object-specific fact, so it is matched with a plain `a[href*=...]`
   * attribute selector. No Salesforce/Aura class names are used.
   *
   * `expectOpportunity` states what the conversion was set up to do. A missing Opportunity
   * link when one is expected, or a present one when none is expected, fails the test.
   */
  async captureRecordIds(expectOpportunity: boolean): Promise<ConvertedRecordIds> {
    const accountId = await this.idFromLink('Account');
    const contactId = await this.idFromLink('Contact');
    const opportunityId = await this.idFromLink('Opportunity');

    if (!accountId) throw new Error('No Account link was found in the conversion confirmation.');
    if (!contactId) throw new Error('No Contact link was found in the conversion confirmation.');

    if (expectOpportunity && !opportunityId) {
      throw new Error('An Opportunity was expected, but the confirmation has no Opportunity link.');
    }
    if (!expectOpportunity && opportunityId) {
      throw new Error('No Opportunity was expected, but the confirmation has an Opportunity link.');
    }

    return { accountId, contactId, opportunityId };
  }

  /** Returns the id from the single link to this object, or undefined if there is none. */
  private async idFromLink(object: ConvertedObject): Promise<string | undefined> {
    const links = this.confirmation.locator(`a[href*="/lightning/r/${object}/"]`);
    const count = await links.count();
    if (count === 0) return undefined;
    if (count > 1) {
      throw new Error(`Found ${count} ${object} links in the confirmation; expected exactly one.`);
    }
    const href = (await links.first().getAttribute('href')) ?? '';
    const match = new RegExp(`/lightning/r/${object}/([a-zA-Z0-9]{15,18})(?:/|$|\\?)`).exec(href);
    if (!match) {
      // Never put the link in the message.
      throw new Error(`The ${object} link in the confirmation did not contain a record id.`);
    }
    return match[1];
  }

  // ---- Verifying the records (each one opens the record by its id) --------------------

  /** The Lead now carries the Converted Status chosen in the dialog (e.g. "Closed - Converted"). */
  async expectLeadConverted(leadId: string, convertedStatus: string): Promise<void> {
    const lead = new RecordPage(this.page, 'Lead');
    await lead.open(leadId);
    await lead.openDetails();
    await lead.expectDetail('Lead Status', convertedStatus);
  }

  /** Reads and verifies the created Account's title and name. */
  async expectAccount(accountId: string, accountName: string): Promise<void> {
    const account = new RecordPage(this.page, 'Account');
    await account.open(accountId);
    await account.expectTitle(accountName);
    await account.openDetails();
    await account.expectDetail('Account Name', accountName);
  }

  /**
   * Reads and verifies the created Contact, including its link to the Account
   * (the Account-Contact relationship, checked from the Contact's own "Account Name").
   */
  async expectContact(
    contactId: string,
    firstName: string,
    lastName: string,
    accountName: string
  ): Promise<void> {
    const contact = new RecordPage(this.page, 'Contact');
    await contact.open(contactId);
    await contact.openDetails();
    await contact.expectDetail('Name', `${firstName} ${lastName}`);
    await contact.expectDetail('Account Name', accountName);
  }

  /**
   * Reads and verifies the created Opportunity, including its link to the Account
   * (the Account-Opportunity relationship, checked from the Opportunity's "Account Name").
   */
  async expectOpportunity(
    opportunityId: string,
    opportunityName: string,
    accountName: string
  ): Promise<void> {
    const opportunity = new RecordPage(this.page, 'Opportunity');
    await opportunity.open(opportunityId);
    await opportunity.expectTitle(opportunityName);
    await opportunity.openDetails();
    await opportunity.expectDetail('Opportunity Name', opportunityName);
    await opportunity.expectDetail('Account Name', accountName);
  }

  /** The no-Opportunity case: the confirmation must not offer an Opportunity at all. */
  async expectNoOpportunityCreated(): Promise<void> {
    await expect(this.confirmation.locator('a[href*="/lightning/r/Opportunity/"]')).toHaveCount(0);
  }
}
