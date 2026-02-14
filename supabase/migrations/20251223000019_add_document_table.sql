-- Add document table for standalone documents (not tied to tax filing)
-- This includes POA drafts, identity documents, company documents, etc.

-- Document type enum for standalone documents
CREATE TYPE document_category AS ENUM (
    'POA_DRAFT',
    'IDENTITY',
    'COMPANY',
    'TAX_REGISTRATION',
    'BANK_STATEMENT',
    'OTHER'
);

CREATE TABLE document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    document_type document_category NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT, -- Signed URL or public URL
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_document_customer ON document(customer_id);
CREATE INDEX idx_document_uploader ON document(uploaded_by_user_id);
CREATE INDEX idx_document_type ON document(document_type);
CREATE INDEX idx_document_created ON document(created_at DESC);

-- Enable RLS
ALTER TABLE document ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Block platform admins from accessing documents (they contain PII)
CREATE POLICY "Block platform admins from documents"
ON document FOR ALL
TO authenticated
USING (NOT is_platform_admin())
WITH CHECK (NOT is_platform_admin());

-- Customers can view their own documents
CREATE POLICY "Customers can view own documents"
ON document FOR SELECT
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- Customers can upload their own documents
CREATE POLICY "Customers can upload own documents"
ON document FOR INSERT
TO authenticated
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id() AND
    uploaded_by_user_id = auth.uid()
);

-- Customers can delete their own documents
CREATE POLICY "Customers can delete own documents"
ON document FOR DELETE
TO authenticated
USING (
    is_customer() AND
    customer_id = get_customer_id()
);

-- JTC consultants can view documents for assigned customers
CREATE POLICY "JTC consultants can view assigned documents"
ON document FOR SELECT
TO authenticated
USING (
    is_jtc_consultant() AND
    customer_id IN (
        SELECT customer_id
        FROM customer_consultant
        WHERE consultant_id = get_consultant_id()
        AND is_active = true
    )
);

-- JTC consultants can upload documents for assigned customers
CREATE POLICY "JTC consultants can upload documents"
ON document FOR INSERT
TO authenticated
WITH CHECK (
    is_jtc_consultant() AND
    uploaded_by_user_id = auth.uid() AND
    customer_id IN (
        SELECT customer_id
        FROM customer_consultant
        WHERE consultant_id = get_consultant_id()
        AND is_active = true
    )
);

-- Auto-update updated_at
CREATE TRIGGER update_document_updated_at
BEFORE UPDATE ON document
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE document IS 'Standalone documents not tied to tax filing (POA drafts, identity docs, etc.)';
