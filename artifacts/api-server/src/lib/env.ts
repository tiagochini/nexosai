export const env = {
  PORT: process.env["PORT"] ?? "5000",
  NODE_ENV: process.env["NODE_ENV"] ?? "development",
  DATABASE_URL: process.env["DATABASE_URL"] ?? "",
  SESSION_SECRET: process.env["SESSION_SECRET"] ?? "nexos-dev-secret",
  JWT_SECRET: process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"] ?? "nexos-dev-secret",
  JWT_REFRESH_SECRET: process.env["JWT_REFRESH_SECRET"] ?? (process.env["SESSION_SECRET"] ?? "nexos-refresh-secret") + "-refresh",
  JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] ?? "15m",
  JWT_REFRESH_EXPIRES_IN: process.env["JWT_REFRESH_EXPIRES_IN"] ?? "30d",
  REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:6379",
  ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"] ?? "",
  OPENAI_API_KEY: process.env["OPENAI_API_KEY"] ?? "",
  GEMINI_API_KEY: process.env["GEMINI_API_KEY"] ?? "",
  AI_INTEGRATIONS_ANTHROPIC_BASE_URL: process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] ?? "",
  AI_INTEGRATIONS_ANTHROPIC_API_KEY: process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "",
  AI_INTEGRATIONS_OPENAI_BASE_URL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ?? "",
  AI_INTEGRATIONS_OPENAI_API_KEY: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "",
  AI_INTEGRATIONS_GEMINI_BASE_URL: process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] ?? "",
  AI_INTEGRATIONS_GEMINI_API_KEY: process.env["AI_INTEGRATIONS_GEMINI_API_KEY"] ?? "",
  RESEND_API_KEY: process.env["RESEND_API_KEY"] ?? "",
  RESEND_FROM_EMAIL: process.env["RESEND_FROM_EMAIL"] ?? "lancamento@agencianexos.vip",
  NEXOS_BASE_DOMAIN: process.env["NEXOS_BASE_DOMAIN"] ?? "agencianexos.vip",
  CREDIT_MARGIN_MULTIPLIER: parseFloat(process.env["CREDIT_MARGIN_MULTIPLIER"] ?? "1.5"),
  APP_URL: process.env["APP_URL"] ?? `https://${process.env["REPLIT_DEV_DOMAIN"] ?? "localhost"}`,
  META_APP_ID: process.env["META_APP_ID"] ?? "",
  META_APP_SECRET: process.env["META_APP_SECRET"] ?? "",
  TIKTOK_CLIENT_KEY: process.env["TIKTOK_CLIENT_KEY"] ?? "",
  TIKTOK_CLIENT_SECRET: process.env["TIKTOK_CLIENT_SECRET"] ?? "",
  GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"] ?? "",
  GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
  HUBSPOT_CLIENT_ID: process.env["HUBSPOT_CLIENT_ID"] ?? "",
  HUBSPOT_CLIENT_SECRET: process.env["HUBSPOT_CLIENT_SECRET"] ?? "",
  RD_STATION_CLIENT_ID: process.env["RD_STATION_CLIENT_ID"] ?? "",
  RD_STATION_CLIENT_SECRET: process.env["RD_STATION_CLIENT_SECRET"] ?? "",
  LINKEDIN_CLIENT_ID: process.env["LINKEDIN_CLIENT_ID"] ?? "",
  LINKEDIN_CLIENT_SECRET: process.env["LINKEDIN_CLIENT_SECRET"] ?? "",
  ALLOWED_ORIGINS: process.env["ALLOWED_ORIGINS"] ?? "",
  // ISO date string (e.g. "2025-06-01T20:00:00-03:00") — set to start the launch countdown
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] ?? "nexos-whatsapp-2026",
  ASAAS_API_KEY: process.env["ASAAS_API_KEY"] ?? "",
  ASAAS_SANDBOX: process.env["ASAAS_SANDBOX"] ?? "true",
  // Gmail SMTP (alternative to Resend — set both GMAIL_USER and GMAIL_APP_PASSWORD to enable)
  GMAIL_USER: process.env["GMAIL_USER"] ?? "",
  GMAIL_APP_PASSWORD: process.env["GMAIL_APP_PASSWORD"] ?? "",
  LAUNCH_CAMPAIGN_DATE: process.env["LAUNCH_CAMPAIGN_DATE"] ?? "",
  // Simulator / lead funnel config
  SIMULATOR_CART_OPEN: process.env["SIMULATOR_CART_OPEN"] === "true",
  SIMULATOR_CHECKOUT_URL: process.env["SIMULATOR_CHECKOUT_URL"] ?? "",
  SIMULATOR_WHATSAPP_URL: process.env["SIMULATOR_WHATSAPP_URL"] ?? "",
  SIMULATOR_TELEGRAM_URL: process.env["SIMULATOR_TELEGRAM_URL"] ?? "",
  // DRY_RUN_MODE: skips real AI calls, real payments, real ad publishing.
  // All agent executions are simulated and logged with is_dry_run=true.
  DRY_RUN_MODE: process.env["DRY_RUN_MODE"] === "true",
  // ── Video generation providers ─────────────────────────────────────────────
  // Runway ML — text/image → video (Gen-3 Alpha). https://dev.runwayml.com
  RUNWAY_API_KEY: process.env["RUNWAY_API_KEY"] ?? "",
  RUNWAY_API_VERSION: process.env["RUNWAY_API_VERSION"] ?? "2024-11-06",
  // Kling AI via fal.ai — text → video. https://fal.ai/models/fal-ai/kling-video
  FAL_API_KEY: process.env["FAL_API_KEY"] ?? "",
  // HeyGen — avatar talking-head videos. https://www.heygen.com/api
  HEYGEN_API_KEY: process.env["HEYGEN_API_KEY"] ?? "",
  // ElevenLabs — voice cloning. https://elevenlabs.io/docs/api
  ELEVENLABS_API_KEY: process.env["ELEVENLABS_API_KEY"] ?? "",
} as const;

// ─── Production guard ──────────────────────────────────────────────────────────

if (env.NODE_ENV === "production") {
  const required: Array<keyof typeof env> = ["DATABASE_URL", "SESSION_SECRET"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for production: ${missing.join(", ")}`);
  }

  if (env.JWT_SECRET === "nexos-dev-secret") {
    throw new Error("JWT_SECRET must be set to a secure value in production (SESSION_SECRET will be used as fallback)");
  }
}
