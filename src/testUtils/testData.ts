import type { Medication, Order } from '@/models';
import { DAY_MS, toIso } from '@/domain/dates';

// Fixed "now" so tests are deterministic: Wed Oct 1 2026, 10:00 local time.
export const NOW = new Date(2026, 9, 1, 10, 0, 0).getTime();

export function makeMed(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'med-1',
    residentId: 'res-1',
    name: 'Acetaminophen',
    strength: '500 mg',
    form: 'Tablet',
    directions: 'As needed',
    prescriber: 'Dr. Test',
    fillType: 'prn',
    daysSupply: 30,
    lastFilledAt: toIso(NOW - 10 * DAY_MS),
    costPerFill: 5,
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    residentId: 'res-1',
    medicationId: 'med-1',
    priority: 'routine',
    submittedAt: toIso(NOW),
    submittedBy: 'Tester',
    processingStartedAt: toIso(NOW),
    history: [{ at: toIso(NOW), label: 'Submitted' }],
    ...overrides,
  };
}
