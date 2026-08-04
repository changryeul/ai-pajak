-- Security fix: operator_assignment_log (20260724000001) and
-- operator_affiliation_transfer (20260724000002) were created without
-- ENABLE ROW LEVEL SECURITY. Supabase grants anon/authenticated full table
-- access by default, so both tables were readable/writable with just the
-- anon key via PostgREST (verified 2026-08-04).
--
-- All application access goes through service-role clients (getSupabaseAdmin
-- in the affiliation routes and assign-customer helper), which bypasses RLS.
-- Enabling RLS with zero policies therefore blocks direct client access
-- without changing app behavior.

ALTER TABLE operator_assignment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_affiliation_transfer ENABLE ROW LEVEL SECURITY;
