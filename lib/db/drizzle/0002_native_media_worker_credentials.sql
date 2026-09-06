ALTER TABLE "native_media_workers" ADD COLUMN "credential_hash" text;
-- Existing workers cannot authenticate after this hardening and must register again.
DELETE FROM "native_media_workers";
ALTER TABLE "native_media_workers" ALTER COLUMN "credential_hash" SET NOT NULL;
CREATE TABLE "native_media_worker_nonces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "worker_id" uuid NOT NULL REFERENCES "native_media_workers"("id") ON DELETE cascade,
  "nonce" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "native_media_worker_nonces_worker_nonce_uidx" ON "native_media_worker_nonces" ("worker_id", "nonce");
CREATE INDEX "native_media_worker_nonces_expiry_idx" ON "native_media_worker_nonces" ("expires_at");
ALTER TABLE "native_media_jobs" ADD COLUMN "consent_id" uuid REFERENCES "native_media_consents"("id") ON DELETE restrict;