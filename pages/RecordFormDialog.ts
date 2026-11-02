import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * A Salesforce "New <object>" dialog, found by its title (for example "New Lead").
 *
 * Fields are addressed by their visible label, exactly as shown on the form. Each test
 * decides which fields to fill, so field-specific behaviour stays in the test.
 */
export class RecordFormDialog extends BasePage {
  private readonly dialog: Locator;

  constructor(page: Page, title: string) {
    super(page);
    this.dialog = page.getByRole('dialog', { name: title, exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  /** Types into a text box by its label, e.g. fillText('Last Name', 'Smith'). */
  async fillText(label: string, value: string): Promise<void> {
    await this.dialog.getByRole('textbox', { name: label, exact: true }).fill(value);
  }

  /** Picks a dropdown option by label, e.g. selectOption('Lead Source', 'Web'). */
  async selectOption(label: string, option: string): Promise<void> {
    await this.dialog.getByRole('combobox', { name: label, exact: true }).click();
    await this.dialog.getByRole('option', { name: option, exact: true }).click();
  }

  /** Clicks Save only. Use this when you expect validation errors and the dialog to stay open. */
  async clickSave(): Promise<void> {
    await this.dialog.getByRole('button', { name: 'Save', exact: true }).click();
  }

  /** Clicks Save and waits for the dialog to close (the record was saved). */
  async save(): Promise<void> {
    await this.clickSave();
    await expect(this.dialog).toBeHidden();
  }

  /**
   * Checks Salesforce is showing its required-field error in this dialog.
   * NEEDS UI INSPECTION: the text "Complete this field." was seen on an empty required
   * field, but it is not yet tied to one specific field. This is not used by the Lead
   * creation test.
   */
  async expectRequiredFieldError(): Promise<void> {
    await expect(this.dialog.getByText('Complete this field.').first()).toBeVisible();
  }
}
