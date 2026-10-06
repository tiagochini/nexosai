# P1 — implementation and local evidence

Reviewed October 6, 2026. Technical implementation is complete; remote CI
confirmation is pending because GitHub CLI authentication is invalid.
This does not approve open production or close external P0 activation gates.

Paid lessons, exercises, quizzes, glossary, bibliography and guide content now
reside in the API. The public client contains catalog metadata. Course delivery
requires a confirmed complete-bundle purchase; guide HTML and the original PDF
accept either paid product. Every request checks revocation and financial holds.
Credentials use headers. Owner access uses the existing audited, revocable
individual session. Authorized responses are private and no-store. Redis quotas
fail closed. The original guide PDF is generated server-side and licensed from
the authorized purchase. Previously received material can still be copied.

Quality CI includes disposable PostgreSQL 17/Redis 7, empty bootstrap, forced
rollback, schema/migration verification, authentication, cookies, realtime,
payment concurrency/reversals, Academy delivery/outbox, paid authorization,
Redis quotas and checkpoint recovery. A public fixture encryption key supports
isolated integration rows. Offline fallback, boot recovery and health tests run
in CI too. Security CI fetches full history, scans current versionable files,
and audits prohibited sensitive paths across all reachable commits. The history
audit rejects shallow clones and covers paths, not every possible secret in
historical blob contents.

All listed database/Redis checks passed locally, with 177 tables/73 schema
entries and no remaining fixture users/workspaces/campaigns. Full build and
typecheck passed, followed by final API/Academy rebuilds. Paid content checks
found 313 canaries absent from five public JS/HTML artifacts. Header/query
authorization boundaries, wrong products, pending purchases, holds, revocation,
refunds and unknown codes were tested. Authorized PDF delivery passed, and
refunds block new downloads. Current secret scan/history-path audit passed.
The complete dependency audit reported no known vulnerabilities.

Reproduce with the Compose file `scripts/compose.p1-tests.yml`, project name
`nexos-p1-tests`, and `pnpm run test:p1-local`, then build and run
`node scripts/check-academy-paid-bundle.mjs`. The runner fixes dedicated loopback
database/Redis URLs and does not load production .env files. Initial execution
requires an empty database; `--from test:academy-content-db` resumes later steps.
Remove owned containers and anonymous volumes with Compose down --volumes.
No real provider, charge or email is required.

Deploy API before frontend, remove previous public bundles and invalidate CDN
caches. Keep API source private and do not serve Vite dev in production. This
P1 changes no schema. For rollback, temporarily disable paid UI while retaining
protected delivery; restoring the old public bundle exposes paid content again.
Final P1 closure requires publishing this revision and confirming successful
Quality checks/Security checks runs on GitHub.

Detailed Portuguese evidence: [P1_CLOSEOUT.md](./P1_CLOSEOUT.md).
