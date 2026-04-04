-- Add phone number and WhatsApp preferences for customer notifications

-- Customer phone number (used for WhatsApp)
ALTER TABLE customer ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
COMMENT ON COLUMN customer.phone_number IS 'Indonesian phone number for WhatsApp (08xxx or 62xxx)';

-- WhatsApp opt-in preference
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);
COMMENT ON COLUMN notification_preferences.whatsapp_enabled IS 'User opted in for WhatsApp notifications';

-- WhatsApp message log for tracking delivery
CREATE TABLE IF NOT EXISTS whatsapp_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customer(id),
    user_id UUID REFERENCES auth.users(id),
    message_type VARCHAR(50) NOT NULL, -- DEADLINE_REMINDER, PAYMENT_REMINDER, FILING_COMPLETE, SAVINGS_REPORT
    phone_number VARCHAR(20) NOT NULL,
    message_text TEXT NOT NULL,
    provider_message_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'SENT', -- SENT, DELIVERED, FAILED
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wa_log_customer ON whatsapp_message_log(customer_id);
CREATE INDEX idx_wa_log_created ON whatsapp_message_log(created_at DESC);
CREATE INDEX idx_wa_log_type ON whatsapp_message_log(message_type, created_at DESC);

-- Enable RLS
ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- Customers can view their own message log
CREATE POLICY "Customers can view own WhatsApp logs"
ON whatsapp_message_log FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

-- Service role can insert (via admin client)
CREATE POLICY "Block platform admins from WhatsApp logs"
ON whatsapp_message_log FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());
