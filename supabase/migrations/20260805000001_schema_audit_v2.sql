-- schema_audit() v2 — add two fields for the drift CI guard:
--   tables       : every public table name (feeds types/database.ts subset check)
--   rls_disabled : public tables with ROW LEVEL SECURITY off
--
-- Motivation (2026-08-04 table audit): operator_assignment_log and
-- operator_affiliation_transfer shipped without ENABLE ROW LEVEL SECURITY and
-- sat readable/writable via the anon key until a manual audit caught them.
-- verify-prod-schema-drift.ts now fails when a non-whitelisted table has RLS
-- off, so the next forgotten ENABLE ROW LEVEL SECURITY breaks CI instead.

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
      ),
    'tables',
      COALESCE(
        (SELECT jsonb_agg(c.relname ORDER BY c.relname)
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'),
        '[]'::jsonb
      ),
    'rls_disabled',
      COALESCE(
        (SELECT jsonb_agg(c.relname ORDER BY c.relname)
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
           AND c.relrowsecurity = false),
        '[]'::jsonb
      )
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION schema_audit() FROM PUBLIC;
