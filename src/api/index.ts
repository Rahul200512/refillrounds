import { MockPharmacyApi } from './mockPharmacyApi';
import type { PharmacyApi } from './PharmacyApi';

// The one place that decides which implementation the app uses. Swapping in
// an HTTP client for the ASP.NET Core API would be a one-line change here.
export const pharmacyApi: PharmacyApi = new MockPharmacyApi();

export { ApiError } from './PharmacyApi';
export type { PharmacyApi } from './PharmacyApi';
