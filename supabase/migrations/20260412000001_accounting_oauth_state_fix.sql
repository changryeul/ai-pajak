-- Fix: accounting_oauth_state was marked as "applied" via migration repair
-- but the actual table was never created because the SQL was never executed.
-- This migration re-applies the same DDL with IF NOT EXISTS so it's safe
-- even if the table somehow exists.

CREATE TABLE IF NOT EXISTS accounting_oauth_state (
    state VARCHAR(128) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    redirect_after TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_user ON accounting_oauth_state(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_state_expires ON accounting_oauth_state(expires_at);

ALTER TABLE accounting_oauth_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block all direct access" ON accounting_oauth_state;
CREATE POLICY "Block all direct access" ON accounting_oauth_state FOR ALL TO authenticated
USING (false) WITH CHECK (false);

COMMENT ON TABLE accounting_oauth_state IS 'Short-lived OAuth state tokens for CSRF protection (10 min expiry)';
