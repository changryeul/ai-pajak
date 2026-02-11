-- Migration: Notification System Tables
-- Created: 2024-02-11
-- Description: Add notification and notification_preferences tables for in-app notifications

-- Notification type enum
CREATE TYPE notification_type AS ENUM (
  'DEADLINE_REMINDER',
  'FILING_STATUS',
  'POA_STATUS',
  'DOCUMENT_PROCESSED',
  'PAYMENT_DUE',
  'PAYMENT_RECEIVED',
  'SYSTEM_ANNOUNCEMENT'
);

-- Notification channel enum
CREATE TYPE notification_channel AS ENUM (
  'EMAIL',
  'IN_APP',
  'PUSH'
);

-- Notification priority enum
CREATE TYPE notification_priority AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW'
);

-- Notification table
CREATE TABLE IF NOT EXISTS notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'MEDIUM',
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  channels notification_channel[] NOT NULL DEFAULT ARRAY['IN_APP']::notification_channel[],
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  deadline_reminders boolean NOT NULL DEFAULT true,
  filing_updates boolean NOT NULL DEFAULT true,
  payment_reminders boolean NOT NULL DEFAULT true,
  marketing_emails boolean NOT NULL DEFAULT false,
  reminder_days_before integer[] NOT NULL DEFAULT ARRAY[30, 14, 7, 1],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for notification table
CREATE INDEX idx_notification_user_id ON notification(user_id);
CREATE INDEX idx_notification_user_read ON notification(user_id, read);
CREATE INDEX idx_notification_user_created ON notification(user_id, created_at DESC);
CREATE INDEX idx_notification_type ON notification(type);
CREATE INDEX idx_notification_expires ON notification(expires_at) WHERE expires_at IS NOT NULL;

-- Index for preferences lookup
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_updated_at
  BEFORE UPDATE ON notification
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_updated_at();

-- RLS Policies for notification table
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notification FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON notification FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notification FOR DELETE
  USING (auth.uid() = user_id);

-- System/Service role can create notifications for any user
CREATE POLICY "Service role can create notifications"
  ON notification FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'SYSTEM'
    )
    OR current_setting('role', true) = 'service_role'
  );

-- RLS Policies for notification_preferences table
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can create own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notification;

-- Grant permissions
GRANT ALL ON notification TO authenticated;
GRANT ALL ON notification_preferences TO authenticated;
GRANT ALL ON notification TO service_role;
GRANT ALL ON notification_preferences TO service_role;

-- Comments
COMMENT ON TABLE notification IS 'User notifications for in-app, email, and push channels';
COMMENT ON TABLE notification_preferences IS 'User preferences for notification delivery';
COMMENT ON COLUMN notification.data IS 'Additional data specific to notification type (JSON)';
COMMENT ON COLUMN notification.channels IS 'Delivery channels for this notification';
COMMENT ON COLUMN notification_preferences.reminder_days_before IS 'Days before deadline to send reminders';
