-- Schema audit RPC for drift CI guard.
-- Returns lists of (table, name) tuples for: RLS policies, indexes,
-- CHECK constraints. Used by scripts/verify-prod-schema-drift.ts to expand
-- coverage beyond ADD/DROP COLUMN (which PostgREST exposes natively).
--
-- v1 verifies NAME existence only — does NOT compare USING expressions or
-- index column lists. False negatives possible (policy with same name but
-- different definition); false positives unlikely.

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
           -- exclude indexes that BACK a constraint (PK / UNIQUE / EXCLUDE).
           -- These are auto-created by Postgres and named after the constraint;
           -- they aren't declared as standalone CREATE INDEX in our migrations,
           -- so they should not appear in expected-set comparisons.
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
