-- Tax Code Rule — system-level Indonesian tax code reference managed by
-- TAX_OPERATOR_MASTER. 7 fixed categories (PPh21, PPh23, PPh4(2), PPh22,
-- PPh26, PPN, PPh25); no INSERT/DELETE from app, only seed in this file.
-- Track B of PDF p.26-27 "Admin / Tax Engine".

CREATE TABLE tax_code_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT NOT NULL UNIQUE,
  sort_order      INTEGER NOT NULL,
  tax_code        TEXT NOT NULL,
  rate_rule       TEXT NOT NULL,
  condition_text  TEXT NOT NULL,
  doc_required    TEXT NOT NULL,
  review_note     TEXT NOT NULL,
  updated_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tax_code_rule_sort_order_idx ON tax_code_rule(sort_order);

COMMENT ON TABLE tax_code_rule IS
  'System-level Indonesian tax code reference rules. 7 fixed rows; MASTER edits only. Seeded in same migration.';

-- ── RLS ──
ALTER TABLE tax_code_rule ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_code_rule_read ON tax_code_rule
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tax_code_rule_master_update ON tax_code_rule
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );

-- No INSERT or DELETE policy → no app-side row creation/deletion.

-- ── Seed (idempotent) ──
INSERT INTO tax_code_rule (category, sort_order, tax_code, rate_rule, condition_text, doc_required, review_note) VALUES
  ('PPh21',   1, '411121-100', '급여/비정기소득별 누진·TER 기준',     '직원 급여, THR, bonus, benefit 등',                        'Payroll, A1/A2, employee master',         '직원구분/비과세/공제항목 확인'),
  ('PPh23',   2, '411124-104', '일반 용역 2% 등',                    '서비스 수수료, management fee, royalty 등',                'Invoice, contract, bukti potong',         '서비스 성격과 계약서 문구 확인'),
  ('PPh4(2)', 3, '411128-403', '최종분리과세 항목별 상이',             '건물 임대, 특정 건설서비스, 토지/건물 거래 등',              '계약서, 라이선스, invoice',                  'PPh23과 혼동 위험이 큰 항목 우선검토'),
  ('PPh22',   4, '411122-100', '거래/수입/기관별 상이',               '수입, 정부거래, 특정 상품 거래',                            'PIB, purchase document, payment proof',   '거래주체와 과세대상 여부 확인'),
  ('PPh26',   5, '411127-100', '기본 20% / 조세조약 적용 가능',         '비거주자 지급, royalty, interest, technical fee',          'DGT Form, treaty residence certificate, contract', '조세조약 적용 가능성과 DGT 유효성 확인'),
  ('PPN',     6, '411211-100', '현재 적용 VAT rate 기준',             '과세 재화/용역, PKP 거래',                                  'Faktur Pajak, invoice, e-Faktur data',    'PKP 여부, VAT credit 가능 여부 확인'),
  ('PPh25',   7, '411126-100', '전년도 기준 월할 또는 신규 기준',        '법인/개인 월별 선납세액',                                    '전년도 SPT, PPh25 billing history',       'UMKM final 전환 여부와 법인나이 확인')
ON CONFLICT (category) DO NOTHING;
