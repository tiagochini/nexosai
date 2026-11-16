ALTER TABLE masterplan_versions
  ADD COLUMN module_reviews jsonb NOT NULL DEFAULT '{}'::jsonb;
