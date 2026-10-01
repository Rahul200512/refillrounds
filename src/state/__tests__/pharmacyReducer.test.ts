import { createSeedData } from '@/api/seed';
import { makeOrder, NOW } from '@/testUtils/testData';
import { initialPharmacyState, pharmacyReducer, type PharmacyState } from '../pharmacyReducer';

function loadedState(): PharmacyState {
  const { facility, residents, medications, orders, delivery } = createSeedData(NOW);
  return pharmacyReducer(initialPharmacyState, {
    type: 'load_succeeded',
    snapshot: { facility, residents, medications, orders, delivery },
  });
}

describe('pharmacyReducer', () => {
  it('starts loading and stores the snapshot on success', () => {
    expect(initialPharmacyState.status).toBe('loading');
    const state = loadedState();
    expect(state.status).toBe('ready');
    expect(state.residents).toHaveLength(10);
    expect(state.delivery?.items).toHaveLength(8);
  });

  it('records load errors', () => {
    const state = pharmacyReducer(initialPharmacyState, { type: 'load_failed', error: 'Offline' });
    expect(state).toMatchObject({ status: 'error', error: 'Offline' });
  });

  it('keeps showing data during a background refresh', () => {
    const state = pharmacyReducer(loadedState(), { type: 'load_started' });
    expect(state.status).toBe('ready');
  });

  it('adds new orders to the top', () => {
    const order = makeOrder({ id: 'ord-new' });
    const state = pharmacyReducer(loadedState(), { type: 'orders_added', orders: [order] });
    expect(state.orders[0].id).toBe('ord-new');
  });

  it('replaces an updated order without touching others', () => {
    const before = loadedState();
    const target = before.orders[0];
    const updated = { ...target, hold: undefined };
    const after = pharmacyReducer(before, { type: 'order_updated', order: updated });
    expect(after.orders[0]).toBe(updated);
    expect(after.orders.slice(1)).toEqual(before.orders.slice(1));
    expect(after).not.toBe(before);
  });

  it('replaces the delivery', () => {
    const before = loadedState();
    const delivery = { ...before.delivery!, confirmedAt: 'now' };
    expect(pharmacyReducer(before, { type: 'delivery_updated', delivery }).delivery?.confirmedAt).toBe('now');
  });
});
