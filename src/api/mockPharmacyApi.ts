import { API_LATENCY_MS, DEMO_USER } from '@/config';
import { toDateKey, toIso } from '@/domain/dates';
import { isOrderOpen } from '@/domain/orderStatus';
import { formatCurrency, needsFacilityApproval } from '@/domain/refills';
import { validateReason, validateRefill } from '@/domain/validation';
import type {
  AuditAction,
  AuditEntry,
  Delivery,
  DeliveryItemStatus,
  Order,
  PharmacySnapshot,
  RefillRequest,
  Session,
} from '@/models';
import { ApiError, type PharmacyApi } from './PharmacyApi';
import { createSeedData, type DemoDatabase } from './seed';
import { readJson, removeKey, writeJson } from './storage';

const DB_KEY = 'refillrounds.db.v1';
const SESSION_KEY = 'refillrounds.session.v1';

interface MockOptions {
  latencyMs?: number;
  now?: () => number;
}

/** Deep copy so callers (React state) never share objects with the "server". */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter}`;
}

/**
 * Stands in for the ASP.NET Core API. It behaves like a server: it owns the
 * data, enforces the business rules, writes the audit log, and responds after
 * a short delay. Data is persisted with AsyncStorage (localStorage on web).
 */
export class MockPharmacyApi implements PharmacyApi {
  private db: DemoDatabase | null = null;
  private readonly latencyMs: number;
  private readonly now: () => number;

  constructor(options: MockOptions = {}) {
    this.latencyMs = options.latencyMs ?? API_LATENCY_MS;
    this.now = options.now ?? (() => Date.now());
  }

  // ---- Auth ---------------------------------------------------------------

  async signIn(username: string, password: string): Promise<Session> {
    await this.simulateLatency();
    if (username.trim().toLowerCase() !== DEMO_USER.username || password !== DEMO_USER.password) {
      throw new ApiError(401, 'Incorrect username or password.');
    }
    const nowIso = toIso(this.now());
    const session: Session = {
      username: DEMO_USER.username,
      displayName: DEMO_USER.displayName,
      role: DEMO_USER.role,
      signedInAt: nowIso,
      lastActiveAt: nowIso,
    };
    await writeJson(SESSION_KEY, session);
    await this.audit(session.displayName, 'signed_in', 'Signed in');
    return clone(session);
  }

  async signOut(reason: 'manual' | 'inactivity'): Promise<void> {
    const session = await readJson<Session>(SESSION_KEY);
    if (session) {
      if (reason === 'inactivity') {
        await this.audit(session.displayName, 'session_locked', 'Session locked after inactivity');
      } else {
        await this.audit(session.displayName, 'signed_out', 'Signed out');
      }
    }
    await removeKey(SESSION_KEY);
  }

  // Reading the session is local (a token in device storage), so no latency.
  async getSession(): Promise<Session | null> {
    return readJson<Session>(SESSION_KEY);
  }

  async keepAlive(): Promise<void> {
    const session = await readJson<Session>(SESSION_KEY);
    if (session) {
      await writeJson(SESSION_KEY, { ...session, lastActiveAt: toIso(this.now()) });
    }
  }

  // ---- Reads --------------------------------------------------------------

  async getSnapshot(): Promise<PharmacySnapshot> {
    await this.simulateLatency();
    await this.requireUser();
    const db = await this.load();
    return clone({
      facility: db.facility,
      residents: db.residents,
      medications: db.medications,
      orders: db.orders,
      delivery: db.delivery,
    });
  }

  async getAuditLog(): Promise<AuditEntry[]> {
    await this.simulateLatency();
    await this.requireUser();
    const db = await this.load();
    return clone(db.audit);
  }

  // ---- Orders -------------------------------------------------------------

  async requestRefill(request: RefillRequest): Promise<Order[]> {
    await this.simulateLatency();
    const user = await this.requireUser();
    const db = await this.load();
    const now = this.now();

    const errors = validateRefill(request);
    if (errors.medications || errors.note) {
      throw new ApiError(400, errors.medications ?? errors.note ?? 'Invalid request.');
    }
    const resident = db.residents.find((r) => r.id === request.residentId);
    if (!resident) throw new ApiError(404, 'Resident not found.');

    // Validate every medication first so the request is all-or-nothing.
    const meds = request.medicationIds.map((medicationId) => {
      const med = db.medications.find((m) => m.id === medicationId && m.residentId === resident.id);
      if (!med) throw new ApiError(404, 'Medication not found for this resident.');
      if (db.orders.some((o) => o.medicationId === med.id && isOrderOpen(o, now))) {
        throw new ApiError(409, `${med.name} already has an open order.`);
      }
      return med;
    });

    const created: Order[] = [];
    for (const med of meds) {
      const nowIso = toIso(now);
      const isStat = request.priority === 'stat';
      const needsApproval = needsFacilityApproval(med);
      const order: Order = {
        id: newId('ord'),
        residentId: resident.id,
        medicationId: med.id,
        priority: request.priority,
        note: request.note.trim() || undefined,
        submittedAt: nowIso,
        submittedBy: user,
        approval: needsApproval ? { state: 'pending', estimatedCost: med.costPerFill } : undefined,
        processingStartedAt: needsApproval ? null : nowIso,
        history: [{ at: nowIso, label: isStat ? 'Submitted (STAT)' : 'Submitted' }],
      };
      if (needsApproval) {
        order.history.push({ at: nowIso, label: 'Sent for facility approval: high-cost medication' });
      }
      created.push(order);

      const residentName = `${resident.firstName} ${resident.lastName}`;
      await this.audit(
        user,
        'refill_requested',
        `Requested ${med.name} ${med.strength} for ${residentName}${isStat ? ' (STAT)' : ''}` +
          (needsApproval ? ` — needs facility approval (${formatCurrency(med.costPerFill)})` : ''),
        db,
      );
    }

    db.orders = [...created, ...db.orders];
    await this.save(db);
    return clone(created);
  }

  async approveOrder(orderId: string): Promise<Order> {
    await this.simulateLatency();
    const user = await this.requireUser();
    const db = await this.load();
    const order = this.findOrder(db, orderId);
    if (order.approval?.state !== 'pending') throw new ApiError(409, 'This order is not waiting for approval.');

    const nowIso = toIso(this.now());
    const updated: Order = {
      ...order,
      approval: { ...order.approval, state: 'approved', decidedAt: nowIso, decidedBy: user },
      processingStartedAt: order.hold ? null : nowIso,
      history: [...order.history, { at: nowIso, label: `Approved by ${user}` }],
    };
    await this.audit(user, 'order_approved', `Approved ${this.describeOrder(db, order)} (${formatCurrency(order.approval.estimatedCost)})`, db);
    return this.replaceOrder(db, updated);
  }

  async denyOrder(orderId: string, reason: string): Promise<Order> {
    await this.simulateLatency();
    const user = await this.requireUser();
    const db = await this.load();
    const order = this.findOrder(db, orderId);
    if (order.approval?.state !== 'pending') throw new ApiError(409, 'This order is not waiting for approval.');
    const reasonError = validateReason(reason);
    if (reasonError) throw new ApiError(400, reasonError);

    const nowIso = toIso(this.now());
    const updated: Order = {
      ...order,
      approval: { ...order.approval, state: 'denied', decidedAt: nowIso, decidedBy: user, denialReason: reason.trim() },
      processingStartedAt: null,
      history: [...order.history, { at: nowIso, label: `Denied by ${user}: ${reason.trim()}` }],
    };
    await this.audit(user, 'order_denied', `Denied ${this.describeOrder(db, order)}: ${reason.trim()}`, db);
    return this.replaceOrder(db, updated);
  }

  async resolveHold(orderId: string, resolution: string): Promise<Order> {
    await this.simulateLatency();
    const user = await this.requireUser();
    const db = await this.load();
    const order = this.findOrder(db, orderId);
    if (!order.hold) throw new ApiError(409, 'This order is not on hold.');
    if (!resolution.trim()) throw new ApiError(400, 'Choose how the hold was resolved.');

    const nowIso = toIso(this.now());
    const stillNeedsApproval = order.approval?.state === 'pending';
    const updated: Order = {
      ...order,
      hold: undefined,
      processingStartedAt: stillNeedsApproval ? null : nowIso,
      history: [...order.history, { at: nowIso, label: `Hold resolved: ${resolution}` }],
    };
    await this.audit(user, 'hold_resolved', `Resolved hold on ${this.describeOrder(db, order)}: ${resolution}`, db);
    return this.replaceOrder(db, updated);
  }

  // ---- Delivery -----------------------------------------------------------

  async updateDeliveryItem(itemId: string, status: DeliveryItemStatus): Promise<Delivery> {
    await this.simulateLatency();
    const user = await this.requireUser();
    const db = await this.load();
    if (db.delivery.confirmedAt) throw new ApiError(409, 'This delivery is already confirmed.');
    const item = db.delivery.items.find((i) => i.id === itemId);
    if (!item) throw new ApiError(404, 'Item not found on this packing slip.');

    db.delivery = {
      ...db.delivery,
      items: db.delivery.items.map((i) => (i.id === itemId ? { ...i, status } : i)),
    };
    if (status === 'missing' || status === 'damaged') {
      await this.audit(user, 'delivery_item_flagged', `Flagged ${item.description} as ${status} on ${db.delivery.packingSlipNumber}`, db);
    }
    await this.save(db);
    return clone(db.delivery);
  }

  async confirmDelivery(): Promise<Delivery> {
    await this.simulateLatency();
    const user = await this.requireUser();
    const db = await this.load();
    if (db.delivery.confirmedAt) throw new ApiError(409, 'This delivery is already confirmed.');
    if (db.delivery.items.some((i) => i.status === 'pending')) {
      throw new ApiError(400, 'Check every item before confirming the delivery.');
    }

    const received = db.delivery.items.filter((i) => i.status === 'received').length;
    const flagged = db.delivery.items.length - received;
    db.delivery = { ...db.delivery, confirmedAt: toIso(this.now()), confirmedBy: user };
    await this.audit(
      user,
      'delivery_confirmed',
      `Confirmed delivery ${db.delivery.packingSlipNumber}: ${received} received` +
        (flagged > 0 ? `, ${flagged} flagged for the pharmacy` : ', no issues'),
      db,
    );
    await this.save(db);
    return clone(db.delivery);
  }

  // ---- Demo ---------------------------------------------------------------

  async resetDemoData(): Promise<void> {
    await this.simulateLatency();
    const user = await this.requireUser();
    const db = createSeedData(this.now());
    await this.audit(user, 'demo_reset', 'Reset demo data', db);
    await this.save(db);
  }

  // ---- Internals ----------------------------------------------------------

  private simulateLatency(): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }

  /** Loads the database, regenerating it when missing or from a previous day. */
  private async load(): Promise<DemoDatabase> {
    const today = toDateKey(this.now());
    if (this.db?.seededOn === today) return this.db;

    const stored = await readJson<DemoDatabase>(DB_KEY);
    if (stored?.seededOn === today) {
      this.db = stored;
    } else {
      this.db = createSeedData(this.now());
      await writeJson(DB_KEY, this.db);
    }
    return this.db;
  }

  private async save(db: DemoDatabase): Promise<void> {
    this.db = db;
    await writeJson(DB_KEY, db);
  }

  /** Every data call requires a session, like a bearer token on a real API. */
  private async requireUser(): Promise<string> {
    const session = await readJson<Session>(SESSION_KEY);
    if (!session) throw new ApiError(401, 'Your session has ended. Please sign in again.');
    return session.displayName;
  }

  private findOrder(db: DemoDatabase, orderId: string): Order {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new ApiError(404, 'Order not found.');
    return order;
  }

  private async replaceOrder(db: DemoDatabase, updated: Order): Promise<Order> {
    db.orders = db.orders.map((o) => (o.id === updated.id ? updated : o));
    await this.save(db);
    return clone(updated);
  }

  private describeOrder(db: DemoDatabase, order: Order): string {
    const med = db.medications.find((m) => m.id === order.medicationId);
    const resident = db.residents.find((r) => r.id === order.residentId);
    const medText = med ? `${med.name} ${med.strength}` : 'medication';
    return resident ? `${medText} for ${resident.firstName} ${resident.lastName}` : medText;
  }

  /** Adds an audit entry. Pass `db` when the caller saves it afterwards. */
  private async audit(user: string, action: AuditAction, summary: string, db?: DemoDatabase): Promise<void> {
    const target = db ?? (await this.load());
    target.audit = [{ id: newId('aud'), at: toIso(this.now()), user, action, summary }, ...target.audit];
    if (!db) await this.save(target);
  }
}
