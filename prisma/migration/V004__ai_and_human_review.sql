CREATE TABLE ai_results (
  ai_result_id  BIGSERIAL PRIMARY KEY,
  tax_case_id   BIGINT NOT NULL REFERENCES tax_cases(tax_case_id),
  model_version VARCHAR(50),
  suggested_tax tax_type NOT NULL,
  confidence    NUMERIC(5,2) NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  explanation   TEXT,
  raw_response  JSONB NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE human_reviews (
  review_id     BIGSERIAL PRIMARY KEY,
  tax_case_id   BIGINT NOT NULL REFERENCES tax_cases(tax_case_id),
  reviewer_id   BIGINT NOT NULL REFERENCES users(user_id),
  final_tax     tax_type NOT NULL,
  override_flag BOOLEAN NOT NULL,
  reason        TEXT NOT NULL,
  reviewed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
