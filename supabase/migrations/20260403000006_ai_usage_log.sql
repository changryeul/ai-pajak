-- AI Usage Log — Track token usage and cost per AI feature
CREATE TABLE ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    customer_id UUID,
    feature VARCHAR(50) NOT NULL, -- INVOICE_CLASSIFY, OCR_1721A1, TAX_SAVINGS, ANOMALY_CHECK, FILING_VALIDATE, CHAT, REPORT
    model VARCHAR(50) NOT NULL,   -- claude-sonnet-4-20250514, gpt-4o, etc.
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    duration_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_feature ON ai_usage_log(feature);
CREATE INDEX idx_ai_usage_user ON ai_usage_log(user_id);
CREATE INDEX idx_ai_usage_date ON ai_usage_log(created_at);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can read" ON ai_usage_log FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY "System can insert" ON ai_usage_log FOR INSERT TO authenticated WITH CHECK (TRUE);

COMMENT ON TABLE ai_usage_log IS 'Tracks AI API token usage and costs per feature for monitoring';
