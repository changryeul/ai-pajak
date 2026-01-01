CREATE TABLE audit_logs (
  audit_id     BIGSERIAL PRIMARY KEY,
  tax_case_id  BIGINT REFERENCES tax_cases(tax_case_id),
  actor_id     BIGINT REFERENCES users(user_id),
  action       VARCHAR(50) NOT NULL,
  before_state JSONB,
  after_state  JSONB,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
  subscription_id BIGSERIAL PRIMARY KEY,
  account_id      BIGINT NOT NULL REFERENCES accounts(account_id),
  plan            plan_type NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE,
  status          VARCHAR(20) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
