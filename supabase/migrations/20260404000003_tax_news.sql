-- Tax news articles with AI summary
CREATE TABLE IF NOT EXISTS tax_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL, -- 'DJP', 'KONTAN', 'BISNIS_INDONESIA', 'MANUAL'
    source_url TEXT,
    original_title TEXT NOT NULL,
    original_content TEXT,
    -- AI processed
    summary_id TEXT, -- Indonesian summary (3 lines)
    summary_ko TEXT, -- Korean translation
    summary_en TEXT, -- English translation
    impact_analysis TEXT, -- "How this affects our customers"
    -- Classification
    category VARCHAR(50) NOT NULL, -- PPh21, PPh23, PPN, UMKM, TP, GENERAL, REGULATION
    tags TEXT[] DEFAULT '{}',
    regulation_number VARCHAR(100), -- e.g., 'PMK 123/PMK.03/2026'
    importance VARCHAR(20) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, CRITICAL
    -- Status
    published_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    wa_notified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_news_category ON tax_news(category);
CREATE INDEX IF NOT EXISTS idx_tax_news_published ON tax_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_tax_news_importance ON tax_news(importance);
CREATE INDEX IF NOT EXISTS idx_tax_news_active ON tax_news(is_active, published_at DESC);

-- Enable RLS
ALTER TABLE tax_news ENABLE ROW LEVEL SECURITY;

-- Everyone can read published news
DROP POLICY IF EXISTS "Anyone can read active tax news" ON tax_news;
CREATE POLICY "Anyone can read active tax news"
ON tax_news FOR SELECT
TO authenticated
USING (is_active = true);

-- Only admin can manage news
DROP POLICY IF EXISTS "Admin can manage tax news" ON tax_news;
CREATE POLICY "Admin can manage tax news"
ON tax_news FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

-- Auto-update timestamp
DROP TRIGGER IF EXISTS update_tax_news_updated_at ON tax_news;
CREATE TRIGGER update_tax_news_updated_at
BEFORE UPDATE ON tax_news
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
