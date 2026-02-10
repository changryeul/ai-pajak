-- Fix tax filing audit trigger to handle service role operations
-- When using service role key, auth.uid() returns NULL which causes the trigger to fail

CREATE OR REPLACE FUNCTION log_tax_filing_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_user_id UUID;
    v_actor_role user_role_type;
    v_actor_org_id UUID;
    v_activity_type activity_type;
BEGIN
    -- Get current user from Supabase auth context
    v_actor_user_id := auth.uid();

    -- Skip audit logging if no authenticated user (service role operations)
    -- This allows seeding and system operations
    IF v_actor_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Get user role
    SELECT role, organization_id INTO v_actor_role, v_actor_org_id
    FROM user_roles
    WHERE user_id = v_actor_user_id AND is_active = true
    LIMIT 1;

    -- Determine activity type
    IF TG_OP = 'INSERT' THEN
        v_activity_type := 'CREATE';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'FILED' AND OLD.status != 'FILED' THEN
            v_activity_type := 'FILE';
        ELSE
            v_activity_type := 'UPDATE';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_activity_type := 'DELETE';
    END IF;

    -- Insert audit log
    INSERT INTO tax_activity_log (
        customer_id,
        tax_filing_id,
        actor_user_id,
        actor_organization_id,
        actor_role,
        activity_type,
        tax_type,
        tax_period,
        activity_details
    ) VALUES (
        COALESCE(NEW.customer_id, OLD.customer_id),
        COALESCE(NEW.id, OLD.id),
        v_actor_user_id,
        v_actor_org_id,
        COALESCE(v_actor_role, 'SYSTEM'),
        v_activity_type,
        COALESCE(NEW.tax_type, OLD.tax_type),
        COALESCE(NEW.tax_period, OLD.tax_period),
        jsonb_build_object(
            'operation', TG_OP,
            'status', COALESCE(NEW.status, OLD.status),
            'consultant_id', COALESCE(NEW.consultant_id, OLD.consultant_id)
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
