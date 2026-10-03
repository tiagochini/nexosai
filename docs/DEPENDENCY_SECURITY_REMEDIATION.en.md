# Production dependency remediation

Português: [DEPENDENCY_SECURITY_REMEDIATION.md](./DEPENDENCY_SECURITY_REMEDIATION.md)

Date: October 3, 2026.

## Result and scope

The initial audit reported 75 findings (39 high, 31 moderate, 5 low).
After remediation, `pnpm run security:audit-dependencies` found no known
vulnerabilities in the production graph. This does not prove that application
code is free of flaws and excludes development-only dependencies.

- Removed unused `html-pdf-node`, with no references in script source. Its
  legacy Puppeteer chain is no longer installed; the separate modern Puppeteer
  dependency remains. No PDF generator was rewritten.
- Upgraded Multer to 2.4.0 and Nodemailer to version 10 (lock: 10.0.13).
- Refreshed the lockfile within existing compatible ranges, including
  Express/body-parser/qs, Socket.IO/Engine.IO/ws, DOMPurify and fflate.
- Scoped overrides pin `gaxios>uuid` and `teeny-request>uuid` to 11.1.1,
  retaining CommonJS support. UUID 14 was not forced onto legacy Google clients.
- Intake/video uploads cap multipart array indices at 100 to prevent excessive
  sparse arrays. Existing file-size limits are preserved.
- CI runs the audit with `--prod --audit-level low`; every known severity
  fails the job. Registry connectivity errors are not ignored either.
- The minimum release age of 24 hours remains enabled.

## Reproducible verification

```powershell
pnpm install --frozen-lockfile
pnpm run security:audit-dependencies
pnpm --filter @workspace/api-server run test:dependency-runtime
pnpm --filter @workspace/db run test:token-encryption
pnpm --filter @workspace/api-server run test:integration-security
pnpm --filter @workspace/api-server run test:auth-cookie-security
pnpm run build
pnpm run security:scan
```

Dependency regressions passed: offline mail serialization (no delivery), UUID v4
through CommonJS in Google clients, offline GCS object construction, JSON/forms,
uploads at and above the size limit, excessive multipart index rejection,
Engine.IO handshake, invalid protocol and valid responses after rejected requests.

Concurrent registration and HTTP session tests passed against local PostgreSQL:
cookies, CSRF, concurrent rotation, replay, workspace switching, expiry and logout.
They create and remove temporary fixtures without sending messages or publishing.
The local realtime test uses polling; it does not certify WebSocket, room
authorization, load or Redis recovery.

Nodemailer 10 requires Node.js 20 or newer; CI uses Node.js 24. Offline mail tests
do not certify SMTP authentication or real delivery. Rerun the audit on each
update because new advisories may appear.

## Rollback

Restore manifests and lockfile together from the previous commit, reinstall with
`--frozen-lockfile` and rebuild. This reintroduces known vulnerabilities and is
not a safe option for open production. No database migration or key change is
required for this batch.

## Maintainer references

- [Multer changelog and multipart limits](https://github.com/expressjs/multer/blob/main/CHANGELOG.md).
- [Nodemailer version 10 changes](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md).

Other plan items remain pending, especially sensitive logging, Redis,
backup/restore, the sandbox journey and AI quality.
