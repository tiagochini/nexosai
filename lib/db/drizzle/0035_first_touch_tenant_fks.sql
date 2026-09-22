DO $$ BEGIN
 ALTER TABLE first_touch_attempts ADD CONSTRAINT first_touch_workspace_sequence_fk
   FOREIGN KEY (workspace_id,sequence_id) REFERENCES launch_sequences(workspace_id,id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE first_touch_attempts ADD CONSTRAINT first_touch_workspace_contact_fk
   FOREIGN KEY (workspace_id,contact_id) REFERENCES sequence_contacts(workspace_id,id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
 ALTER TABLE first_touch_attempts ADD CONSTRAINT first_touch_workspace_item_fk
   FOREIGN KEY (workspace_id,item_id) REFERENCES launch_sequence_items(workspace_id,id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;