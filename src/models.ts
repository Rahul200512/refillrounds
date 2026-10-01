// Shared domain types. These mirror the DTOs a future ASP.NET Core API would
// return (see README "REST contract"). Dates are ISO-8601 strings so the same
// shapes work over JSON.

export interface Unit {
  id: string;
  name: string;
}

export interface Facility {
  id: string;
  name: string;
  units: Unit[];
}

export interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  room: string;
  unitId: string;
  /** Empty array means NKDA (no known drug allergies). */
  allergies: string[];
}

/**
 * cycle:  routine meds the pharmacy ships automatically every cycle
 * prn:    "as needed" meds the nurse refills on request
 * course: short courses (e.g. antibiotics) that are filled once, not refilled
 */
export type FillType = 'cycle' | 'prn' | 'course';

export interface Medication {
  id: string;
  residentId: string;
  name: string;
  strength: string;
  form: string;
  directions: string;
  prescriber: string;
  fillType: FillType;
  /** Days of supply dispensed per fill. */
  daysSupply: number;
  lastFilledAt: string;
  /** Pharmacy cost of one fill in USD. High-cost fills need facility approval. */
  costPerFill: number;
}

export type Priority = 'routine' | 'stat';

export type HoldReason = 'renewal_needed' | 'insurance_not_covered';

export interface OrderHold {
  reason: HoldReason;
  detail: string;
  since: string;
}

export type ApprovalState = 'pending' | 'approved' | 'denied';

export interface OrderApproval {
  state: ApprovalState;
  estimatedCost: number;
  decidedAt?: string;
  decidedBy?: string;
  denialReason?: string;
}

/** A one-off event shown on the order timeline (submitted, held, approved, ...). */
export interface OrderEvent {
  at: string;
  label: string;
}

export interface Order {
  id: string;
  residentId: string;
  medicationId: string;
  priority: Priority;
  note?: string;
  submittedAt: string;
  submittedBy: string;
  hold?: OrderHold;
  approval?: OrderApproval;
  /**
   * When the pharmacy started working the order. Null while it is blocked by a
   * hold or a pending approval. Status after this point is computed from time
   * (see domain/orderStatus.ts), so nothing needs to be stored or polled.
   */
  processingStartedAt: string | null;
  history: OrderEvent[];
}

export type OrderStatus =
  | 'awaiting_approval'
  | 'on_hold'
  | 'denied'
  | 'submitted'
  | 'verified'
  | 'filled'
  | 'out_for_delivery'
  | 'delivered';

export type DeliveryItemStatus = 'pending' | 'received' | 'missing' | 'damaged';

export interface DeliveryItem {
  id: string;
  residentId: string;
  description: string;
  quantity: string;
  handlingNote?: string;
  status: DeliveryItemStatus;
}

export interface Delivery {
  id: string;
  packingSlipNumber: string;
  date: string;
  window: string;
  route: string;
  items: DeliveryItem[];
  confirmedAt?: string;
  confirmedBy?: string;
}

export type AuditAction =
  | 'signed_in'
  | 'signed_out'
  | 'session_locked'
  | 'refill_requested'
  | 'order_held'
  | 'order_approved'
  | 'order_denied'
  | 'hold_resolved'
  | 'delivery_item_flagged'
  | 'delivery_confirmed'
  | 'demo_reset';

export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  action: AuditAction;
  summary: string;
}

export interface Session {
  username: string;
  displayName: string;
  role: string;
  signedInAt: string;
  lastActiveAt: string;
}

/** Everything the app needs after sign-in, loaded in one round of API calls. */
export interface PharmacySnapshot {
  facility: Facility;
  residents: Resident[];
  medications: Medication[];
  orders: Order[];
  delivery: Delivery;
}

export interface RefillRequest {
  residentId: string;
  medicationIds: string[];
  priority: Priority;
  note: string;
}
