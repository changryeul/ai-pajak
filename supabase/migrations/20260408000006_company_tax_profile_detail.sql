-- Detailed Company Tax Profile
-- 세목 결정(PPh 25 vs PPh Final, PPh 4(2), PPh 23 등)에 필요한 모든 정보

ALTER TABLE customer
  -- Business type classification
  ADD COLUMN IF NOT EXISTS business_category VARCHAR(30),
  -- SERVICE | TRADING | MANUFACTURING | CONSTRUCTION | REAL_ESTATE |
  -- FNB_RESTAURANT | FNB_CATERING | TRANSPORTATION | MINING |
  -- AGRICULTURE | FRANCHISE | DIGITAL_PLATFORM | OTHER

  -- Legal / corporate structure
  ADD COLUMN IF NOT EXISTS legal_form VARCHAR(20),         -- PT | CV | UD | FIRMA | KOPERASI | YAYASAN
  ADD COLUMN IF NOT EXISTS established_year INTEGER,        -- 설립 연도 (UMKM 기간 추적용)
  ADD COLUMN IF NOT EXISTS authorized_capital NUMERIC(18,2),  -- 수권 자본금
  ADD COLUMN IF NOT EXISTS paid_up_capital NUMERIC(18,2),     -- 납입 자본금

  -- Ownership
  ADD COLUMN IF NOT EXISTS has_foreign_shareholders BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS foreign_ownership_pct NUMERIC(5,2) DEFAULT 0,  -- % (TP 및 PPh 26 판단)
  ADD COLUMN IF NOT EXISTS parent_company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS parent_company_country VARCHAR(2),

  -- UMKM / PPh Final (PP 55/2022)
  ADD COLUMN IF NOT EXISTS is_umkm BOOLEAN DEFAULT FALSE,  -- UMKM 자격 여부
  ADD COLUMN IF NOT EXISTS umkm_registered_at DATE,          -- PP 55 등록일
  ADD COLUMN IF NOT EXISTS umkm_final_tax_start_year INTEGER, -- PPh Final 0.5% 시작 연도
  -- 법인(PT): 4년 한도, 개인: 7년, CV/FIRMA: 4년

  -- Construction (건설)
  ADD COLUMN IF NOT EXISTS has_construction_sbu BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sbu_qualification VARCHAR(20),    -- SMALL | MEDIUM | LARGE | NONE
  ADD COLUMN IF NOT EXISTS sbu_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sbu_expires_at DATE,

  -- Real estate / property
  ADD COLUMN IF NOT EXISTS sells_property BOOLEAN DEFAULT FALSE,  -- 부동산 매매 → PPh 4(2) 2.5%
  ADD COLUMN IF NOT EXISTS property_type VARCHAR(30),  -- LAND | BUILDING | APARTMENT | OFFICE

  -- F&B
  ADD COLUMN IF NOT EXISTS is_restaurant BOOLEAN DEFAULT FALSE,    -- 식당 → PPh 4(2) / PPN 면제
  ADD COLUMN IF NOT EXISTS is_catering BOOLEAN DEFAULT FALSE,      -- 케이터링 → PPh 23

  -- Income sources (세목 결정용)
  ADD COLUMN IF NOT EXISTS receives_dividends BOOLEAN DEFAULT FALSE,   -- 배당 수입 → PPh 23/26
  ADD COLUMN IF NOT EXISTS receives_interest BOOLEAN DEFAULT FALSE,    -- 이자 수입 → PPh 23/26
  ADD COLUMN IF NOT EXISTS receives_royalties BOOLEAN DEFAULT FALSE,   -- 로열티 수입 → PPh 23/26
  ADD COLUMN IF NOT EXISTS has_franchise BOOLEAN DEFAULT FALSE,        -- 프랜차이즈 → PPh 23 로열티
  ADD COLUMN IF NOT EXISTS pays_rent BOOLEAN DEFAULT FALSE,            -- 임차료 지급 → PPh 4(2) 원천징수

  -- Digital / platform
  ADD COLUMN IF NOT EXISTS is_digital_platform BOOLEAN DEFAULT FALSE,  -- PMSE (디지털 사업)
  ADD COLUMN IF NOT EXISTS has_crypto_transactions BOOLEAN DEFAULT FALSE,

  -- Transportation
  ADD COLUMN IF NOT EXISTS has_shipping_business BOOLEAN DEFAULT FALSE, -- 해운/항공 → PPh 15

  -- Mining / natural resources
  ADD COLUMN IF NOT EXISTS has_mining_license BOOLEAN DEFAULT FALSE,

  -- Tax regime determination (AI가 채움)
  ADD COLUMN IF NOT EXISTS tax_regime VARCHAR(20),  -- UMKM_FINAL | GENERAL_25 | SPECIAL
  ADD COLUMN IF NOT EXISTS tax_regime_reason TEXT,   -- AI가 판별 근거 기록
  ADD COLUMN IF NOT EXISTS tax_regime_determined_at TIMESTAMPTZ,

  -- AI follow-up questions & answers
  ADD COLUMN IF NOT EXISTS ai_profile_questions JSONB DEFAULT '[]'::jsonb,
  -- [{ question: '...', answer: '...', asked_at: '...', answered_at: '...' }]

  -- Profile completeness
  ADD COLUMN IF NOT EXISTS profile_completeness INTEGER DEFAULT 0; -- 0~100%

COMMENT ON COLUMN customer.business_category IS 'Primary business type for tax regime determination';
COMMENT ON COLUMN customer.is_umkm IS 'UMKM status — PPh Final 0.5% applicable if annual revenue < 4.8B IDR';
COMMENT ON COLUMN customer.umkm_final_tax_start_year IS 'Year PPh Final 0.5% started — PT: 4yr limit, CV: 4yr, Individual: 7yr';
COMMENT ON COLUMN customer.tax_regime IS 'AI-determined tax regime: UMKM_FINAL (0.5%) | GENERAL_25 (22%) | SPECIAL';
COMMENT ON COLUMN customer.sbu_qualification IS 'SBU grade for construction: SMALL (1.75%) | MEDIUM (2.65%) | LARGE (4%)';
COMMENT ON COLUMN customer.ai_profile_questions IS 'AI-generated follow-up questions based on profile gaps';
