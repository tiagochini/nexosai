# Authentication sessions

[Português](./AUTH_SESSION_SECURITY.md)

Login, registration, checkout, workspace creation, and workspace switching use
the same session issuance. JSON responses contain the access token and its actual
lifetime. Refresh credentials are sent only through the `nexos_refresh` cookie,
with `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, and `Secure` in production.
Session issuance responses use `Cache-Control: no-store`. The frontend removes
legacy refresh credentials from `localStorage` and never stores new ones there.

## Persistence and renewal

`auth_refresh_sessions` stores only the refresh token's SHA-256 hash, user,
workspace, expiration, and revocation timestamps. Secrets contain 32 random
bytes. Sessions expire at most 30 days after issuance; renewal does not extend
this deadline. Each refresh replaces the secret with a conditional database
update. Concurrent consumption and reuse of the previous token return HTTP 401.

`POST /api/auth/refresh` reads the cookie rather than a body token.
`POST /api/auth/logout` revokes the current session and clears the cookie.
Workspace switching issues a new session and revokes the previous one. Renewal
checks ownership of the active workspace. Deleting a user or workspace removes
its sessions through foreign-key cascades.

Session mutations check `Origin` and `Sec-Fetch-Site`. Untrusted origins,
cross-site requests, and forms without a trusted origin are rejected. Clients
without browser headers must use JSON. Configure `APP_URL` and `ALLOWED_ORIGINS`
correctly. The app uses the API on the same site via `/api`, including its local
proxy.

The frontend deduplicates concurrent refreshes and uses Web Locks when available
to coordinate tabs. Login and registration wait for pending logout requests.
Without Web Locks, the database still enforces single consumption, but exactly
simultaneous refreshes in multiple tabs may return a 401 and require login.

## Rollout and rollback

1. Back up the database and run `pnpm --filter @workspace/db run migrate:tracked`
   with `DATABASE_URL` configured. The migration is `0063_auth_refresh_sessions.sql`.
2. Update backend and frontend together. JWT refresh tokens and clients sending
   body refresh tokens are no longer accepted. Legacy users must log in again
   when their existing access token expires.
3. Use HTTPS in production so the `Secure` cookie works. Opaque refresh tokens
   require no additional signing key.
4. Verify login, renewal, workspace switching, and logout. CI runs these tests
   with disposable accounts, concurrent registration, and token encryption in
   PostgreSQL.

To roll back, restore backend and frontend together; the new table may remain
unused. Old code cannot interpret opaque tokens, so users must log in again.
Do not change the previous SQL snapshot checksum: bootstrap applies migrations
after version 0062 within its transaction.

## Limitations

Access tokens retain their previous storage and configured lifetime. This change
protects and revokes refresh credentials. Existing access tokens remain valid
until expiration. Offline logout clears the local access token, but server
revocation depends on delivery of the request. XSS controls and security review
of other modules are still necessary. Expired/revoked sessions remain in the
database until maintenance.
