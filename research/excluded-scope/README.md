# Excluded historical commerce archive

**Historical evidence only. Nothing here is a LivingCity feature requirement.** Root [AGENTS.md](../../AGENTS.md) excludes directories, marketing, advertiser systems, ads/sponsors, monetization, commerce, identities/recovery, moderation, analytics, and backend services. Accessibility does not authorize bringing them back.

These notes preserve the supplied researcher findings from **2026-09-12**. They are not a security review, legal conclusion, implementation audit, or instruction to call source services. Sources are registered in [SOURCES.md](../../docs/SOURCES.md); no new research was performed during import.

## Archived captures

[directory.png](directory.png), [mobile-directory.png](mobile-directory.png), [booking.png](booking.png), and [how-it-works.png](how-it-works.png) are attributed Opportunity.city screenshots, analysis-only and never runtime assets.

Additional historical text remains unchanged in [observations.json](../raw/observations.json), [interactions.json](../raw/interactions.json), and [motion.json](../raw/motion.json). Those files mix useful ambient facts with commercial UI and must stay inert.

## Inventory, pricing, and forms

**Observed UI snapshot:** 37 offered placements, all available in the captured directory:

| Type | Count | Published seven-day price per placement |
| --- | --- | --- |
| Buildings | 32 | $49 |
| Landmark | 1 | $149 |
| Buses | 3 | $59 |
| Drone | 1 | $99 |

The captured payment entry uses fixed published prices for seven days, not a demonstrated auction. Legacy labels such as "bidding history" are not evidence of a live bidding mechanism. Supplied source-term research described exclusive occupancy, occupied placements unavailable to another buyer, and renewal adding another seven days. These behavior/terms claims were not tested with a completed purchase.

Observed form: brand name maximum 35 characters; description maximum 280; website URL, category and color; optional PNG/JPG/WebP logo; required authorization/content-compliance and immediate-start/withdrawal acknowledgments. Full labels/categories remain in `/bookingForm` and `/bookingInputs`. A selected location opens a commercial card with availability, price and reserve/share actions. LivingCity must replace that entire business interaction with concise original-landmark focus status.

No advertiser submission, logo upload, checkout payment, or recovery request was made. The application privacy notice explicitly stated **Stripe SANDBOX and no real payments**. Real-money production readiness is unverified; the visible Pay button is not evidence of completed real transactions.

## Public service and infrastructure evidence

**Observed naturally in the research flow:** source HTTPS paths `/api/city`, `/api/presence`, `/api/buyer/session`, and `/api/analytics/config`. HTTP headers include a Fly server identifier and `via: 2 fly.io, 2 fly.io`.

These are response/path observations, not API contracts. **Do not call, probe, clone, or add these endpoints to LivingCity.** Online/visit counters do not establish shared-world state or multiplayer.

**Operator-declared in supplied app-policy research:**

| Provider/system | Declared role | Limits |
| --- | --- | --- |
| Fly.io | EU application hosting. | Request headers corroborate Fly serving, not all storage locations or deployment details. |
| Cloudflare | Protection, including the optional analytics endpoint path. | No independently audited security configuration. |
| PostHog EU | Optional consent-based product analytics. | Policy claim, not a complete runtime audit. |
| Resend | Recovery email delivery; US processing/storage disclosed. | No recovery email flow was submitted. |
| Sightengine | Automated uploaded-image checks before publication. | No moderation upload was tested. |
| Stripe Checkout | Checkout, explicitly sandbox/no real payments in the notice. | No transaction was submitted or production readiness established. |
| Operator server | Placement records/logos reportedly stored there. | No database engine, ORM, or object-storage vendor disclosed. |

The general [privacy page](https://opportunity.city/privacy) concerns the marketing/coming-soon surface; [privacy/app](https://opportunity.city/privacy/app) supplements it for the actual application. Do **not** claim a contradiction solely because the general page says "coming soon."

## Purchase identity and recovery disclosures

The following are **operator-declared**, retained from supplied public-policy notes, not independently verified source-code behavior:

- An essential secure browser purchase cookie lasts up to 180 days; the random value is stored hashed server-side.
- The first successful Checkout billing email sets the recovery contact. That does not by itself prove ownership of the email inbox.
- Recovery links are single-use, expire after 15 minutes, and are stored as hashes.
- Restoring purchases revokes other browser sessions.
- Cleanup removes expired sessions; rate-limit buckets use hashed identifiers.
- Resend delivers recovery email with US processing/storage disclosed.

No cookie value, auth token, email address entered by the researcher, or private buyer state was collected. These disclosures are historical context only. The scoped city has no account or purchase identity to recover.

## Analytics disclosures

**Operator-declared optional analytics:** PostHog EU only after consent, via a Cloudflare-protected endpoint. The notice excludes session replay, autocapture and person profiles, along with typed/search text, email, payment IDs, purchase-cookie values, full URLs, query strings/fragments and referrers.

Consent and an anonymous ID were described as localStorage-backed; PostHog session state as memory-only. Withdrawal clears the ID and stops future events, with no retroactive capture of pre-consent activity. The raw capture lists the storage key name `townwhirl_analytics_consent`; it is not a stored token or a preference-key recommendation for LivingCity.

**Operator-declared separate essential aggregates:** daily advertiser outbound-click totals through a redirect, grouped by UTC day, placement and ownership period. These are not unique visitor or sales counts. The original counter/measurement semantics should not be generalized beyond the disclosed scope.

LivingCity needs **none of this analytics architecture**, consent UI, event schema, redirect accounting, or advertiser dashboard. Only local non-sensitive user preferences and local ephemeral performance measurement belong in the proposal.

## Mobile historical finding

The excluded directory fit 320/375/414/768 widths at height 844 in Chromium emulation. At the separate 390 px mobile inspection, the Directory button's center hit the brand-name span while Browse remained usable. This is evidence of a hit-target collision in that snapshot, not a complete accessibility audit or iOS Safari result.

Carry forward only the lesson to test ordinary controls for occlusion and input interception. Do not rebuild a directory as the remedy or the accessible alternative.

## Historical effort estimate

An earlier full-commerce concept was roughly estimated at **250-450 hours**. It is not a scoped ambient-city estimate and is not verified source-author effort. The current [roadmap](../../docs/ROADMAP.md) instead proposes a 40-80 hour overlapping visual prototype and a 120-220 hour polished ambient experience, subject to original-art and device requirements.

## Why this archive exists

The user asked to preserve the research comprehensively while removing the directory/marketing side from the product. Retaining excluded evidence here avoids losing context or accidentally treating historical discoveries as active requirements. No source asset or commercial feature is authorized by its presence in this repository.
