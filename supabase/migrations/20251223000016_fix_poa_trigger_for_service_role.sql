-- Fix POA audit trigger to handle service role operations
-- When using service role key, auth.uid() returns NULL which causes the trigger to fail

CREATE OR REPLACE FUNCTION log_poa_activity()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_user_id UUID;
    v_actor_role user_role_type;
    v_actor_org_id UUID;
    v_activity_type activity_type;
BEGIN
    v_actor_user_id := auth.uid();

    -- Skip audit logging if no authenticated user (service role operations)
    -- This allows seeding and system operations
    IF v_actor_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role, organization_id INTO v_actor_role, v_actor_org_id
    FROM user_roles
    WHERE user_id = v_actor_user_id AND is_active = true
    LIMIT 1;

    -- Determine activity type
    IF TG_OP = 'INSERT' THEN
        v_activity_type := 'POA_CREATED';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            IF NEW.status = 'ACTIVE' THEN
                v_activity_type := 'POA_ACTIVATED';
            ELSIF NEW.status = 'REVOKED' THEN
                v_activity_type := 'POA_REVOKED';
            ELSIF NEW.customer_signed_at IS NOT NULL AND OLD.customer_signed_at IS NULL THEN
                v_activity_type := 'POA_SIGNED';
            ELSIF NEW.tax_partner_signed_at IS NOT NULL AND OLD.tax_partner_signed_at IS NULL THEN
                v_activity_type := 'POA_SIGNED';
            ELSE
                v_activity_type := 'POA_CREATED'; -- Default for other updates
            END IF;
        ELSE
            -- Status didn't change, check for signature updates
            IF NEW.customer_signed_at IS NOT NULL AND OLD.customer_signed_at IS NULL THEN
                v_activity_type := 'POA_SIGNED';
            ELSIF NEW.tax_partner_signed_at IS NOT NULL AND OLD.tax_partner_signed_at IS NULL THEN
                v_activity_type := 'POA_SIGNED';
            ELSE
                RETURN NEW; -- No significant change, skip logging
            END IF;
        END IF;
    END IF;

    -- Insert into tax_activity_log
    INSERT INTO tax_activity_log (
        customer_id,
        actor_user_id,
        actor_organization_id,
        actor_role,
        activity_type,
        activity_details
    ) VALUES (
        NEW.customer_id,
        v_actor_user_id,
        COALESCE(v_actor_org_id, NEW.tax_partner_id),
        COALESCE(v_actor_role, 'SYSTEM'),
        v_activity_type,
        jsonb_build_object(
            'operation', TG_OP,
            'poa_id', NEW.id,
            'poa_number', NEW.poa_number,
            'scope', NEW.scope,
            'status', NEW.status,
            'valid_from', NEW.valid_from,
            'valid_to', NEW.valid_to
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
