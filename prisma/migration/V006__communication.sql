CREATE TABLE communications (
  communication_id BIGSERIAL PRIMARY KEY,
  tax_case_id      BIGINT REFERENCES tax_cases(tax_case_id),
  sender_type      sender_type NOT NULL,
  sender_id        BIGINT REFERENCES users(user_id),
  message          TEXT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);