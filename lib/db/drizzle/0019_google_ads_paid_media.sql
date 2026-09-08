-- Google Ads is a paid-media provider.  ALTER TYPE is intentionally
-- idempotent so existing workspaces can be upgraded without destructive enum
-- recreation or credential migration.
ALTER TYPE "paid_media_provider" ADD VALUE IF NOT EXISTS 'google_ads';