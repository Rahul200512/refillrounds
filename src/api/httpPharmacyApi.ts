import type {
  AuditEntry,
  Delivery,
  DeliveryItemStatus,
  Facility,
  Medication,
  Order,
  PharmacySnapshot,
  RefillRequest,
  Resident,
  Session,
} from '@/models';
import { ApiError, type PharmacyApi } from './PharmacyApi';
import { readJson, removeKey, writeJson } from './storage';

const TOKEN_KEY = 'refillrounds.token.v1';

/**
 * PharmacyApi backed by the ASP.NET Core API in /api. Enabled by setting
 * EXPO_PUBLIC_API_URL (e.g. http://localhost:5005). The UI does not change:
 * it only ever sees the PharmacyApi interface.
 */
export class HttpPharmacyApi implements PharmacyApi {
  constructor(private readonly baseUrl: string) {}

  // ---- Auth ---------------------------------------------------------------

  async signIn(username: string, password: string): Promise<Session> {
    const result = await this.request<{ token: string; session: Session }>('POST', '/api/auth/sign-in', {
      username,
      password,
    });
    await writeJson(TOKEN_KEY, result.token);
    return result.session;
  }

  async signOut(reason: 'manual' | 'inactivity'): Promise<void> {
    try {
      await this.request('POST', '/api/auth/sign-out', { reason });
    } catch {
      // Signing out locally must always succeed, even if the server is unreachable.
    } finally {
      await removeKey(TOKEN_KEY);
    }
  }

  async getSession(): Promise<Session | null> {
    if (!(await readJson<string>(TOKEN_KEY))) return null;
    try {
      return await this.request<Session>('GET', '/api/auth/session');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await removeKey(TOKEN_KEY);
        return null;
      }
      throw error;
    }
  }

  async keepAlive(): Promise<void> {
    try {
      await this.request('POST', '/api/auth/keep-alive');
    } catch {
      // Best effort; the next real request will surface any problem.
    }
  }

  // ---- Reads --------------------------------------------------------------

  async getSnapshot(): Promise<PharmacySnapshot> {
    const [facility, residents, medications, orders, delivery] = await Promise.all([
      this.request<Facility>('GET', '/api/facility'),
      this.request<Resident[]>('GET', '/api/residents'),
      this.request<Medication[]>('GET', '/api/medications'),
      this.request<Order[]>('GET', '/api/orders'),
      this.request<Delivery>('GET', '/api/deliveries/today'),
    ]);
    return { facility, residents, medications, orders, delivery };
  }

  getAuditLog(): Promise<AuditEntry[]> {
    return this.request('GET', '/api/audit-log');
  }

  // ---- Writes -------------------------------------------------------------

  requestRefill(request: RefillRequest): Promise<Order[]> {
    return this.request('POST', '/api/orders/refills', request);
  }

  approveOrder(orderId: string): Promise<Order> {
    return this.request('POST', `/api/orders/${encodeURIComponent(orderId)}/approve`);
  }

  denyOrder(orderId: string, reason: string): Promise<Order> {
    return this.request('POST', `/api/orders/${encodeURIComponent(orderId)}/deny`, { reason });
  }

  resolveHold(orderId: string, resolution: string): Promise<Order> {
    return this.request('POST', `/api/orders/${encodeURIComponent(orderId)}/resolve-hold`, { resolution });
  }

  updateDeliveryItem(itemId: string, status: DeliveryItemStatus): Promise<Delivery> {
    return this.request('PATCH', `/api/deliveries/today/items/${encodeURIComponent(itemId)}`, { status });
  }

  confirmDelivery(): Promise<Delivery> {
    return this.request('POST', '/api/deliveries/today/confirm');
  }

  async resetDemoData(): Promise<void> {
    await this.request('POST', '/api/demo/reset');
  }

  // ---- Internals ----------------------------------------------------------

  /** Sends JSON with the bearer token and maps failures to ApiError. */
  private async request<T = void>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await readJson<string>(TOKEN_KEY);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Cannot reach the pharmacy server. Check your connection and try again.');
    }

    if (!response.ok) {
      // The API returns RFC 7807 problem details: { status, title, detail }.
      const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new ApiError(response.status, problem?.detail ?? `Request failed (${response.status}).`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
