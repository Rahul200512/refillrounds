import type { Href } from 'expo-router';

import type { Delivery, Medication, Order, Resident } from '@/models';
import type { Tone } from '@/theme';
import { toMs } from './dates';
import { getOrderStatus } from './orderStatus';
import { getDaysRemaining, getRefillStatus, isRefillDue, formatCurrency } from './refills';

export interface DashboardInput {
  residents: Resident[];
  medications: Medication[];
  orders: Order[];
  delivery: Delivery | null;
}

export interface DashboardCounts {
  refillsDue: number;
  ordersOnHold: number;
  approvalsNeeded: number;
  deliveryItems: number;
  deliveryChecked: number;
  deliveryConfirmed: boolean;
}

export function getDashboardCounts(data: DashboardInput, now: number): DashboardCounts {
  const items = data.delivery?.items ?? [];
  return {
    refillsDue: data.medications.filter((m) => isRefillDue(getRefillStatus(m, data.orders, now))).length,
    ordersOnHold: data.orders.filter((o) => Boolean(o.hold)).length,
    approvalsNeeded: data.orders.filter((o) => o.approval?.state === 'pending').length,
    deliveryItems: items.length,
    deliveryChecked: items.filter((i) => i.status !== 'pending').length,
    deliveryConfirmed: Boolean(data.delivery?.confirmedAt),
  };
}

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  badge: string;
  tone: Tone;
  href: Href;
  /** Lower = more urgent. */
  rank: number;
  sortTime: number;
}

/**
 * The prioritized "Needs attention" list. Ranking, most urgent first:
 *   0  STAT order blocked (hold or approval)
 *   1  order on hold, or PRN med completely out
 *   2  high-cost approval waiting
 *   3  PRN refill due soon
 *   4  today's delivery not yet checked in
 */
export function getAttentionItems(data: DashboardInput, now: number): AttentionItem[] {
  const residentName = (id: string) => {
    const r = data.residents.find((x) => x.id === id);
    return r ? `${r.firstName} ${r.lastName} · ${r.room}` : 'Unknown resident';
  };
  const medName = (id: string) => {
    const m = data.medications.find((x) => x.id === id);
    return m ? `${m.name} ${m.strength}` : 'Unknown medication';
  };

  const items: AttentionItem[] = [];

  for (const order of data.orders) {
    const status = getOrderStatus(order, now);
    const isStat = order.priority === 'stat';
    if (status === 'on_hold' && order.hold) {
      items.push({
        id: `hold-${order.id}`,
        title: medName(order.medicationId),
        detail: `${residentName(order.residentId)} — ${order.hold.detail}`,
        badge: isStat ? 'STAT on hold' : 'On hold',
        tone: 'danger',
        href: `/order/${order.id}`,
        rank: isStat ? 0 : 1,
        sortTime: toMs(order.hold.since),
      });
    } else if (status === 'awaiting_approval' && order.approval) {
      items.push({
        id: `approval-${order.id}`,
        title: medName(order.medicationId),
        detail: `${residentName(order.residentId)} — ${formatCurrency(order.approval.estimatedCost)} needs facility approval`,
        badge: isStat ? 'STAT approval' : 'Approval',
        tone: 'warning',
        href: `/order/${order.id}`,
        rank: isStat ? 0 : 2,
        sortTime: toMs(order.submittedAt),
      });
    }
  }

  for (const med of data.medications) {
    const status = getRefillStatus(med, data.orders, now);
    if (!isRefillDue(status)) continue;
    const days = getDaysRemaining(med, data.orders, now);
    items.push({
      id: `refill-${med.id}`,
      title: `${med.name} ${med.strength}`,
      detail: `${residentName(med.residentId)} — ${days === 0 ? 'no supply left' : `${days} day${days === 1 ? '' : 's'} left`}`,
      badge: status === 'out' ? 'Out of supply' : 'Refill due',
      tone: status === 'out' ? 'danger' : 'warning',
      href: { pathname: '/resident/[id]/refill', params: { id: med.residentId, med: med.id } },
      rank: status === 'out' ? 1 : 3,
      sortTime: days,
    });
  }

  if (data.delivery && !data.delivery.confirmedAt) {
    const pending = data.delivery.items.filter((i) => i.status === 'pending').length;
    items.push({
      id: 'delivery',
      title: "Today's delivery check-in",
      detail: `${data.delivery.items.length} items · ${data.delivery.window} · ${pending} not checked`,
      badge: 'Check in',
      tone: 'info',
      href: '/delivery',
      rank: 4,
      sortTime: 0,
    });
  }

  return items.sort((a, b) => a.rank - b.rank || a.sortTime - b.sortTime);
}
