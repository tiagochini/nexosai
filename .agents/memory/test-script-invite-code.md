---
name: Test Script Registration Gate
description: How to get past the invite-code registration gate when running e2e tests or test scripts that need to register a new user.
---

Registration is gated behind an invite code when `PLATFORM_OPEN` env var is not `"true"`. The `/register` UI only shows a "Solicitação Enviada!" message with a WhatsApp-code promise — there is no way to complete registration through the UI alone.

**How to apply:** before running any e2e test or script that needs to register a fresh user, insert a temporary row into the `invite_codes` table (see `lib/db/src/schema/invite-codes.ts` for the schema — `code`, `plan_slug`, `label`, `used` default false) via a dev-DB SQL query, then pass that code through the registration form's invite-code field (may be hidden behind a "Já tenho código" toggle). Delete the temp row after the test completes to avoid leaving clutter in the dev DB.
