-- Migration: Add NIK column to customer table
-- Description: Add NIK (Nomor Induk Kependudukan) field for Indonesian ID number
-- NIK is a 16-digit national identification number required for SPT forms

-- Add NIK column to customer table
ALTER TABLE customer ADD COLUMN IF NOT EXISTS nik VARCHAR(16);

-- Add index for NIK lookups
CREATE INDEX IF NOT EXISTS idx_customer_nik ON customer(nik) WHERE nik IS NOT NULL;

-- Add check constraint for NIK format (16 digits)
ALTER TABLE customer ADD CONSTRAINT check_nik_format
  CHECK (nik IS NULL OR (LENGTH(nik) = 16 AND nik ~ '^[0-9]+$'));

-- Add comment for documentation
COMMENT ON COLUMN customer.nik IS 'Nomor Induk Kependudukan - Indonesian 16-digit national ID number';

-- Update RLS policy to allow reading NIK
-- (existing policies should already cover this as they allow full row access)
