import { HIGH_COST_THRESHOLD_USD, ORDER_STEP_MS, REFILL_DUE_THRESHOLD_DAYS } from '@/config';
import { DAY_MS, toIso } from '../dates';
import {
  formatCurrency,
  getDaysRemaining,
  getRefillStatus,
  isRefillDue,
  needsFacilityApproval,
} from '../refills';
import { makeMed, makeOrder, NOW } from '@/testUtils/testData';

const filledDaysAgo = (days: number) => toIso(NOW - days * DAY_MS);

describe('getDaysRemaining', () => {
  it('subtracts whole days used from the days supplied', () => {
    expect(getDaysRemaining(makeMed({ lastFilledAt: filledDaysAgo(10) }), [], NOW)).toBe(20);
  });

  it('never goes below zero', () => {
    expect(getDaysRemaining(makeMed({ lastFilledAt: filledDaysAgo(45) }), [], NOW)).toBe(0);
  });

  it('resets after a refill order is delivered', () => {
    const med = makeMed({ lastFilledAt: filledDaysAgo(28) });
    // Processing started 2 days ago, so it was delivered a little over 1 full day ago.
    const delivered = makeOrder({ processingStartedAt: toIso(NOW - 2 * DAY_MS) });
    expect(getDaysRemaining(med, [delivered], NOW)).toBe(29);
  });

  it('ignores an order that has not been delivered yet', () => {
    const med = makeMed({ lastFilledAt: filledDaysAgo(28) });
    expect(getDaysRemaining(med, [makeOrder()], NOW)).toBe(2);
  });
});

describe('getRefillStatus', () => {
  it('is "due" at the threshold and "ok" above it', () => {
    const atThreshold = makeMed({ lastFilledAt: filledDaysAgo(30 - REFILL_DUE_THRESHOLD_DAYS) });
    const above = makeMed({ lastFilledAt: filledDaysAgo(30 - REFILL_DUE_THRESHOLD_DAYS - 1) });
    expect(getRefillStatus(atThreshold, [], NOW)).toBe('due');
    expect(getRefillStatus(above, [], NOW)).toBe('ok');
  });

  it('is "out" with no supply left', () => {
    expect(getRefillStatus(makeMed({ lastFilledAt: filledDaysAgo(30) }), [], NOW)).toBe('out');
  });

  it('is "ordered" when an open order exists, so it is not counted as due', () => {
    const med = makeMed({ lastFilledAt: filledDaysAgo(29) });
    const status = getRefillStatus(med, [makeOrder()], NOW);
    expect(status).toBe('ordered');
    expect(isRefillDue(status)).toBe(false);
  });

  it('is due again if the open order was denied', () => {
    const med = makeMed({ lastFilledAt: filledDaysAgo(29) });
    const denied = makeOrder({ processingStartedAt: null, approval: { state: 'denied', estimatedCost: 1 } });
    expect(getRefillStatus(med, [denied], NOW)).toBe('due');
  });

  it('never flags cycle-fill or short-course meds as due', () => {
    expect(getRefillStatus(makeMed({ fillType: 'cycle', lastFilledAt: filledDaysAgo(29) }), [], NOW)).toBe('cycle');
    expect(getRefillStatus(makeMed({ fillType: 'course', lastFilledAt: filledDaysAgo(29) }), [], NOW)).toBe('course');
  });

  it('treats a delivered order as complete (not ordered)', () => {
    const med = makeMed({ lastFilledAt: filledDaysAgo(29) });
    const delivered = makeOrder({ processingStartedAt: toIso(NOW - 10 * ORDER_STEP_MS.routine) });
    expect(getRefillStatus(med, [delivered], NOW)).toBe('ok');
  });
});

describe('needsFacilityApproval', () => {
  it('flags fills at or above the cost threshold', () => {
    expect(needsFacilityApproval(makeMed({ costPerFill: HIGH_COST_THRESHOLD_USD }))).toBe(true);
    expect(needsFacilityApproval(makeMed({ costPerFill: HIGH_COST_THRESHOLD_USD - 1 }))).toBe(false);
  });
});

describe('formatCurrency', () => {
  it('adds thousands separators', () => {
    expect(formatCurrency(4200)).toBe('$4,200');
    expect(formatCurrency(85)).toBe('$85');
  });
});
