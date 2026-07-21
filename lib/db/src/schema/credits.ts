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
  "video_script",
  "video_storyboard",
  "video_low_res",
  "video_high_res",
  "video_avatar",
  "video_voice_clone",
  "video_hybrid",
  "daily_video_short",
  "daily_video_long",
  "daily_video_story",
  "landing_page_generation",
  "campaign_execution",
  "ad_creation",
  "remarketing_setup",
  "nurturing_message",
  "analytics_report",
  "monthly_reset",
  "purchase",
  "admin_grant",
  "referral_bonus",
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
// Calibration basis (1 credit ≈ R$0.002 real AI cost | margin=1.5×):
//   CREDITS_PER_USD=100 → face: $0.01/credit → actual AI cost: $0.0067/credit
//   At R$5/USD: actual AI cost ≈ R$0.033/credit
//   Pack sell price: R$0.17/credit → gross margin ≈ 81%
//
// Critique-loop agents (copywriter, ad_copy, landing_page, compliance) run 3 AI
// turns each, which triples their effective credit cost vs. single-turn agents.

export const CREDIT_COSTS: Record<string, number> = {
  // ── Strategy phase agents (anthropic/claude-3-5-sonnet, single turn) ──────
  strategy_generation: 15,      // strategy agent: ~4k in + 4k out → $0.090 → ~14 cr
  timeline_generation: 15,      // launch_manager: ~5k in + 4k out → $0.090 → ~14 cr
  creative_brief: 10,           // creative_director: ~3k in + 3.5k out → $0.063 → ~10 cr

  // ── Content phase agents (openai/gpt-4o) ─────────────────────────────────
  copy_generation: 30,          // copywriter WITH critique (3 turns): ~$0.190 → ~29 cr
  landing_page_generation: 28,  // landing_page WITH critique (3 turns): ~$0.175 → ~27 cr
  ad_creation: 24,              // ad_copy WITH critique (3 turns): ~$0.155 → ~24 cr
  remarketing_setup: 12,        // media_buyer single-turn: ~$0.075 → ~12 cr

  // ── Compliance (anthropic, critique loop, most expensive) ─────────────────
  campaign_execution: 32,       // compliance WITH critique (3 turns): ~$0.205 → ~31 cr

  // ── Cheap / auxiliary actions ──────────────────────────────────────────────
  nurturing_message: 2,         // item-copy per sequence item (flat, intentionally low)
  analytics_report: 5,          // direct AI chat message or analytics query
  video_concept: 3,             // media brief / gemini concept generation
  video_script: 18,             // VSL/CPL script via GPT-4o (3k in + 4k out) → ~$0.115 → ~18 cr
  video_storyboard: 12,         // Scene Director storyboard via Gemini (2k in + 3k out) → ~$0.075 → ~12 cr
  video_low_res: 50,            // per-scene low-res clip (Runway/Kling) — preview approval gate
  video_high_res: 150,          // per-scene HD final clip (Runway/Kling 1080p)
  video_avatar: 80,             // HeyGen avatar talking-head per scene
  video_voice_clone: 30,        // ElevenLabs voice clone creation (one-time per project)
  video_hybrid: 30,             // Hybrid mode: user records + AI edits (captions, music, cuts)

  // ── Daily Video ───────────────────────────────────────────────────────────
  daily_video_short: 12,        // Reels/TikTok/Shorts (≤60s): script + hook + captions + visual dir → ~$0.08 → ~12 cr
  daily_video_long: 20,         // YouTube/Long Form (5–15min): full script + chapters + B-roll → ~$0.13 → ~20 cr
  daily_video_story: 8,         // Stories sequence (4–6 frames): script + visual per frame → ~$0.05 → ~8 cr

  // ── Presença Social Always-On ─────────────────────────────────────────────
  presence_week_plan: 15,       // presence_planner: plano semanal 7 dias multi-plataforma (~5k in + 5k out)
  presence_bio_optimize: 4,     // bio_optimizer: bio + destaques por plataforma (single-turn curto)
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
//
// MARGIN STRUCTURE (at USD/BRL = 5.00):
//   Real AI cost per credit = $0.01 / 1.5 (margin) = $0.00667 USD = R$0.033
//   Pack sell price = R$0.17/credit average
//   → Gross margin on packs ≈ 80-81%
//   → On a typical 420-credit launch: real AI cost ≈ R$14 | pack revenue = R$71 | profit = R$57
//
// PLAN CREDIT LOGIC — FORCING MECHANISM:
//   Solo (3 campaigns, R$297/mo): 900 credits → enough for exactly 2 typical launches (900/420 = 2.1)
//     The 3rd campaign ALWAYS forces a pack purchase. Even with light use (290 cr min), 900/290 = 3.1 — barely.
//     Heavy users (max 630 cr): 900/630 = 1.4 → need packs after campaign 1.
//   Agency (10 campaigns, R$1497/mo): 2000 credits → enough for ~4 typical launches (2000/420 = 4.7)
//     For all 10 campaigns: 10×420 = 4200 needed → always short ~2200 cr → forces 1-2 pack purchases/mo.
//     Heavy use (max 630 cr): 2000/630 = 3.2 → packs needed from campaign 4 onwards.
//
// PACK ACQUISITION TIMING:
//   Packs are offered AFTER the launch (post-onboarding), once the client has seen results.
//   This is intentional: they convert on value, not on necessity at sign-up.

export const CREDIT_PRICE_BRL = 0.17;

// Minimum credit buffer required before starting a new campaign phase.
export const CAMPAIGN_CREDIT_BUFFER = 100;

// ─── Credit Packs ─────────────────────────────────────────────────────────────
// Sized by launch equivalents so the client understands what they're buying.
// "1 extra launch" ≈ 420 cr. Pack names reflect the use case, not just the volume.
//
// Pricing rationale:
//   500 cr  → 1.2 launches  → R$85  → R$0.170/cr → 80% margin
//   1500 cr → 3.6 launches  → R$239 → R$0.159/cr → 81% margin  ← sweet spot
//   3500 cr → 8.3 launches  → R$529 → R$0.151/cr → 82% margin
//   7000 cr → 16.7 launches → R$979 → R$0.140/cr → 83% margin

export const CREDIT_PACKS = [
  {
    id: "pack_500",
    credits: 500,
    priceBrl: 85,
    label: "Lançamento Extra",
    description: "~1 lançamento completo",
    perCredit: 0.170,
  },
  {
    id: "pack_1500",
    credits: 1500,
    priceBrl: 239,
    label: "Trimestral",
    description: "~3 lançamentos completos",
    perCredit: 0.159,
    highlight: true,
  },
  {
    id: "pack_3500",
    credits: 3500,
    priceBrl: 529,
    label: "Semestral",
    description: "~8 lançamentos completos",
    perCredit: 0.151,
  },
  {
    id: "pack_7000",
    credits: 7000,
    priceBrl: 979,
    label: "Anual",
    description: "~16 lançamentos completos",
    perCredit: 0.140,
  },
] as const;

// Helper: get credit estimate for a campaign type
export function getCampaignCreditEstimate(
  campaignType: string,
): { min: number; typical: number; max: number; label: string } {
  return (
    CAMPAIGN_CREDIT_ESTIMATES[campaignType] ?? CAMPAIGN_CREDIT_ESTIMATES.launch
  );
}
