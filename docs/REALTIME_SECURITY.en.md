# Realtime campaign security

Português: [REALTIME_SECURITY.md](./REALTIME_SECURITY.md)

## Remediated flaw

Previously, any authenticated user could request `join:campaign` for a campaign
in another workspace and receive events through that unauthorized connection.

Room entry now requires a campaign in the token's workspace, owned by the
authenticated user, with active workspace status. These criteria are applied
in the database query. Missing and foreign campaigns return the same
`CAMPAIGN_NOT_FOUND` response; malformed inputs are rejected before querying.
Authorization failures never grant entry and return `REALTIME_UNAVAILABLE`
without logging tokens or query details.

The connection validates workspace ownership/status and JWT expiration. Sockets
are disconnected at expiration. Browser origins must match `ALLOWED_ORIGINS`;
outside production, the origin of `APP_URL` is also allowed. `allowRequest`
validates WebSocket upgrades in addition to polling CORS. Clients without an
Origin remain supported but still require authentication and authorization.

Each connection permits at most 50 campaign subscriptions, including pending
queries. Leaving while authorization is pending cancels entry. The frontend
leaves rooms when their last consumer unmounts, replaces connections after
token refresh/workspace changes, and disconnects at logout.

## Tests

```powershell
# Configure DATABASE_URL, SESSION_SECRET and APP_URL in the environment:
pnpm --filter @workspace/api-server run test:realtime-security-db
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/app run typecheck
pnpm --filter @workspace/api-server run build
pnpm run security:audit-dependencies
pnpm run security:scan
```

The test creates two temporary users/workspaces and campaigns in PostgreSQL.
Both WebSocket and polling are exercised: authorized delivery, no cross-tenant
events, malformed/missing/foreign IDs, leave during pending authorization,
untrusted origins, invalid credentials, mismatched ownership, expired JWT,
disconnect at expiration, suspended workspace, simulated authorization-query
failure and recovery. Fixtures are removed afterward. CI runs the test with
disposable PostgreSQL.

## Operational limits

This batch does not certify load, Redis, durable event delivery, or instant
revocation of all open connections when an account is suspended. Ownership and
status are revalidated at connection and room entry; existing connections end
on frontend logout or JWT expiration. A copied access token remains subject to
its lifetime, as with HTTP APIs. Central access-token revocation is separate work.

No database migration is needed. For rollback, restore code/manifests/lockfile
together and rebuild; this reopens the flaw and is not recommended in production.

The full build, audit and security tests for the preceding dependency fix passed
in [CI](https://github.com/tiagochini/nexosai/actions/runs/37159141875).
