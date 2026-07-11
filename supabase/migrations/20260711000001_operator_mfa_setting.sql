-- Operator 2FA enforcement toggle (docs/manuals/04-tax-operator.md §"2FA 필수"
-- 의 "정책 강제 예정" 이행). Track D 의 system_setting kv 패턴 재사용:
-- Read = all authenticated (RLS system_setting_read), Update = MASTER,
-- INSERT/DELETE 없음 (seed-only via migration).
--
-- Default OFF — master 가 /operator/settings 카드에서 켠다. 켜면
-- operator-tier(TAX_OPERATOR*) 계정은 TOTP 미등록 시 /settings?mfa=required
-- 로, 등록됐지만 세션이 aal1 이면 /login?mfa=challenge 로 강제된다.

INSERT INTO system_setting (key, value) VALUES
  ('security.operator_mfa_required', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- audit action (Track D 의 CORETAX_TOGGLE 패턴과 동일)
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'OPERATOR_MFA_TOGGLE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
