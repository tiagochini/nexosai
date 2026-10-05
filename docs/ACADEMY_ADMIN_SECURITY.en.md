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

### Access-code generation

Checkout and gifts share a generator based on `node:crypto.randomInt`, without
`Math.random` or a non-cryptographic fallback. The existing three groups of four
characters and 32-symbol alphabet excluding ambiguous letters are preserved.
Each new code has 60 random bits; the change improves the random source, not
the length/entropy of the format. Existing codes were not rotated, modified
or deleted.

Gift requests require a valid JSON body and integer `count` from 1 to 50; when
omitted in the object, it defaults to 5. Negative, zero, fractional, string and
oversized values do not generate codes. The database unique constraint remains
the final collision safeguard; collision-specific retries remain pending.

```powershell
pnpm --filter @workspace/api-server run test:academy-access-code
pnpm --filter @workspace/api-server run test:academy-admin-security
```

The test generates 1,000 in-memory samples with `Math.random` blocked, checks
format and absence of duplicates in that sample, and prints no codes. This is
not statistical proof of entropy or a guarantee against collisions. HTTP tests
reject invalid input and check default and boundary counts 1/50 before product
validation, without inserting gifts or querying real purchases. Tests did not
modify any existing code or real purchase.

Public verification attempt limiting, protected code storage, expiry/revocation
and review of personal-data responses remain pending. Cryptographic generation
alone does not resolve these risks.

This is a shared administrative credential, not account-based authorization.
Authenticated owner-role sessions, dedicated attempt limiting, action auditing
and a complete review of other routes/access codes remain pending. External
administrative clients were not exercised. Never put this secret in public
JavaScript, URLs, logs or the repository.

No database migration. Rolling back to previous code would reintroduce default
access and the exposed scheduler; prefer a forward fix and do not restore this
behavior in production.
