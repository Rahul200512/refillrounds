import { createSeedData } from '@/api/seed';
import { toIso } from '../dates';
import { getAttentionItems, getDashboardCounts } from '../dashboard';
import { NOW } from '@/testUtils/testData';

describe('dashboard on seed data', () => {
  const seed = createSeedData(NOW);

  it('counts refills due, holds, approvals and delivery items', () => {
    expect(getDashboardCounts(seed, NOW)).toEqual({
      refillsDue: 6,
      ordersOnHold: 3,
      approvalsNeeded: 2,
      deliveryItems: 8,
      deliveryChecked: 0,
      deliveryConfirmed: false,
    });
  });

  it('updates counts when an approval is decided and a hold is resolved', () => {
    const orders = seed.orders.map((o) => {
      if (o.approval?.state === 'pending') {
        return { ...o, approval: { ...o.approval, state: 'approved' as const }, processingStartedAt: toIso(NOW) };
      }
      if (o.id === 'ord-1001') return { ...o, hold: undefined, processingStartedAt: toIso(NOW) };
      return o;
    });
    const counts = getDashboardCounts({ ...seed, orders }, NOW);
    expect(counts.approvalsNeeded).toBe(0);
    expect(counts.ordersOnHold).toBe(2);
  });

  it('ranks STAT blocked orders first and delivery check-in last', () => {
    const items = getAttentionItems(seed, NOW);
    expect(items.slice(0, 2).map((i) => i.badge)).toEqual(['STAT on hold', 'STAT approval']);
    expect(items[items.length - 1].id).toBe('delivery');
    const ranks = items.map((i) => i.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('drops the delivery item once it is confirmed', () => {
    const delivery = { ...seed.delivery, confirmedAt: toIso(NOW) };
    expect(getAttentionItems({ ...seed, delivery }, NOW).some((i) => i.id === 'delivery')).toBe(false);
  });
});
