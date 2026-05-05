-- Supervisor 배정 콘솔에 필요한 케이스 메타 필드.
-- PDF '업무 배정/회수' 화면의 좌측 카드(케이스 코드 + 우선순위 + 서비스 라벨 + Due) 표시 + 상단 우측 "선택 업무 배정 결정" 카드 (현재 Supervisor)
-- 그리고 "PENDING_DOCS" 상태 (PDF의 자료요청 라벨 매핑용).

ALTER TABLE djp_submission_queue
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES tax_operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS case_code VARCHAR(40),
  ADD COLUMN IF NOT EXISTS service_label VARCHAR(120),
  ADD COLUMN IF NOT EXISTS due_date DATE;

DO $$ BEGIN
  ALTER TABLE djp_submission_queue ADD CONSTRAINT djp_submission_queue_priority_check
    CHECK (priority IN ('URGENT','HIGH','NORMAL','LOW'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add PENDING_DOCS state for cases waiting on customer to provide more information.
ALTER TABLE djp_submission_queue DROP CONSTRAINT IF EXISTS djp_submission_queue_status_check;
ALTER TABLE djp_submission_queue ADD CONSTRAINT djp_submission_queue_status_check
  CHECK (status IN (
    'PENDING','PENDING_DOCS','DATA_REVIEW','PENDING_APPROVAL','APPROVED',
    'EBILLING_GENERATED','PAYMENT_PENDING','PAYMENT_UPLOADED','PAYMENT_VERIFIED',
    'DJP_SUBMITTED','BPE_UPLOADED','COMPLETED','FAILED'
  ));

CREATE INDEX IF NOT EXISTS idx_dsq_supervisor ON djp_submission_queue(supervisor_id) WHERE supervisor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dsq_priority ON djp_submission_queue(priority);
CREATE INDEX IF NOT EXISTS idx_dsq_case_code ON djp_submission_queue(case_code) WHERE case_code IS NOT NULL;

COMMENT ON COLUMN djp_submission_queue.supervisor_id IS 'Supervisor 자동배분 결과. NULL = 미배분.';
COMMENT ON COLUMN djp_submission_queue.priority IS 'URGENT / HIGH / NORMAL / LOW';
COMMENT ON COLUMN djp_submission_queue.case_code IS 'REQ-NEW-001, C-001 형식의 외부 케이스 코드';
COMMENT ON COLUMN djp_submission_queue.service_label IS '"SPT Masa 원천세", "SPT Tahunan Badan Coretax 2025+" 등 UI에 노출되는 서비스 표기';
