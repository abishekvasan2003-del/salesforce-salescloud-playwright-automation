# Salesforce Sales Cloud Automation (Playwright + TypeScript)

An independent portfolio project that demonstrates UI test automation for Salesforce Sales Cloud (Lightning Experience). It uses Playwright with TypeScript and a Page Object Model architecture, and it runs two Playwright projects: one for logged-out tests and one for tests that reuse a saved Salesforce login.

This is a personal project. It was not built for, or delivered to, any employer or client.

> **Warning:** Some tests in this repository can create or convert real records in a Salesforce org. They are disabled by default. See [Destructive-action safeguards](#destructive-action-safeguards) before you enable anything.

## Contents

- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Setup](#setup)
- [Authentication](#authentication)
- [Running commands](#running-commands)
- [Test coverage](#test-coverage)
- [Destructive-action safeguards](#destructive-action-safeguards)
- [Reporting and CI](#reporting-and-ci)
- [Verification status](#verification-status)
- [Safety and limitations](#safety-and-limitations)

## Technology stack

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24 | Developed on 24.21.0. The CI workflow also uses Node 24. Playwright 1.64 requires Node 20 or newer. |
| npm | Bundled with Node | Dependencies are installed from `package-lock.json` with `npm ci`. |
| [@playwright/test](https://playwright.dev) | ^1.64.1 | Test runner and browser automation. Tests run in Chromium (Desktop Chrome). |
| TypeScript | ^7.0.2 | Type checking with `tsc --noEmit`. |
| dotenv | ^18.0.9 | Loads `.env` for `SF_BASE_URL`. |
| @types/node | ^26.6.6 | Node type definitions. |

## Project structure

```text
.
├── pages/                      Page Objects
├── fixtures/                   Custom Playwright fixtures and test data
├── tests/                      Test specs
├── scripts/                    Helper scripts
├── playwright/.auth/           Saved login state (local only, ignored by Git)
├── .github/workflows/          GitHub Actions workflow
├── playwright.config.ts        Playwright configuration (projects, reporters, timeouts)
├── tsconfig.json               TypeScript configuration
├── package.json                npm scripts and dependencies
└── .env.example                Template for local environment variables
```

| Path | Purpose |
| --- | --- |
| `pages/` | Page Objects that wrap Salesforce screens and keep locators out of the tests. It holds `BasePage`, `HomePage`, `ListPage`, `RecordPage` (generic record open, title and Details checks), `RecordFormDialog`, `LeadConversionDialog` and `LeadConversionResult`. |
| `fixtures/` | `index.ts` exports the extended `test` and `expect`, including a `homePage` fixture. `testData.ts` builds unique test data. |
| `tests/` | Test specs. Files named `*.auth.spec.ts` need a saved login and run in the `authenticated` project. All other specs run in the `unauthenticated` project. |
| `scripts/` | `save-auth.js` opens a headed browser so you can sign in and save your login state. |
| `playwright/.auth/` | Holds `user.json`, the saved browser state created by `npm run auth:save`. It is created locally and ignored by Git. |
| `.github/workflows/` | `playwright.yml`, the GitHub Actions workflow. |

## Setup

1. Install Node.js 24.
2. Install the dependencies:

   ```bash
   npm ci
   ```

3. Install the Playwright browser (Chromium is the only browser the project uses):

   ```bash
   npx playwright install chromium
   ```

4. Create your local environment file from the template:

   ```bash
   cp .env.example .env
   ```

5. Open `.env` and set `SF_BASE_URL` to **your own** Salesforce Lightning domain, for example `https://your-domain.lightning.force.com`.

`.env` is ignored by Git and **must never be committed**. Do not put credentials in it. It holds your org URL and your own sample-data values (see below), nothing secret.

The tests were written against a Salesforce Developer Edition org. You need your own org to run the authenticated tests.

### Sample-data configuration

The authenticated tests that read existing records need sample record IDs and expected values from **your own org**. None are stored in the source. You supply them in your local `.env`. `.env.example` lists every variable, commented out, with a placeholder. Copy the lines you need into `.env`, uncomment them and replace the placeholders. IDs are 15 or 18 characters, and the expected values must match what the record pages display in your org.

**Account, Contact and Opportunity details** (`salesforce-records.auth.spec.ts`, read-only). Requires an existing Account, one of its Contacts and one of its Opportunities:

| Variable | Expected value |
| --- | --- |
| `SF_ACCOUNT_ID` | Account record ID |
| `SF_ACCOUNT_NAME` | Account name |
| `SF_ACCOUNT_RATING` | Account Rating |
| `SF_ACCOUNT_INDUSTRY` | Account Industry |
| `SF_ACCOUNT_TYPE` | Account Type |
| `SF_CONTACT_ID` | Contact record ID |
| `SF_CONTACT_NAME` | Contact first and last name, without salutation |
| `SF_CONTACT_EMAIL` | Contact email |
| `SF_CONTACT_TITLE` | Contact Title |
| `SF_OPPORTUNITY_ID` | Opportunity record ID |
| `SF_OPPORTUNITY_NAME` | Opportunity name |
| `SF_OPPORTUNITY_STAGE` | Opportunity Stage |
| `SF_OPPORTUNITY_AMOUNT` | Amount exactly as your org displays it, including currency symbol and locale formatting |

**Lead conversion dialog** (`lead-conversion-dialog.auth.spec.ts`, read-only). Requires an existing, **unconverted** Lead:

| Variable | Expected value |
| --- | --- |
| `SF_CONVERT_LEAD_ID` | Lead record ID |

**Lead conversion preparation** (`lead-conversion-prepare.auth.spec.ts`, read-only). Requires the same unconverted Lead. Salesforce copies its company and name into the Convert Lead dialog, so the values must match that Lead:

| Variable | Expected value |
| --- | --- |
| `SF_CONVERT_LEAD_ID` | Lead record ID |
| `SF_CONVERT_LEAD_COMPANY` | Lead company |
| `SF_CONVERT_LEAD_FIRST_NAME` | Lead first name |
| `SF_CONVERT_LEAD_LAST_NAME` | Lead last name |

**Guarded Lead conversion** (`lead-conversion-execute.auth.spec.ts`, destructive and disabled by default). Requires `SF_CONVERT_LEAD_ID` and the opt-in guard described in [Destructive-action safeguards](#destructive-action-safeguards). There is no default Lead.

**Missing variables skip the tests.** If a required variable is unset or blank, the affected tests are skipped instead of failing. The skip message lists the names of the missing variables only. It never shows their values. Because skipped tests are not passes, check that nothing you care about was skipped.

## Authentication

Authenticated tests reuse a login that you create yourself. The project never stores or handles your credentials.

```bash
npm run auth:save
```

This command does three things:

1. It opens a **headed** (visible) browser at your Salesforce org.
2. It waits while you sign in **manually** and complete any MFA prompt yourself.
3. It saves the authenticated browser state to a local file, `playwright/.auth/user.json`.

Things to know about the saved login:

- **Expiry:** The saved session can expire. When authenticated tests start failing at the login check, run `npm run auth:save` again and sign in again. Refreshing it is always a manual step.
- **Sensitivity:** `playwright/.auth/user.json` grants access to your org session. Never share it and never commit it.
- **Git:** The `playwright/.auth/` directory is ignored by Git.
- **Config check:** `playwright.config.ts` only checks that the file exists. It prints a warning if the file is missing and never reads its contents.

**Evidence settings.** All six authenticated spec files (`auth-check`, `lead-create`, `lead-conversion-dialog`, `lead-conversion-prepare`, `lead-conversion-execute` and `salesforce-records`, each named `*.auth.spec.ts`) explicitly disable trace, screenshot and video by calling `test.use({ trace: 'off', screenshot: 'off', video: 'off' })`. This is configured per spec file, not globally. A new `*.auth.spec.ts` file must add the same line itself. Error messages can still appear in the console and the HTML report.

## Running commands

| Command | What it does | Needs saved login? |
| --- | --- | --- |
| `npm run typecheck` | Runs `tsc --noEmit`. | No |
| `npm run test:ci` | Runs only the `unauthenticated` project. This is what CI runs. | No |
| `npm run test:auth` | Runs only the `authenticated` project (`*.auth.spec.ts`). | **Yes** |
| `npm test` | Runs every project. Locally this includes the authenticated tests. | **Yes** (for the authenticated project) |
| `npm run test:headed` | Runs all tests with a visible browser. | **Yes** (for the authenticated project) |
| `npm run test:ui` | Opens the Playwright UI mode for all tests. | **Yes** (for the authenticated project) |
| `npm run report` | Opens the last HTML report. | No |
| `npm run auth:save` | Creates the saved login. See [Authentication](#authentication). | No (it creates it) |

`test:headed` and `test:ui` have no project filter, so they include the authenticated project. Add `--project=unauthenticated` if you only want the logged-out tests, for example `npx playwright test --headed --project=unauthenticated`.

Tests run one at a time (`workers: 1`, `fullyParallel: false`) because they share one org and one login.

## Test coverage

| Area | Spec | Needs login | Effect on Salesforce |
| --- | --- | --- | --- |
| Public login smoke test | `salesforce-login.spec.ts` | No | Read-only. Loads the public login page and checks the form fields of either the email-first or the username/password layout. It never submits the form. |
| Sample Playwright test | `example.spec.ts` | No | None. It targets the public Playwright website. |
| Authentication smoke test | `auth-check.auth.spec.ts` | Yes | Read-only. Checks that the saved login opens the Sales home page. |
| Lead creation | `lead-create.auth.spec.ts` | Yes | **Creates a real Lead.** Skipped unless the guard is set. |
| Lead conversion dialog | `lead-conversion-dialog.auth.spec.ts` | Yes | Read-only. Opens the Convert Lead dialog, checks the default selections, toggles a checkbox, opens the Account and Contact search results, and cancels. |
| Lead conversion preparation | `lead-conversion-prepare.auth.spec.ts` | Yes | Read-only. Checks the prefilled conversion values, types temporary values into the dialog, and cancels. The dialog is never converted. |
| Guarded Lead conversion | `lead-conversion-execute.auth.spec.ts` | Yes | **Converts a Lead and creates an Account, Contact and Opportunity.** Skipped unless the guard is set. It also contains a design-only `test.fixme` that never runs. |
| Account, Contact and Opportunity details | `salesforce-records.auth.spec.ts` | Yes | Read-only. Opens three existing records and checks their title and Details tab. |

The lead conversion dialog, preparation and conversion specs and the record details spec also need sample data from your `.env`. They are skipped when it is missing. See [Sample-data configuration](#sample-data-configuration).

**Read-only tests** open pages and read values. The conversion dialog and preparation tests also type into the dialog, but they always end by clicking Cancel. Their page object has cleanup that can only click Cancel buttons.

**Tests that can change data** are Lead creation and guarded Lead conversion. Both are disabled unless you explicitly opt in.

## Destructive-action safeguards

Two actions can permanently change data in your Salesforce org. Both are **disabled by default**. Each test is skipped unless an environment variable is set to an exact confirmation phrase:

| Action | Environment variable |
| --- | --- |
| Create a Lead | `SF_ALLOW_LEAD_CREATION=I-UNDERSTAND-THIS-CREATES-A-LEAD` |
| Convert a Lead | `SF_ALLOW_LEAD_CONVERSION=I-UNDERSTAND-THIS-CREATES-RECORDS` |

When a guard is enabled, the test **creates real records** in the org. There is no automatic cleanup or undo. A Lead can only be converted once, so a conversion test can pass at most once per Lead. The conversion test also needs `SF_CONVERT_LEAD_ID`, set in your `.env` to an unconverted Lead in your own org. There is no default Lead, and the test is skipped if the variable is missing.

**Do not enable these casually.** Do not put them in `.env` or in CI. Set one only for a single, deliberate run, for example:

```bash
SF_ALLOW_LEAD_CREATION=I-UNDERSTAND-THIS-CREATES-A-LEAD npx playwright test tests/lead-create.auth.spec.ts
```

Only run that against an org where creating test data is acceptable.

## Reporting and CI

**Local runs** use two reporters: `list` (console output) and `html` (written to `playwright-report/`, never auto-opened). View it with `npm run report`.

**In CI** (when the `CI` environment variable is set) the reporters are:

- `github`, for GitHub annotations on failures.
- `list`, for console output.
- `html`, written to `playwright-report/`.
- `junit`, written to `test-results/junit.xml`.

CI also enables `forbidOnly` and two retries.

**GitHub Actions** (`.github/workflows/playwright.yml`) runs on pushes and pull requests to `main` or `master`. It:

1. Checks out the code and sets up Node 24 with the npm cache.
2. Runs `npm ci`.
3. Runs `npm run typecheck`.
4. Installs Chromium.
5. Runs `npm run test:ci` (the `unauthenticated` project only).
6. Uploads `playwright-report/` and `test-results/` as artifacts, retained for **30 days**.

Authenticated tests are excluded from CI. They need a session that a person signed into manually, and CI has no Salesforce credentials or saved login. The `authenticated` project is not even defined when `CI` is set.

### CI verification

The latest verified GitHub Actions run completed successfully: [run 41504909016](https://github.com/abishekvasan2003-del/salesforce-salescloud-playwright-automation/actions/runs/41504909016), for commit `dd9aacf349750c9028b5e3ce0e0c2556be1a0661`, triggered by a push to `main`.

- **Result:** The run completed with the conclusion `success` on `ubuntu-24.04`.
- **Steps that succeeded:** `actions/checkout@v7`, `actions/setup-node@v7`, `npm ci`, the type check, the Chromium installation, the unauthenticated Playwright tests, the HTML report upload and the test-results upload.
- **Tests:** The Playwright summary reported 3 passed. No flaky tests or retries were reported.
- **Warnings:** The run had no Node.js 20 deprecation annotation and no `ubuntu-latest` migration annotation. Both appeared in the first CI run, before the action versions were upgraded and the runner was pinned.
- **Artifacts:** `playwright-report` and `test-results` were uploaded with 30-day retention. The artifacts were not downloaded or opened for this README.

What this run does **not** show:

- It verifies only the **3 unauthenticated tests** (the login smoke test and the two sample Playwright tests). **No authenticated Salesforce test ran in CI.** Those tests need a manually saved login and remain local only.
- The login smoke test supports both the email-first layout and the username/password layout. This run does not establish which layout branch was exercised, so the other branch has no CI evidence.
- It is a single successful run and does not demonstrate stability over repeated runs. An earlier CI run of the login smoke test, which then asserted a fixed heading, was reported flaky and passed on retry. That is why the test now detects the layout from the form fields instead.
- It was triggered by a push. The pull-request trigger and the pull-request-only cancellation of in-progress runs have not been exercised.
- The `junit` reporter's output file was not inspected.

## Verification status

The architecture has been inspected statically. Runtime evidence exists only for the components that the passing tests below actually used.

The passing runs listed below were made **before** the sample data was moved out of the specs and into environment variables. The externalized versions of those specs have been type-checked but have not been run, so the pass counts do not yet apply to them.

| Item | Implemented | Runtime-verified | Not yet runtime-verified |
| --- | --- | --- | --- |
| Page Object Model and fixtures | Yes. Inspected statically. | Partly. Only the page objects and fixtures used by the passing runs below have runtime evidence. | `LeadConversionResult` and the dialog's `convert()` method. |
| TypeScript typecheck | Yes | Yes. `npm run typecheck` passed after the CI and reporting changes and again after the sample data was moved to environment variables. The CI run also passed its type check step. | None. |
| Lead creation workflow | Yes | The workflow passed earlier, before the opt-in guard was added. | The new opt-in guard has not been runtime-tested. |
| Lead conversion dialog | Yes | Yes. 4 of 4 tests passed, before the sample data was externalized. | The externalized version, including its skip when `SF_CONVERT_LEAD_ID` is missing, has not been run. |
| Lead conversion preparation | Yes | Yes. 2 of 2 tests passed, before the sample data was externalized. | The externalized version and its skip behavior have not been run. |
| Account, Contact and Opportunity details | Yes | Yes. 3 of 3 tests passed, before the sample data was externalized. | The externalized version and its skip behavior have not been run. |
| Guarded Lead conversion | Yes | No. | A conversion has never been performed. The confirmation screen and the post-conversion record checks are unverified assumptions. The new `SF_CONVERT_LEAD_ID` requirement has not been run either. |
| Opportunity-less conversion test | Design only (`test.fixme`) | No. | It never runs. |
| GitHub Actions workflow | Yes | Yes. Latest verified run: 41504909016 (commit `dd9aacf`, push to `main`) succeeded on `ubuntu-24.04` with 3 unauthenticated tests passed and both artifacts uploaded. See [CI verification](#ci-verification). | Repeated-run stability, the pull-request trigger, and any authenticated tests, which are excluded from CI by design. |
| CI reporters | Yes | Partly. In that run the `github` reporter produced a run-summary annotation and a non-empty `playwright-report` artifact was uploaded. | The `junit` output file was not inspected. |
| Public login smoke test and sample test | Yes | Yes. Passed in the latest CI run (3 tests passed, no flaky tests or retries reported). | Which login layout branch ran, and stability across repeated runs. An earlier CI run of the previous login assertion was flaky. |

Not every test or workflow in this repository has been shown to pass. CI evidence covers only the unauthenticated tests. Treat anything in the "Not yet runtime-verified" column as unproven.

## Safety and limitations

- The authenticated tests depend on **Salesforce Developer Edition sample records** in your own org. The Account, Contact and Opportunity tests and the Lead conversion tests read record IDs and expected values from environment variables. Configure them in your local `.env`, not in the spec files. See [Sample-data configuration](#sample-data-configuration). The tests are skipped if the variables are missing, and they fail if the configured records are edited or deleted.
- The Amount check compares text, so `SF_OPPORTUNITY_AMOUNT` must match your org's locale formatting exactly.
- The Lead conversion tests expect an unconverted Lead whose company and name match `SF_CONVERT_LEAD_COMPANY`, `SF_CONVERT_LEAD_FIRST_NAME` and `SF_CONVERT_LEAD_LAST_NAME`.
- The unauthenticated tests depend on external websites (the Salesforce login page and the Playwright website). They can fail if those sites change or are unavailable.
- The saved authentication state is local, expires, and is ignored by Git. Do not share it.
- Lead creation and Lead conversion can **permanently change Salesforce data**. Keep the guards off unless you intend to create records.
- Salesforce Lightning is dynamic. Element IDs change on every page load, so the Page Objects use accessible roles and names. Salesforce UI changes can still break locators.
