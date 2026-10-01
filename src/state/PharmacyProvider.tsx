import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { ApiError, pharmacyApi } from '@/api';
import type { AuditEntry, DeliveryItemStatus, RefillRequest } from '@/models';
import { initialPharmacyState, pharmacyReducer, type PharmacyState } from './pharmacyReducer';
import { useSession } from './SessionProvider';

interface PharmacyContextValue {
  state: PharmacyState;
  reload: () => Promise<void>;
  requestRefill: (request: RefillRequest) => Promise<string[]>;
  approveOrder: (orderId: string) => Promise<void>;
  denyOrder: (orderId: string, reason: string) => Promise<void>;
  resolveHold: (orderId: string, resolution: string) => Promise<void>;
  updateDeliveryItem: (itemId: string, status: DeliveryItemStatus) => Promise<void>;
  confirmDelivery: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  /** Not cached in state: the audit log is fetched fresh each time it is viewed. */
  getAuditLog: () => Promise<AuditEntry[]>;
}

const PharmacyContext = createContext<PharmacyContextValue | null>(null);

/**
 * Loads pharmacy data after sign-in and exposes it plus the actions screens
 * can take. Each action calls the API first, then applies the server's
 * response to local state, so every screen (and the dashboard counts) update
 * immediately and stay consistent with what was saved.
 */
export function PharmacyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pharmacyReducer, initialPharmacyState);
  const { handleUnauthorized } = useSession();

  // A 401 from any call means the session is gone: send the user to sign-in.
  const run = useCallback(
    async <T,>(call: () => Promise<T>): Promise<T> => {
      try {
        return await call();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) handleUnauthorized();
        throw error;
      }
    },
    [handleUnauthorized],
  );

  const reload = useCallback(async () => {
    dispatch({ type: 'load_started' });
    try {
      const snapshot = await run(() => pharmacyApi.getSnapshot());
      dispatch({ type: 'load_succeeded', snapshot });
    } catch (error) {
      dispatch({ type: 'load_failed', error: errorMessage(error) });
    }
  }, [run]);

  useEffect(() => {
    reload();
  }, [reload]);

  const getAuditLog = useCallback(() => run(() => pharmacyApi.getAuditLog()), [run]);

  const value = useMemo<PharmacyContextValue>(
    () => ({
      state,
      reload,
      requestRefill: async (request) => {
        const orders = await run(() => pharmacyApi.requestRefill(request));
        dispatch({ type: 'orders_added', orders });
        return orders.map((o) => o.id);
      },
      approveOrder: async (orderId) => {
        const order = await run(() => pharmacyApi.approveOrder(orderId));
        dispatch({ type: 'order_updated', order });
      },
      denyOrder: async (orderId, reason) => {
        const order = await run(() => pharmacyApi.denyOrder(orderId, reason));
        dispatch({ type: 'order_updated', order });
      },
      resolveHold: async (orderId, resolution) => {
        const order = await run(() => pharmacyApi.resolveHold(orderId, resolution));
        dispatch({ type: 'order_updated', order });
      },
      updateDeliveryItem: async (itemId, status) => {
        const delivery = await run(() => pharmacyApi.updateDeliveryItem(itemId, status));
        dispatch({ type: 'delivery_updated', delivery });
      },
      confirmDelivery: async () => {
        const delivery = await run(() => pharmacyApi.confirmDelivery());
        dispatch({ type: 'delivery_updated', delivery });
      },
      resetDemoData: async () => {
        await run(() => pharmacyApi.resetDemoData());
        await reload();
      },
      getAuditLog,
    }),
    [state, reload, run, getAuditLog],
  );

  return <PharmacyContext.Provider value={value}>{children}</PharmacyContext.Provider>;
}

export function usePharmacy(): PharmacyContextValue {
  const context = useContext(PharmacyContext);
  if (!context) throw new Error('usePharmacy must be used inside <PharmacyProvider>');
  return context;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
