import type {
  AuditEntry,
  Delivery,
  DeliveryItemStatus,
  Order,
  PharmacySnapshot,
  RefillRequest,
  Session,
} from '@/models';

/**
 * The only way screens get or change data. Today it is implemented by
 * MockPharmacyApi (local storage + fake latency). A real implementation would
 * call the ASP.NET Core endpoints listed next to each method, and nothing in
 * the UI would need to change.
 */
export interface PharmacyApi {
  /** POST /api/auth/sign-in */
  signIn(username: string, password: string): Promise<Session>;
  /** POST /api/auth/sign-out */
  signOut(reason: 'manual' | 'inactivity'): Promise<void>;
  /** GET /api/auth/session — returns null when not signed in */
  getSession(): Promise<Session | null>;
  /** POST /api/auth/keep-alive — records activity for the inactivity timeout */
  keepAlive(): Promise<void>;

  /**
   * Everything the screens need after sign-in. An HTTP implementation would
   * call these in parallel and combine them:
   * GET /api/facility, /api/residents, /api/medications, /api/orders, /api/deliveries/today
   */
  getSnapshot(): Promise<PharmacySnapshot>;
  /** GET /api/audit-log */
  getAuditLog(): Promise<AuditEntry[]>;

  /** POST /api/orders/refills — one order per medication */
  requestRefill(request: RefillRequest): Promise<Order[]>;
  /** POST /api/orders/{id}/approve */
  approveOrder(orderId: string): Promise<Order>;
  /** POST /api/orders/{id}/deny */
  denyOrder(orderId: string, reason: string): Promise<Order>;
  /** POST /api/orders/{id}/resolve-hold */
  resolveHold(orderId: string, resolution: string): Promise<Order>;

  /** PATCH /api/deliveries/today/items/{itemId} */
  updateDeliveryItem(itemId: string, status: DeliveryItemStatus): Promise<Delivery>;
  /** POST /api/deliveries/today/confirm */
  confirmDelivery(): Promise<Delivery>;

  /** POST /api/demo/reset — demo only */
  resetDemoData(): Promise<void>;
}

/** Error shape a real HTTP client would map status codes into. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
