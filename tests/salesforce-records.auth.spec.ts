import { test } from '../fixtures';
import { envValue, missingEnv, missingEnvMessage } from '../fixtures/testData';
import { RecordPage } from '../pages/RecordPage';

/*
 * READ-ONLY checks of three existing Salesforce records (an Account, one of its Contacts and
 * one of its Opportunities). Runs in the "authenticated" project with the saved login.
 *
 * Nothing here creates, edits, saves, converts or deletes a record: each test only opens a
 * record by its id, opens the Details tab and reads it.
 *
 * The record ids, names and expected values are org-specific, so they come from environment
 * variables (see .env.example), never from the source. Point them at an Account, one of its
 * Contacts and one of its Opportunities in your own org. The tests are skipped if any of
 * them is not set, and they fail if those records are edited or deleted or if your locale
 * formats the Amount differently from the value you configured.
 *
 * Traces, screenshots and videos are off: they could capture session or org data.
 */
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const REQUIRED_ENV = [
  'SF_ACCOUNT_ID',
  'SF_ACCOUNT_NAME',
  'SF_ACCOUNT_RATING',
  'SF_ACCOUNT_INDUSTRY',
  'SF_ACCOUNT_TYPE',
  'SF_CONTACT_ID',
  'SF_CONTACT_NAME',
  'SF_CONTACT_EMAIL',
  'SF_CONTACT_TITLE',
  'SF_OPPORTUNITY_ID',
  'SF_OPPORTUNITY_NAME',
  'SF_OPPORTUNITY_STAGE',
  'SF_OPPORTUNITY_AMOUNT',
];
const missing = missingEnv(REQUIRED_ENV);
test.skip(missing.length > 0, missingEnvMessage(missing));

const ACCOUNT_ID = envValue('SF_ACCOUNT_ID');
const ACCOUNT_NAME = envValue('SF_ACCOUNT_NAME');
const ACCOUNT_RATING = envValue('SF_ACCOUNT_RATING');
const ACCOUNT_INDUSTRY = envValue('SF_ACCOUNT_INDUSTRY');
const ACCOUNT_TYPE = envValue('SF_ACCOUNT_TYPE');

const CONTACT_ID = envValue('SF_CONTACT_ID');
/** The page title omits the salutation; the "Name" detail may show it (contains check). */
const CONTACT_NAME = envValue('SF_CONTACT_NAME');
const CONTACT_EMAIL = envValue('SF_CONTACT_EMAIL');
const CONTACT_TITLE = envValue('SF_CONTACT_TITLE');

const OPPORTUNITY_ID = envValue('SF_OPPORTUNITY_ID');
const OPPORTUNITY_NAME = envValue('SF_OPPORTUNITY_NAME');
const OPPORTUNITY_STAGE = envValue('SF_OPPORTUNITY_STAGE');
/** Exactly as your org displays it, including currency symbol and locale formatting. */
const OPPORTUNITY_AMOUNT = envValue('SF_OPPORTUNITY_AMOUNT');

test('Account: opens by id and shows the expected title and details', async ({ page }) => {
  const account = new RecordPage(page, 'Account');

  await test.step('Open the Account and check its title', async () => {
    await account.open(ACCOUNT_ID);
    await account.expectTitle(ACCOUNT_NAME);
  });

  await test.step('Check the Details tab', async () => {
    await account.openDetails();
    await account.expectDetail('Account Name', ACCOUNT_NAME);
    await account.expectDetail('Rating', ACCOUNT_RATING);
    await account.expectDetail('Industry', ACCOUNT_INDUSTRY);
    await account.expectDetail('Type', ACCOUNT_TYPE);
  });
});

test('Contact: opens by id and shows the expected title, details and Account', async ({ page }) => {
  const contact = new RecordPage(page, 'Contact');

  await test.step('Open the Contact and check its title', async () => {
    await contact.open(CONTACT_ID);
    await contact.expectTitle(CONTACT_NAME);
  });

  await test.step('Check the Details tab, including the related Account', async () => {
    await contact.openDetails();
    await contact.expectDetail('Name', CONTACT_NAME);
    await contact.expectDetail('Email', CONTACT_EMAIL);
    await contact.expectDetail('Title', CONTACT_TITLE);
    await contact.expectDetail('Account Name', ACCOUNT_NAME);
  });
});

test('Opportunity: opens by id and shows the expected title, details and Account', async ({
  page,
}) => {
  const opportunity = new RecordPage(page, 'Opportunity');

  await test.step('Open the Opportunity and check its title', async () => {
    await opportunity.open(OPPORTUNITY_ID);
    await opportunity.expectTitle(OPPORTUNITY_NAME);
  });

  await test.step('Check the Details tab, including the related Account', async () => {
    await opportunity.openDetails();
    await opportunity.expectDetail('Opportunity Name', OPPORTUNITY_NAME);
    await opportunity.expectDetail('Stage', OPPORTUNITY_STAGE);
    await opportunity.expectDetail('Amount', OPPORTUNITY_AMOUNT);
    await opportunity.expectDetail('Account Name', ACCOUNT_NAME);
  });
});
