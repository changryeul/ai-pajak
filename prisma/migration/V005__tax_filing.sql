CREATE TABLE tax_filings (
  filing_id       BIGSERIAL PRIMARY KEY,
  tax_case_id     BIGINT NOT NULL REFERENCES tax_cases(tax_case_id),
  filing_status   filing_status NOT NULL,
  filed_by        BIGINT REFERENCES users(user_id),
  filed_at        TIMESTAMP,
  submission_ref  VARCHAR(100),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);