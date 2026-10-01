import { expect, test as base, type Page } from '@playwright/test';

/**
 * Every test fails if the browser logs any console error or warning, or
 * throws an uncaught exception. Each test starts with empty storage, like a
 * first-time visitor.
 */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
      await use(problems);
      expect(problems, 'browser console must stay clean').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** React Navigation keeps previous screens mounted (hidden), so only match visible elements. */
export function byId(page: Page, id: string) {
  return page.getByTestId(id).filter({ visible: true });
}

export async function signIn(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await byId(page, 'login-fill-demo').click();
  await byId(page, 'login-submit').click();
  await expect(byId(page, 'dashboard')).toBeVisible();
}

/** Clicks the confirm button in the open dialog and waits for it to close. */
export async function confirmDialog(page: Page) {
  await byId(page, 'confirm-modal-confirm').click();
  await expect(byId(page, 'confirm-modal')).toHaveCount(0);
}

export async function expectTile(page: Page, tile: string, value: string) {
  await expect(byId(page, `tile-${tile}-value`)).toHaveText(value);
}
