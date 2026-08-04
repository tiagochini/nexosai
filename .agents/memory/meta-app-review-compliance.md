---
name: Meta App Review Compliance
description: What the public-facing pages must contain to pass Meta's App Review; entity identification and deletion callback rules.
---

## Rule
For Meta (Facebook/Instagram) App Review, three things are non-negotiable:

### 1. Legal entity identification
Must appear in both `artifacts/landing/src/pages/privacy.tsx` (section 12 contact box) and `artifacts/landing/src/pages/terms.tsx` (section 1):
- Platform name: NexOS
- Legal operator: **DasKapital Holdings / B.A.T Cabral**
- ABN: **38 320 484 941** (Australia)

### 2. Strict-purpose language in Privacy → Meta section (section 4)
Must state explicitly that Meta API data is used **only** for the declared functions and never for re-targeting, profiling, or third-party transfer outside the operational context.

### 3. Data Deletion callback
- `POST /api/meta/data-deletion` — verifies HMAC-SHA256 signature, revokes tokens for matching Meta integrations, returns `{ url, confirmation_code }`.
- **URL in the response must always be the production domain**: `https://agencianexos.vip/data-deletion` — never `.replit.app`.
- The `GET /api/meta/data-deletion` human-readable page must show the legal entity name.
- File: `artifacts/api-server/src/modules/meta/meta-deletion.routes.ts`

**Why:** Meta reviewers verify these three items against the submitted app before granting API access. Missing entity info or a broken deletion URL are documented rejection reasons.
