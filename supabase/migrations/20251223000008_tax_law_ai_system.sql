-- AI 기반 세법 자동 업데이트 시스템
-- Purpose: 법령 문서를 AI로 분석하여 세법 변경사항을 자동으로 감지하고 적용

-- 법령 분석 결과 테이블
CREATE TABLE tax_law_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_type VARCHAR(20) NOT NULL, -- UU, PP, PMK, PERATURAN_DJP
  law_number VARCHAR(100) NOT NULL, -- PMK 131/2024
  law_title TEXT NOT NULL,
  effective_date DATE NOT NULL,
  change_type TEXT[] NOT NULL, -- ARRAY['RATE_CHANGE', 'PTKP_CHANGE']
  summary TEXT NOT NULL,
  detailed_changes JSONB NOT NULL, -- Array of DetailedChange objects
  affected_systems TEXT[] NOT NULL, -- ['ppn-calculator', 'pph21-calculator']
  suggested_migrations TEXT[] NOT NULL, -- Array of SQL statements
  confidence_score INT CHECK (confidence_score >= 0 AND confidence_score <= 100),
  requires_human_review BOOLEAN DEFAULT TRUE,
  original_document TEXT, -- Full text of the law document
  status VARCHAR(20) DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, APPROVED, REJECTED, APPLIED
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 법령 적용 기록 테이블
CREATE TABLE tax_law_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES tax_law_analyses(id) ON DELETE CASCADE,
  applied_by UUID REFERENCES auth.users(id) NOT NULL,
  applied_migrations TEXT[] NOT NULL, -- SQL statements that were executed
  rollback_migrations TEXT[], -- SQL to rollback if needed
  application_status VARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, FAILED, PARTIAL
  error_messages JSONB, -- Any errors that occurred
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 동적 세율 관리 테이블 (년도별)
CREATE TABLE dynamic_tax_rates (
  year INT PRIMARY KEY,
  ppn_statutory_rate DECIMAL(5,4) NOT NULL, -- 법정 세율 (12%)
  pph21_brackets JSONB NOT NULL, -- Progressive tax brackets
  ptkp JSONB NOT NULL, -- 12 categories
  effective_from DATE NOT NULL,
  effective_until DATE,
  legal_basis VARCHAR(200) NOT NULL, -- PMK 131/2024
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_tax_law_analyses_status ON tax_law_analyses(status);
CREATE INDEX idx_tax_law_analyses_law_number ON tax_law_analyses(law_number);
CREATE INDEX idx_tax_law_analyses_effective_date ON tax_law_analyses(effective_date);
CREATE INDEX idx_tax_law_applications_analysis_id ON tax_law_applications(analysis_id);
CREATE INDEX idx_dynamic_tax_rates_year ON dynamic_tax_rates(year);
CREATE INDEX idx_dynamic_tax_rates_active ON dynamic_tax_rates(is_active);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_tax_law_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tax_law_analyses_updated_at
BEFORE UPDATE ON tax_law_analyses
FOR EACH ROW
EXECUTE FUNCTION update_tax_law_analyses_updated_at();

CREATE TRIGGER trigger_update_dynamic_tax_rates_updated_at
BEFORE UPDATE ON dynamic_tax_rates
FOR EACH ROW
EXECUTE FUNCTION update_tax_law_analyses_updated_at();

-- 초기 데이터: 2024-2025 세율 (기존 하드코딩에서 마이그레이션)
INSERT INTO dynamic_tax_rates (year, ppn_statutory_rate, pph21_brackets, ptkp, effective_from, legal_basis, is_active)
VALUES (
  2024,
  0.11,
  '[
    {"min": 0, "max": 60000000, "rate": 0.05},
    {"min": 60000000, "max": 250000000, "rate": 0.15},
    {"min": 250000000, "max": 500000000, "rate": 0.25},
    {"min": 500000000, "max": 5000000000, "rate": 0.30},
    {"min": 5000000000, "max": 999999999999, "rate": 0.35}
  ]'::jsonb,
  '{
    "TK0": 54000000, "TK1": 58500000, "TK2": 63000000, "TK3": 67500000,
    "K0": 58500000, "K1": 63000000, "K2": 67500000, "K3": 72000000,
    "KI0": 112500000, "KI1": 117000000, "KI2": 121500000, "KI3": 126000000
  }'::jsonb,
  '2024-01-01',
  'UU HPP 2021 - PPN 11%',
  TRUE
),
(
  2025,
  0.12,
  '[
    {"min": 0, "max": 60000000, "rate": 0.05},
    {"min": 60000000, "max": 250000000, "rate": 0.15},
    {"min": 250000000, "max": 500000000, "rate": 0.25},
    {"min": 500000000, "max": 5000000000, "rate": 0.30},
    {"min": 5000000000, "max": 999999999999, "rate": 0.35}
  ]'::jsonb,
  '{
    "TK0": 54000000, "TK1": 58500000, "TK2": 63000000, "TK3": 67500000,
    "K0": 58500000, "K1": 63000000, "K2": 67500000, "K3": 72000000,
    "KI0": 112500000, "KI1": 117000000, "KI2": 121500000, "KI3": 126000000
  }'::jsonb,
  '2025-01-01',
  'PMK 131/2024 - PPN 12%',
  TRUE
);

-- RLS 정책 (TAX_ADVISOR_JTC만 접근 가능)
ALTER TABLE tax_law_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_law_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_tax_rates ENABLE ROW LEVEL SECURITY;

-- TAX_ADVISOR_JTC만 법령 분석 결과 조회 가능
CREATE POLICY "tax_advisors_can_view_analyses"
ON tax_law_analyses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'TAX_ADVISOR_JTC'
  )
);

-- TAX_ADVISOR_JTC만 법령 분석 승인/거부 가능
CREATE POLICY "tax_advisors_can_update_analyses"
ON tax_law_analyses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'TAX_ADVISOR_JTC'
  )
);

-- 모든 인증된 사용자는 세율 조회 가능
CREATE POLICY "authenticated_users_can_view_tax_rates"
ON dynamic_tax_rates FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Comments
COMMENT ON TABLE tax_law_analyses IS 'AI analysis results of Indonesian tax law documents (PMK, PP, UU)';
COMMENT ON TABLE tax_law_applications IS 'Record of applied tax law changes to the system';
COMMENT ON TABLE dynamic_tax_rates IS 'Year-based tax rates (PPN, PPh21 brackets, PTKP) - dynamically updatable';

COMMENT ON COLUMN tax_law_analyses.confidence_score IS 'AI confidence score (0-100) for the analysis accuracy';
COMMENT ON COLUMN tax_law_analyses.requires_human_review IS 'Whether human tax advisor review is required before applying';
COMMENT ON COLUMN tax_law_analyses.suggested_migrations IS 'Auto-generated SQL migration scripts to apply changes';
COMMENT ON COLUMN tax_law_applications.rollback_migrations IS 'SQL statements to rollback changes if needed';
COMMENT ON COLUMN dynamic_tax_rates.ppn_statutory_rate IS 'Statutory PPN rate (12% in 2025), before PMK 131 DPP adjustment';
