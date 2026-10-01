import { HttpPharmacyApi } from './httpPharmacyApi';
import { MockPharmacyApi } from './mockPharmacyApi';
import type { PharmacyApi } from './PharmacyApi';

// The one place that decides which implementation the app uses.
// - No EXPO_PUBLIC_API_URL (the deployed demo): local mock, no server needed.
// - EXPO_PUBLIC_API_URL=http://localhost:5005: the ASP.NET Core API in /api.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const pharmacyApi: PharmacyApi = apiUrl ? new HttpPharmacyApi(apiUrl) : new MockPharmacyApi();

export { ApiError } from './PharmacyApi';
export type { PharmacyApi } from './PharmacyApi';
