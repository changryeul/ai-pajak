-- =====================================================
-- Customer-Consultant Assignment Table
-- =====================================================
-- Links customers to their assigned consultants
-- Enables multi-client management for consultants

-- Create customer_consultant table
CREATE TABLE IF NOT EXISTS public.customer_consultant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customer(id) ON DELETE CASCADE,
    consultant_id UUID NOT NULL REFERENCES public.consultant(id) ON DELETE CASCADE,
    assigned_by_user_id UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate active assignments using partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_consultant_unique_active
    ON public.customer_consultant(customer_id, consultant_id)
    WHERE is_active = true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_consultant_customer
    ON public.customer_consultant(customer_id)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_customer_consultant_consultant
    ON public.customer_consultant(consultant_id)
    WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.customer_consultant ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for customer_consultant
-- =====================================================

-- Consultants can view their own assignments
CREATE POLICY "Consultants can view own assignments"
ON public.customer_consultant
FOR SELECT
TO authenticated
USING (
    consultant_id IN (
        SELECT id FROM public.consultant
        WHERE user_id = auth.uid()
    )
);

-- Tax Advisors can view all assignments in their tax partner
CREATE POLICY "Tax advisors can view partner assignments"
ON public.customer_consultant
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.consultant c
        JOIN public.tax_advisor ta ON ta.consultant_id = c.id
        WHERE c.user_id = auth.uid()
        AND c.tax_partner_id = (
            SELECT tax_partner_id FROM public.consultant
            WHERE id = customer_consultant.consultant_id
        )
    )
);

-- Tax Advisors can insert assignments
CREATE POLICY "Tax advisors can assign consultants"
ON public.customer_consultant
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.consultant c
        JOIN public.tax_advisor ta ON ta.consultant_id = c.id
        WHERE c.user_id = auth.uid()
    )
);

-- Tax Advisors can update assignments
CREATE POLICY "Tax advisors can update assignments"
ON public.customer_consultant
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.consultant c
        JOIN public.tax_advisor ta ON ta.consultant_id = c.id
        WHERE c.user_id = auth.uid()
    )
);

-- Platform admins can manage all assignments
CREATE POLICY "Platform admins can manage assignments"
ON public.customer_consultant
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'PLATFORM_ADMIN'
        AND is_active = true
    )
);

-- =====================================================
-- Triggers
-- =====================================================

-- Update updated_at on change
CREATE OR REPLACE FUNCTION update_customer_consultant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_consultant_updated_at
    BEFORE UPDATE ON public.customer_consultant
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_consultant_updated_at();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE public.customer_consultant IS
'Links customers to their assigned consultants. Enables multi-client management.';

COMMENT ON COLUMN public.customer_consultant.is_active IS
'Soft delete flag. Inactive assignments are hidden but preserved for history.';

COMMENT ON COLUMN public.customer_consultant.assigned_by_user_id IS
'User who created this assignment (usually a Tax Advisor).';
