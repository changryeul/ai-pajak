-- 결산 wizard ↔ 운영팀 큐 브릿지.
--
-- 결산 wizard에서 「제출」하면 closing_submission row가 생성되는데, 운영팀이
-- Coretax 처리할 때 djp_submission_queue 케이스도 함께 갖고 있어야 BPE를
-- 양쪽에 동기화할 수 있다. djp_submission_queue.closing_session_id 로 두 테이블을 잇는다.
--
-- nullable + ON DELETE SET NULL — 결산 wizard와 무관한 일반 운영 케이스도 그대로 사용.

ALTER TABLE djp_submission_queue
  ADD COLUMN IF NOT EXISTS closing_session_id UUID
    REFERENCES tax_closing_session(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dsq_closing_session
  ON djp_submission_queue(closing_session_id)
  WHERE closing_session_id IS NOT NULL;

COMMENT ON COLUMN djp_submission_queue.closing_session_id IS
  '연결된 tax_closing_session.id — 결산 wizard 제출로 자동 생성된 케이스에만 채워진다. record-completion 액션에서 BPE를 closing_submission에 동기화할 때 사용.';
