# Log protection — local batch

P0 update: API runtime field inventory was reviewed and opaque canaries now cover
free-text names, questions, keywords, codes and raw responses.
[Closeout and scope limitations](P0_SECURITY_CLOSEOUT.en.md).

Português: [LOG_SECURITY.md](./LOG_SECURITY.md)

## Changes

The central logger sanitizes objects, messages and bindings before output,
including child loggers and `setBindings`, without mutating source objects.

- Credentials, tokens, emails, phones, names, documents, fingerprints, IPs
  identified by field name, cookies and headers are redacted.
- Bodies, payloads, prompts, transcripts, screenshots, SQL and parameters are
  omitted from structured logs. Binary buffers are redacted too.
- Errors retain only a generic type, recognized operational codes and valid
  HTTP status. Messages, stacks, causes and SDK responses are removed.
- Free text is filtered for absolute URLs, Bearer/JWT, known key patterns,
  credential assignments and emails. This cannot automatically identify every
  opaque secret or personal detail in free text.
- HTTP logs retain request ID/method/status, without URLs, dynamic path
  segments, query strings or headers. Endpoint context must be correlated
  through static module messages.
- Internal IDs, status, AI token counters and useful static messages remain.
  Internal IDs are pseudonyms, not anonymization.
- Traversal limits bound depth, field/item counts and text. Getters/toJSON are
  not invoked; circular references do not crash the logger.

Reviewed call sites no longer log invite codes, Academy/admin emails, WhatsApp
recipient phones, fingerprints or raw Asaas/Resend responses. Redis failures use
a fixed classification rather than server-returned text. A direct console warning
in campaign context now uses the protected logger.

## Verification

```powershell
pnpm --filter @workspace/api-server run test:log-security
pnpm run security:check-runtime-logging
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run test:dependency-runtime
pnpm --filter @workspace/api-server run test:integration-security
pnpm --filter @workspace/api-server run test:auth-cookie-security
pnpm run security:scan
```

The test inspects actual logger JSON output and a local Express request using
random password/token/email fixtures and a phone. It covers nested fields,
arrays, errors/string errors, interpolation, chained children/setBindings,
tokens in URL paths/queries, headers, cycles, getters, toJSON and non-mutation.
It also checks preservation of operational IDs, status and counters.

## Follow-up review — October 4, 2026

Reviewed logs no longer include Meta DM text, WhatsApp message snippets, user
feedback, AI previews/responses, report HTML or raw Resend/Gemini/OpenAI/HeyGen
responses. Processing logic, content sent to providers and user-facing content
remain unchanged; this batch limits logging only. Contract warnings retain IDs
and a violation indicator rather than generated-output fragments.

Sanitization handles aliases including `lastError`, `errText`, `oaiErr`,
`providerErrorMessage`, `dtErrText`, `failureMsg`, `rawPreview`, `rawTail` and raw
provider data. The numeric `tokens` counter remains available.

The AST guard `security:check-runtime-logging` passed on 325 API TypeScript files
and 1,030 structured calls. It blocks known raw fields in literal log metadata,
direct console/stdout/stderr writes and Pino imports outside the protected
factory (type-only imports are allowed). Rule tests are included, and the guard
is wired into the local quality workflow.

This is not full data-flow analysis: spreads, logger aliases, new field names,
interpolated messages and persisted data may need manual review. Diagnostic
scripts are excluded. A passing guard does not prove the whole project is free
of sensitive-data exposure.

The test was added to the local quality workflow. This batch must not be pushed:
the user authorizes a local commit only. Remote CI does not validate these
changes until a future authorized push.

## Remaining work and limits

The full module-by-module audit remains open: opaque data in free text,
independent loggers, third-party libraries and diagnostic scripts require review.
This protection covers the central logger and its children, not every process,
console, Python service or database audit store. Existing logs were not deleted
or rewritten. Log retention and access controls still need to be defined.
Do not restore raw body/stack dumps for debugging; use IDs/status/codes and
controlled tracing instead.

No database migration, secret change or publication is required. Rollback restores
previous files and rebuilds, but reintroduces exposure through logs. Restart the
API with the new build to activate protection in the running process.
