CREATE TABLE users (
  user_id     BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  role        user_role NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
  account_id   BIGSERIAL PRIMARY KEY,
  account_name VARCHAR(255) NOT NULL,
  plan         plan_type NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE companies (
  company_id      BIGSERIAL PRIMARY KEY,
  account_id      BIGINT NOT NULL REFERENCES accounts(account_id),
  company_name    VARCHAR(255) NOT NULL,
  npwp            VARCHAR(50) NOT NULL UNIQUE,
  industry_code   VARCHAR(50),
  vat_registered  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);