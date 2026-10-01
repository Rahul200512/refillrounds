import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_USER } from '@/config';
import { DAY_MS } from '@/domain/dates';
import { getOrderStatus } from '@/domain/orderStatus';
import { NOW } from '@/testUtils/testData';
import { MockPharmacyApi } from '../mockPharmacyApi';
import { ApiError } from '../PharmacyApi';

// These tests treat the mock like a real server: call it, then check what it returns.

let now = NOW;
function makeApi() {
  return new MockPharmacyApi({ latencyMs: 0, now: () => now });
}

async function signedInApi() {
  const api = makeApi();
  await api.signIn(DEMO_USER.username, DEMO_USER.password);
  return api;
}

beforeEach(async () => {
  now = NOW;
  await AsyncStorage.clear();
});

describe('auth', () => {
  it('rejects wrong credentials with a 401', async () => {
    await expect(makeApi().signIn('nurse.demo', 'wrong')).rejects.toMatchObject({ status: 401 });
  });

  it('requires a session for data calls', async () => {
    await expect(makeApi().getSnapshot()).rejects.toBeInstanceOf(ApiError);
  });

  it('persists the session until sign-out', async () => {
    const api = await signedInApi();
    expect((await api.getSession())?.displayName).toBe(DEMO_USER.displayName);
    await api.signOut('manual');
    expect(await api.getSession()).toBeNull();
  });
});

describe('refill requests', () => {
  it('creates one order per medication and audits it', async () => {
    const api = await signedInApi();
    const orders = await api.requestRefill({
      residentId: 'res-01',
      medicationIds: ['med-01c', 'med-01d'],
      priority: 'routine',
      note: '',
    });
    expect(orders).toHaveLength(2);
    expect(getOrderStatus(orders[0], now)).toBe('submitted');

    const audit = await api.getAuditLog();
    expect(audit.filter((a) => a.action === 'refill_requested' && a.user === DEMO_USER.displayName)).toHaveLength(2);
  });

  it('sends high-cost medications for facility approval', async () => {
    const api = await signedInApi();
    const [order] = await api.requestRefill({ residentId: 'res-02', medicationIds: ['med-02b'], priority: 'routine', note: '' });
    expect(order.approval?.state).toBe('pending');
    expect(getOrderStatus(order, now)).toBe('awaiting_approval');
  });

  it('rejects a duplicate while an order is open, without creating anything', async () => {
    const api = await signedInApi();
    await expect(
      api.requestRefill({ residentId: 'res-03', medicationIds: ['med-03c', 'med-03b'], priority: 'routine', note: '' }),
    ).rejects.toMatchObject({ status: 409 });
    const { orders } = await api.getSnapshot();
    expect(orders.some((o) => o.medicationId === 'med-03c')).toBe(false);
  });

  it('enforces the same validation as the form', async () => {
    const api = await signedInApi();
    await expect(
      api.requestRefill({ residentId: 'res-01', medicationIds: [], priority: 'routine', note: '' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('approvals and holds', () => {
  it('approves a pending order and starts processing', async () => {
    const api = await signedInApi();
    const order = await api.approveOrder('ord-1004');
    expect(order.approval?.state).toBe('approved');
    expect(getOrderStatus(order, now)).toBe('submitted');
    await expect(api.approveOrder('ord-1004')).rejects.toMatchObject({ status: 409 });
  });

  it('requires a reason to deny', async () => {
    const api = await signedInApi();
    await expect(api.denyOrder('ord-1005', '')).rejects.toMatchObject({ status: 400 });
    const order = await api.denyOrder('ord-1005', 'Formulary alternative chosen');
    expect(getOrderStatus(order, now)).toBe('denied');
    expect(order.approval?.denialReason).toBe('Formulary alternative chosen');
  });

  it('resolves a hold and logs who did it', async () => {
    const api = await signedInApi();
    const order = await api.resolveHold('ord-1001', 'Signed renewal received from prescriber');
    expect(order.hold).toBeUndefined();
    const [latest] = await api.getAuditLog();
    expect(latest).toMatchObject({ action: 'hold_resolved', user: DEMO_USER.displayName });
  });

  it('returns 404 for unknown orders', async () => {
    const api = await signedInApi();
    await expect(api.approveOrder('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('delivery check-in', () => {
  it('only confirms once every item is checked', async () => {
    const api = await signedInApi();
    await expect(api.confirmDelivery()).rejects.toMatchObject({ status: 400 });

    const { delivery } = await api.getSnapshot();
    for (const item of delivery.items) {
      await api.updateDeliveryItem(item.id, item.id === 'itm-4' ? 'damaged' : 'received');
    }
    const confirmed = await api.confirmDelivery();
    expect(confirmed.confirmedAt).toBeDefined();
    await expect(api.updateDeliveryItem('itm-1', 'missing')).rejects.toMatchObject({ status: 409 });
  });
});

describe('persistence and demo data', () => {
  it('keeps changes across a new API instance (page refresh)', async () => {
    const api = await signedInApi();
    await api.resolveHold('ord-1001', 'Verbal order obtained and read back');
    const { orders } = await makeApi().getSnapshot();
    expect(orders.find((o) => o.id === 'ord-1001')?.hold).toBeUndefined();
  });

  it('regenerates data on a new day so the demo always looks current', async () => {
    const api = await signedInApi();
    await api.resolveHold('ord-1001', 'Verbal order obtained and read back');
    now = NOW + DAY_MS;
    const { orders } = await makeApi().getSnapshot();
    expect(orders.find((o) => o.id === 'ord-1001')?.hold).toBeDefined();
  });

  it('reset restores the starting state', async () => {
    const api = await signedInApi();
    await api.approveOrder('ord-1004');
    await api.resetDemoData();
    const { orders } = await api.getSnapshot();
    expect(orders.find((o) => o.id === 'ord-1004')?.approval?.state).toBe('pending');
  });
});
