import { test, expect } from '../fixtures';
import { envValue, missingEnv, missingEnvMessage } from '../fixtures/testData';
import { LeadConversionDialog } from '../pages/LeadConversionDialog';
import { LeadConversionResult } from '../pages/LeadConversionResult';
import { RecordPage } from '../pages/RecordPage';

/*
 * ============================  WARNING: DESTRUCTIVE  ============================
 * These tests click the Convert Lead dialog's final "Convert" button.
 * EXECUTING A CONVERSION CREATES REAL SALESFORCE RECORDS (Account, Contact and, unless
 * disabled, Opportunity) AND CHANGES THE LEAD'S STATUS. A Lead can only be converted ONCE,
 * so the test below can pass at most once for a given Lead; later runs fail because the
 * Lead is already converted. There is no automatic undo.
 *
 * Safety guards:
 *  - The conversion test is SKIPPED unless SF_ALLOW_LEAD_CONVERSION is set to exactly
 *    "I-UNDERSTAND-THIS-CREATES-RECORDS". It is never set in this project's files.
 *  - The no-opportunity test is a DESIGN ONLY (test.fixme): it never runs.
 *  - Neither test runs in the preparation or dialog specs.
 *
 * STATUS: written but NEVER RUN. The post-conversion screens are unverified (see
 * LeadConversionResult). Traces, screenshots and videos are off: they could capture org data.
 */
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

/* The unconverted Lead to convert, from your own org. There is no default. */
const LEAD_ID = envValue('SF_CONVERT_LEAD_ID');
const MISSING_ENV = missingEnv(['SF_CONVERT_LEAD_ID']);
const CONVERSION_ALLOWED =
  process.env.SF_ALLOW_LEAD_CONVERSION === 'I-UNDERSTAND-THIS-CREATES-RECORDS';

const CONVERTED_STATUS = 'Closed - Converted';

/** Unique per run, and clearly recognisable as test data (compare buildLead in fixtures). */
function buildConversionData() {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return {
    accountName: `PWConvert Account ${stamp}`,
    firstName: 'PWConvert',
    lastName: `Contact_${stamp}`,
    opportunityName: `PWConvert Opportunity ${stamp}`,
  };
}

test.describe('Lead conversion (DESTRUCTIVE: creates records, converts the Lead)', () => {
  let conversion: LeadConversionDialog;

  test.beforeEach(async ({ page }) => {
    conversion = new LeadConversionDialog(page);
  });

  /* Cancel-only cleanup. If convert() already closed the dialog this does nothing. */
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

  test('converts the Lead with a new Account, Contact and Opportunity and verifies the records', async ({
    page,
  }) => {
    test.skip(
      !CONVERSION_ALLOWED,
      'Conversion is destructive. Set SF_ALLOW_LEAD_CONVERSION=I-UNDERSTAND-THIS-CREATES-RECORDS to run.'
    );
    test.skip(MISSING_ENV.length > 0, missingEnvMessage(MISSING_ENV));

    const data = buildConversionData();
    const result = new LeadConversionResult(page);
    let ids: Awaited<ReturnType<LeadConversionResult['captureRecordIds']>>;

    await test.step('Open the Lead and the Convert Lead dialog', async () => {
      await new RecordPage(page, 'Lead').open(LEAD_ID);
      await conversion.openFromLeadPage();
      await conversion.expectDefaultSelections();
    });

    await test.step('Set unique Account, Contact and Opportunity names', async () => {
      await conversion.fillAccountName(data.accountName);
      await conversion.fillContactName(data.firstName, data.lastName);
      await conversion.fillOpportunityName(data.opportunityName);
      await conversion.expectOpportunityCheckboxUnchecked();
      await conversion.expectConvertedStatus(CONVERTED_STATUS);
    });

    await test.step('Convert (REAL: creates records and converts the Lead)', async () => {
      await conversion.convert();
      await result.expectConfirmation();
    });

    await test.step('Capture the new record ids from the confirmation', async () => {
      ids = await result.captureRecordIds(true);
      expect(ids.opportunityId).toBeDefined();
    });

    await test.step('Verify the Lead, Account, Contact and Opportunity and their links', async () => {
      await result.expectLeadConverted(LEAD_ID, CONVERTED_STATUS);
      await result.expectAccount(ids.accountId, data.accountName);
      await result.expectContact(ids.contactId, data.firstName, data.lastName, data.accountName);
      await result.expectOpportunity(
        ids.opportunityId as string,
        data.opportunityName,
        data.accountName
      );
    });
  });

  /*
   * DESIGN ONLY, NEVER RUNS (test.fixme). A Lead converts once, so this needs its own
   * separate unconverted Lead, which has not been chosen. To enable it later: pick that
   * Lead, point LEAD_ID at it (not the Lead above), keep the CONVERSION_ALLOWED guard, and
   * remove the fixme.
   */
  test.fixme(
    'converts the Lead with "Don\'t create an opportunity" and expects no Opportunity',
    async ({ page }) => {
      const data = buildConversionData();
      const result = new LeadConversionResult(page);

      await new RecordPage(page, 'Lead').open(LEAD_ID);
      await conversion.openFromLeadPage();

      await conversion.fillAccountName(data.accountName);
      await conversion.fillContactName(data.firstName, data.lastName);
      await conversion.setDontCreateOpportunity(true);

      await conversion.convert();
      await result.expectConfirmation();

      const ids = await result.captureRecordIds(false);
      expect(ids.opportunityId).toBeUndefined();
      await result.expectNoOpportunityCreated();

      await result.expectLeadConverted(LEAD_ID, CONVERTED_STATUS);
      await result.expectAccount(ids.accountId, data.accountName);
      await result.expectContact(ids.contactId, data.firstName, data.lastName, data.accountName);
    }
  );
});
