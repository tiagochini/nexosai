-- Separate renewable monthly credits from purchased/permanent credits.
-- Existing balances are conservatively classified as acquired so no user's
-- current credits can disappear before their provenance is known.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS credits_purchased_balance integer;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS credits_monthly_balance integer;

UPDATE workspaces
   SET credits_purchased_balance = credits_balance,
       credits_monthly_balance = 0
 WHERE credits_purchased_balance IS NULL
    OR credits_monthly_balance IS NULL;

ALTER TABLE workspaces
  ALTER COLUMN credits_purchased_balance SET DEFAULT 0,
  ALTER COLUMN credits_purchased_balance SET NOT NULL,
  ALTER COLUMN credits_monthly_balance SET DEFAULT 0,
  ALTER COLUMN credits_monthly_balance SET NOT NULL;
