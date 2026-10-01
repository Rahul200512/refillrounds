import { ORDER_STEP_MS } from '@/config';
import type { HoldReason, Order, OrderStatus } from '@/models';
import type { Tone } from '@/theme';
import { toIso, toMs } from './dates';

/** The normal path an order takes once the pharmacy starts working it. */
export const PROGRESS_STEPS = ['submitted', 'verified', 'filled', 'out_for_delivery', 'delivered'] as const;

export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_approval: 'Awaiting approval',
  on_hold: 'On hold',
  denied: 'Denied',
  submitted: 'Submitted',
  verified: 'Pharmacy verified',
  filled: 'Filled',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

export const STATUS_TONES: Record<OrderStatus, Tone> = {
  awaiting_approval: 'warning',
  on_hold: 'danger',
  denied: 'neutral',
  submitted: 'info',
  verified: 'info',
  filled: 'info',
  out_for_delivery: 'primary',
  delivered: 'success',
};

/**
 * Status is derived from timestamps instead of stored, so it advances on its
 * own, survives a page refresh, and needs no background timers:
 *   step = floor((now - processingStartedAt) / stepLength), capped at "delivered".
 */
export function getOrderStatus(order: Order, now: number): OrderStatus {
  if (order.approval?.state === 'denied') return 'denied';
  if (order.hold) return 'on_hold';
  if (order.approval?.state === 'pending') return 'awaiting_approval';
  if (!order.processingStartedAt) return 'submitted';

  const elapsed = now - toMs(order.processingStartedAt);
  const step = Math.floor(Math.max(0, elapsed) / ORDER_STEP_MS[order.priority]);
  return PROGRESS_STEPS[Math.min(step, PROGRESS_STEPS.length - 1)];
}

/** When the order was (or will be) delivered; null while blocked or denied. */
export function getDeliveredAt(order: Order): number | null {
  if (!order.processingStartedAt || order.hold || order.approval?.state === 'pending' || order.approval?.state === 'denied') {
    return null;
  }
  return toMs(order.processingStartedAt) + (PROGRESS_STEPS.length - 1) * ORDER_STEP_MS[order.priority];
}

/** Open = still needs something to happen (not delivered and not denied). */
export function isOrderOpen(order: Order, now: number): boolean {
  const status = getOrderStatus(order, now);
  return status !== 'delivered' && status !== 'denied';
}

export function isOrderBlocked(order: Order): boolean {
  return Boolean(order.hold) || order.approval?.state === 'pending';
}

export interface TimelineEntry {
  key: string;
  label: string;
  /** ISO time the step happened, or is expected to happen. */
  at: string | null;
  state: 'done' | 'current' | 'upcoming' | 'blocked';
}

/**
 * Timeline for the order detail screen: recorded events (submitted, held,
 * approved...) followed by the computed progress steps.
 */
export function getOrderTimeline(order: Order, now: number): TimelineEntry[] {
  const status = getOrderStatus(order, now);
  const entries: TimelineEntry[] = order.history.map((event, index) => ({
    key: `event-${index}`,
    label: event.label,
    at: event.at,
    state: 'done',
  }));

  if (status === 'denied') return entries;

  if (status === 'on_hold' || status === 'awaiting_approval') {
    entries[entries.length - 1].state = 'blocked';
    for (const step of PROGRESS_STEPS.slice(1)) {
      entries.push({ key: step, label: STATUS_LABELS[step], at: null, state: 'upcoming' });
    }
    return entries;
  }

  const startedAt = order.processingStartedAt ? toMs(order.processingStartedAt) : toMs(order.submittedAt);
  const stepMs = ORDER_STEP_MS[order.priority];
  const currentIndex = PROGRESS_STEPS.indexOf(status as (typeof PROGRESS_STEPS)[number]);

  PROGRESS_STEPS.forEach((step, index) => {
    if (index === 0) return; // "Submitted" is already in the recorded history.
    const at = toIso(startedAt + index * stepMs);
    let state: TimelineEntry['state'] = 'upcoming';
    if (index < currentIndex || (index === currentIndex && step === 'delivered')) state = 'done';
    else if (index === currentIndex) state = 'current';
    entries.push({ key: step, label: STATUS_LABELS[step], at, state });
  });

  if (currentIndex === 0) entries[order.history.length - 1].state = 'current';
  return entries;
}

/** Sort for order lists: blocked first, then STAT, then newest. */
export function compareOrders(a: Order, b: Order): number {
  const blocked = Number(isOrderBlocked(b)) - Number(isOrderBlocked(a));
  if (blocked !== 0) return blocked;
  const stat = Number(b.priority === 'stat') - Number(a.priority === 'stat');
  if (stat !== 0) return stat;
  return toMs(b.submittedAt) - toMs(a.submittedAt);
}

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  renewal_needed: 'Needs prescriber renewal',
  insurance_not_covered: 'Insurance not covered',
};

/** How a nurse can resolve each kind of hold (what they did to clear it). */
export const HOLD_RESOLUTIONS: Record<HoldReason, string[]> = {
  renewal_needed: ['Signed renewal received from prescriber', 'Verbal order obtained and read back'],
  insurance_not_covered: ['Prior authorization approved', 'Facility approved private pay'],
};
