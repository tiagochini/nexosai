# Integration token encryption

[Português](./INTEGRATION_TOKEN_ENCRYPTION.md)

`workspace_integrations.access_token` and `refresh_token` use AES-256-GCM at the
Drizzle persistence boundary. The database receives a versioned envelope with
a key identifier, random 12-byte nonce, authentication tag, and ciphertext.
ORM reads return the token to internal consumers. Columns remain `text`, with
no SQL schema change. Null values remain null. Raw SQL does not automatically
perform this conversion.

## Configuration and rollout

1. Set `INTEGRATION_TOKEN_ENCRYPTION_KEY` to 32 random bytes encoded in canonical
   base64. Use a secret manager in production. Never commit the key or store it
   alongside database backups.
2. Keep a database backup and a protected copy of the key. Stop old APIs and
   workers before migration; they cannot interpret encrypted envelopes.
3. Run `pnpm --filter @workspace/db run tokens:check`. It validates credentials
   and keys without persisting changes, and reports counts only.
4. Run `pnpm --filter @workspace/db run tokens:migrate`. All tokens are converted
   in one transaction with a table write lock. Errors roll back the changes.
   An empty credential store produces a zero count.
5. Start updated APIs and workers with the same key. Production API startup
   requires valid encryption configuration. In every environment, token writes
   require the key and reads reject plaintext or tampered ciphertext.

There is no development-key or plaintext-write fallback. The migration command
supports legacy databases before starting the new version. Run it outside normal
traffic.

## Rotation and recovery

To rotate, stop writers, set a new active key, and include the old key in
`INTEGRATION_TOKEN_PREVIOUS_KEYS`, a JSON array of base64 keys. Run the check
and migration commands. The migration reencrypts values with the active key.
Restart all consumers with the updated configuration. Remove previous keys only
after verifying conversion and accounting for older backups.

Migration failures roll back automatically. To return to the old code, restore
the pre-migration backup while writers are stopped. Do not run old code against
encrypted data. Losing all keys makes tokens unrecoverable; revoke credentials
and reconnect integrations with their providers.

## Verification and scope

`pnpm --filter @workspace/db run test:token-encryption` checks nonce uniqueness,
integrity, missing/wrong keys, rotation, and SQL mapping. Append `-- --database`
to exercise PostgreSQL insert, read, update, and `RETURNING` using a temporary
table and rollback without changing real integrations.

This change covers the two token columns in this table. Secrets in metadata,
other columns, logs, or chat history need separate checks. Encryption at rest
does not protect tokens in process memory or replace authorization and API
responses that omit credentials.
