CREATE TABLE IF NOT EXISTS "social_conversation_turns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "integration_id" uuid NOT NULL REFERENCES "workspace_integrations"("id") ON DELETE CASCADE,
  "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE SET NULL,
  "account_id" text NOT NULL,
  "provider_user_id" text,
  "provider_event_id" text NOT NULL,
  "provider_message_id" text,
  "channel" text NOT NULL,
  "direction" text NOT NULL,
  "input_text" text,
  "reply_text" text,
  "masterplan_version" text,
  "masterplan_fingerprint" text,
  "context_fingerprint" text,
  "intent" text,
  "sales_stage" text,
  "decision" text,
  "confidence" numeric(4,3),
  "needs_human" text,
  "safety_reason" text,
  "provenance" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "provider_response_id" text,
  "provider_status" text,
  "provider_error" text,
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_conversation_turn_event_unique"
  ON "social_conversation_turns" ("workspace_id","integration_id","provider_event_id","direction");
CREATE INDEX IF NOT EXISTS "social_conversation_turn_account_user_idx"
  ON "social_conversation_turns" ("workspace_id","account_id","provider_user_id","created_at");