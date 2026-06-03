-- Fix schema_audit() index filter false-positive.
-- Original (20260603000007) used `indexname NOT LIKE '%_key'` to skip
-- auto-created UNIQUE-constraint indexes, but that pattern also
-- excludes legitimate user indexes whose name happens to end in `_key`
-- (e.g. `idx_billing_idempotency_key`). Replace the LIKE pattern with
-- a precise join on pg_constraint.conindid so only constraint-backed
-- indexes are excluded.

CREATE OR REPLACE FUNCTION schema_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'policies',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('table', tablename, 'name', policyname))
         FROM pg_policies
         WHERE schemaname = 'public'),
        '[]'::jsonb
      ),
    'indexes',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('table', i.tablename, 'name', i.indexname))
         FROM pg_indexes i
         WHERE i.schemaname = 'public'
           AND NOT EXISTS (
             SELECT 1 FROM pg_constraint c
             JOIN pg_class cl ON cl.oid = c.conindid
             JOIN pg_namespace n ON n.oid = cl.relnamespace
             WHERE n.nspname = 'public'
               AND cl.relname = i.indexname
           )),
        '[]'::jsonb
      ),
    'check_constraints',
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
           'table', c.conrelid::regclass::text,
           'name', c.conname
         ))
         FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
         WHERE n.nspname = 'public'
           AND c.contype = 'c'),
        '[]'::jsonb
      )
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION schema_audit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION schema_audit() TO service_role;
