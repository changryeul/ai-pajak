-- Phase K-1.3: Add TAX_OPERATOR_MASTER role to user_role_type enum.
--
-- The 3-tier operator hierarchy (상담원 / 수퍼바이저 / 마스터) requires
-- a dedicated "MASTER" role at the top. Previously, TAX_OPERATOR_LEAD and
-- TAX_OPERATOR_SUPERVISOR were both added but ended up with overlapping
-- permissions. Going forward:
--
--   TAX_OPERATOR             - 상담원  : per-customer queue work
--   TAX_OPERATOR_SUPERVISOR  - 수퍼바이저: team approvals, queue distribution
--   TAX_OPERATOR_MASTER      - 마스터   : platform-wide stats, custom pricing,
--                                        special-service quotes (tax audit, etc.)
--
-- TAX_OPERATOR_LEAD is retained in the enum for backward compatibility
-- but should not be assigned to new users. Existing LEAD users remain
-- functional (their sidebar still loads supervisorRoles menu).

-- Check current enum values and add new ones if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role_type' AND e.enumlabel = 'TAX_OPERATOR'
  ) THEN
    ALTER TYPE user_role_type ADD VALUE 'TAX_OPERATOR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role_type' AND e.enumlabel = 'TAX_OPERATOR_LEAD'
  ) THEN
    ALTER TYPE user_role_type ADD VALUE 'TAX_OPERATOR_LEAD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role_type' AND e.enumlabel = 'TAX_OPERATOR_SUPERVISOR'
  ) THEN
    ALTER TYPE user_role_type ADD VALUE 'TAX_OPERATOR_SUPERVISOR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role_type' AND e.enumlabel = 'TAX_OPERATOR_MASTER'
  ) THEN
    ALTER TYPE user_role_type ADD VALUE 'TAX_OPERATOR_MASTER';
  END IF;
END
$$;
