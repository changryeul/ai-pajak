-- Customer Notes table for CRM functionality
CREATE TABLE IF NOT EXISTS customer_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id),
    author_role TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_customer_note_customer_id ON customer_note(customer_id);
CREATE INDEX idx_customer_note_created_at ON customer_note(customer_id, created_at DESC);

-- RLS
ALTER TABLE customer_note ENABLE ROW LEVEL SECURITY;

-- Consultants and tax advisors can read/write notes for their assigned customers
CREATE POLICY "Consultants can manage notes for assigned customers"
    ON customer_note
    FOR ALL
    USING (
        author_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM customer_consultant cc
            JOIN consultant c ON c.id = cc.consultant_id
            WHERE cc.customer_id = customer_note.customer_id
            AND c.user_id = auth.uid()
            AND cc.is_active = true
        )
    );

-- Customers can read their own notes
CREATE POLICY "Customers can read own notes"
    ON customer_note
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM customer cu
            WHERE cu.id = customer_note.customer_id
            AND cu.user_id = auth.uid()
        )
    );
