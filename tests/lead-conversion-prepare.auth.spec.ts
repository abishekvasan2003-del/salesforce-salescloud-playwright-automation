import { test, expect } from '../fixtures';
import { envValue, missingEnv, missingEnvMessage } from '../fixtures/testData';
import { LeadConversionDialog } from '../pages/LeadConversionDialog';
import { RecordPage } from '../pages/RecordPage';

/*
 * STAGE 1 of Lead conversion: preparation only. Runs in the "authenticated" project.
 *
 * Opens the Convert Lead dialog for an existing Lead, checks the Create New sections are
 * prefilled as expected, and CANCELS. It never clicks the final "Convert" button (the page
 * object has no method for it), never selects an existing Account or Contact, and never
 * creates, edits, converts or deletes a record.
 *
 * Needs an unconverted Lead in your org (SF_CONVERT_LEAD_ID). The expected values are the
 * Company and Name saved on that Lead, which Salesforce copies into the dialog
 * (SF_CONVERT_LEAD_COMPANY, SF_CONVERT_LEAD_FIRST_NAME, SF_CONVERT_LEAD_LAST_NAME; see
 * .env.example). The tests are skipped if any of them is not set.
 *
 * Traces, screenshots and videos are off: they could capture session or org data.
 */
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const REQUIRED_ENV = [
  'SF_CONVERT_LEAD_ID',
  'SF_CONVERT_LEAD_COMPANY',
  'SF_CONVERT_LEAD_FIRST_NAME',
  'SF_CONVERT_LEAD_LAST_NAME',
];
const missing = missingEnv(REQUIRED_ENV);
test.skip(missing.length > 0, missingEnvMessage(missing));

const LEAD_ID = envValue('SF_CONVERT_LEAD_ID');

const EXPECTED_COMPANY = envValue('SF_CONVERT_LEAD_COMPANY');
const EXPECTED_FIRST_NAME = envValue('SF_CONVERT_LEAD_FIRST_NAME');
const EXPECTED_LAST_NAME = envValue('SF_CONVERT_LEAD_LAST_NAME');
/** Salesforce prefills the Opportunity Name as "<Company>-". */
const EXPECTED_OPPORTUNITY_NAME = `${EXPECTED_COMPANY}-`;
const EXPECTED_CONVERTED_STATUS = 'Closed - Converted';

/*
 * Temporary values typed into the open dialog by the configuration test. They are never
 * saved: the dialog is cancelled and the final Convert button is never clicked.
 */
const TEMP_ACCOUNT_NAME = 'PW-TEMP-DO-NOT-SAVE Account Stage1B';
const TEMP_FIRST_NAME = 'PW-TEMP-First';
const TEMP_LAST_NAME = 'PW-TEMP-Last-DoNotSave';
const TEMP_OPPORTUNITY_NAME = 'PW-TEMP-DO-NOT-SAVE Opportunity Stage1B';

test.describe('Lead conversion preparation (cancels, never converts)', () => {
  let conversion: LeadConversionDialog;

  test.beforeEach(async ({ page }) => {
    conversion = new LeadConversionDialog(page);
    await new RecordPage(page, 'Lead').open(LEAD_ID);
    await conversion.openFromLeadPage();
  });

  /* Same safe cleanup as the dialog tests: only ever clicks "Cancel" buttons. */
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

  test('prepares the conversion, verifies the prefilled values, then cancels', async () => {
    await test.step('Default modes are Create New Account, Contact and Opportunity', async () => {
      await conversion.expectDefaultSelections();
    });

    await test.step('Account section is prefilled from the Lead Company', async () => {
      await conversion.expectAccountName(EXPECTED_COMPANY);
    });

    await test.step('Contact section is prefilled from the Lead Name', async () => {
      await conversion.expectContactName(EXPECTED_FIRST_NAME, EXPECTED_LAST_NAME);
    });

    await test.step('Opportunity section is prefilled and will be created', async () => {
      await conversion.expectOpportunityName(EXPECTED_OPPORTUNITY_NAME);
      await conversion.expectOpportunityCheckboxUnchecked();
    });

    await test.step('Record Owner is selected and Converted Status is the converted status', async () => {
      await conversion.expectRecordOwner();
      await conversion.expectConvertedStatus(EXPECTED_CONVERTED_STATUS);
    });

    await test.step('Cancel without converting', async () => {
      await conversion.cancel();
    });
  });

  test('configures the conversion fields in the dialog only, then cancels', async () => {
    await test.step('Type temporary Account, Contact and Opportunity values', async () => {
      await conversion.fillAccountName(TEMP_ACCOUNT_NAME);
      await conversion.fillContactName(TEMP_FIRST_NAME, TEMP_LAST_NAME);
      await conversion.fillOpportunityName(TEMP_OPPORTUNITY_NAME);
    });

    await test.step('Read every changed field back', async () => {
      expect(await conversion.getAccountName()).toBe(TEMP_ACCOUNT_NAME);
      expect(await conversion.getContactName()).toEqual({
        firstName: TEMP_FIRST_NAME,
        lastName: TEMP_LAST_NAME,
      });
      expect(await conversion.getOpportunityName()).toBe(TEMP_OPPORTUNITY_NAME);
    });

    await test.step("Opportunity checkbox: checked when enabled, unchecked when restored", async () => {
      await conversion.expectOpportunityCheckboxUnchecked();

      await conversion.setDontCreateOpportunity(true);
      await conversion.expectOpportunityCheckboxChecked();

      await conversion.setDontCreateOpportunity(false);
      await conversion.expectOpportunityCheckboxUnchecked();
    });

    await test.step('Cancel without converting; the dialog closes', async () => {
      await conversion.cancel();
    });
  });
});
