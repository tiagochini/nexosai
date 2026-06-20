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

export const aiProviderEnum = pgEnum("ai_provider", [
  "anthropic",
  "openai",
  "gemini",
]);

export const aiProviderLogsTable = pgTable("ai_provider_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id"),
  agentType: text("agent_type"),
  provider: aiProviderEnum("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
  creditsCharged: integer("credits_charged").notNull().default(0),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAiProviderLogSchema = createInsertSchema(
  aiProviderLogsTable,
).omit({ id: true, createdAt: true });

export type InsertAiProviderLog = z.infer<typeof insertAiProviderLogSchema>;
export type AiProviderLog = typeof aiProviderLogsTable.$inferSelect;

export const AI_PROVIDER_COSTS: Record<
  string,
  Record<string, { inputPerMillion: number; outputPerMillion: number }>
> = {
  anthropic: {
    // Legacy models
    "claude-3-5-sonnet-20241022": { inputPerMillion: 3.0,   outputPerMillion: 15.0  },
    "claude-3-haiku-20240307":    { inputPerMillion: 0.25,  outputPerMillion: 1.25  },
    // Claude 4 — integration proxy model (Replit AI proxy)
    "claude-sonnet-4-6":          { inputPerMillion: 3.0,   outputPerMillion: 15.0  },
    // Claude 4 Opus — native key (highest reasoning)
    "claude-opus-4-5":            { inputPerMillion: 15.0,  outputPerMillion: 75.0  },
    // Catch-all for any future claude-* models not yet listed
    "claude-3-5-haiku-20241022":  { inputPerMillion: 0.8,   outputPerMillion: 4.0   },
  },
  openai: {
    "gpt-4o":       { inputPerMillion: 2.5,   outputPerMillion: 10.0 },
    "gpt-4o-mini":  { inputPerMillion: 0.15,  outputPerMillion: 0.6  },
    // GPT-5 family
    "gpt-5.4":      { inputPerMillion: 10.0,  outputPerMillion: 40.0 },
    "gpt-5":        { inputPerMillion: 10.0,  outputPerMillion: 40.0 },
    "gpt-5.5":      { inputPerMillion: 10.0,  outputPerMillion: 40.0 },
    "gpt-5.5-mini": { inputPerMillion: 1.5,   outputPerMillion: 6.0  },
    // Integration proxy model
    "gpt-5.4-mini": { inputPerMillion: 1.5,   outputPerMillion: 6.0  },
  },
  gemini: {
    "gemini-1.5-pro":          { inputPerMillion: 1.25,  outputPerMillion: 5.0  },
    "gemini-1.5-flash":        { inputPerMillion: 0.075, outputPerMillion: 0.3  },
    "gemini-2.5-flash":        { inputPerMillion: 0.15,  outputPerMillion: 0.6  },
    "gemini-2.5-flash-preview":{ inputPerMillion: 0.15,  outputPerMillion: 0.6  },
    "gemini-2.5-pro":          { inputPerMillion: 1.25,  outputPerMillion: 10.0 },
    "gemini-3-flash-preview":  { inputPerMillion: 0.15,  outputPerMillion: 0.6  },
  },
};

export const CREDITS_PER_USD = 100;

export function calculateCostUsd(
  provider: keyof typeof AI_PROVIDER_COSTS,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const providerCosts = AI_PROVIDER_COSTS[provider] as Record<
    string,
    { inputPerMillion: number; outputPerMillion: number }
  >;
  let costs = providerCosts?.[model];

  // Cross-provider fallback: Replit AI integrations may return a model name
  // that belongs to a different provider (e.g. Anthropic integration returning
  // "gpt-5.5" via its OpenAI-compatible proxy endpoint). Search all providers
  // so we never silently return 0 on a valid completion.
  if (!costs) {
    for (const p of Object.values(AI_PROVIDER_COSTS)) {
      const found = p[model];
      if (found) { costs = found; break; }
    }
  }

  // Last-resort: if model is unknown but we know the provider, use a safe
  // conservative estimate rather than 0 (prevents silent zero-cost records).
  if (!costs) {
    const fallbackCosts: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
      anthropic: { inputPerMillion: 3.0,  outputPerMillion: 15.0 },
      openai:    { inputPerMillion: 2.5,  outputPerMillion: 10.0 },
      gemini:    { inputPerMillion: 0.15, outputPerMillion: 0.6  },
    };
    costs = fallbackCosts[provider as string];
  }

  if (!costs) return 0;
  return (
    (inputTokens / 1_000_000) * costs.inputPerMillion +
    (outputTokens / 1_000_000) * costs.outputPerMillion
  );
}

export function calculateCreditsFromCost(
  costUsd: number,
  marginMultiplier = 1.5,
): number {
  return Math.ceil(costUsd * CREDITS_PER_USD * marginMultiplier);
}
