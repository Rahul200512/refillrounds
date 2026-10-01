// App-wide tunables in one place so they are easy to find and explain.

/** Sign the user out after this much inactivity (compliance: unattended devices). */
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/** Simulated network latency for the mock API, so loading states are real. */
export const API_LATENCY_MS = 300;

/** A PRN medication is "refill due" when this many days of supply or fewer remain. */
export const REFILL_DUE_THRESHOLD_DAYS = 7;

/** Fills at or above this cost need facility approval before the pharmacy fills them. */
export const HIGH_COST_THRESHOLD_USD = 500;

/**
 * Time between order status steps (verified -> filled -> out for delivery -> delivered).
 * Compressed for the demo; a real pharmacy measures this in hours.
 */
export const ORDER_STEP_MS = {
  stat: 30 * 1000,
  routine: 60 * 1000,
} as const;

/** Fictional demo account shown on the sign-in screen. */
export const DEMO_USER = {
  username: 'nurse.demo',
  password: 'Demo1234',
  displayName: 'Jordan Lee, RN',
  role: 'Charge Nurse',
} as const;

export const APP_NAME = 'RefillRounds';
export const DEMO_NOTICE = 'Demo app — fictional data, no real patient information';
