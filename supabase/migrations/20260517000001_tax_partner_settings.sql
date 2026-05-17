-- Adds a JSONB settings column to tax_partner so the supervisor 설정 페이지
-- (PDF p.36-38) can persist approval-step toggles + notification-channel
-- toggles + Coretax security overrides per tax-partner.
--
-- Shape (all keys optional; the API merges with DEFAULT_* in the handler):
--   {
--     "approval": {
--       "requireSupervisorApproval": true,
--       "allowRevisionAfterReject": true,
--       "autoAdvanceToBilling": true,
--       "slaMaxReviewDays": 2,
--       "slaReminderHours": 12
--     },
--     "channels": {
--       "whatsApp": true, "email": true, "telegram": false,
--       "approvalPending": true, "deadlineNearing": true,
--       "idBillingNtpn": true, "revisionResubmit": true, "legalityExpiry": true
--     }
--   }

ALTER TABLE tax_partner
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tax_partner.settings IS
  'Per-tax-partner ERP overrides for the supervisor settings page (approval + channels). Empty JSON means use system defaults.';
