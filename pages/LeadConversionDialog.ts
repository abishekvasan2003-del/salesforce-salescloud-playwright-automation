import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** The three record types that the Convert Lead dialog can create or link. */
export type ConversionSection = 'Account' | 'Contact' | 'Opportunity';

/** Records that have a "Choose Existing ..." search in the Convert Lead dialog. */
export type SearchableSection = 'Account' | 'Contact';

/**
 * The "Convert Lead" dialog, opened from the Convert button on a Lead record page.
 *
 * Everything here is read-only/cancel-only EXCEPT convert(), which is the single method
 * that clicks the dialog's final "Convert" button. convert() REALLY CONVERTS THE LEAD: it
 * creates Salesforce records and changes the Lead's status. No preparation, search or
 * cancel method calls it, and only the explicitly guarded conversion tests may.
 * Nothing in this class clicks a "Select" action in a results table.
 *
 * Stacked dialogs: opening Account/Contact Results puts a second dialog on top of the
 * Convert Lead dialog (both stay in the page). Neither dialog has an accessible name in
 * Salesforce, so each one is found by the level-1 heading it contains. Conversion
 * controls are always searched inside the Convert Lead dialog, and results controls are
 * always searched inside the results dialog.
 */
export class LeadConversionDialog extends BasePage {
  private readonly dialog: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = LeadConversionDialog.dialogWithHeading(page, 'Convert Lead');
  }

  private static dialogWithHeading(page: Page, title: string): Locator {
    return page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: title, level: 1, exact: true }) });
  }

  private resultsDialog(section: SearchableSection): Locator {
    return LeadConversionDialog.dialogWithHeading(this.page, `${section} Results`);
  }

  /** The "Create New X" / "Choose Existing X" radio buttons are named exactly like this. */
  private radio(mode: 'Create New' | 'Choose Existing', section: ConversionSection): Locator {
    return this.dialog.getByRole('radio', { name: `${mode} ${section}`, exact: true });
  }

  private get opportunityCheckbox(): Locator {
    return this.dialog.getByRole('checkbox', {
      name: "Don't create an opportunity upon conversion checkbox",
      exact: true,
    });
  }

  private searchBox(section: SearchableSection): Locator {
    return this.dialog.getByRole('combobox', { name: `${section} Search`, exact: true });
  }

  // ---- Opening / closing the Convert Lead dialog --------------------------------------

  /**
   * Clicks "Convert" in the Lead record page header, which only OPENS this dialog.
   * This is the page-header button, not the dialog's final Convert button. It refuses to
   * click if a dialog is already open, so it can never reach the dialog's Convert button.
   */
  async openFromLeadPage(): Promise<void> {
    await expect(this.page.getByRole('dialog')).toHaveCount(0);
    await this.page.getByRole('button', { name: 'Convert', exact: true }).click();
    await this.expectOpen();
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  // ---- Conversion (DESTRUCTIVE: creates records and converts the Lead) ------------------

  /**
   * Clicks the dialog's final "Convert" button and waits for the dialog to close.
   *
   * THIS CONVERTS THE LEAD. It creates the chosen Account/Contact/Opportunity in Salesforce
   * and sets the Lead's status to the Converted Status. A Lead can only be converted once.
   *
   * The button is looked up INSIDE the Convert Lead dialog (found by its level-1 heading)
   * by role and exact name "Convert". That cannot match the Lead page header's Convert
   * button (outside the dialog), "Cancel" or "Cancel and close". The click is refused unless
   * exactly one such button exists. Use LeadConversionResult for what happens afterwards.
   *
   * NEEDS RUNTIME VERIFICATION: written from the preparation inspection; it has never run.
   */
  async convert(timeoutMs = 60_000): Promise<void> {
    await this.expectOpen();

    const convertButton = this.dialog.getByRole('button', { name: 'Convert', exact: true });
    const buttonCount = await convertButton.count();
    if (buttonCount !== 1) {
      throw new Error(
        `Refusing to convert: expected exactly one "Convert" button in the Convert Lead dialog, found ${buttonCount}.`
      );
    }

    await convertButton.click();

    try {
      await expect(this.dialog).toBeHidden({ timeout: timeoutMs });
    } catch {
      // The dialog stayed open: most likely a validation error. Report generic alert text only.
      const alerts = await this.dialog.getByRole('alert').allInnerTexts().catch(() => []);
      const shown = alerts.map((a) => a.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
      throw new Error(
        `Conversion did not finish: the Convert Lead dialog was still open after ${timeoutMs / 1000}s. ` +
          (shown ? `Dialog messages: ${shown.slice(0, 300)}` : 'No error message was visible in the dialog.')
      );
    }
  }

  /** Clicks the dialog's own "Cancel" button (nothing is converted) and waits for it to close. */
  async cancel(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(this.dialog).toBeHidden();
  }

  // ---- Create New / Choose Existing selections ----------------------------------------

  async expectCreateNewSelected(section: ConversionSection): Promise<void> {
    await expect(this.radio('Create New', section)).toBeChecked();
  }

  async expectChooseExistingSelected(section: ConversionSection): Promise<void> {
    await expect(this.radio('Choose Existing', section)).toBeChecked();
  }

  /** Verifies the default state: a new Account, Contact and Opportunity will be created. */
  async expectDefaultSelections(): Promise<void> {
    await this.expectCreateNewSelected('Account');
    await this.expectCreateNewSelected('Contact');
    await this.expectCreateNewSelected('Opportunity');
  }

  /**
   * Selects a radio by clicking its linked <label>, then checks the radio is checked.
   *
   * Why not radio.check(): Salesforce draws a custom radio. The real <input> is a 1x1 px
   * element inside <span class="slds-radio">, and that span covers the click point, so
   * Playwright reports "intercepts pointer events" and times out (seen in the real org).
   * Each input has one standard <label for="<input id>"> that holds the visible radio, and
   * clicking it selects the radio. The radio is found by role and exact name, then its id
   * is read at click time (ids and group names change on every page load, so none are
   * hard-coded). No Salesforce/Aura class names are used.
   */
  private async selectRadio(
    mode: 'Create New' | 'Choose Existing',
    section: ConversionSection
  ): Promise<void> {
    const radio = this.radio(mode, section);
    const radioId = await radio.getAttribute('id');
    if (!radioId) {
      throw new Error(`The "${mode} ${section}" radio has no id, so its linked label cannot be found.`);
    }
    await this.dialog.locator(`label[for="${radioId}"]`).click();
    await expect(radio).toBeChecked();
  }

  async chooseExisting(section: SearchableSection): Promise<void> {
    await this.selectRadio('Choose Existing', section);
    await expect(this.searchBox(section)).toBeVisible();
  }

  async chooseCreateNew(section: ConversionSection): Promise<void> {
    await this.selectRadio('Create New', section);
  }

  /**
   * Puts Account and Contact back to "Create New", then brings Opportunity back to its
   * default only if the UI allows it. Salesforce may change the Opportunity radio when the
   * Account or Contact mode changes, so it is not assumed to be unchanged:
   *  - "Create New Opportunity" already checked: nothing to do.
   *  - not checked but enabled: it is checked.
   *  - disabled: it is left alone and not asserted.
   * The "Don't create an opportunity" checkbox is only ever asserted unchecked (never clicked here).
   */
  async restoreDefaultSelections(): Promise<void> {
    await this.chooseCreateNew('Account');
    await this.chooseCreateNew('Contact');
    await this.expectCreateNewSelected('Account');
    await this.expectCreateNewSelected('Contact');

    const newOpportunity = this.radio('Create New', 'Opportunity');
    await expect(newOpportunity).toBeVisible();
    if (await newOpportunity.isEnabled()) {
      if (!(await newOpportunity.isChecked())) {
        await this.selectRadio('Create New', 'Opportunity');
      }
      await this.expectCreateNewSelected('Opportunity');
    }

    if (await this.opportunityCheckbox.isVisible()) {
      await this.expectOpportunityCheckboxUnchecked();
    }
  }

  // ---- "Don't create an opportunity" checkbox -----------------------------------------

  async expectOpportunityCheckboxUnchecked(): Promise<void> {
    await expect(this.opportunityCheckbox).not.toBeChecked();
  }

  async expectOpportunityCheckboxChecked(): Promise<void> {
    await expect(this.opportunityCheckbox).toBeChecked();
  }

  /**
   * Toggles the "Don't create an opportunity" checkbox by clicking its linked <label>.
   *
   * Why a CSS selector is needed here: during MCP inspection, clicking the checkbox
   * itself did not toggle it, because Salesforce draws a custom box that covers the real
   * <input>. The visible label text is a standard <label for="<checkbox id>"> element, and
   * clicking it does toggle the checkbox. A label with that text has no accessible role,
   * so getByRole cannot find it, and getByText would also match the separate caption
   * ("Don't create an opportunity upon conversion") next to it. The only reliable
   * link is the checkbox's own id, so we read that id and use the standard HTML
   * `label[for=...]` attribute selector. No Salesforce/Aura class names are used.
   * The id is generated per page load, so it is read at click time and never hard-coded.
   */
  async toggleOpportunityCheckbox(): Promise<void> {
    const checkboxId = await this.opportunityCheckbox.getAttribute('id');
    if (!checkboxId) {
      throw new Error('The opportunity checkbox has no id, so its linked label cannot be found.');
    }
    await this.dialog.locator(`label[for="${checkboxId}"]`).click();
  }

  // ---- Create New sections: prefilled values (Stage 1 conversion preparation) ----------
  //
  // Field names below are the exact accessible names seen in the real org (MCP inspection):
  // textboxes "Account Name *", "First Name", "Last Name *", "Opportunity Name *"; combobox
  // "Salutation -- None --"; list "Record Owner - Current Selection: <name>"; combobox
  // "Converted Status". Nothing here clicks Convert. Filling a field only changes the
  // open dialog, and nothing is saved unless the final Convert button is clicked (which
  // this page object cannot do).

  /**
   * Each section is an accordion with a header button named exactly "Account", "Contact"
   * or "Opportunity". Its fields are only in the page while it is expanded, so this
   * expands the section if needed (aria-expanded) and waits for that state.
   */
  async expandSection(section: ConversionSection): Promise<void> {
    const header = this.dialog.getByRole('button', { name: section, exact: true });
    if ((await header.getAttribute('aria-expanded')) !== 'true') {
      await header.click();
    }
    await expect(header).toHaveAttribute('aria-expanded', 'true');
  }

  private get accountNameBox(): Locator {
    return this.dialog.getByRole('textbox', { name: 'Account Name *', exact: true });
  }

  private get contactFirstNameBox(): Locator {
    return this.dialog.getByRole('textbox', { name: 'First Name', exact: true });
  }

  private get contactLastNameBox(): Locator {
    return this.dialog.getByRole('textbox', { name: 'Last Name *', exact: true });
  }

  private get opportunityNameBox(): Locator {
    return this.dialog.getByRole('textbox', { name: 'Opportunity Name *', exact: true });
  }

  private get recordOwnerList(): Locator {
    return this.dialog.getByRole('list', { name: /^Record Owner - Current Selection:/ });
  }

  private get convertedStatusBox(): Locator {
    return this.dialog.getByRole('combobox', { name: 'Converted Status', exact: true });
  }

  // Readers: expand the section first, then return the current text.

  async getAccountName(): Promise<string> {
    await this.expandSection('Account');
    return this.accountNameBox.inputValue();
  }

  async getContactName(): Promise<{ firstName: string; lastName: string }> {
    await this.expandSection('Contact');
    return {
      firstName: await this.contactFirstNameBox.inputValue(),
      lastName: await this.contactLastNameBox.inputValue(),
    };
  }

  async getOpportunityName(): Promise<string> {
    await this.expandSection('Opportunity');
    return this.opportunityNameBox.inputValue();
  }

  /** The selected Record Owner's display text, with the remove "✕" button text dropped. */
  async getRecordOwner(): Promise<string> {
    const text = await this.recordOwnerList.getByRole('listitem').first().innerText();
    return text.replace(/✕/g, '').trim();
  }

  async getConvertedStatus(): Promise<string> {
    return (await this.convertedStatusBox.innerText()).trim();
  }

  // Verifiers (auto-retrying): each one expands its section first.

  async expectAccountName(expected: string): Promise<void> {
    await this.expandSection('Account');
    await expect(this.accountNameBox).toHaveValue(expected);
  }

  async expectContactName(firstName: string, lastName: string): Promise<void> {
    await this.expandSection('Contact');
    await expect(this.contactFirstNameBox).toHaveValue(firstName);
    await expect(this.contactLastNameBox).toHaveValue(lastName);
  }

  async expectOpportunityName(expected: string): Promise<void> {
    await this.expandSection('Opportunity');
    await expect(this.opportunityNameBox).toHaveValue(expected);
  }

  /** Checks a Record Owner is selected; pass `expected` to also check who it is. */
  async expectRecordOwner(expected?: string): Promise<void> {
    await expect(this.recordOwnerList).toHaveAccessibleName(
      expected === undefined
        ? /^Record Owner - Current Selection: \S/
        : `Record Owner - Current Selection: ${expected}`
    );
  }

  async expectConvertedStatus(expected: string): Promise<void> {
    await expect(this.convertedStatusBox).toHaveText(expected);
  }

  // Configuration: these only change the open dialog (nothing is saved until Convert).

  async fillAccountName(value: string): Promise<void> {
    await this.expandSection('Account');
    await this.accountNameBox.fill(value);
  }

  async fillContactName(firstName: string, lastName: string): Promise<void> {
    await this.expandSection('Contact');
    await this.contactFirstNameBox.fill(firstName);
    await this.contactLastNameBox.fill(lastName);
  }

  async fillOpportunityName(value: string): Promise<void> {
    await this.expandSection('Opportunity');
    await this.opportunityNameBox.fill(value);
  }

  /** Sets "Don't create an opportunity" to the wanted state, toggling only if it differs. */
  async setDontCreateOpportunity(checked: boolean): Promise<void> {
    await this.expandSection('Opportunity');
    if ((await this.opportunityCheckbox.isChecked()) !== checked) {
      await this.toggleOpportunityCheckbox();
    }
    if (checked) {
      await this.expectOpportunityCheckboxChecked();
    } else {
      await this.expectOpportunityCheckboxUnchecked();
    }
  }

  // ---- Existing Account / Contact search ----------------------------------------------

  async expectSearchBoxVisible(section: SearchableSection): Promise<void> {
    await expect(this.searchBox(section)).toBeVisible();
    await expect(this.searchBox(section)).toBeEnabled();
  }

  /**
   * Types a search term into "<Account|Contact> Search", then clicks the search-action
   * option in that field's suggestion list, which opens the "<Account|Contact> Results"
   * dialog on top. It never picks a result and has no keyboard fallback.
   *
   * Observed option name (Contact, MCP inspection): `Search for matching contacts "Ro" in Contact`.
   * The Account option is assumed to follow the same pattern (not captured; see report).
   * The option is looked up inside the Convert Lead dialog, and its name contains the
   * section and the typed term, so it cannot be another field's option.
   */
  async openResults(section: SearchableSection, searchTerm: string): Promise<void> {
    const box = this.searchBox(section);
    await box.fill(searchTerm);

    const optionName = `Search for matching ${section.toLowerCase()}s "${searchTerm}" in ${section}`;
    const searchOption = this.dialog.getByRole('option', { name: optionName, exact: true });

    // Wait for exactly one visible option. Never fall back to the keyboard or another control.
    try {
      await expect(searchOption).toHaveCount(1);
      await expect(searchOption).toBeVisible();
    } catch {
      const found = await searchOption.count();
      throw new Error(
        `Could not identify the ${section} search-action option. Expected exactly one visible ` +
          `option named: ${optionName} (found ${found}). Nothing was clicked.`
      );
    }

    await searchOption.click();
    await expect(this.resultsDialog(section)).toBeVisible();
  }

  /**
   * Checks the topmost results dialog: its title, the search box that carries our term,
   * the results heading ("Accounts Results" / "Contacts Results") and the table headers.
   * Only headers are checked, because the rows depend on org data.
   */
  async expectResults(
    section: SearchableSection,
    searchTerm: string,
    columns: readonly string[]
  ): Promise<void> {
    const results = this.resultsDialog(section);
    await expect(results).toBeVisible();
    await expect(results.getByRole('combobox', { name: `${section} Search`, exact: true })).toHaveValue(
      searchTerm
    );
    await expect(
      results.getByRole('heading', { name: `${section}s Results`, level: 2, exact: true })
    ).toBeVisible();
    await expect(results.getByRole('table')).toBeVisible();
    for (const column of columns) {
      await expect(results.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
    }
  }

  /**
   * Closes the results dialog with its own "Cancel" button, choosing no record, and checks
   * that the Convert Lead dialog is still open underneath.
   */
  async cancelResults(section: SearchableSection): Promise<void> {
    const results = this.resultsDialog(section);
    await results.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(results).toBeHidden();
    await this.expectOpen();
  }

  /**
   * Best-effort cleanup for afterEach. Cancels the topmost dialog first (an Account or
   * Contact Results dialog), then the Convert Lead dialog. Only ever clicks buttons named
   * exactly "Cancel", each inside a dialog identified by its heading. It has no path to
   * the final "Convert" button or to any result row.
   *
   * A dialog is only touched if exactly one visible dialog matches its heading. If a
   * match is ambiguous, or the Convert Lead dialog is still open after its Cancel, nothing
   * more is clicked and a note is returned for the caller to report.
   */
  async cancelOpenDialogs(): Promise<string[]> {
    const notes: string[] = [];

    // 1. Topmost first: any VISIBLE results dialog. Hidden leftovers in the DOM are ignored.
    for (const section of ['Account', 'Contact'] as const) {
      const results = this.resultsDialog(section).filter({ visible: true });
      const count = await results.count();
      if (count === 0) continue;
      if (count > 1) {
        notes.push(`Cleanup stopped: ${count} visible "${section} Results" dialogs (ambiguous).`);
        return notes;
      }
      await results.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(results).toHaveCount(0);
    }

    // 2. Then the Convert Lead dialog, if it is visible.
    const convert = this.dialog.filter({ visible: true });
    const count = await convert.count();
    if (count === 0) return notes;
    if (count > 1) {
      notes.push(`Cleanup stopped: ${count} visible "Convert Lead" dialogs (ambiguous).`);
      return notes;
    }
    await convert.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(convert).toHaveCount(0);
    return notes;
  }
}
