import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

export const regionalCompetitorKindEnum = pgEnum("regional_competitor_kind", ["direct", "indirect", "substitute", "aspirational", "emerging"]);
export const regionalRunStatusEnum = pgEnum("regional_monitor_run_status", ["queued", "running", "completed", "failed"]);
export const regionalAlertStatusEnum = pgEnum("regional_alert_status", ["open", "acknowledged"]);
export const regionalLawfulBasisStatusEnum = pgEnum("regional_lawful_basis_status", ["unknown", "not_permitted", "permitted", "opted_out"]);
export const regionalAudienceOpportunityLifecycleEnum = pgEnum("regional_audience_opportunity_lifecycle", ["observed", "qualified", "ready_for_activation", "activated", "converted", "discarded"]);
export const regionalDeletionStateEnum = pgEnum("regional_deletion_state", ["active", "opted_out", "pending_deletion", "deleted"]);

/** Campaign scoped configuration; the application verifies campaign/workspace pairing on every write. */
export const regionalProfilesTable = pgTable("regional_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  region: text("region").notNull(),
  locale: text("locale").notNull().default("pt-BR"),
  countryCode: text("country_code"),
  subdivision: text("subdivision"),
  city: text("city"),
  postalCode: text("postal_code"),
  address: jsonb("address").notNull().default({}),
  timezone: text("timezone"),
  languages: jsonb("languages").notNull().default([]),
  operatingRegions: jsonb("operating_regions").notNull().default([]),
  residenceRegion: jsonb("residence_region").notNull().default({}),
  serviceRegion: jsonb("service_region").notNull().default({}),
  geoProvenance: jsonb("geo_provenance").notNull().default({}),
  geoConfidence: integer("geo_confidence"),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("regional_profiles_workspace_campaign_uidx").on(t.workspaceId, t.campaignId)]);

export const regionalCompetitorsTable = pgTable("regional_competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: regionalCompetitorKindEnum("kind").notNull(),
  websiteUrl: text("website_url"),
  normalizedWebsiteUrl: text("normalized_website_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("regional_competitors_workspace_campaign_url_uidx").on(t.workspaceId, t.campaignId, t.normalizedWebsiteUrl),
  index("regional_competitors_workspace_campaign_idx").on(t.workspaceId, t.campaignId),
]);

export const regionalPublicSourcesTable = pgTable("regional_public_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  competitorId: uuid("competitor_id").references(() => regionalCompetitorsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  normalizedUrl: text("normalized_url").notNull(),
  title: text("title"),
  sourceType: text("source_type").notNull().default("public_web"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("regional_sources_workspace_campaign_url_uidx").on(t.workspaceId, t.campaignId, t.normalizedUrl), index("regional_sources_workspace_campaign_idx").on(t.workspaceId, t.campaignId)]);

export const regionalEvidenceTable = pgTable("regional_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => regionalPublicSourcesTable.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  claim: text("claim").notNull(),
  payload: jsonb("payload").notNull().default({}),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("regional_evidence_workspace_fingerprint_uidx").on(t.workspaceId, t.fingerprint), index("regional_evidence_workspace_campaign_idx").on(t.workspaceId, t.campaignId)]);

export const regionalObservationsTable = pgTable("regional_observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  competitorId: uuid("competitor_id").notNull().references(() => regionalCompetitorsTable.id, { onDelete: "cascade" }),
  evidenceId: uuid("evidence_id").notNull().references(() => regionalEvidenceTable.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  facts: jsonb("facts").notNull().default({}),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("regional_observations_workspace_fingerprint_uidx").on(t.workspaceId, t.fingerprint), index("regional_observations_competitor_time_idx").on(t.workspaceId, t.competitorId, t.observedAt)]);

export const regionalChangeEventsTable = pgTable("regional_change_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  competitorId: uuid("competitor_id").notNull().references(() => regionalCompetitorsTable.id, { onDelete: "cascade" }),
  observationId: uuid("observation_id").notNull().references(() => regionalObservationsTable.id, { onDelete: "cascade" }),
  previousObservationId: uuid("previous_observation_id").references(() => regionalObservationsTable.id, { onDelete: "set null" }),
  changes: jsonb("changes").notNull(),
  material: text("material").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("regional_change_events_observation_uidx").on(t.observationId), index("regional_change_events_workspace_campaign_idx").on(t.workspaceId, t.campaignId, t.createdAt), check("regional_change_events_material_check", sql`${t.material} in ('true', 'false')`)]);

export const regionalMonitorRunsTable = pgTable("regional_monitor_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  idempotencyKey: text("idempotency_key").notNull(),
  status: regionalRunStatusEnum("status").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
  summary: jsonb("summary").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("regional_monitor_runs_workspace_campaign_key_uidx").on(t.workspaceId, t.campaignId, t.idempotencyKey), index("regional_monitor_runs_workspace_campaign_idx").on(t.workspaceId, t.campaignId, t.createdAt)]);

export const regionalAlertsTable = pgTable("regional_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  changeEventId: uuid("change_event_id").notNull().references(() => regionalChangeEventsTable.id, { onDelete: "cascade" }),
  status: regionalAlertStatusEnum("status").notNull().default("open"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedByUserId: uuid("acknowledged_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("regional_alerts_change_event_uidx").on(t.changeEventId), index("regional_alerts_workspace_campaign_status_idx").on(t.workspaceId, t.campaignId, t.status)]);

/** Public interaction metadata only. This is deliberately not a contact/lead table. */
export const regionalSocialSignalsTable = pgTable("regional_social_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  publicAccountRef: text("public_account_ref"),
  displayName: text("display_name"),
  sourceUrl: text("source_url").notNull(),
  normalizedSourceUrl: text("normalized_source_url").notNull(),
  postRef: text("post_ref"),
  interactionType: text("interaction_type").notNull(),
  publicTextExcerpt: text("public_text_excerpt"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  sentiment: text("sentiment"),
  intent: text("intent"),
  confidence: integer("confidence"),
  regionInference: text("region_inference"),
  regionProvenance: jsonb("region_provenance").notNull().default({}),
  lawfulBasisStatus: regionalLawfulBasisStatusEnum("lawful_basis_status").notNull().default("unknown"),
  sensitiveDataExcluded: boolean("sensitive_data_excluded").notNull().default(true),
  fingerprint: text("fingerprint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("regional_social_signals_workspace_fingerprint_uidx").on(t.workspaceId, t.fingerprint),
  index("regional_social_signals_workspace_campaign_time_idx").on(t.workspaceId, t.campaignId, t.occurredAt),
]);

/** An aggregateable audience insight, never a contactable lead or a contact record. */
export const regionalAudienceOpportunitiesTable = pgTable("regional_audience_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  signalId: uuid("signal_id").notNull().references(() => regionalSocialSignalsTable.id, { onDelete: "cascade" }),
  competitorId: uuid("competitor_id").references(() => regionalCompetitorsTable.id, { onDelete: "set null" }),
  identityHintFingerprint: text("identity_hint_fingerprint"),
  opportunityType: text("opportunity_type").notNull(),
  summary: text("summary").notNull(),
  attributes: jsonb("attributes").notNull().default({}),
  status: text("status").notNull().default("open"),
  heatScore: integer("heat_score").notNull().default(0),
  heatBand: text("heat_band").notNull().default("cold"),
  scoreReasons: jsonb("score_reasons").notNull().default([]),
  evidenceRefs: jsonb("evidence_refs").notNull().default([]),
  observedIntent: text("observed_intent"),
  interestTopic: text("interest_topic"),
  inferredRegion: text("inferred_region"),
  regionProvenance: jsonb("region_provenance").notNull().default({}),
  interactionRecencyHours: integer("interaction_recency_hours"),
  interactionFrequency: integer("interaction_frequency").notNull().default(1),
  lifecycle: regionalAudienceOpportunityLifecycleEnum("lifecycle").notNull().default("observed"),
  contactPermission: regionalLawfulBasisStatusEnum("contact_permission").notNull().default("unknown"),
  contactPhoneE164: text("contact_phone_e164"),
  processingPurpose: text("processing_purpose"),
  lawfulBasis: regionalLawfulBasisStatusEnum("lawful_basis").notNull().default("unknown"),
  consentSource: text("consent_source"),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  jurisdictionCodes: jsonb("jurisdiction_codes").notNull().default([]),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
  deletionState: regionalDeletionStateEnum("deletion_state").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("regional_audience_opportunities_signal_uidx").on(t.signalId),
  uniqueIndex("regional_audience_opportunities_workspace_identity_uidx").on(t.workspaceId, t.campaignId, t.identityHintFingerprint),
  index("regional_audience_opportunities_workspace_campaign_idx").on(t.workspaceId, t.campaignId, t.createdAt),
]);

export const regionalAudienceSegmentsTable = pgTable("regional_audience_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  label: text("label").notNull(),
  dimensions: jsonb("dimensions").notNull().default({}),
  signalCount: integer("signal_count").notNull().default(0),
  opportunityCount: integer("opportunity_count").notNull().default(0),
  lastObservedAt: timestamp("last_observed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("regional_audience_segments_workspace_fingerprint_uidx").on(t.workspaceId, t.fingerprint),
  index("regional_audience_segments_workspace_campaign_idx").on(t.workspaceId, t.campaignId, t.updatedAt),
]);
