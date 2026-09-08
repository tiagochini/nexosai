-- Supplier-direct domain billing. Safe on fresh and drifted installations.
DO $$ BEGIN ALTER TYPE "domain_lifecycle_status" ADD VALUE IF NOT EXISTS 'quote_ready'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "domain_lifecycle_status" ADD VALUE IF NOT EXISTS 'awaiting_supplier_payment'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "domain_lifecycle_status" ADD VALUE IF NOT EXISTS 'payment_confirmed'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "domain_lifecycle_status" ADD VALUE IF NOT EXISTS 'provisioning'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "domain_lifecycle_status" ADD VALUE IF NOT EXISTS 'dns_configuring'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "domain_lifecycle_status" ADD VALUE IF NOT EXISTS 'ssl_pending'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "domain_lifecycle_status" ADD VALUE IF NOT EXISTS 'payment_expired'; EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "supplier_payment_reference" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "supplier_payment_url" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "supplier_payment_status" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "supplier_order_id" text;