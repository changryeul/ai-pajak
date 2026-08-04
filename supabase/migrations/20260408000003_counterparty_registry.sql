-- gin_trgm_ops 인덱스에 필요 — hosted 는 이미 활성, 로컬 fresh replay 용 idempotent guard.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Global Counterparty Registry — 거래 상대방 공유 지식베이스
-- 한 고객이 등록한 거래처 정보를 다른 고객이 재사용할 수 있도록 NPWP 기반 글로벌 레지스트리 생성.
-- 기존 tax_counterparty는 유지 (customer-scoped 관계 기록), registry_id로 레지스트리 참조.

-- ──────────────────────────────────────────────────────────
-- 1. counterparty_registry (글로벌, NPWP 유니크)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counterparty_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    npwp VARCHAR(20) UNIQUE,                -- Indonesian tax ID (15-16 digits)
    name VARCHAR(255) NOT NULL,
    legal_form VARCHAR(30),                 -- PT, CV, KPP, UD, Branch, ForeignCompany
    trade_name VARCHAR(255),                -- 상호명 (법인명과 다를 수 있음)

    -- Address
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),

    -- Contact
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),

    -- Business classification
    kbli_code VARCHAR(5) REFERENCES klu_codes(code),
    kbli_codes_extra JSONB,                 -- ["12345","67890"] — 추가 KBLI 배열

    -- Tax / legal status
    qualification_grade VARCHAR(20),        -- SBU: SMALL, MEDIUM_LARGE, QUALIFIED, NONE
    is_pkp BOOLEAN DEFAULT FALSE,           -- Pengusaha Kena Pajak (VAT-registered)
    pkp_registered_at DATE,

    -- Foreign company + tax treaty
    is_foreign BOOLEAN DEFAULT FALSE,       -- 국외 법인 여부
    country_code VARCHAR(2) DEFAULT 'ID',   -- ISO 3166-1 alpha-2
    has_cod BOOLEAN DEFAULT FALSE,          -- Certificate of Domicile (조세조약 적용 증명)
    cod_expires_at DATE,
    tax_treaty_info JSONB,                  -- { article, rate, notes, effective_from, effective_to }

    -- Licenses (인허가)
    -- [{ type: 'SIUP', number: '123/2024', issuer: 'Kemendag', issued_at: '2024-01-01', expires_at: '2029-01-01', status: 'ACTIVE' }]
    licenses JSONB DEFAULT '[]'::jsonb,

    -- Data quality
    verified BOOLEAN DEFAULT FALSE,         -- 관리자 검증 완료 여부
    verification_source VARCHAR(50),        -- USER, DJP_API, ADMIN
    first_registered_by UUID REFERENCES customer(id),  -- 최초 등록 고객
    last_updated_by UUID REFERENCES customer(id),
    usage_count INTEGER DEFAULT 1,          -- 이 레지스트리 엔트리를 사용하는 고객 수

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registry_npwp ON counterparty_registry(npwp);
CREATE INDEX IF NOT EXISTS idx_registry_name_trgm ON counterparty_registry USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_registry_country ON counterparty_registry(country_code) WHERE is_foreign = true;

-- Enable pg_trgm for fuzzy search on company names
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- RLS: authenticated users can read (shared knowledge base), only write via API
ALTER TABLE counterparty_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read registry" ON counterparty_registry
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Block direct writes" ON counterparty_registry
FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Block direct updates" ON counterparty_registry
FOR UPDATE TO authenticated USING (false);

-- ──────────────────────────────────────────────────────────
-- 2. tax_counterparty — registry_id link + 신규 필드
-- ──────────────────────────────────────────────────────────
ALTER TABLE tax_counterparty
  ADD COLUMN IF NOT EXISTS registry_id UUID REFERENCES counterparty_registry(id),
  ADD COLUMN IF NOT EXISTS is_foreign BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS licenses JSONB,              -- customer-specific license snapshot
  ADD COLUMN IF NOT EXISTS tax_treaty_info JSONB,
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(100),       -- customer's own label
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_counterparty_registry ON tax_counterparty(registry_id);

COMMENT ON TABLE counterparty_registry IS 'Global counterparty registry shared across all AI Pajak customers';
COMMENT ON COLUMN counterparty_registry.usage_count IS 'Number of customers referencing this entry';
COMMENT ON COLUMN counterparty_registry.licenses IS 'JSONB array of business licenses with expiry dates';
COMMENT ON COLUMN counterparty_registry.tax_treaty_info IS 'Tax treaty details for foreign counterparties (for PPh 26 rate determination)';
