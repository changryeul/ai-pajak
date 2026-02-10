-- Add general audit_log table for all activity logging
-- This is separate from tax_activity_log to allow more flexible logging

-- Create activity_type enum values if not exists
DO $$ BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'TAX_CALCULATION';
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'BILLING_CREATE';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customer(id),
    tax_filing_id UUID REFERENCES tax_filing(id),
    actor_user_id UUID NOT NULL REFERENCES auth.users(id),
    actor_organization_id UUID,
    actor_role user_role_type,
    activity_type activity_type NOT NULL,
    tax_type tax_type,
    tax_period VARCHAR(7),
    activity_details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_customer ON audit_log(customer_id);
CREATE INDEX idx_audit_log_filing ON audit_log(tax_filing_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_type ON audit_log(activity_type);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Platform admins can view all audit logs (for monitoring)
CREATE POLICY "Platform admins can view audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (is_platform_admin());

-- JTC consultants can view audit logs for their customers
CREATE POLICY "JTC consultants can view assigned audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    (
        customer_id IN (
            SELECT customer_id
            FROM customer_consultant
            WHERE consultant_id = get_consultant_id()
            AND is_active = true
        )
        OR customer_id IS NULL
    )
);

-- Customers can view their own audit logs
CREATE POLICY "Customers can view own audit logs"
ON audit_log FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Anyone authenticated can insert audit logs (for logging their own actions)
CREATE POLICY "Authenticated users can create audit logs"
ON audit_log FOR INSERT
TO authenticated
WITH CHECK (actor_user_id = auth.uid());

-- Allow service role to insert (for system operations)
-- This is handled by Supabase's service role bypassing RLS

COMMENT ON TABLE audit_log IS 'General audit log for all platform activities';
