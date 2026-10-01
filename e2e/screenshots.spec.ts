import { byId, expect, signIn, test } from './fixtures';

// Captures the README screenshots. Run with: SCREENSHOTS=1 npx playwright test screenshots --project=mobile-chrome
test.skip(!process.env.SCREENSHOTS, 'only when generating README screenshots');

const shot = (name: string) => `docs/screenshots/${name}.png`;

test('capture screens', async ({ page }) => {
  await page.goto('/');
  await expect(byId(page, 'login-submit')).toBeVisible();
  await page.screenshot({ path: shot('01-login') });

  await signIn(page);
  await page.screenshot({ path: shot('02-dashboard') });

  await page.goto('/resident/res-02');
  await expect(byId(page, 'allergy-banner')).toBeVisible();
  await page.screenshot({ path: shot('03-resident') });

  await page.goto('/resident/res-07/refill');
  await byId(page, 'refill-med-med-07c').click();
  await byId(page, 'priority-stat').click();
  await byId(page, 'refill-note').fill('Wheezing overnight, last vial used');
  await page.screenshot({ path: shot('04-refill') });

  await byId(page, 'refill-review').click();
  await byId(page, 'confirm-modal-confirm').click();
  await expect(byId(page, 'order-status')).toHaveText('Pharmacy verified', { timeout: 45_000 });
  await page.screenshot({ path: shot('05-order-timeline') });

  await page.goto('/approvals');
  await expect(byId(page, 'blocked-ord-1004')).toBeVisible();
  await page.screenshot({ path: shot('06-approvals') });

  await page.goto('/delivery');
  await byId(page, 'delivery-itm-1-received').click();
  await byId(page, 'delivery-itm-2-received').click();
  await byId(page, 'delivery-itm-4-damaged').click();
  await page.screenshot({ path: shot('07-delivery') });

  await page.goto('/audit');
  await expect(page.getByText('Requested Ipratropium').first()).toBeVisible();
  await page.screenshot({ path: shot('08-audit-log') });
});
