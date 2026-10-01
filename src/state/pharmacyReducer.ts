import type { Delivery, Facility, Medication, Order, PharmacySnapshot, Resident } from '@/models';

// Client-side cache of what the API returned. The reducer is pure: given the
// current state and an action it returns the next state, which keeps it easy
// to test and reason about (same idea as a Redux store).

export interface PharmacyState {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  facility: Facility | null;
  residents: Resident[];
  medications: Medication[];
  orders: Order[];
  delivery: Delivery | null;
}

export type PharmacyAction =
  | { type: 'load_started' }
  | { type: 'load_succeeded'; snapshot: PharmacySnapshot }
  | { type: 'load_failed'; error: string }
  | { type: 'orders_added'; orders: Order[] }
  | { type: 'order_updated'; order: Order }
  | { type: 'delivery_updated'; delivery: Delivery };

export const initialPharmacyState: PharmacyState = {
  status: 'loading',
  error: null,
  facility: null,
  residents: [],
  medications: [],
  orders: [],
  delivery: null,
};

export function pharmacyReducer(state: PharmacyState, action: PharmacyAction): PharmacyState {
  switch (action.type) {
    case 'load_started':
      // Keep showing existing data during a refresh; only show a spinner on first load.
      return { ...state, status: state.facility ? 'ready' : 'loading', error: null };
    case 'load_succeeded':
      return { ...state, status: 'ready', error: null, ...action.snapshot };
    case 'load_failed':
      return { ...state, status: 'error', error: action.error };
    case 'orders_added':
      return { ...state, orders: [...action.orders, ...state.orders] };
    case 'order_updated':
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.order.id ? action.order : o)),
      };
    case 'delivery_updated':
      return { ...state, delivery: action.delivery };
    default:
      return state;
  }
}
