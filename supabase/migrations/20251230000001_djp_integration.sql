-- DJP Integration Migration
-- Adds support for DJP e-Filing, e-Billing, and status tracking
-- Version: 1.0.0
-- Date: 2025-12-30

-- ============================================================================
-- ENUMS
-- ============================================================================

-- DJP Submission Status
DO $$ BEGIN
    CREATE TYPE djp_submission_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'ACCEPTED',
        'REJECTED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DJP Job Type
DO $$ BEGIN
    CREATE TYPE djp_job_type AS ENUM (
        'E_FILING',
        'E_BILLING',
        'NPWP_VALIDATION',
        'BPE_RETRIEVAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DJP Job Status
DO $$ BEGIN
    CREATE TYPE djp_job_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- DJP Job Priority
DO $$ BEGIN
    CREATE TYPE djp_job_priority AS ENUM (
        'HIGH',
        'NORMAL',
        'LOW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ADD COLUMNS TO tax_filing
-- ============================================================================

ALTER TABLE tax_filing
ADD COLUMN IF NOT EXISTS djp_submission_status djp_submission_status,
ADD COLUMN IF NOT EXISTS djp_transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS djp_job_id UUID,
ADD COLUMN IF NOT EXISTS djp_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS djp_error_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS djp_error_message TEXT,
ADD COLUMN IF NOT EXISTS djp_bpe_pdf TEXT,
ADD COLUMN IF NOT EXISTS bpe_date TIMESTAMP WITH TIME ZONE;

-- Indexes for DJP columns
CREATE INDEX IF NOT EXISTS idx_tax_filing_djp_status
ON tax_filing(djp_submission_status);

CREATE INDEX IF NOT EXISTS idx_tax_filing_djp_transaction
ON tax_filing(djp_transaction_id);

CREATE INDEX IF NOT EXISTS idx_tax_filing_djp_job
ON tax_filing(djp_job_id);

-- ============================================================================
-- DJP JOB QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS djp_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type djp_job_type NOT NULL,
    tax_filing_id UUID REFERENCES tax_filing(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customer(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    priority djp_job_priority DEFAULT 'NORMAL',
    status djp_job_status DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    result JSONB,
    error_message TEXT,
    djp_transaction_id VARCHAR(100),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for job queue
CREATE INDEX IF NOT EXISTS idx_djp_job_status ON djp_job(status);
CREATE INDEX IF NOT EXISTS idx_djp_job_type ON djp_job(type);
CREATE INDEX IF NOT EXISTS idx_djp_job_tax_filing ON djp_job(tax_filing_id);
CREATE INDEX IF NOT EXISTS idx_djp_job_customer ON djp_job(customer_id);
CREATE INDEX IF NOT EXISTS idx_djp_job_scheduled ON djp_job(scheduled_at)
WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_djp_job_transaction ON djp_job(djp_transaction_id);
CREATE INDEX IF NOT EXISTS idx_djp_job_created ON djp_job(created_at DESC);

-- ============================================================================
-- DJP BILLING TABLE (for e-Billing tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS djp_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    tax_filing_id UUID REFERENCES tax_filing(id) ON DELETE SET NULL,
    djp_job_id UUID REFERENCES djp_job(id) ON DELETE SET NULL,
    kode_billing VARCHAR(50),
    jenis_pajak VARCHAR(20) NOT NULL,
    jenis_setoran VARCHAR(20) NOT NULL,
    masa_pajak VARCHAR(2) NOT NULL,
    tahun_pajak INTEGER NOT NULL,
    jumlah_setor DECIMAL(15, 2) NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE,
    ntpn VARCHAR(50),
    payment_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for billing table
CREATE INDEX IF NOT EXISTS idx_djp_billing_customer ON djp_billing(customer_id);
CREATE INDEX IF NOT EXISTS idx_djp_billing_kode ON djp_billing(kode_billing);
CREATE INDEX IF NOT EXISTS idx_djp_billing_status ON djp_billing(status);
CREATE INDEX IF NOT EXISTS idx_djp_billing_tax_filing ON djp_billing(tax_filing_id);

-- ============================================================================
-- DJP WEBHOOK LOG TABLE (for debugging and audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS djp_webhook_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    is_valid_signature BOOLEAN,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_result VARCHAR(20),
    error_message TEXT
);

-- Indexes for webhook log
CREATE INDEX IF NOT EXISTS idx_djp_webhook_event ON djp_webhook_log(event_type);
CREATE INDEX IF NOT EXISTS idx_djp_webhook_transaction ON djp_webhook_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_djp_webhook_date ON djp_webhook_log(processed_at DESC);

-- ============================================================================
-- ADD ACTIVITY TYPES FOR DJP (if activity_type enum exists)
-- ============================================================================

DO $$ BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'DJP_SUBMIT';
EXCEPTION
    WHEN undefined_object THEN null;
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'DJP_FILING_ACCEPTED';
EXCEPTION
    WHEN undefined_object THEN null;
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'DJP_FILING_REJECTED';
EXCEPTION
    WHEN undefined_object THEN null;
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'DJP_BILLING_CREATED';
EXCEPTION
    WHEN undefined_object THEN null;
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'DJP_BILLING_PAID';
EXCEPTION
    WHEN undefined_object THEN null;
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'DJP_BPE_READY';
EXCEPTION
    WHEN undefined_object THEN null;
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- RLS POLICIES FOR DJP TABLES
-- ============================================================================

ALTER TABLE djp_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE djp_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE djp_webhook_log ENABLE ROW LEVEL SECURITY;

-- DJP Job policies
DROP POLICY IF EXISTS "Service role can manage djp_job" ON djp_job;
CREATE POLICY "Service role can manage djp_job"
ON djp_job FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Consultants can view djp_job for their filings" ON djp_job;
CREATE POLICY "Consultants can view djp_job for their filings"
ON djp_job FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tax_filing tf
        JOIN consultant c ON tf.consultant_id = c.id
        WHERE tf.id = djp_job.tax_filing_id
        AND c.user_id = auth.uid()
    )
);

-- DJP Billing policies
DROP POLICY IF EXISTS "Service role can manage djp_billing" ON djp_billing;
CREATE POLICY "Service role can manage djp_billing"
ON djp_billing FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Customers can view their billing" ON djp_billing;
CREATE POLICY "Customers can view their billing"
ON djp_billing FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM customer c
        WHERE c.id = djp_billing.customer_id
        AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Consultants can view billing for their customers" ON djp_billing;
CREATE POLICY "Consultants can view billing for their customers"
ON djp_billing FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM consultant c
        JOIN customer_consultant cc ON cc.consultant_id = c.id
        WHERE cc.customer_id = djp_billing.customer_id
        AND c.user_id = auth.uid()
    )
);

-- Webhook log is system only
DROP POLICY IF EXISTS "Service role can manage webhook_log" ON djp_webhook_log;
CREATE POLICY "Service role can manage webhook_log"
ON djp_webhook_log FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at trigger for djp_job
DROP TRIGGER IF EXISTS update_djp_job_updated_at ON djp_job;
CREATE TRIGGER update_djp_job_updated_at
BEFORE UPDATE ON djp_job
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for djp_billing
DROP TRIGGER IF EXISTS update_djp_billing_updated_at ON djp_billing;
CREATE TRIGGER update_djp_billing_updated_at
BEFORE UPDATE ON djp_billing
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE djp_job IS 'Queue for async DJP API operations (e-Filing, e-Billing, etc.)';
COMMENT ON TABLE djp_billing IS 'Tracks Kode Billing and NTPN for tax payments';
COMMENT ON TABLE djp_webhook_log IS 'Audit log for DJP webhook callbacks';

COMMENT ON COLUMN tax_filing.djp_submission_status IS 'Current status of DJP submission';
COMMENT ON COLUMN tax_filing.djp_transaction_id IS 'DJP transaction reference ID';
COMMENT ON COLUMN tax_filing.djp_bpe_pdf IS 'Official BPE PDF from DJP (base64)';
COMMENT ON COLUMN tax_filing.bpe_date IS 'Date when BPE was issued by DJP';

COMMENT ON COLUMN djp_job.payload IS 'Request payload for DJP API call (encrypted sensitive data)';
COMMENT ON COLUMN djp_job.result IS 'Response from DJP API';
COMMENT ON COLUMN djp_job.scheduled_at IS 'When to process this job (for delayed/retry)';

COMMENT ON COLUMN djp_billing.kode_billing IS 'Billing code from DJP e-Billing system';
COMMENT ON COLUMN djp_billing.ntpn IS 'NTPN (Nomor Transaksi Penerimaan Negara) after payment';
