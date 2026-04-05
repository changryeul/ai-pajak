-- Staff invitation system
-- Master/Supervisor invites operators via email → token-based signup completion

CREATE TABLE IF NOT EXISTS staff_invitation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL, -- TAX_OPERATOR | TAX_OPERATOR_SUPERVISOR | TAX_ADVISOR_JTC
    team VARCHAR(30),           -- CORPORATE | INDIVIDUAL | PAYROLL | ADMIN
    full_name VARCHAR(255),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    inviter_role VARCHAR(30),   -- snapshot of inviter's role at invitation time

    token VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_user_id UUID REFERENCES auth.users(id),
    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invitation_email ON staff_invitation(email);
CREATE INDEX IF NOT EXISTS idx_staff_invitation_token ON staff_invitation(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitation_inviter ON staff_invitation(invited_by);
CREATE INDEX IF NOT EXISTS idx_staff_invitation_pending
  ON staff_invitation(email) WHERE accepted_at IS NULL AND cancelled_at IS NULL;

-- RLS: only master/supervisor can read their own invitations
ALTER TABLE staff_invitation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block customers and admins" ON staff_invitation FOR ALL TO authenticated
USING (false) WITH CHECK (false);

-- All invitation management goes through admin API (service role only)
-- No direct client access

CREATE OR REPLACE FUNCTION update_staff_invitation_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_staff_invitation_updated_at
BEFORE UPDATE ON staff_invitation
FOR EACH ROW EXECUTE FUNCTION update_staff_invitation_updated_at();

COMMENT ON TABLE staff_invitation IS 'Staff invitations (master/supervisor invites operators)';
