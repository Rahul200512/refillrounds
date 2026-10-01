import { byId, confirmDialog, expect, expectTile, signIn, test } from './fixtures';

// The main nurse journey, start to finish, on a fresh browser with no saved data.
test('nurse workflow: refill, approvals, holds, delivery, audit, sign-out, reset', async ({ page }) => {
  // --- First visit: redirected to sign-in, demo notice shown, validation works
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(byId(page, 'demo-notice')).toContainText('fictional data');
  await byId(page, 'login-submit').click();
  await expect(page.getByText('Enter your username.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();

  await byId(page, 'login-username').fill('nurse.demo');
  await byId(page, 'login-password').fill('wrong-password');
  await byId(page, 'login-submit').click();
  await expect(byId(page, 'login-error')).toHaveText('Incorrect username or password.');

  // --- Sign in: seed data is present and counts are right
  await byId(page, 'login-fill-demo').click();
  await byId(page, 'login-submit').click();
  await expect(byId(page, 'dashboard')).toBeVisible();
  await expectTile(page, 'refills', '6');
  await expectTile(page, 'holds', '3');
  await expectTile(page, 'approvals', '2');
  await expectTile(page, 'delivery', '0/8');

  // --- Resident search and profile
  await byId(page, 'tab-residents').click();
  await byId(page, 'resident-search').fill('abernathy');
  await expect(page.getByTestId(/^resident-row-/).filter({ visible: true })).toHaveCount(1);
  await byId(page, 'resident-row-res-07').click();
  await expect(byId(page, 'allergy-banner')).toContainText('Penicillin');

  // --- Request a STAT refill (validation first)
  await byId(page, 'request-refill-button').click();
  await byId(page, 'refill-review').click();
  await expect(byId(page, 'refill-error-medications')).toBeVisible();
  await byId(page, 'refill-med-med-07c').click();
  await byId(page, 'priority-stat').click();
  await byId(page, 'refill-review').click();
  await expect(page.getByText('STAT requests need a short clinical reason')).toBeVisible();
  await byId(page, 'refill-note').fill('Wheezing overnight, last vial used');
  await byId(page, 'refill-review').click();
  await confirmDialog(page);

  // --- The new order opens and advances on its own
  await expect(page).toHaveURL(/\/order\/ord-/);
  await expect(byId(page, 'order-status')).toHaveText('Submitted');
  await expect(byId(page, 'order-status')).toHaveText('Pharmacy verified', { timeout: 45_000 });

  // --- Refresh on a detail route: no 404, still signed in, status preserved
  const orderUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(orderUrl);
  await expect(byId(page, 'order-status')).not.toHaveText('Submitted');
  await expect(byId(page, 'timeline-delivered')).toBeVisible();

  // --- Approve one high-cost order, deny another (reason required)
  await page.goto('/approvals');
  await byId(page, 'approve-ord-1004').click();
  await confirmDialog(page);
  await byId(page, 'deny-ord-1005').click();
  await byId(page, 'confirm-modal-confirm').click();
  await expect(page.getByText('Enter a reason (at least 5 characters).')).toBeVisible();
  await byId(page, 'deny-reason').fill('Prescriber switching to a formulary alternative');
  await confirmDialog(page);
  await expect(page.getByText('No approvals waiting')).toBeVisible();

  // --- Resolve a hold
  await byId(page, 'approvals-view-holds').click();
  await expect(page).toHaveURL(/view=holds/);
  await byId(page, 'resolve-ord-1001').click();
  await expect(byId(page, 'confirm-modal-confirm')).toBeDisabled();
  await byId(page, 'resolution-option-0').click();
  await confirmDialog(page);
  await expect(byId(page, 'blocked-ord-1001')).toHaveCount(0);

  // --- Dashboard counts reflect every action
  await byId(page, 'tab-home').click();
  await expectTile(page, 'refills', '5');
  await expectTile(page, 'holds', '2');
  await expectTile(page, 'approvals', '0');

  // --- Delivery check-in: one item flagged as damaged
  await byId(page, 'tile-delivery').click();
  await expect(byId(page, 'delivery-confirm')).toBeDisabled();
  for (let i = 1; i <= 8; i++) {
    await byId(page, `delivery-itm-${i}-${i === 4 ? 'damaged' : 'received'}`).click();
    await expect(byId(page, 'delivery-progress')).toHaveText(`${i} of 8 items checked`);
  }
  await byId(page, 'delivery-confirm').click();
  await confirmDialog(page);
  await expect(byId(page, 'delivery-status')).toHaveText('Confirmed');

  // --- Audit log recorded everything
  await page.goto('/audit');
  for (const text of [
    'Requested Ipratropium-albuterol',
    'Approved Fidaxomicin',
    'Denied Linezolid',
    'Resolved hold on Sertraline',
    'Flagged Insulin glargine',
    'Confirmed delivery',
  ]) {
    await expect(page.getByText(text, { exact: false }).filter({ visible: true }).first()).toBeVisible();
  }

  // --- Sign out, sign back in: changes persisted
  await page.goto('/settings');
  await byId(page, 'sign-out').click();
  await confirmDialog(page);
  await expect(page).toHaveURL(/\/login$/);
  await byId(page, 'login-fill-demo').click();
  await byId(page, 'login-submit').click();
  await expectTile(page, 'holds', '2');
  await expectTile(page, 'delivery', 'Done');

  // --- Reset demo data restores the starting state
  await byId(page, 'tab-settings').click();
  await byId(page, 'reset-demo').click();
  await confirmDialog(page);
  await expect(byId(page, 'reset-done')).toBeVisible();
  await byId(page, 'tab-home').click();
  await expectTile(page, 'refills', '6');
  await expectTile(page, 'holds', '3');
  await expectTile(page, 'approvals', '2');
  await expectTile(page, 'delivery', '0/8');
});

test('dashboard tiles open the matching filtered lists', async ({ page }) => {
  await signIn(page);
  await byId(page, 'tile-holds').click();
  await expect(page).toHaveURL(/\/approvals\?view=holds/);
  await expect(byId(page, 'blocked-ord-1003')).toBeVisible();

  await byId(page, 'tab-home').click();
  await byId(page, 'tile-approvals').click();
  await expect(page).toHaveURL(/view=approvals/);
  await expect(byId(page, 'blocked-ord-1004')).toBeVisible();

  await byId(page, 'tab-home').click();
  await byId(page, 'tile-refills').click();
  await expect(page).toHaveURL(/\/refills-due$/);
  await expect(page.getByTestId(/^due-med-/).filter({ visible: true })).toHaveCount(6);
});
