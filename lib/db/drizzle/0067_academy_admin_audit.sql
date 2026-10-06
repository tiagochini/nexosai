CREATE TABLE academy_admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 action text NOT NULL,
 method varchar(10) NOT NULL,
 status integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE academy_delivery_reconciliations (
 request_key text PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES users(id),
 job_id uuid NOT NULL REFERENCES academy_access_email_outbox(id) ON DELETE CASCADE,
 decision varchar(20) NOT NULL CHECK (decision IN ('accepted', 'not_accepted')),
 evidence_hash text NOT NULL,
 request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
