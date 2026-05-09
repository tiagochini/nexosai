import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  decimal,
  boolean,
  date,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const alertTypeEnum = pgEnum("alert_type", [
  "kpi_breach",
  "budget_exhausted",
  "low_health",
  "optimization_triggered",
  "phase_behind",
  "revenue_gap",
  "email_engagement_drop",
  "cpl_spike",
  "roas_drop",
  "custom",
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

// ── campaign_metrics — one row per day per campaign ───────────────────────────

export const campaignMetricsTable = pgTable(
  "campaign_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaignsTable.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),

    metricDate: date("metric_date").notNull(),
    dayIndex: integer("day_index").notNull(),
    phase: text("phase"),

    // ── Traffic
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    spendBrl: decimal("spend_brl", { precision: 12, scale: 2 }).notNull().default("0"),
    cplBrl: decimal("cpl_brl", { precision: 10, scale: 2 }),
    ctr: decimal("ctr", { precision: 6, scale: 4 }),

    // ── Leads & Conversions
    leads: integer("leads").notNull().default(0),
    sales: integer("sales").notNull().default(0),
    revenueBrl: decimal("revenue_brl", { precision: 14, scale: 2 }).notNull().default("0"),
    roas: decimal("roas", { precision: 8, scale: 4 }),
    conversionRate: decimal("conversion_rate", { precision: 6, scale: 4 }),

    // ── Email
    emailsSent: integer("emails_sent").notNull().default(0),
    emailOpens: integer("email_opens").notNull().default(0),
    emailClicks: integer("email_clicks").notNull().default(0),
    openRate: decimal("open_rate", { precision: 6, scale: 4 }),
    clickRate: decimal("click_rate", { precision: 6, scale: 4 }),

    // ── Social
    socialReach: integer("social_reach").notNull().default(0),
    socialEngagements: integer("social_engagements").notNull().default(0),

    // ── Computed
    healthScore: integer("health_score"),
    projectedRevenueBrl: decimal("projected_revenue_brl", { precision: 14, scale: 2 }),
    revenueGapPercent: decimal("revenue_gap_percent", { precision: 8, scale: 4 }),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("campaign_metrics_campaign_date_idx").on(table.campaignId, table.metricDate),
    index("campaign_metrics_workspace_idx").on(table.workspaceId),
  ],
);

// ── campaign_alerts ───────────────────────────────────────────────────────────

export const campaignAlertsTable = pgTable(
  "campaign_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaignsTable.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),

    alertType: alertTypeEnum("alert_type").notNull(),
    severity: alertSeverityEnum("severity").notNull(),

    title: text("title").notNull(),
    description: text("description").notNull(),
    recommendation: text("recommendation"),

    metricKey: text("metric_key"),
    metricValue: decimal("metric_value", { precision: 14, scale: 4 }),
    thresholdValue: decimal("threshold_value", { precision: 14, scale: 4 }),

    isAcknowledged: boolean("is_acknowledged").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),

    autoActionTaken: text("auto_action_taken"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("campaign_alerts_campaign_idx").on(table.campaignId),
    index("campaign_alerts_severity_idx").on(table.severity),
  ],
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type CampaignMetric = typeof campaignMetricsTable.$inferSelect;
export type NewCampaignMetric = typeof campaignMetricsTable.$inferInsert;
export type CampaignAlert = typeof campaignAlertsTable.$inferSelect;

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const IngestMetricsSchema = z.object({
  metricDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  dayIndex: z.number().int().min(1),
  phase: z.string().optional(),

  clicks: z.number().int().min(0).optional(),
  impressions: z.number().int().min(0).optional(),
  spendBrl: z.number().min(0).optional(),
  cplBrl: z.number().min(0).optional(),
  ctr: z.number().min(0).max(1).optional(),

  leads: z.number().int().min(0).optional(),
  sales: z.number().int().min(0).optional(),
  revenueBrl: z.number().min(0).optional(),
  roas: z.number().min(0).optional(),
  conversionRate: z.number().min(0).max(1).optional(),

  emailsSent: z.number().int().min(0).optional(),
  emailOpens: z.number().int().min(0).optional(),
  emailClicks: z.number().int().min(0).optional(),
  openRate: z.number().min(0).max(1).optional(),
  clickRate: z.number().min(0).max(1).optional(),

  socialReach: z.number().int().min(0).optional(),
  socialEngagements: z.number().int().min(0).optional(),

  notes: z.string().optional(),
});

export type IngestMetricsInput = z.infer<typeof IngestMetricsSchema>;
