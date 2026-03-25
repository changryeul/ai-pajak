-- ============================================
-- Migration: e-Faktur PPN tables
-- Date: 2026-03-25
-- Purpose: Faktur Pajak (tax invoice) management for PPN
-- ============================================

-- Faktur status enum
CREATE TYPE faktur_status AS ENUM (
  'DRAFT',
  'APPROVED',
  'ISSUED',
  'VOID',
  'REPLACED'
);

-- Faktur transaction type
CREATE TYPE faktur_transaction_type AS ENUM (
  'OUTPUT',   -- Faktur Keluaran (sales)
  'INPUT'     -- Faktur Masukan (purchases)
);

-- Main faktur_pajak table
CREATE TABLE faktur_pajak (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  consultant_id UUID REFERENCES consultant(id),
  transaction_type faktur_transaction_type NOT NULL,

  -- Serial number: KKK.FFF-YY.NNNNNNNN
  serial_number VARCHAR(20) UNIQUE,
  replaced_by_serial VARCHAR(20),

  -- Transaction details
  buyer_npwp VARCHAR(16) NOT NULL,
  buyer_name VARCHAR(255) NOT NULL,
  buyer_address TEXT,
  seller_npwp VARCHAR(16) NOT NULL,
  seller_name VARCHAR(255) NOT NULL,

  -- Amounts
  dpp DECIMAL(15,2) NOT NULL DEFAULT 0,           -- Dasar Pengenaan Pajak
  ppn_amount DECIMAL(15,2) NOT NULL DEFAULT 0,     -- PPN amount
  ppnbm_amount DECIMAL(15,2) NOT NULL DEFAULT 0,   -- PPnBM (luxury tax)
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Line items stored as JSONB
  items JSONB NOT NULL DEFAULT '[]',

  -- Status
  status faktur_status NOT NULL DEFAULT 'DRAFT',
  issue_date DATE,
  void_date DATE,
  void_reason TEXT,

  -- DJP integration
  djp_approval_code VARCHAR(100),
  djp_submitted_at TIMESTAMPTZ,
  djp_status VARCHAR(50),

  -- Linked to SPT Masa
  tax_filing_id UUID REFERENCES tax_filing(id),
  tax_period VARCHAR(7),  -- YYYY-MM

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_faktur_customer ON faktur_pajak(customer_id);
CREATE INDEX idx_faktur_serial ON faktur_pajak(serial_number);
CREATE INDEX idx_faktur_period ON faktur_pajak(tax_period);
CREATE INDEX idx_faktur_status ON faktur_pajak(status);
CREATE INDEX idx_faktur_transaction_type ON faktur_pajak(transaction_type);

-- Serial number sequence for auto-generation
CREATE SEQUENCE faktur_serial_seq START WITH 1;

-- RLS
ALTER TABLE faktur_pajak ENABLE ROW LEVEL SECURITY;

-- Customers see own faktur
CREATE POLICY faktur_customer_select ON faktur_pajak
  FOR SELECT TO authenticated
  USING (
    customer_id = get_customer_id()
    AND NOT is_platform_admin()
  );

-- Consultants see assigned customer faktur
CREATE POLICY faktur_consultant_select ON faktur_pajak
  FOR SELECT TO authenticated
  USING (
    is_jtc_consultant()
    AND customer_id IN (
      SELECT cc.customer_id FROM customer_consultant cc
      WHERE cc.consultant_id = get_consultant_id() AND cc.is_active = true
    )
  );

-- Consultants can create/update faktur
CREATE POLICY faktur_consultant_insert ON faktur_pajak
  FOR INSERT TO authenticated
  WITH CHECK (is_jtc_consultant());

CREATE POLICY faktur_consultant_update ON faktur_pajak
  FOR UPDATE TO authenticated
  USING (is_jtc_consultant());

-- Service role full access
CREATE POLICY faktur_service_all ON faktur_pajak
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- PLATFORM_ADMIN blocked (Hard Rule #1)
-- No policy for PLATFORM_ADMIN = no access

COMMENT ON TABLE faktur_pajak IS
  'e-Faktur (Faktur Pajak) for PPN tax invoices. Managed by app layer. No triggers.';
