-- Schema cleanup (2026-08-04 table audit): drop tables with zero application
-- references. Audit method: prod pg_class inventory (115 tables) cross-checked
-- against src/ + scripts/ .from() references and broad string search.
--
-- accurate_connection / accurate_invoice — renamed to accounting_* by
--   20260407000002; the empty originals were later recreated on prod by a
--   broken push (both 0 rows; app reads accounting_* only).
-- column_mapping_memory — bulk-import column-mapping cache v1; column-mapper.ts
--   no longer persists (2 stale rows backed up in commit context).
-- dynamic_tax_rates — 2025-12 tax_law_ai_system leftover; superseded by
--   tax_rate_config (rate-provider.ts). 0 rows.
-- inventory_record / koreksi_fiskal — 20260408000010 plan leftovers; koreksi
--   is implemented as a pure TS engine (koreksi-fiskal-engine.ts). 0 rows.
-- operator_performance_logs — 20260331000001 leftover; evaluation now measures
--   from rejected_reason history (/api/operator/evaluation). 0 rows.
-- revenue_split — initial_schema leftover, never wired to billing. 0 rows.
--
-- chart_of_accounts is intentionally KEPT: journal_entry_line.account_code and
-- coa_mapping_memory.account_code hold FKs to it (live bank-to-journal data).

DROP TABLE IF EXISTS accurate_connection;
DROP TABLE IF EXISTS accurate_invoice;
DROP TABLE IF EXISTS column_mapping_memory;
DROP TABLE IF EXISTS dynamic_tax_rates;
DROP TABLE IF EXISTS inventory_record;
DROP TABLE IF EXISTS koreksi_fiskal;
DROP TABLE IF EXISTS operator_performance_logs;
DROP TABLE IF EXISTS revenue_split;
