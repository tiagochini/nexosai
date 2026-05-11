import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const creditActionEnum = pgEnum("credit_action", [
  "strategy_generation",
  "copy_generation",
  "creative_brief",
  "timeline_generation",
  "video_concept",
  "video_low_res",
  "video_high_res",
  "landing_page_generation",
  "campaign_execution",
  "ad_creation",
  "remarketing_setup",
  "nurturing_message",
  "analytics_report",
  "monthly_reset",
  "purchase",
  "admin_grant",
]);

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "debit",
  "credit",
]);

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id"),
  type: creditTransactionTypeEnum("type").notNull(),
  action: creditActionEnum("action").notNull(),
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  aiProvider: text("ai_provider"),
  tokensUsed: integer("tokens_used"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCreditTransactionSchema = createInsertSchema(
  creditTransactionsTable,
).omit({ id: true, createdAt: true });

export type InsertCreditTransaction = z.infer<
  typeof insertCreditTransactionSchema
>;
export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;

// ─── Flat Credit Costs ────────────────────────────────────────────────────────
// Used by deductCredits() for actions that bypass the AI gateway dynamic pricing.
// Dynamic AI calls (via runAgent/completeWithAgent) compute credits from actual
// token usage × CREDIT_MARGIN_MULTIPLIER — these flat values are for auxiliary
// actions or legacy references only.
//
// Calibration basis (1 credit ≈ R$0.002 | CREDITS_PER_USD=100 | margin=1.5×):
//   anthropic/claude-3-5-sonnet:  input $3/M,  output $15/M
//   openai/gpt-4o:                input $2.5/M, output $10/M
//   gemini/gemini-1.5-pro:        input $1.25/M, output $5/M
//
// Critique-loop agents (copywriter, ad_copy, landing_page, compliance) run 3 AI
// turns each, which triples their effective credit cost vs. single-turn agents.

export const CREDIT_COSTS: Record<string, number> = {
  // ── Strategy phase agents (anthropic/claude-3-5-sonnet, single turn) ──────
  strategy_generation: 15,      // strategy agent: ~4k in + 4k out → $0.090 → ~14 cr
  timeline_generation: 15,      // launch_manager: ~5k in + 4k out → $0.090 → ~14 cr
  creative_brief: 10,           // creative_director: ~3k in + 3.5k out → $0.063 → ~10 cr

  // ── Content phase agents (openai/gpt-4o) ─────────────────────────────────
  // Single-turn agents
  copy_generation: 30,          // copywriter WITH critique (3 turns): ~$0.190 → ~29 cr
  landing_page_generation: 28,  // landing_page WITH critique (3 turns): ~$0.175 → ~27 cr
  ad_creation: 24,              // ad_copy WITH critique (3 turns): ~$0.155 → ~24 cr
  remarketing_setup: 12,        // media_buyer single-turn: ~$0.075 → ~12 cr

  // ── Compliance (anthropic, critique loop, most expensive) ─────────────────
  campaign_execution: 32,       // compliance WITH critique (3 turns): ~$0.205 → ~31 cr
                                 // also used by critique.runner.ts as a generic label

  // ── Cheap / auxiliary actions ──────────────────────────────────────────────
  nurturing_message: 2,         // item-copy per sequence item (flat, intentionally low)
  analytics_report: 5,          // direct AI chat message or analytics query
  video_concept: 3,             // media brief / gemini concept generation
  video_low_res: 50,            // future: AI video low-res render
  video_high_res: 150,          // future: AI video high-res render
};

// ─── Campaign Credit Estimates ────────────────────────────────────────────────
// Full lifecycle cost per campaign type (strategy + content + sequence + monitoring).
// "min" = no traffic budget, light WhatsApp, minimal monitoring
// "typical" = moderate traffic, ~30 WhatsApp AI responses, 3 optimization cycles
// "max" = full traffic, ~80 WhatsApp AI responses, heavy monitoring/re-optimization
//
// Component breakdown for "launch" (most expensive type):
//   Strategy phase:  command(3) + profile_builder(9) + strategy(11)
//                    + offer(7) + launch_manager(12) + financial_projector(3) = 45
//   Content phase:   creative_director(7) + copywriter_critique(24) + landing_page_critique(23)
//                    + social_media(8) + ad_copy_critique(20) + targeting(7) + media_buyer(9)
//                    + vsl_script(8) + cpl_script(8) + live_script(8) + stories(7)
//                    + media_brief(3) + compliance_critique(29) = 161 (with traffic)
//                    Without traffic: 161 - 7 (targeting) - 9 (media_buyer) = 145
//   Sequence:        launch_sequence_builder(7) + 15 items × 2 (item_copy) = 37
//   Monitoring:      WhatsApp AI responses (2 cr each) + optimization triggers (3 cr each)
//                    typical: 30×2 + 5×3 = 75 | max: 80×2 + 10×3 = 190

export const CAMPAIGN_CREDIT_ESTIMATES: Record<
  string,
  { min: number; typical: number; max: number; label: string }
> = {
  // Classic PLF launch (most agents active, VSL + CPL + Live scripts)
  launch: {
    min: 290,
    typical: 420,
    max: 630,
    label: "Lançamento clássico PLF",
  },
  // PLF for affiliates (same as launch but no financial ownership)
  affiliate: {
    min: 280,
    typical: 400,
    max: 580,
    label: "Campanha de afiliado",
  },
  // Perpetual launch (webinar instead of CPL, no cart close urgency cycle)
  perpetual_launch: {
    min: 270,
    typical: 390,
    max: 560,
    label: "Lançamento perpétuo / Webinar",
  },
  // Flash or live sales (shorter lifecycle, no CPL scripts)
  flash_sale: {
    min: 230,
    typical: 330,
    max: 480,
    label: "Queima relâmpago",
  },
  live_sale: {
    min: 240,
    typical: 350,
    max: 510,
    label: "Live de vendas",
  },
  // Evergreen (no launch spike, no CPL/VSL, ongoing optimization heavier)
  continuous_sales: {
    min: 220,
    typical: 320,
    max: 480,
    label: "Vendas contínuas / Evergreen",
  },
  subscription_growth: {
    min: 210,
    typical: 300,
    max: 450,
    label: "Crescimento de assinatura",
  },
  // Authority / audience growth (no financial projector, no launch manager)
  authority: {
    min: 170,
    typical: 240,
    max: 360,
    label: "Autoridade e posicionamento",
  },
  audience_growth: {
    min: 160,
    typical: 230,
    max: 340,
    label: "Crescimento de audiência",
  },
  creator_monetization: {
    min: 200,
    typical: 290,
    max: 430,
    label: "Monetização de criador",
  },
  // Lighter campaigns
  branding: {
    min: 140,
    typical: 200,
    max: 300,
    label: "Branding e marca",
  },
  upsell: {
    min: 180,
    typical: 260,
    max: 390,
    label: "Upsell / Cross-sell",
  },
  remarketing: {
    min: 160,
    typical: 230,
    max: 340,
    label: "Reativação de leads",
  },
  scale: {
    min: 200,
    typical: 280,
    max: 400,
    label: "Escala de campanha",
  },
  regional_dominance: {
    min: 220,
    typical: 310,
    max: 450,
    label: "Dominância regional",
  },
};

// ─── Credit Pricing in BRL ────────────────────────────────────────────────────
// Price per credit for top-up purchases (outside of plan allowance).
// Plan credits are ~33% cheaper (included in monthly subscription).
// R$0.15/credit × 420 typical launch = R$63 per campaign
// Plans give credits at effective R$0.10/credit (Solo: 2000 cr = R$297 → R$0.149/cr)
export const CREDIT_PRICE_BRL = 0.15;

// Minimum credit buffer required before starting a new campaign phase.
// Ensures the user always has headroom for at least a light next campaign.
export const CAMPAIGN_CREDIT_BUFFER = 150;

// Credit packs available for purchase (BRL, no subscription required)
export const CREDIT_PACKS = [
  { id: "pack_500", credits: 500, priceBrl: 79, label: "Starter", perCredit: 0.158 },
  { id: "pack_1000", credits: 1000, priceBrl: 149, label: "Popular", perCredit: 0.149, highlight: true },
  { id: "pack_2500", credits: 2500, priceBrl: 349, label: "Pro", perCredit: 0.140 },
  { id: "pack_5000", credits: 5000, priceBrl: 649, label: "Agency", perCredit: 0.130 },
] as const;

// Helper: get credit estimate for a campaign type
export function getCampaignCreditEstimate(
  campaignType: string,
): { min: number; typical: number; max: number; label: string } {
  return (
    CAMPAIGN_CREDIT_ESTIMATES[campaignType] ?? CAMPAIGN_CREDIT_ESTIMATES.launch
  );
}
