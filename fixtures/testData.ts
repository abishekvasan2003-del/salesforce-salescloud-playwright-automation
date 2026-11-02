import { randomBytes } from 'crypto';

/**
 * Org-specific sample data (record ids, names, values) comes from environment variables,
 * never from the source. See .env.example for the names. `.env` is ignored by Git.
 */

/** The trimmed value of an environment variable, or '' if it is unset or blank. */
export function envValue(name: string): string {
  return (process.env[name] ?? '').trim();
}

/** The names from `names` that are unset or blank. Names only: values are never reported. */
export function missingEnv(names: readonly string[]): string[] {
  return names.filter((name) => envValue(name) === '');
}

/** A skip reason that lists the missing variable names, for use with `test.skip`. */
export function missingEnvMessage(missing: readonly string[]): string {
  return `Missing sample data in the environment: ${missing.join(', ')}. See .env.example.`;
}

/** Everything the Lead form needs. Values for the dropdowns were verified in the real org. */
export type LeadData = {
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  email: string;
  leadSource: string;
  industry: string;
  status: string;
  rating: string;
};

/** A short id that is different on every call: timestamp plus random hex. */
function uniqueId(): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14); // YYYYMMDDHHmmss
  return `${stamp}${randomBytes(2).toString('hex')}`;
}

/**
 * Builds a brand-new Lead for one test run.
 * Last name, company and email are unique, and the last name starts with "PWTest_"
 * so test records are easy to find. It never reuses data from an existing record.
 */
export function buildLead(): LeadData {
  const id = uniqueId();
  return {
    firstName: 'Abi',
    lastName: `PWTest_${id}`,
    company: `Playwright Demo Corp ${id}`,
    title: 'QA Automation Engineer',
    email: `pwtest.${id}@example.com`,
    leadSource: 'Web',
    industry: 'Technology',
    status: 'Open - Not Contacted',
    rating: 'Warm',
  };
}

/** The name Salesforce shows for the Lead: first name, a space, then last name. */
export function leadFullName(lead: LeadData): string {
  return `${lead.firstName} ${lead.lastName}`;
}
