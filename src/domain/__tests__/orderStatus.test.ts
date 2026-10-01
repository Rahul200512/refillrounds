import { ORDER_STEP_MS } from '@/config';
import { toIso } from '../dates';
import {
  compareOrders,
  getDeliveredAt,
  getOrderStatus,
  getOrderTimeline,
  isOrderOpen,
} from '../orderStatus';
import { makeOrder, NOW } from '@/testUtils/testData';

const ROUTINE = ORDER_STEP_MS.routine;
const STAT = ORDER_STEP_MS.stat;

describe('getOrderStatus', () => {
  it('advances one step per interval from when processing started', () => {
    const order = makeOrder();
    expect(getOrderStatus(order, NOW)).toBe('submitted');
    expect(getOrderStatus(order, NOW + ROUTINE - 1)).toBe('submitted');
    expect(getOrderStatus(order, NOW + ROUTINE)).toBe('verified');
    expect(getOrderStatus(order, NOW + 2 * ROUTINE)).toBe('filled');
    expect(getOrderStatus(order, NOW + 3 * ROUTINE)).toBe('out_for_delivery');
    expect(getOrderStatus(order, NOW + 4 * ROUTINE)).toBe('delivered');
  });

  it('stays delivered forever after the last step', () => {
    expect(getOrderStatus(makeOrder(), NOW + 1000 * ROUTINE)).toBe('delivered');
  });

  it('moves faster for STAT orders', () => {
    const order = makeOrder({ priority: 'stat' });
    expect(getOrderStatus(order, NOW + 3 * STAT)).toBe('out_for_delivery');
    expect(STAT).toBeLessThan(ROUTINE);
  });

  it('is on hold while a hold exists, regardless of time', () => {
    const order = makeOrder({
      processingStartedAt: null,
      hold: { reason: 'renewal_needed', detail: 'Expired', since: toIso(NOW) },
    });
    expect(getOrderStatus(order, NOW + 100 * ROUTINE)).toBe('on_hold');
  });

  it('waits for approval and reports denial', () => {
    const pending = makeOrder({ processingStartedAt: null, approval: { state: 'pending', estimatedCost: 900 } });
    expect(getOrderStatus(pending, NOW + 100 * ROUTINE)).toBe('awaiting_approval');

    const denied = makeOrder({ processingStartedAt: null, approval: { state: 'denied', estimatedCost: 900 } });
    expect(getOrderStatus(denied, NOW)).toBe('denied');
    expect(isOrderOpen(denied, NOW)).toBe(false);
  });

  it('starts progressing from the approval/resolution time, not submission', () => {
    const resumedAt = NOW + 10 * ROUTINE;
    const order = makeOrder({ processingStartedAt: toIso(resumedAt) });
    expect(getOrderStatus(order, resumedAt + ROUTINE)).toBe('verified');
  });
});

describe('getDeliveredAt / isOrderOpen', () => {
  it('computes delivery time and openness', () => {
    const order = makeOrder();
    expect(getDeliveredAt(order)).toBe(NOW + 4 * ROUTINE);
    expect(isOrderOpen(order, NOW)).toBe(true);
    expect(isOrderOpen(order, NOW + 4 * ROUTINE)).toBe(false);
  });

  it('has no delivery time while blocked', () => {
    expect(getDeliveredAt(makeOrder({ processingStartedAt: null, approval: { state: 'pending', estimatedCost: 1 } }))).toBeNull();
  });
});

describe('getOrderTimeline', () => {
  it('marks done, current and upcoming steps', () => {
    const timeline = getOrderTimeline(makeOrder(), NOW + 2 * ROUTINE + 1);
    expect(timeline.map((e) => [e.label, e.state])).toEqual([
      ['Submitted', 'done'],
      ['Pharmacy verified', 'done'],
      ['Filled', 'current'],
      ['Out for delivery', 'upcoming'],
      ['Delivered', 'upcoming'],
    ]);
  });

  it('shows the blocking event and no expected times while on hold', () => {
    const order = makeOrder({
      processingStartedAt: null,
      hold: { reason: 'renewal_needed', detail: 'Expired', since: toIso(NOW) },
      history: [
        { at: toIso(NOW), label: 'Submitted' },
        { at: toIso(NOW), label: 'On hold: expired' },
      ],
    });
    const timeline = getOrderTimeline(order, NOW);
    expect(timeline[1].state).toBe('blocked');
    expect(timeline.slice(2).every((e) => e.state === 'upcoming' && e.at === null)).toBe(true);
  });

  it('marks every step done once delivered', () => {
    const timeline = getOrderTimeline(makeOrder(), NOW + 10 * ROUTINE);
    expect(timeline.every((e) => e.state === 'done')).toBe(true);
  });
});

describe('compareOrders', () => {
  it('sorts blocked first, then STAT, then newest', () => {
    const blocked = makeOrder({ id: 'blocked', processingStartedAt: null, approval: { state: 'pending', estimatedCost: 1 } });
    const stat = makeOrder({ id: 'stat', priority: 'stat' });
    const newer = makeOrder({ id: 'newer', submittedAt: toIso(NOW + 1000) });
    const older = makeOrder({ id: 'older', submittedAt: toIso(NOW - 1000) });
    const sorted = [older, newer, stat, blocked].sort(compareOrders).map((o) => o.id);
    expect(sorted).toEqual(['blocked', 'stat', 'newer', 'older']);
  });
});
