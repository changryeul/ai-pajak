-- Individual taxpayer onboarding + spouse model + signature audit
-- Phase: PR1 of personal-filing prototype port (2026-04-18 /plan-eng-review scope A)
--
-- Adds:
--   * customer.onboarding_step            — 1~3 for INDIVIDUAL onboarding flow
--   * customer.spouse_{name,npwp,...}     — flat columns for MT/PH/K-I regime inputs
--   * customer.spouse_customer_id FK      — self-ref, populated by trigger when
--                                           the spouse signs up as their own customer
--   * signature_audit table               — immutable record of electronic signatures
--                                           (UU ITE 11/2008 / PP 71/2019 minimum viable
--                                           evidence: hash + timestamp + IP + UA)
--
-- Not introduced here (deferred to T-009 in TODOS.md):
--   * Kominfo-certified PSrE integration (Privy/VIDA). signature_audit is designed so
--     a future PSrE transaction_id can be stored in signature_url / external_ref without
--     schema changes.

-- ============================================================================
-- ENUM: signature_purpose
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE signature_purpose AS ENUM (
    'POA_MANDATE',         -- Power of attorney mandate (onboarding step 3)
    'SPT_SUBMISSION',      -- Per-filing signature (future)
    'PROFILE_CHANGE',      -- Reserved for sensitive profile updates
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- CUSTOMER COLUMN EXTENSIONS
-- ============================================================================

ALTER TABLE customer
  -- Onboarding progress (INDIVIDUAL only; NULL for pre-existing + COMPANY customers)
  ADD COLUMN IF NOT EXISTS onboarding_step SMALLINT,

  -- Spouse flat fields (per /plan-eng-review 1-3 decision: flat + sync trigger)
  -- Populated when the customer registers; most spouses are not platform users
  ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS spouse_npwp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS spouse_annual_income NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS spouse_withheld_tax NUMERIC(18, 2),

  -- Optional self-reference if the spouse also registers. Filled by trigger below.
  ADD COLUMN IF NOT EXISTS spouse_customer_id UUID REFERENCES customer(id);

-- Enforce onboarding_step range (1..3) — NULL allowed for COMPANY
ALTER TABLE customer
  DROP CONSTRAINT IF EXISTS customer_onboarding_step_range;
ALTER TABLE customer
  ADD CONSTRAINT customer_onboarding_step_range
    CHECK (onboarding_step IS NULL OR onboarding_step BETWEEN 1 AND 3);

COMMENT ON COLUMN customer.onboarding_step IS
  'INDIVIDUAL onboarding step: 1=register, 2=terms, 3=mandate (done when NULL after step 3 or >=3).';
COMMENT ON COLUMN customer.spouse_customer_id IS
  'Self-reference when the spouse is also a platform customer. Populated by sync_spouse_customer_link trigger.';

-- ============================================================================
-- TRIGGER: sync spouse_customer_id when a new customer matches an existing spouse_npwp
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_spouse_customer_link()
RETURNS TRIGGER AS $$
DECLARE
  matched_npwp VARCHAR(20);
BEGIN
  -- When a customer row is inserted/updated with a NPWP, check if any OTHER
  -- customer has that NPWP listed as spouse_npwp. If yes, link both directions.
  IF NEW.npwp IS NOT NULL AND NEW.npwp != '' THEN
    UPDATE customer
       SET spouse_customer_id = NEW.id
     WHERE spouse_npwp = NEW.npwp
       AND id <> NEW.id
       AND (spouse_customer_id IS NULL OR spouse_customer_id <> NEW.id);
  END IF;

  -- And if this row sets spouse_npwp, find the matching customer.
  IF NEW.spouse_npwp IS NOT NULL AND NEW.spouse_npwp != '' THEN
    SELECT id INTO matched_npwp FROM customer
      WHERE npwp = NEW.spouse_npwp
        AND id <> NEW.id
      LIMIT 1;
    IF FOUND THEN
      NEW.spouse_customer_id := matched_npwp::uuid;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_spouse_link ON customer;
CREATE TRIGGER trg_sync_spouse_link
  BEFORE INSERT OR UPDATE OF npwp, spouse_npwp ON customer
  FOR EACH ROW EXECUTE FUNCTION sync_spouse_customer_link();

-- ============================================================================
-- TABLE: signature_audit (immutable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS signature_audit (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  purpose            signature_purpose NOT NULL,

  -- Evidence fields per UU ITE / PP 71 minimum viable
  signature_sha256   VARCHAR(64) NOT NULL,        -- hex SHA256 of the PNG bytes
  signed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address         INET,
  user_agent         TEXT,

  -- Storage reference (Supabase Storage path; signed URL generated per-request)
  storage_path       TEXT,                        -- e.g. 'signatures/<customer_id>/<uuid>.png'
  byte_size          INTEGER,

  -- Extensibility for future PSrE (Privy/VIDA) integration
  external_provider  TEXT,                        -- 'canvas' | 'privy' | 'vida' | ...
  external_ref       TEXT,                        -- PSrE transaction id when applicable

  -- Link back to POA row when purpose = POA_MANDATE
  poa_id             UUID REFERENCES power_of_attorney(id) ON DELETE SET NULL,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_audit_customer ON signature_audit(customer_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_poa      ON signature_audit(poa_id) WHERE poa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signature_audit_signed_at ON signature_audit(signed_at DESC);

-- ----------------------------------------------------------------------------
-- Immutability: no updates, no deletes except by service role.
-- Enforced via RLS (no UPDATE/DELETE policies for customer / consultant).
-- ----------------------------------------------------------------------------

ALTER TABLE signature_audit ENABLE ROW LEVEL SECURITY;

-- Customer can read their own signatures (for self-audit)
CREATE POLICY signature_audit_customer_read ON signature_audit
  FOR SELECT USING (customer_id = get_customer_id());

-- Consultant of the customer's tax partner can read (for compliance reviews)
CREATE POLICY signature_audit_consultant_read ON signature_audit
  FOR SELECT USING (
    is_jtc_consultant() AND
    EXISTS (
      SELECT 1 FROM customer c
      WHERE c.id = signature_audit.customer_id
    )
  );

-- Platform admin CANNOT read (customer tax data isolation per Hard Rule #1).
-- No UPDATE policy → no-one can update.
-- No DELETE policy → no-one can delete (service_role bypasses RLS anyway).

COMMENT ON TABLE signature_audit IS
  'Immutable log of electronic signatures. MVP evidence per UU ITE 11/2008 and PP 71/2019 '
  '(signer control = session, change detection = sha256, non-repudiation = ip + ua + timestamp). '
  'Future PSrE (Privy/VIDA) integration uses external_provider/external_ref fields.';

-- ============================================================================
-- Storage bucket policy for `signatures` (managed via dashboard or cli separately;
-- this migration leaves a comment so ops knows to create it).
-- ============================================================================

-- Ops: create a Supabase Storage bucket named `signatures` with:
--   public = false
--   allowed mime types: image/png
--   max file size: 1 MB
--   Signed URL TTL: 5 minutes (generated per-request in app code)
--   RLS: users can upload under `signatures/<auth.uid()>/` prefix only.
