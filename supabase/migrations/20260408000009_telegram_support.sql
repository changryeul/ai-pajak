-- Telegram Bot support
-- Customer can register their Telegram chat_id for notifications

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

COMMENT ON COLUMN customer.telegram_chat_id IS 'Telegram chat ID for bot notifications';
