# Academy — administrative protection

Local review: October 5, 2026. [Português](./ACADEMY_ADMIN_SECURITY.md).

## Remediation

Removed the embedded default password from administrative/CRM routes. All 11
reviewed routes share the same authorization check, including `/funnel-tick`,
which previously did not check authorization. Lead/purchase listings, statistics,
purchase confirmation, gift-code generation and CRM updates require valid
credentials before reading data or performing actions.

Configure `ACADEMY_ADMIN_SECRET` in the private server environment using a
cryptographically secure random value of 32–256 characters, without surrounding
whitespace. Send it exclusively in the `x-admin-secret` header, over HTTPS
outside local development. Comparison uses `timingSafeEqual` after length
validation. Missing, empty or short configuration closes these routes with `401`.

There is no default secret in `.env.example`. No new secret was generated,
displayed, saved or changed in `.env.local` in this stage. If current configuration
is absent or short, administrative access will be disabled after restarting the
API. Legacy clients using `?secret=...` must switch to the header; URL parameters
no longer authenticate.

## Evidence and operations

```powershell
pnpm --filter @workspace/api-server run test:academy-admin-security
```

The test starts only a temporary local HTTP server, exercises all 11 routes with
missing/weak configuration and absent/default/query credentials, and verifies
that a valid header reaches input validation. It does not confirm purchases,
generate codes, run the scheduler, send email or modify the database. Temporary
test-process configuration is restored in `finally`.

Typecheck, build and logging guard/tests passed locally. The workflow was updated
but not executed remotely in this stage because there was no push. The running
API was not automatically restarted.

## Limits

This is a shared administrative credential, not account-based authorization.
Authenticated owner-role sessions, dedicated attempt limiting, action auditing
and a complete review of other routes/access codes remain pending. External
administrative clients were not exercised. Never put this secret in public
JavaScript, URLs, logs or the repository.

No database migration. Rolling back to previous code would reintroduce default
access and the exposed scheduler; prefer a forward fix and do not restore this
behavior in production.
