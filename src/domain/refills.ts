import { HIGH_COST_THRESHOLD_USD, REFILL_DUE_THRESHOLD_DAYS } from '@/config';
import type { Medication, Order } from '@/models';
import type { Tone } from '@/theme';
import { DAY_MS, toIso, toMs } from './dates';
import { getDeliveredAt, isOrderOpen } from './orderStatus';

/**
 * - ordered: an open order already exists for this med
 * - out / due: PRN med is empty / at or under the refill threshold
 * - ok: PRN med has enough supply
 * - cycle: cycle-fill med; the pharmacy ships it automatically next cycle
 * - course: short course; filled once, not refilled
 */
export type RefillStatus = 'ordered' | 'out' | 'due' | 'ok' | 'cycle' | 'course';

export const REFILL_LABELS: Record<RefillStatus, string> = {
  ordered: 'Ordered',
  out: 'Out of supply',
  due: 'Refill due',
  ok: 'Supply OK',
  cycle: 'Cycle fill',
  course: 'Short course',
};

export const REFILL_TONES: Record<RefillStatus, Tone> = {
  ordered: 'info',
  out: 'danger',
  due: 'warning',
  ok: 'success',
  cycle: 'neutral',
  course: 'neutral',
};

/** The most recent fill: the med's last fill, or a later delivered refill order. */
export function getLastFilledAt(med: Medication, orders: Order[], now: number): number {
  let last = toMs(med.lastFilledAt);
  for (const order of orders) {
    if (order.medicationId !== med.id) continue;
    const deliveredAt = getDeliveredAt(order);
    if (deliveredAt !== null && deliveredAt <= now && deliveredAt > last) last = deliveredAt;
  }
  return last;
}

/** Whole days of supply left, never negative. */
export function getDaysRemaining(med: Medication, orders: Order[], now: number): number {
  const daysUsed = Math.floor((now - getLastFilledAt(med, orders, now)) / DAY_MS);
  return Math.max(0, med.daysSupply - daysUsed);
}

/** When the next automatic cycle fill is expected (cycle meds). */
export function getNextCycleDate(med: Medication, orders: Order[], now: number): string {
  return toIso(getLastFilledAt(med, orders, now) + med.daysSupply * DAY_MS);
}

export function findOpenOrder(medicationId: string, orders: Order[], now: number): Order | undefined {
  return orders.find((o) => o.medicationId === medicationId && isOrderOpen(o, now));
}

export function getRefillStatus(med: Medication, orders: Order[], now: number): RefillStatus {
  if (findOpenOrder(med.id, orders, now)) return 'ordered';
  if (med.fillType === 'cycle') return 'cycle';
  if (med.fillType === 'course') return 'course';
  const remaining = getDaysRemaining(med, orders, now);
  if (remaining === 0) return 'out';
  if (remaining <= REFILL_DUE_THRESHOLD_DAYS) return 'due';
  return 'ok';
}

export function isRefillDue(status: RefillStatus): boolean {
  return status === 'due' || status === 'out';
}

export function needsFacilityApproval(med: Medication): boolean {
  return med.costPerFill >= HIGH_COST_THRESHOLD_USD;
}

/** "$4,200" */
export function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
