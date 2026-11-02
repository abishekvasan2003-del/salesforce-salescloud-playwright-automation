import { test, expect } from '../fixtures';
import { envValue, missingEnv, missingEnvMessage } from '../fixtures/testData';
import { LeadConversionDialog } from '../pages/LeadConversionDialog';
import { RecordPage } from '../pages/RecordPage';

/*
 * READ-ONLY inspection of the Convert Lead dialog. Runs in the "authenticated" project.
 *
 * Safety: nothing here creates, edits, converts or deletes a record. The dialog's final
 * "Convert" button has no page object method and is never clicked, and no result row is
 * ever selected. Every test ends by cancelling the dialog.
 *
 * Needs an EXISTING, unconverted Lead in your org, given by SF_CONVERT_LEAD_ID (see
 * .env.example). The tests are skipped if it is not set. This test never creates a Lead.
 *
 * Traces, screenshots and videos are off: they could capture session or org data.
 */
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const LEAD_ID = envValue('SF_CONVERT_LEAD_ID');

const missing = missingEnv(['SF_CONVERT_LEAD_ID']);
test.skip(missing.length > 0, missingEnvMessage(missing));

const ACCOUNT_SEARCH_TERM = 'Ac';
const CONTACT_SEARCH_TERM = 'Ro';
const ACCOUNT_COLUMNS = ['Account Name', 'Account Site', 'Phone', 'Account Owner Alias', 'Action'];
const CONTACT_COLUMNS = [
  'Name',
  'Account Name',
  'Account Site',
  'Phone',
  'Email',
  'Contact Owner Alias',
  'Action',
];

test.describe('Convert Lead dialog (read-only)', () => {
  let conversion: LeadConversionDialog;

  test.beforeEach(async ({ page }) => {
    conversion = new LeadConversionDialog(page);
    await new RecordPage(page, 'Lead').open(LEAD_ID);
    await conversion.openFromLeadPage();
  });

  /*
   * If a test failed with a dialog open, cancel the topmost dialog, then Convert Lead.
   * This only ever clicks "Cancel" buttons (see cancelOpenDialogs), never "Convert".
   * A cleanup problem is recorded as a test annotation and must not hide the real failure.
   */
  test.afterEach(async () => {
    try {
      const notes = await conversion.cancelOpenDialogs();
      for (const note of notes) {
        test.info().annotations.push({ type: 'cleanup', description: note });
      }
    } catch {
      test.info().annotations.push({
        type: 'cleanup',
        description: 'Cleanup could not cancel an open dialog; nothing else was clicked.',
      });
    }
  });

  test('opens with Create New Account, Contact and Opportunity selected', async () => {
    await conversion.expectDefaultSelections();
    await conversion.cancel();
  });

  test('toggles the "Don\'t create an opportunity" checkbox through its label', async () => {
    await conversion.expectOpportunityCheckboxUnchecked();

    await conversion.toggleOpportunityCheckbox();
    await conversion.expectOpportunityCheckboxChecked();

    // Put it back the way it was.
    await conversion.toggleOpportunityCheckbox();
    await conversion.expectOpportunityCheckboxUnchecked();

    await conversion.cancel();
  });

  test('Choose Existing Account shows the search box and its results dialog', async () => {
    await conversion.chooseExisting('Account');
    await conversion.expectSearchBoxVisible('Account');

    await conversion.openResults('Account', ACCOUNT_SEARCH_TERM);
    await conversion.expectResults('Account', ACCOUNT_SEARCH_TERM, ACCOUNT_COLUMNS);
    await conversion.cancelResults('Account');

    await conversion.restoreDefaultSelections();
    await conversion.cancel();
  });

  test('Choose Existing Contact shows the search box and its results dialog', async () => {
    await conversion.chooseExisting('Contact');
    await conversion.expectSearchBoxVisible('Contact');

    await conversion.openResults('Contact', CONTACT_SEARCH_TERM);
    await conversion.expectResults('Contact', CONTACT_SEARCH_TERM, CONTACT_COLUMNS);
    await conversion.cancelResults('Contact');

    await conversion.restoreDefaultSelections();
    await conversion.cancel();
  });
});
