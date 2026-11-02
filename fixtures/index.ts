import { test as base, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';

/** Page objects that authenticated tests can ask for by name. */
type Fixtures = {
  homePage: HomePage;
};

/**
 * Use this `test` (not the one from @playwright/test) in authenticated specs:
 *   import { test, expect } from '../fixtures';
 */
export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
});

export { expect };
