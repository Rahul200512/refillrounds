import { byId, confirmDialog, expect, expectTile, signIn, test } from './fixtures';

// Feature-by-feature checks that complement the main workflow test.

test('residents: unit filter, search, empty state', async ({ page }) => {
  await signIn(page);
  await byId(page, 'tab-residents').click();
  const rows = page.getByTestId(/^resident-row-/).filter({ visible: true });
  await expect(rows).toHaveCount(10);
  await byId(page, 'unit-filter-unit-cedar').click();
  await expect(rows).toHaveCount(5);
  await byId(page, 'unit-filter-unit-magnolia').click();
  await expect(rows).toHaveCount(5);
  await byId(page, 'unit-filter-all').click();
  await byId(page, 'resident-search').fill('C-2');
  await expect(rows).toHaveCount(5);
  await byId(page, 'resident-search').fill('zzz');
  await expect(page.getByText('No residents found')).toBeVisible();
});

test('resident profile: allergies, NKDA, meds and orders', async ({ page }) => {
  await signIn(page);
  await page.goto('/resident/res-02');
  await expect(byId(page, 'allergy-banner')).toContainText('No known drug allergies');
  await expect(byId(page, 'med-status-med-02c')).toHaveText('Out of supply');
  await expect(byId(page, 'med-status-med-02d')).toHaveText('Order: Awaiting approval');
  await expect(byId(page, 'order-row-ord-1004')).toBeVisible();
});

test('refills due list preselects the medication', async ({ page }) => {
  await signIn(page);
  await page.goto('/refills-due');
  await byId(page, 'due-request-med-01c').click();
  await expect(byId(page, 'refill-med-med-01c')).toHaveAttribute('aria-checked', 'true');
  await byId(page, 'refill-review').click();
  await confirmDialog(page);
  await expect(page).toHaveURL(/\/order\/ord-/);
  await expect(byId(page, 'order-status')).toHaveText('Submitted');
  await page.goto('/');
  await expectTile(page, 'refills', '5');
});

test('multi-medication refill creates one order each and opens Orders', async ({ page }) => {
  await signIn(page);
  await page.goto('/resident/res-01/refill');
  await byId(page, 'refill-med-med-01c').click();
  await byId(page, 'refill-med-med-01d').click();
  await byId(page, 'refill-review').click();
  await expect(page.getByText('Send 2 refill requests?')).toBeVisible();
  await confirmDialog(page);
  await expect(page).toHaveURL(/\/orders$/);
  await expect(byId(page, 'orders-filter-open')).toHaveText('Open (7)');
  // Already-ordered meds can't be ordered again
  await page.goto('/resident/res-01/refill');
  await expect(byId(page, 'refill-med-med-01c')).toHaveAttribute('aria-disabled', 'true');
});

test('high-cost refill from the app waits for facility approval', async ({ page }) => {
  await signIn(page);
  await page.goto('/resident/res-02/refill');
  await expect(page.getByText('Needs facility approval · $545')).toBeVisible();
  await byId(page, 'refill-med-med-02b').click();
  await byId(page, 'refill-review').click();
  await expect(page.getByText('will wait for facility approval')).toBeVisible();
  await confirmDialog(page);
  await expect(byId(page, 'order-status')).toHaveText('Awaiting approval');
  await expect(byId(page, 'approval-callout')).toBeVisible();
  await page.goto('/');
  await expectTile(page, 'approvals', '3');
  await expect(byId(page, 'tab-approvals')).toContainText('6');
});

test('order progresses all the way to Delivered and moves to Completed', async ({ page }) => {
  await page.clock.install();
  await signIn(page);
  await page.goto('/resident/res-06/refill');
  await byId(page, 'refill-med-med-06c').click();
  await byId(page, 'refill-review').click();
  await confirmDialog(page);
  await expect(byId(page, 'order-status')).toHaveText('Submitted');
  // 4 routine steps of 60 s. Stay under the 5-minute idle lock, which would otherwise sign us out.
  await page.clock.fastForward('04:10');
  await expect(byId(page, 'order-status')).toHaveText('Delivered');
  await expect(byId(page, 'timeline-delivered')).toBeVisible();
  // The tab bar is hidden on detail screens, so go back first.
  await page.getByRole('link', { name: 'Home, back' }).filter({ visible: true }).click();
  await byId(page, 'tab-orders').click();
  await byId(page, 'orders-filter-closed').click();
  await expect(page.getByText('Guaifenesin 100 mg/5 mL').filter({ visible: true }).first()).toBeVisible();
  // Delivered refill resets supply: no longer due
  await page.goto('/resident/res-06');
  await expect(byId(page, 'med-status-med-06c')).toHaveText('Supply OK');
});

test('approving an order starts its timeline', async ({ page }) => {
  await signIn(page);
  await page.goto('/order/ord-1004');
  await byId(page, 'approve-ord-1004').click();
  await confirmDialog(page);
  await expect(byId(page, 'order-status')).toHaveText('Submitted');
  await expect(byId(page, 'approval-callout')).toHaveCount(0);
  await expect(page.getByText('Approved by Jordan Lee, RN')).toBeVisible();
});

test('delivery: missing, damaged and tap-again-to-clear', async ({ page }) => {
  await signIn(page);
  await page.goto('/delivery');
  await byId(page, 'delivery-itm-1-missing').click();
  await expect(byId(page, 'delivery-progress')).toHaveText('1 of 8 items checked');
  await byId(page, 'delivery-itm-1-missing').click();
  await expect(byId(page, 'delivery-progress')).toHaveText('0 of 8 items checked');
  await byId(page, 'delivery-itm-1-missing').click();
  for (let i = 2; i <= 8; i++) await byId(page, `delivery-itm-${i}-received`).click();
  await expect(byId(page, 'delivery-confirm')).toBeEnabled();
  await byId(page, 'delivery-confirm').click();
  await expect(page.getByText('Donepezil 10 mg tablet: missing')).toBeVisible();
  await confirmDialog(page);
  await expect(byId(page, 'delivery-confirmed')).toContainText('1 issue reported');
  await expect(byId(page, 'delivery-itm-2-received')).toHaveAttribute('aria-disabled', 'true');
});

test('auto-lock fires after 5 idle minutes while the app is open', async ({ page }) => {
  await page.clock.install();
  await signIn(page);
  await page.clock.fastForward('04:00');
  await byId(page, 'tab-orders').click(); // activity resets the timer
  await page.clock.fastForward('04:00');
  await expect(byId(page, 'tab-orders')).toBeVisible(); // still signed in
  await page.clock.fastForward('02:00');
  await expect(page).toHaveURL(/\/login$/);
  await expect(byId(page, 'session-notice')).toContainText('5 minutes of inactivity');
});

test('back button works after opening a deep link directly', async ({ page }) => {
  await signIn(page);
  await page.goto('/order/ord-1001');
  await expect(byId(page, 'order-detail')).toBeVisible();
  await page.getByRole('link', { name: 'Home, back' }).filter({ visible: true }).click();
  await expect(byId(page, 'dashboard')).toBeVisible();
});

test('settings menu opens delivery and audit log; cancel keeps you signed in', async ({ page }) => {
  await signIn(page);
  await byId(page, 'tab-settings').click();
  await expect(byId(page, 'about')).toContainText('fictional');
  await byId(page, 'menu-audit').click();
  await expect(page.getByText('Signed in').filter({ visible: true }).first()).toBeVisible();
  await page.goBack();
  await byId(page, 'menu-delivery').click();
  await expect(byId(page, 'delivery')).toBeVisible();
  await page.goto('/settings');
  await byId(page, 'sign-out').click();
  await byId(page, 'confirm-modal-cancel').click();
  await expect(byId(page, 'settings')).toBeVisible();
});
