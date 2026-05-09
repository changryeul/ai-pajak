-- closing_document 에 OCR 자동 분류 결과 컬럼 추가.
-- ocr_status: 'NONE' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
--   * NONE — 분류 미실행 (기본값)
--   * PROCESSING — 분류 호출 중 (비동기 예약 가능)
--   * COMPLETED — 분류 성공, ocr_extracted 사용 가능
--   * FAILED — 분류 시도했으나 실패, ocr_error 참조
-- ocr_confidence: 0~1, COMPLETED일 때만 의미 있음
-- ocr_extracted: 분류 결과 (category/totalAmount/rowCount/lineItems/raw_text 등)
-- ocr_error: FAILED 시 사용자에게 보일 짧은 메시지

ALTER TABLE closing_document
  ADD COLUMN IF NOT EXISTS ocr_status TEXT NOT NULL DEFAULT 'NONE'
    CHECK (ocr_status IN ('NONE', 'PROCESSING', 'COMPLETED', 'FAILED')),
  ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(4, 3),
  ADD COLUMN IF NOT EXISTS ocr_extracted JSONB,
  ADD COLUMN IF NOT EXISTS ocr_error TEXT,
  ADD COLUMN IF NOT EXISTS ocr_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN closing_document.ocr_status IS
  'OCR 자동 분류 상태. NONE(기본) → PROCESSING → COMPLETED/FAILED.';
COMMENT ON COLUMN closing_document.ocr_extracted IS
  'OCR/LLM이 추출한 구조화 데이터. category, totalAmount, rowCount, lineItems[], raw_text 등.';
