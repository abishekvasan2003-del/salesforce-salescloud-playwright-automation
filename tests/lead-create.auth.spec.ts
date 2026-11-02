import { test, expect } from '../fixtures';
import { buildLead, leadFullName } from '../fixtures/testData';
import { ListPage } from '../pages/ListPage';
import { RecordFormDialog } from '../pages/RecordFormDialog';
import { RecordPage } from '../pages/RecordPage';

/*
 * Runs in the "authenticated" project with the saved login.
 * Traces, screenshots and videos are all turned off: they can capture session data or
 * Salesforce org data.
 */
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

/*
 * SAFETY GUARD: this test CREATES A REAL LEAD in Salesforce every time it runs, and there is
 * no cleanup. It is SKIPPED unless SF_ALLOW_LEAD_CREATION is set to exactly
 * "I-UNDERSTAND-THIS-CREATES-A-LEAD". It is never set in this project's files.
 */
test.skip(
  process.env.SF_ALLOW_LEAD_CREATION !== 'I-UNDERSTAND-THIS-CREATES-A-LEAD',
  'Creates a real Lead. Set SF_ALLOW_LEAD_CREATION=I-UNDERSTAND-THIS-CREATES-A-LEAD to run.'
);

test('creates a Lead and verifies its saved details', async ({ page, homePage }) => {
  const lead = buildLead();
  const fullName = leadFullName(lead);

  const leads = new ListPage(page);
  const newLeadForm = new RecordFormDialog(page, 'New Lead');
  const leadPage = new RecordPage(page, 'Lead');

  let leadId = '';

  await test.step('Open the authenticated Salesforce Home page', async () => {
    await homePage.open();
    await homePage.expectSalesApp();
  });

  await test.step('Go to Leads and open the New Lead form', async () => {
    await leads.open('Leads');
    await leads.clickNew();
    await newLeadForm.expectOpen();
  });

  await test.step('Fill in the generated Lead', async () => {
    await newLeadForm.fillText('First Name', lead.firstName);
    await newLeadForm.fillText('Last Name', lead.lastName);
    await newLeadForm.fillText('Company', lead.company);
    await newLeadForm.fillText('Title', lead.title);
    await newLeadForm.fillText('Email', lead.email);
    await newLeadForm.selectOption('Lead Source', lead.leadSource);
    await newLeadForm.selectOption('Industry', lead.industry);
    await newLeadForm.selectOption('Lead Status', lead.status);
    await newLeadForm.selectOption('Rating', lead.rating);
  });

  await test.step('Save the Lead, check the success notification and capture its id', async () => {
    await newLeadForm.save();
    await leadPage.expectCreatedToast(fullName);
    leadId = await leadPage.waitForRecordId();
  });

  await test.step('Leave, then reopen the created Lead directly by its id', async () => {
    await leads.open('Leads');
    await leadPage.open(leadId);
  });

  await test.step('Verify the record title and saved details', async () => {
    await expect(page).toHaveURL(new RegExp(`/lightning/r/Lead/${leadId}/view`));
    await leadPage.expectTitle(fullName);
    await leadPage.openDetails();

    await leadPage.expectDetail('Name', fullName);
    await leadPage.expectDetail('Company', lead.company);
    await leadPage.expectDetail('Title', lead.title);
    await leadPage.expectDetail('Email', lead.email);
    await leadPage.expectDetail('Lead Source', lead.leadSource);
    await leadPage.expectDetail('Industry', lead.industry);
    await leadPage.expectDetail('Lead Status', lead.status);
    await leadPage.expectDetail('Rating', lead.rating);
  });
});
