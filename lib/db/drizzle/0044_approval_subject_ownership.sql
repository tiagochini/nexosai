ALTER TABLE "workspaces"
  ADD CONSTRAINT "workspaces_id_owner_id_uidx" UNIQUE ("id", "owner_id");
ALTER TABLE "content_pieces"
  ADD CONSTRAINT "content_pieces_workspace_campaign_id_uidx" UNIQUE ("workspace_id", "campaign_id", "id");
ALTER TABLE "approval_checkpoints"
  ADD CONSTRAINT "approval_checkpoints_campaign_id_uidx" UNIQUE ("campaign_id", "id");
ALTER TABLE "masterplan_versions"
  ADD CONSTRAINT "masterplan_versions_workspace_campaign_id_uidx" UNIQUE ("workspace_id", "campaign_id", "id");

ALTER TABLE "approval_decisions"
  DROP CONSTRAINT IF EXISTS "approval_decisions_masterplan_version_fk",
  DROP CONSTRAINT IF EXISTS "approval_decisions_content_piece_fk",
  DROP CONSTRAINT IF EXISTS "approval_decisions_checkpoint_fk";

ALTER TABLE "approval_decisions"
  ADD CONSTRAINT "approval_decisions_workspace_actor_fk"
    FOREIGN KEY ("workspace_id", "actor_user_id")
    REFERENCES "workspaces" ("id", "owner_id") ON DELETE RESTRICT,
  ADD CONSTRAINT "approval_decisions_masterplan_scope_fk"
    FOREIGN KEY ("workspace_id", "campaign_id", "masterplan_version_id")
    REFERENCES "masterplan_versions" ("workspace_id", "campaign_id", "id") ON DELETE RESTRICT,
  ADD CONSTRAINT "approval_decisions_content_piece_scope_fk"
    FOREIGN KEY ("workspace_id", "campaign_id", "content_piece_id")
    REFERENCES "content_pieces" ("workspace_id", "campaign_id", "id") ON DELETE RESTRICT,
  ADD CONSTRAINT "approval_decisions_checkpoint_scope_fk"
    FOREIGN KEY ("campaign_id", "checkpoint_id")
    REFERENCES "approval_checkpoints" ("campaign_id", "id") ON DELETE RESTRICT;