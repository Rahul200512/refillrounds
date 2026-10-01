# RefillRounds architecture: how it works and why

This document explains the codebase in plain language, with comparisons to C#/.NET where they help.
If you can explain the sections below, you can explain the app.

## 1. Folder structure

```
src/
  app/                       Screens. Expo Router turns each file into a route (like Razor Pages).
    _layout.tsx              Root: font loading, theme, SessionProvider, centered web column
    login.tsx                /login
    +not-found.tsx           Any unknown URL
    (app)/                   "(app)" is a route group: it groups files without adding to the URL
      _layout.tsx            Auth guard + PharmacyProvider + the Stack navigator
      (tabs)/_layout.tsx     Bottom tab bar
      (tabs)/index.tsx       /            Dashboard
      (tabs)/residents.tsx   /residents
      (tabs)/orders.tsx      /orders
      (tabs)/approvals.tsx   /approvals?view=holds|approvals
      (tabs)/settings.tsx    /settings
      resident/[id]/index.tsx    /resident/res-02         ([id] = route parameter)
      resident/[id]/refill.tsx   /resident/res-02/refill
      order/[id].tsx             /order/ord-1004
      refills-due.tsx, delivery.tsx, audit.tsx
  components/                Reusable UI: AppButton, Badge, Card, ConfirmModal, TextField, OrderActions…
  state/                     SessionProvider (who is signed in), PharmacyProvider + pharmacyReducer (data)
  api/                       PharmacyApi interface, MockPharmacyApi, HttpPharmacyApi, seed data, storage
  domain/                    Pure business rules: order status, refills, dashboard, validation, dates
  models.ts                  All shared types (the DTOs)
  config.ts                  Tunables: timeout, latency, thresholds, demo user
  theme.ts                   Colors, spacing, font sizes; the only place colors are defined
api/                         ASP.NET Core minimal API + xUnit tests (optional real backend)
e2e/                         Playwright end-to-end tests
```

**The rule that holds it together:** dependencies only point one way:
`screens → state → api → storage`, and everything may use `domain` and `models`.
Screens never import storage or call `fetch`.

## 2. What happens when a nurse taps "Approve"

1. `OrderActions` (component) opens a `ConfirmModal`. The nurse taps **Approve**.
2. It calls `approveOrder(order.id)` from `usePharmacy()`, the context hook.
3. `PharmacyProvider` calls `pharmacyApi.approveOrder(id)`. That's the **interface**; it doesn't know
   whether it's talking to the mock or a real server.
4. `MockPharmacyApi` waits about 300 ms (fake network), checks the rule ("must be pending, else 409"),
   updates its data, writes an audit entry, saves to storage and returns the updated `Order`.
5. The provider dispatches `{ type: 'order_updated', order }` to the reducer.
6. The reducer returns new state with that order replaced. React re-renders: the approvals list,
   the tab badge and the dashboard counts all update, because they all read from the same state.
7. If the API throws, the modal shows the error message and stays open. A 401 signs the user out.

The same path is used for refills, denials, holds and delivery check-in.

## 3. State management: why Context + useReducer

- **Two contexts, two jobs.** `SessionProvider` answers "who is signed in, and should we lock?".
  `PharmacyProvider` holds the data (residents, medications, orders, delivery).
- **A reducer is a pure function:** `(state, action) => newState`. It's easy to unit-test and easy to
  reason about. It's the same pattern as Redux, without the library.
- **Why not Redux or Zustand?** At this size they add a dependency and concepts without solving a
  problem we have. Context is built into React. If the app grew (dozens of screens, frequent updates,
  caching rules), I'd move server data to **TanStack Query**, which handles caching, refetching and
  retries, and keep Context for session state.
- **Derived data isn't stored.** Dashboard counts, refill status and order status are calculated
  from the data each render. Storing them would mean keeping copies in sync, which is a classic
  source of bugs.

## 4. The service layer (PharmacyApi)

`src/api/PharmacyApi.ts` is a TypeScript **interface**. It's the same idea as `IPharmacyService`
injected in ASP.NET Core:

```ts
export interface PharmacyApi {
  signIn(username: string, password: string): Promise<Session>;
  getSnapshot(): Promise<PharmacySnapshot>;
  approveOrder(orderId: string): Promise<Order>;
  // …
}
```

`src/api/index.ts` picks the implementation, like registering a service in `Program.cs`:

```ts
export const pharmacyApi = apiUrl ? new HttpPharmacyApi(apiUrl) : new MockPharmacyApi();
```

- **MockPharmacyApi** behaves like a server: it owns the data, enforces rules, writes the audit log,
  adds latency and returns copies (so React state never shares objects with the "database").
- **HttpPharmacyApi** calls the real ASP.NET Core API with `fetch` and a bearer token, and turns error
  responses (RFC 7807 problem details) into `ApiError(status, message)`.
- **Proof it works:** the same Playwright test suite passes against both implementations.

**Why a mock for the live demo?** Free backend hosting sleeps when idle, so the first request can
take 30+ seconds. A reviewer would see a spinner or an error. The mock is instant and can't go down,
and the interface shows the app is ready for a real API.

## 5. Order status is computed from time

```ts
step = floor((now - processingStartedAt) / stepLength)   // capped at "delivered"
```

- **No timers, no polling, no stored status.** A refresh gives the same answer because it's a pure
  function of the timestamps. Screens re-render every second or few seconds with `useNow()`.
- Holds and pending approvals block progress (`processingStartedAt = null`). Approving or resolving
  sets it to "now", so progress restarts from there.
- In production the status would come from the pharmacy system (verification, fill and dispatch
  events). The UI would be the same.

## 6. LTC pharmacy domain choices

- **Cycle fill vs PRN vs short course.** Cycle-fill meds ship automatically every cycle, so they
  never show as "refill due". PRN (as-needed) meds are refilled on request, so they get supply
  tracking. Antibiotic courses are filled once.
- **Refill due** = PRN with 7 days of supply or less and no open order. Supply resets when a
  refill is delivered.
- **Holds** model real pharmacy blockers: expired prescription or dose change needs the prescriber;
  insurance (Part D) not covered. Resolution options match what a nurse actually does, such as
  getting a verbal order and reading it back, or a prior authorization approval.
- **High-cost approval:** fills of $500 or more wait for facility approval, because the facility often
  pays for non-covered drugs.
- **STAT requires a clinical reason**, because the pharmacist needs it to triage.
- **Allergies are shown prominently** on the profile and again on the refill screen.

## 7. Security decisions

- **Inactivity auto-lock (5 min).** Every touch, click, key or scroll updates a timestamp in memory.
  It's saved at most every 15 seconds (to avoid constant writes). A 10-second interval locks the
  session when idle, and the check also runs on app start and when the app returns to the foreground.
  So refreshing the page doesn't bypass it. The .NET API enforces the same timeout server-side.
- **Audit log** of every action, with required reasons for denials.
- **The server re-validates everything.** Client validation is only for fast feedback.
- **No real PHI anywhere.** That's why local storage is acceptable here. Production would use secure
  storage, SSO and HIPAA hosting (see the README).

## 8. Web-specific decisions

- **No `Alert.alert`.** It doesn't support buttons on web, so there's a `ConfirmModal` built on
  React Native's `Modal`, which works everywhere.
- **Single-page output and a Vercel rewrite** (`/(.*)` → `/index.html`) so refreshing `/order/123`
  never 404s. `unstable_settings.initialRouteName = '(tabs)'` keeps the back button working after a
  deep link.
- **Centered 480px column** on desktop. On phones it's full width.
- **Fonts preloaded** so icons never flash as empty boxes.

## 9. Testing strategy

- **Unit (Jest):** the pure domain functions and reducer. They're the core logic and the cheapest to
  test. The mock API is tested like a server, including persistence and daily regeneration.
- **E2E (Playwright):** the real nurse journey against the **deployed** site, at phone and desktop
  sizes, in Chrome and WebKit. Any console error fails the test.
- **API (xUnit):** `WebApplicationFactory` runs the API in memory. `FakeTimeProvider` tests the
  5-minute timeout without waiting.

## 10. Likely interview questions

**1. Why Expo instead of bare React Native?**
Expo is now React Native's recommended way to start a project. It gives one codebase for iOS, Android
and web, file-based routing, and over-the-air updates and cloud builds through EAS. You can still
write native modules (config plugins / prebuild), so there's no ceiling. The old "ejecting" concern is
gone.

**2. How would you connect this to a real backend?**
It already can: set `EXPO_PUBLIC_API_URL` and `HttpPharmacyApi` is used instead of the mock. Screens
don't change because they only know the `PharmacyApi` interface. For production I'd add retries,
request timeouts, token refresh, and probably TanStack Query for caching and background refetch.

**3. Why Context + useReducer and not Redux?**
The state is small: one session and one data snapshot. Context is built in and the reducer is
testable. Redux would add boilerplate without benefit here. If server data grew, I'd use TanStack
Query for it rather than Redux.

**4. How does the order status update "live"?**
It's computed from timestamps on every render, and `useNow()` re-renders every second. Nothing is
stored, so a refresh shows the same status and there are no timers to leak or drift.

**5. How do you handle security for patient data?**
This demo has no PHI on purpose. It shows auto-lock, an audit trail and server-side validation. For
production: SSO with short-lived tokens in Keychain/Keystore, role-based access per facility, no PHI
cached on the device, HIPAA hosting under a BAA, encryption in transit and at rest, and MDM.

**6. What happens if the API call fails?**
The provider re-throws it, and the screen shows the message inline and leaves the dialog open so the
nurse can retry. A 401 signs the user out with a message. The initial load has a full-screen error
with **Try again**. Lists have loading, empty and error states.

**7. How did you make it work on web as well as mobile?**
I avoided APIs without web support (`Alert.alert`, native date pickers), used React Native Web through
Expo, configured SPA routing and rewrites for deep links, and capped the width on desktop. Playwright
tests the web build in Chrome and Safari's engine on every check.

**8. How do you prevent double orders?**
The refill screen disables meds that already have an open order. The API also rejects it with 409
Conflict, so two nurses or two devices can't both order it. A multi-med request is validated first
and then created all-or-nothing.

**9. What would you improve with more time?**
Real persistence (EF Core + SQL Server), SSO and roles, push notifications for STAT orders, barcode
scanning at delivery check-in, an offline queue for poor connectivity on the floor, and signed
builds through EAS.

**10. How does the .NET API relate to the app?**
It implements the exact contract the app's mock implements: the same routes, DTOs (C# records that
mirror `models.ts`), rules and audit behavior. It returns RFC 7807 problem details, uses a bearer
token, enforces the inactivity timeout server-side, and has xUnit integration tests using
`WebApplicationFactory` and a fake clock. The same Playwright suite passes against it.

## 11. Quick C# ↔ TypeScript map

| In this app | Closest C#/.NET idea |
| --- | --- |
| `interface PharmacyApi` + `src/api/index.ts` | `IPharmacyService` + DI registration in `Program.cs` |
| `PharmacyProvider` / `usePharmacy()` | A scoped service injected into every page |
| `pharmacyReducer` | A pure `Apply(State, Event) => State` method (like event sourcing) |
| `models.ts` types | DTO `record`s |
| `domain/*.ts` | Static helper/service classes with pure methods, unit-tested with xUnit |
| Expo Router files in `src/app` | Razor Pages / Blazor `@page` routing |
| `useEffect` | `OnInitializedAsync` / lifecycle methods in Blazor |
| `useState` | A component field plus `StateHasChanged()` |
