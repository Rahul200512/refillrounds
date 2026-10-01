# Demo video script (about 2½ minutes)

**Before recording**
- Open https://refillrounds.vercel.app on your phone, or in Chrome DevTools device mode (iPhone size).
  Use a private window, or tap **Settings → Reset demo data**, so the data starts clean.
- Close notifications. Zoom so text is readable. Record with sound.
- Keep the pace calm. Say what the nurse is doing, not what the code is doing, until the last part.

---

### 1. The problem (about 20 s): sign-in screen
> "In a nursing home, the nurse is the pharmacy's main contact: refills, holds, approvals and
> deliveries. Today that usually means walking back to a desktop portal. RefillRounds puts that to-do
> list on the phone they already carry. All the data here is fictional."

Tap **Fill demo credentials → Sign in**.

### 2. Dashboard (about 15 s)
> "The dashboard shows what needs attention: six refills due, three orders on hold, two approvals and
> today's delivery. Below, the most urgent items come first. A STAT order on hold is at the top."

### 3. Resident and STAT refill (about 35 s)
Tap **Residents**, type "ruth", open **Ruth Abernathy**.
> "Allergies are the first thing you see. Her nebulizer is down to one day of supply."

Tap **Request refill**, select **Ipratropium-albuterol**, tap **STAT**.
> "STAT requires a clinical reason so the pharmacist can triage."

Type "Wheezing overnight, last vial used", tap **Review request → Send to pharmacy**.
> "The order is sent. The timeline updates on its own: pharmacy verified, filled, out for delivery.
> It's compressed to seconds for the demo."

### 4. Approvals and holds (about 30 s)
Tap the back arrow, then the **Approvals** tab.
> "High-cost medications need facility approval. This antibiotic is $4,200 and it's STAT, so I approve
> it." Tap **Approve → Approve**.

On **Linezolid**, tap **Deny**.
> "Denying requires a reason, which goes into the audit log." Type a reason, then tap **Deny order**.

Tap **Holds**, then **Resolve hold** on Sertraline. Choose **Signed renewal received**, then **Resolve hold**.
> "Holds like an expired prescription can be cleared right here. The badge counts update immediately."

### 5. Delivery and audit (about 20 s)
**Settings → Today's delivery check-in.** Mark two items received and one as **Damaged**.
> "When the tote arrives, the nurse checks each item against the packing slip and flags anything
> missing or damaged."

**Settings → Audit log.**
> "Every action is recorded: who, what and when."

### 6. Under the hood (about 30 s): switch to the GitHub repo or your editor
> "It's React Native with Expo and TypeScript, so one codebase runs on iOS, Android and the web. All
> data goes through a typed service interface. The live demo uses a local mock, and the repo includes
> an ASP.NET Core API that implements the same contract. The same end-to-end tests pass against both.
> Sessions lock after five minutes of inactivity, every action is audited, and CI runs type checks,
> lint, unit tests and Playwright tests. Thanks for watching."

---

**Tips**
- If you record on a phone, the STAT order reaches "Out for delivery" about 90 seconds after
  submitting. Talk through approvals while it runs, then show the order again at the end if you want.
- Re-record any section rather than editing mid-sentence. Short clean cuts look more professional.
