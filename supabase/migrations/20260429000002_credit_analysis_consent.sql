-- Optional consent for credit-analysis / AI risk evaluation data usage,
-- collected on the corporate signup terms+mandate combined page.

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS credit_analysis_consent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS credit_analysis_consent_at TIMESTAMPTZ;

COMMENT ON COLUMN customer.credit_analysis_consent IS 'Optional consent for credit/AI risk analytics — gives JTC permission to feed firm data to credit-scoring models';
COMMENT ON COLUMN customer.credit_analysis_consent_at IS 'Timestamp the credit-analysis consent was given (or revoked)';
