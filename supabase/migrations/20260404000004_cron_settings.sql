-- Cron job settings (enable/disable from admin UI)
CREATE TABLE IF NOT EXISTS cron_settings (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'deadline-reminders'
    is_enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_status VARCHAR(20), -- 'success', 'error', 'skipped'
    last_duration_ms INTEGER,
    last_result JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default cron jobs
INSERT INTO cron_settings (id, is_enabled) VALUES
  ('deadline-reminders', true),
  ('payment-reminders', true),
  ('monthly-report', true),
  ('news-fetch', true),
  ('cleanup-expired-tokens', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: only admin can manage
ALTER TABLE cron_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage cron settings"
ON cron_settings FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

-- Service role can update (for cron jobs themselves)
CREATE POLICY "Service can update cron settings"
ON cron_settings FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can read cron settings"
ON cron_settings FOR SELECT
TO authenticated
USING (true);
