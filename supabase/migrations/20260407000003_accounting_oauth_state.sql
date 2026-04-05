-- OAuth State table for CSRF protection during accounting provider OAuth flow
-- Short-lived rows (10 min expiry) that bind a random `state` to:
--   - user who initiated
--   - customer being connected
--   - target provider

CREATE TABLE IF NOT EXISTS accounting_oauth_state (
    state VARCHAR(128) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,   -- ACCURATE | MEKARI
    redirect_after TEXT,              -- optional locale-prefixed UI path
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_user ON accounting_oauth_state(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_state_expires ON accounting_oauth_state(expires_at);

-- RLS: only service role and row owner can read (no browser access needed)
ALTER TABLE accounting_oauth_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all direct access" ON accounting_oauth_state FOR ALL TO authenticated
USING (false) WITH CHECK (false);

COMMENT ON TABLE accounting_oauth_state IS 'Short-lived OAuth state tokens for CSRF protection (10 min expiry)';
