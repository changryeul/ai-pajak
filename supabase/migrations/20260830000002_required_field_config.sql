-- 고객 제공 데이터의 필수항목 레지스트리.
-- MASTER 가 폼별 필수항목을 선택(on/off)·추가·삭제한다. 고객 폼은 active 행을
-- 읽어 별표(*) 표시 + 빈 값 입력유도. (요청 2026-08-30)
--   form_key: company_profile | my_profile | pph23 | ppn | payslip
--   is_required(active): true 면 해당 필드가 필수
CREATE TABLE IF NOT EXISTS required_field_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key     TEXT NOT NULL,
  field_key    TEXT NOT NULL,
  label        TEXT NOT NULL,
  is_required  BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  updated_by   UUID REFERENCES auth.users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_key, field_key)
);
CREATE INDEX IF NOT EXISTS required_field_config_form_idx ON required_field_config(form_key, sort_order);

COMMENT ON TABLE required_field_config IS
  '고객 데이터 필수항목 레지스트리. MASTER 가 폼별 선택/추가/삭제. 고객 폼은 active 행으로 별표+입력유도.';

ALTER TABLE required_field_config ENABLE ROW LEVEL SECURITY;

-- 모든 로그인 사용자 읽기(고객 폼에서 소비)
DROP POLICY IF EXISTS required_field_config_read ON required_field_config;
CREATE POLICY required_field_config_read ON required_field_config
  FOR SELECT TO authenticated USING (true);

-- 쓰기(추가/변경/삭제)는 MASTER 만
DROP POLICY IF EXISTS required_field_config_master_write ON required_field_config;
CREATE POLICY required_field_config_master_write ON required_field_config
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'TAX_OPERATOR_MASTER' AND user_roles.is_active = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'TAX_OPERATOR_MASTER' AND user_roles.is_active = true)
  );

-- 기본 시드 (idempotent). is_required 기본값 = 실무 필수.
INSERT INTO required_field_config (form_key, field_key, label, is_required, sort_order) VALUES
  ('company_profile','company_name','회사명',        true, 1),
  ('company_profile','npwp','NPWP',                  true, 2),
  ('company_profile','business_category','업종',      true, 3),
  ('company_profile','annual_revenue','연매출',       false,4),
  ('company_profile','kbli_code','KBLI 코드',         false,5),
  ('company_profile','legal_form','법인형태',         false,6),
  ('my_profile','full_name','이름',                  true, 1),
  ('my_profile','npwp','NPWP',                       true, 2),
  ('my_profile','nik','NIK',                         true, 3),
  ('my_profile','ptkp_status','PTKP 상태',           true, 4),
  ('my_profile','address','주소',                    false,5),
  ('pph23','counterparty_name','거래처명',           true, 1),
  ('pph23','counterparty_npwp','거래처 NPWP',        true, 2),
  ('pph23','transaction_date','거래일자',            true, 3),
  ('pph23','gross_amount','지급액(DPP)',             true, 4),
  ('pph23','tax_rate','세율',                        true, 5),
  ('pph23','invoice_number','인보이스 번호',          false,6),
  ('pph23','bukti_potong_number','증빙번호',          false,7),
  ('ppn','faktur_number','Faktur 번호',              true, 1),
  ('ppn','faktur_date','Faktur 일자',                true, 2),
  ('ppn','counterparty_name','거래처명',             true, 3),
  ('ppn','counterparty_npwp','거래처 NPWP',          true, 4),
  ('ppn','dpp','DPP',                                true, 5),
  ('ppn','ppn','PPN',                                true, 6),
  ('payslip','employee_name','직원명',               true, 1),
  ('payslip','employee_npwp','직원 NPWP',            false,2),
  ('payslip','base_salary','기본급',                 true, 3),
  ('payslip','ptkp','PTKP',                          true, 4)
ON CONFLICT (form_key, field_key) DO NOTHING;
