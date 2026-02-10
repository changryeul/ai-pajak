-- ============================================================================
-- ADD OCR COLUMNS TO DOCUMENT TABLE
-- ============================================================================
-- This migration adds OCR-related columns to the document table for
-- tracking OCR processing status and storing results.
-- ============================================================================

-- Add OCR status enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ocr_status') THEN
        CREATE TYPE ocr_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    END IF;
END$$;

-- Add OCR columns to document table
ALTER TABLE document
ADD COLUMN IF NOT EXISTS ocr_status ocr_status DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS ocr_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ocr_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ocr_result JSONB,
ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS ocr_error_message TEXT;

-- Add index for OCR status queries
CREATE INDEX IF NOT EXISTS idx_document_ocr_status ON document(ocr_status);
CREATE INDEX IF NOT EXISTS idx_document_ocr_pending ON document(ocr_status) WHERE ocr_status = 'PENDING';

-- Comment on columns
COMMENT ON COLUMN document.ocr_status IS 'OCR processing status: PENDING, PROCESSING, COMPLETED, FAILED';
COMMENT ON COLUMN document.ocr_started_at IS 'Timestamp when OCR processing started';
COMMENT ON COLUMN document.ocr_completed_at IS 'Timestamp when OCR processing completed or failed';
COMMENT ON COLUMN document.ocr_result IS 'JSON object containing extracted OCR data';
COMMENT ON COLUMN document.ocr_confidence IS 'Confidence score of OCR extraction (0.00-1.00)';
COMMENT ON COLUMN document.ocr_error_message IS 'Error message if OCR processing failed';

-- ============================================================================
-- FORM TYPE ENUM FOR SPECIFIC TAX FORMS
-- ============================================================================

-- Add form type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_form_type') THEN
        CREATE TYPE tax_form_type AS ENUM (
            'FORM_1721_A1',      -- Bukti Potong PPh 21 (Employee)
            'FORM_1721_A2',      -- Bukti Potong PPh 21 (Retired)
            'FORM_1721_VI',      -- Bukti Potong PPh 21 Final
            'FORM_BUPOT_23',     -- Bukti Potong PPh 23
            'FORM_BUPOT_26',     -- Bukti Potong PPh 26
            'FORM_BUPOT_FINAL',  -- Bukti Potong PPh Final
            'FAKTUR_PAJAK',      -- Tax Invoice
            'SPT_1770_SS',       -- Annual Individual (Simple)
            'SPT_1770_S',        -- Annual Individual (Standard)
            'SPT_1770',          -- Annual Individual (Full)
            'SPT_MASA_PPH21',    -- Monthly PPh 21
            'SPT_MASA_PPH23',    -- Monthly PPh 23
            'SPT_MASA_PPN',      -- Monthly PPN
            'OTHER'              -- Other documents
        );
    END IF;
END$$;

-- Add form_type column to document table
ALTER TABLE document
ADD COLUMN IF NOT EXISTS form_type tax_form_type;

-- Add index for form type
CREATE INDEX IF NOT EXISTS idx_document_form_type ON document(form_type);

COMMENT ON COLUMN document.form_type IS 'Specific tax form type identified by OCR';
