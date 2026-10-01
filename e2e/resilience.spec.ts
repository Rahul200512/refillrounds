import { byId, expect, signIn, test } from './fixtures';

test('signed-out deep link goes to sign-in', async ({ page }) => {
  await page.goto('/order/ord-1004');
  await expect(page).toHaveURL(/\/login$/);
});

test('unknown IDs and routes show friendly screens, not errors', async ({ page }) => {
  await signIn(page);
  await page.goto('/order/does-not-exist');
  await expect(page.getByText('Order not found')).toBeVisible();
  await page.goto('/resident/nobody');
  await expect(page.getByText('Resident not found')).toBeVisible();
  await page.goto('/this/page/does/not/exist');
  await expect(page.getByText('Page not found')).toBeVisible();
  await byId(page, 'not-found-home').click();
  await expect(byId(page, 'dashboard')).toBeVisible();
});

test('a session idle for more than 5 minutes is locked on return', async ({ page }) => {
  await signIn(page);
  // Pretend the last activity was 6 minutes ago, then come back.
  await page.evaluate(() => {
    const key = 'refillrounds.session.v1';
    const session = JSON.parse(localStorage.getItem(key) ?? '{}');
    session.lastActiveAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(byId(page, 'session-notice')).toContainText('inactivity');
});

test('desktop shows a centered phone-width column', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await signIn(page);
  const width = await byId(page, 'dashboard').evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(480);
});
