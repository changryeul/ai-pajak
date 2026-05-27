-- Generic platform-level kv store. Today's only row: coretax.submit_enabled.
-- Read = all authenticated; Update = TAX_OPERATOR_MASTER. No INSERT/DELETE
-- from app (rows added via migrations only). Track D of PDF p.26 §3 Coretax
-- Status card — moves the toggle out of CORETAX_SUBMIT_ENABLED env var.

CREATE TABLE system_setting (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_setting IS
  'Platform-level config kv. MASTER edits only. Today: coretax.submit_enabled.';

ALTER TABLE system_setting ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_setting_read ON system_setting
  FOR SELECT TO authenticated USING (true);

CREATE POLICY system_setting_master_update ON system_setting
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );

-- No INSERT or DELETE policy → seed-only via migration.

-- Seed (idempotent). Default OFF — master flips via UI after deploy.
INSERT INTO system_setting (key, value) VALUES
  ('coretax.submit_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Track D 의 audit action 을 activity_type ENUM 에 추가 (Track C 의
-- audit_tax_code_rule_enum 패턴과 동일).
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'CORETAX_TOGGLE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
