CREATE TABLE IF NOT EXISTS "credit_pack_pricing" (
  "id" text PRIMARY KEY,
  "credits" integer NOT NULL CHECK ("credits" > 0),
  "price_brl" numeric(10, 2) NOT NULL CHECK ("price_brl" >= 0),
  "label" text NOT NULL,
  "description" text NOT NULL,
  "highlight" boolean NOT NULL DEFAULT false,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "credit_pack_pricing" ("id", "credits", "price_brl", "label", "description", "highlight")
VALUES
  ('pack_500', 500, 85.00, 'Lançamento Extra', '~1 lançamento completo', false),
  ('pack_1500', 1500, 239.00, 'Trimestral', '~3 lançamentos completos', true),
  ('pack_3500', 3500, 529.00, 'Semestral', '~8 lançamentos completos', false),
  ('pack_7000', 7000, 979.00, 'Anual', '~16 lançamentos', false)
ON CONFLICT ("id") DO NOTHING;
