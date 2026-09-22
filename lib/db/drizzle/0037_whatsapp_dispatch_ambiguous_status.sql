DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_dispatch_status') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'whatsapp_dispatch_status' AND e.enumlabel = 'ambiguous'
    ) THEN
      ALTER TYPE whatsapp_dispatch_status ADD VALUE 'ambiguous';
    END IF;
  END IF;
END $$;