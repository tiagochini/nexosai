import { validateIntegrationEncryptionConfig } from "@workspace/db/token-crypto";

export const env = {
  PORT: process.env["PORT"] ?? "5000",
  NODE_ENV: process.env["NODE_ENV"] ?? "development",
  DATABASE_URL: process.env["DATABASE_URL"] ?? "",
  SESSION_SECRET: process.env["SESSION_SECRET"] ?? "nexos-dev-secret",
  JWT_SECRET:
    process.env["JWT_SECRET"] ??
    process.env["SESSION_SECRET"] ??
    "nexos-dev-secret",
  JWT_REFRESH_SECRET:
    process.env["JWT_REFRESH_SECRET"] ??
    (process.env["SESSION_SECRET"] ?? "nexos-refresh-secret") + "-refresh",
  JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] ?? "8h",
  JWT_REFRESH_EXPIRES_IN: process.env["JWT_REFRESH_EXPIRES_IN"] ?? "90d",
  REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:6379",
  ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"] ?? "",
  OPENAI_API_KEY: process.env["OPENAI_API_KEY"] ?? "",
  NEXOS_OPENAI: process.env["NEXOS_OPENAI"] ?? "",
  GEMINI_API_KEY: process.env["GEMINI_API_KEY"] ?? "",
  AI_INTEGRATIONS_ANTHROPIC_BASE_URL:
    process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] ?? "",
  AI_INTEGRATIONS_ANTHROPIC_API_KEY:
    process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ?? "",
  AI_INTEGRATIONS_OPENAI_BASE_URL:
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ?? "",
  AI_INTEGRATIONS_OPENAI_API_KEY:
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "",
  AI_INTEGRATIONS_GEMINI_BASE_URL:
    process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] ?? "",
  AI_INTEGRATIONS_GEMINI_API_KEY:
    process.env["AI_INTEGRATIONS_GEMINI_API_KEY"] ?? "",
  RESEND_API_KEY: process.env["RESEND_API_KEY"] ?? "",
  RESEND_FROM_EMAIL:
    process.env["RESEND_FROM_EMAIL"] ?? "lancamento@agencianexos.vip",
  NEXOS_BASE_DOMAIN: process.env["NEXOS_BASE_DOMAIN"] ?? "agencianexos.vip",
  CREDIT_MARGIN_MULTIPLIER: parseFloat(
    process.env["CREDIT_MARGIN_MULTIPLIER"] ?? "1.5",
  ),
  APP_URL:
    process.env["APP_URL"] ??
    `https://${process.env["REPLIT_DEV_DOMAIN"] ?? "localhost"}`,
  META_APP_ID: process.env["META_APP_ID"] ?? "",
  META_APP_SECRET: process.env["META_APP_SECRET"] ?? "",
  // Provider-state mutations are opt-in. This prevents a restored production
  // database from subscribing every real account when a developer boots it.
  META_WEBHOOK_AUTO_SUBSCRIBE:
    process.env["META_WEBHOOK_AUTO_SUBSCRIBE"] === "true",
  // Public HTTPS tunnel/domain used only when displaying the callback URL.
  META_WEBHOOK_PUBLIC_BASE_URL:
    process.env["META_WEBHOOK_PUBLIC_BASE_URL"] ?? "",
  TIKTOK_CLIENT_KEY: process.env["TIKTOK_CLIENT_KEY"] ?? "",
  TIKTOK_CLIENT_SECRET: process.env["TIKTOK_CLIENT_SECRET"] ?? "",
  GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"] ?? "",
  GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
  GOOGLE_ADS_DEVELOPER_TOKEN: process.env["GOOGLE_ADS_DEVELOPER_TOKEN"] ?? "",
  HUBSPOT_CLIENT_ID: process.env["HUBSPOT_CLIENT_ID"] ?? "",
  HUBSPOT_CLIENT_SECRET: process.env["HUBSPOT_CLIENT_SECRET"] ?? "",
  RD_STATION_CLIENT_ID: process.env["RD_STATION_CLIENT_ID"] ?? "",
  RD_STATION_CLIENT_SECRET: process.env["RD_STATION_CLIENT_SECRET"] ?? "",
  LINKEDIN_CLIENT_ID: process.env["LINKEDIN_CLIENT_ID"] ?? "",
  LINKEDIN_CLIENT_SECRET: process.env["LINKEDIN_CLIENT_SECRET"] ?? "",
  ALLOWED_ORIGINS: process.env["ALLOWED_ORIGINS"] ?? "",
  // ISO date string (e.g. "2025-06-01T20:00:00-03:00") — set to start the launch countdown
  WHATSAPP_WEBHOOK_VERIFY_TOKEN:
    process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] ?? "",
  ASAAS_API_KEY: process.env["ASAAS_API_KEY"] ?? "",
  // Sandbox credentials are deliberately separate from live credentials.
  ASAAS_SANDBOX: process.env["ASAAS_SANDBOX"] ?? "false",
  ASAAS_SANDBOX_API_KEY: process.env["ASAAS_SANDBOX_API_KEY"] ?? "",
  // Value configured in Asaas's webhook configuration (not the API key).
  ASAAS_WEBHOOK_TOKEN: process.env["ASAAS_WEBHOOK_TOKEN"] ?? "",
  // Gmail SMTP (alternative to Resend — set both GMAIL_USER and GMAIL_APP_PASSWORD to enable)
  GMAIL_USER: process.env["GMAIL_USER"] ?? "",
  GMAIL_APP_PASSWORD: process.env["GMAIL_APP_PASSWORD"] ?? "",
  LAUNCH_CAMPAIGN_DATE: process.env["LAUNCH_CAMPAIGN_DATE"] ?? "",
  // Admin alert destination — receives email + WhatsApp when a new lead joins the waitlist
  ADMIN_NOTIFY_EMAIL:
    process.env["ADMIN_NOTIFY_EMAIL"] ?? "bruceallan04@gmail.com",
  ADMIN_NOTIFY_PHONE: process.env["ADMIN_NOTIFY_PHONE"] ?? "", // E.164 format, e.g. 5511999999999
  // Simulator / lead funnel config
  SIMULATOR_CART_OPEN: process.env["SIMULATOR_CART_OPEN"] === "true",
  SIMULATOR_CHECKOUT_URL: process.env["SIMULATOR_CHECKOUT_URL"] ?? "",
  SIMULATOR_WHATSAPP_URL: process.env["SIMULATOR_WHATSAPP_URL"] ?? "",
  SIMULATOR_TELEGRAM_URL: process.env["SIMULATOR_TELEGRAM_URL"] ?? "",
  // DRY_RUN_MODE: skips real AI calls, real payments, real ad publishing.
  // All agent executions are simulated and logged with is_dry_run=true.
  DRY_RUN_MODE: process.env["DRY_RUN_MODE"] === "true",
  // Explicitly guarded below. This is only for running-server E2E harnesses.
  META_E2E_TEST_MODE:
    process.env["NODE_ENV"] !== "production" &&
    process.env["META_E2E_TEST_MODE"] === "true",
  // CART_OPEN: when "true", the register gate shows purchase options for public products.
  // Set to "false" during pre-launch (carrinho fechado) — only invite codes / waitlist work.
  CART_OPEN: process.env["CART_OPEN"] === "true",
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
  // Real provider endpoints. Empty values deliberately block mutations.
  REGISTRAR_API_URL: process.env["REGISTRAR_API_URL"] ?? "",
  REGISTRAR_API_KEY: process.env["REGISTRAR_API_KEY"] ?? "",
  REGISTRAR_PROVIDER: process.env["REGISTRAR_PROVIDER"] ?? "",
  CLOUDFLARE_API_URL:
    process.env["CLOUDFLARE_API_URL"] ?? "https://api.cloudflare.com/client/v4",
  CLOUDFLARE_API_TOKEN: process.env["CLOUDFLARE_API_TOKEN"] ?? "",
  CLOUDFLARE_ACCOUNT_ID: process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "",
  HOSTINGER_API_URL: process.env["HOSTINGER_API_URL"] ?? "",
  HOSTINGER_API_KEY: process.env["HOSTINGER_API_KEY"] ?? "",
  // Shared verification secret for supplier webhook delivery. Empty disables webhook ingestion.
  SUPPLIER_WEBHOOK_SECRET: process.env["SUPPLIER_WEBHOOK_SECRET"] ?? "",
  LANDING_DEPLOYMENT_URL: process.env["LANDING_DEPLOYMENT_URL"] ?? "",
  LANDING_DEPLOYMENT_TOKEN: process.env["LANDING_DEPLOYMENT_TOKEN"] ?? "",
  // DISABLE_SCHEDULED_VIDEO_GENERATION — when "true", the social-presence scheduler
  // suppresses automatic HeyGen video generation (leaves posts in current state,
  // does NOT publish without video). The manual "Gerar vídeo" button is unaffected.
  // Set to "true" before deploying C1 to avoid burning HeyGen credits on 28+ posts.
  // Remove (or set to "false") after validating one post manually. [C0.9 TEMP]
  DISABLE_SCHEDULED_VIDEO_GENERATION:
    process.env["DISABLE_SCHEDULED_VIDEO_GENERATION"] === "true",
} as const;

// ─── Production guard ──────────────────────────────────────────────────────────

if (env.NODE_ENV === "production") {
  validateIntegrationEncryptionConfig();
  if (process.env["META_E2E_TEST_MODE"] === "true") {
    throw new Error("META_E2E_TEST_MODE must never be enabled in production");
  }
  const required: Array<keyof typeof env> = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "META_APP_SECRET",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  ];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missing.join(", ")}`,
    );
  }

  if (env.JWT_SECRET === "nexos-dev-secret") {
    throw new Error(
      "JWT_SECRET must be set to a secure value in production (SESSION_SECRET will be used as fallback)",
    );
  }
  if (!env.ALLOWED_ORIGINS.trim()) {
    throw new Error(
      "ALLOWED_ORIGINS must contain an explicit origin allowlist in production",
    );
  }
}
