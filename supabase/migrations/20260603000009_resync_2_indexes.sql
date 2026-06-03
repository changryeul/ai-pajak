-- Resync 2 indexes lost in the 2026-04-10 broken push (discovered 2026-06-03
-- via expanded drift CI guard — RLS/index/CHECK probe RPC schema_audit()).
--
-- Both origins are idempotent (CREATE INDEX IF NOT EXISTS), so safe to
-- re-apply on any environment. Index definitions copied verbatim from the
-- original migrations.

-- From 20260408000005_document_request.sql
CREATE INDEX IF NOT EXISTS idx_doc_request_submission
  ON document_request(submission_id);

-- From 20260409000002_coa_mapping_memory.sql
CREATE INDEX IF NOT EXISTS idx_coa_memory_pattern
  ON coa_mapping_memory(description_pattern);
