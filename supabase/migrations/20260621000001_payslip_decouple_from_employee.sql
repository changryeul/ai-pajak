-- 2026-06-21 monthly_payslip 을 employee_payroll 마스터와 분리
--
-- 새 정책 (사용자 결정):
-- - 월별 급여 자료를 업로드하면 monthly_payslip 행만 생성 (employee_payroll 자동 생성 X).
-- - 직원 마스터는 매월 PPh21 작업 종료 후 "sync" 버튼으로만 갱신.
-- - 한 번 sync 된 직원은 급여 부분만 갱신, 기타 인적 정보는 사용자가 직접 수정.
--
-- 따라서 monthly_payslip 이 self-contained 가 되도록 직원 식별 정보 (name/npwp/ptkp)
-- 를 monthly_payslip 자체에 보관하고, employee_id FK 는 nullable 로 (sync 전 단계).

-- 1) 직원 식별 정보 컬럼 추가 (sync 전 단계에서도 행이 누구 것인지 알 수 있도록)
ALTER TABLE monthly_payslip
  ADD COLUMN IF NOT EXISTS employee_name      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS employee_npwp      VARCHAR(32),
  ADD COLUMN IF NOT EXISTS ptkp_category      VARCHAR(8);

-- 2) 제출 상태 (사용자가 검토/수정 후 "최종 제출" 시 SUBMITTED)
ALTER TABLE monthly_payslip
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED'));

-- 3) employee_id 를 nullable 로 (sync 전엔 마스터가 비어있을 수 있음)
ALTER TABLE monthly_payslip ALTER COLUMN employee_id DROP NOT NULL;

-- 4) 기존 행에 직원 식별 정보 백필 (마이그레이션 적용 시점 데이터 보호용 — 사용자가 사전
--    삭제 스크립트를 돌리면 빈 상태)
UPDATE monthly_payslip mp
SET employee_name = ep.employee_name,
    employee_npwp = ep.employee_npwp,
    ptkp_category = ep.ptkp_category
FROM employee_payroll ep
WHERE mp.employee_id = ep.id
  AND mp.employee_name IS NULL;

-- 5) customer 에 마지막 sync 완료 시점 컬럼 (이전 달까지 sync 되면 버튼 비활성)
ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS employee_synced_through_period VARCHAR(7); -- YYYY-MM

COMMENT ON COLUMN monthly_payslip.employee_id IS
  'NULLABLE since 2026-06-21. NULL = 급여 자료만 업로드된 상태 (직원 마스터 sync 전).
   sync 후 마스터의 id 로 채워진다.';
COMMENT ON COLUMN monthly_payslip.status IS
  'DRAFT = 업로드 후 사용자가 수정 가능한 상태. SUBMITTED = 최종 제출 완료, 수정 불가.';
COMMENT ON COLUMN customer.employee_synced_through_period IS
  'YYYY-MM. 이 월까지의 monthly_payslip 데이터는 employee_payroll 마스터에 sync 완료.
   sync 버튼은 이 값보다 큰 period 의 행이 있을 때만 활성.';
