import { test as base, Page } from '@playwright/test';
import { loginAsGuru } from '../utils/helpers';

export const test = base.extend<{ guruPage: Page }>({
  guruPage: async ({ page }, use) => {
    await loginAsGuru(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';

