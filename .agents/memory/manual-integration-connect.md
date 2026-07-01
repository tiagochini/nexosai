---
name: Manual integration connect endpoint
description: Rules for the manual credential-entry fallback endpoint for social/payment integrations (used when OAuth isn't available or feasible)
---

The manual-entry endpoint for connecting an integration is easy to leave silently broken because its Zod validation schema is a separate source of truth from the DB enum and from the insert `.values()` call — none of the three are type-checked against each other by default.

**Why:** found in production that the manual-connect route accepted requests successfully (201, no error) but the submitted access token was dropped (not in the Zod schema) and status was hardcoded to "disconnected" — so the integration silently never actually connected. Additionally the provider allow-list had drifted out of sync with the DB enum (missing `facebook`, several payment providers), so those provider submissions failed validation outright.

**How to apply:** whenever adding/reviewing a manual-credential-entry endpoint for any provider/integration system:
1. Confirm every field the frontend form can submit (especially the secret/token field) is present in the request-validation schema AND passed through to the insert/update — a field silently absent from the schema is stripped with no error.
2. Confirm the status written to DB actually reflects whether credentials were provided — don't hardcode a status.
3. Keep the request-level provider allow-list in sync with the DB-level enum; when providers are DB-aliased (e.g. an organic/free-tier variant sharing a paid-tier DB enum value), replicate the exact mapping already used by the OAuth callback path so both entry methods write to the same row.
4. Treat workspace+provider as a natural key: query for an existing row first and update it, otherwise reconnecting/re-entering credentials creates duplicate rows.
