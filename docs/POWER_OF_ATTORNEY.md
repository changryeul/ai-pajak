# Power of Attorney (POA) - Implementation Guide
**Version**: 1.0
**Date**: 2025-12-23
**Status**: Ready for Review

## Overview

The Power of Attorney (Surat Kuasa) feature establishes a legally-binding authorization between customers and Jakarta Tax Consulting, enabling tax consultants to act on behalf of customers when filing taxes with DJP (Direktorat Jenderal Pajak).

**Legal Requirement**: Under Indonesian tax law, tax consultants require explicit written authorization (Power of Attorney) to represent taxpayers before tax authorities.

## Database Schema

### Table: `power_of_attorney`

```sql
CREATE TABLE power_of_attorney (
    id UUID PRIMARY KEY,

    -- Parties
    customer_id UUID NOT NULL REFERENCES customer(id),
    tax_partner_id UUID NOT NULL REFERENCES tax_partner(id),

    -- POA Metadata
    poa_number VARCHAR(100) UNIQUE,  -- Auto: POA-2025-001234
    scope poa_scope NOT NULL,        -- ALL_TAX_TYPES | PPh21_ONLY | etc
    scope_details JSONB,             -- Custom scope

    -- Validity
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,

    -- Document
    document_url TEXT NOT NULL,      -- Signed PDF in Supabase Storage
    document_hash VARCHAR(64),       -- SHA-256 for integrity

    -- Status
    status poa_status,               -- DRAFT | ACTIVE | EXPIRED | REVOKED

    -- Customer Signature
    customer_signed_at TIMESTAMP,
    customer_signature_url TEXT,
    customer_ip_address INET,

    -- Tax Partner Signature
    tax_partner_signed_at TIMESTAMP,
    tax_partner_signed_by_user_id UUID,
    tax_partner_signature_url TEXT,

    -- Revocation
    revoked_at TIMESTAMP,
    revoked_by_user_id UUID,
    revocation_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Enums

```sql
-- POA Status Lifecycle
CREATE TYPE poa_status AS ENUM (
    'DRAFT',              -- Customer creating POA
    'PENDING_SIGNATURE',  -- Waiting for signatures
    'ACTIVE',             -- Both parties signed, within validity period
    'EXPIRED',            -- Past valid_to date
    'REVOKED',            -- Manually revoked by customer
    'REJECTED'            -- Rejected by tax partner
);

-- POA Scope (Authorization Level)
CREATE TYPE poa_scope AS ENUM (
    'ALL_TAX_TYPES',      -- Full authorization
    'PPh21_ONLY',         -- Only PPh 21 (Employee Tax)
    'PPh23_ONLY',         -- Only PPh 23 (Withholding Tax)
    'PPN_ONLY',           -- Only PPN (VAT)
    'SPT_TAHUNAN_ONLY',   -- Only Annual Tax Return
    'CUSTOM'              -- Custom scope defined in scope_details
);
```

## Workflow

### 1. Customer Creates POA

```typescript
// Frontend: Customer initiates POA
const createPOA = async () => {
  const { data, error } = await supabase
    .from('power_of_attorney')
    .insert({
      customer_id: currentCustomer.id,
      tax_partner_id: JTC_ID,
      scope: 'ALL_TAX_TYPES',
      valid_from: '2025-01-01',
      valid_to: '2025-12-31',
      status: 'DRAFT'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

**RLS Check**: Customer can only create POA for themselves
```sql
CREATE POLICY "Customers can create POAs"
ON power_of_attorney FOR INSERT
WITH CHECK (
    is_customer() AND
    customer_id = get_customer_id() AND
    status = 'DRAFT'
);
```

### 2. Customer Uploads & Signs POA Document

```typescript
// Upload POA document to Supabase Storage
const uploadPOADocument = async (poaId: string, file: File) => {
  // 1. Upload to Storage
  const filePath = `poa/${poaId}/${file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('legal-documents')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from('legal-documents')
    .getPublicUrl(filePath);

  // 3. Calculate hash for integrity
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const documentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 4. Update POA record
  const { data, error } = await supabase
    .from('power_of_attorney')
    .update({
      document_url: urlData.publicUrl,
      document_hash: documentHash,
      customer_signed_at: new Date().toISOString(),
      customer_ip_address: await getClientIP(),
      status: 'PENDING_SIGNATURE'
    })
    .eq('id', poaId)
    .select()
    .single();

  return data;
};
```

### 3. Tax Partner Reviews & Signs POA

```typescript
// Consultant reviews and signs POA
const signPOAAsConsultant = async (poaId: string, signatureUrl: string) => {
  const { data, error } = await supabase
    .from('power_of_attorney')
    .update({
      tax_partner_signed_at: new Date().toISOString(),
      tax_partner_signed_by_user_id: currentUser.id,
      tax_partner_signature_url: signatureUrl,
      status: 'ACTIVE'
    })
    .eq('id', poaId)
    .eq('status', 'PENDING_SIGNATURE')
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

**RLS Check**: Only JTC consultants can sign for tax partner
```sql
CREATE POLICY "JTC consultants can update POAs"
ON power_of_attorney FOR UPDATE
USING (
    is_jtc_consultant() AND
    tax_partner_id = get_user_organization_id()
);
```

### 4. POA Becomes Active

**Automatic Status Check** (via constraint):
```sql
CONSTRAINT active_requires_signatures CHECK (
    status != 'ACTIVE' OR
    (customer_signed_at IS NOT NULL AND tax_partner_signed_at IS NOT NULL)
);
```

**Validity Period Check**:
- POA is only ACTIVE if `CURRENT_DATE BETWEEN valid_from AND valid_to`
- Daily cron job expires POAs past `valid_to` date

### 5. Tax Filing References POA

```typescript
// Create tax filing with POA reference
const createTaxFiling = async (customerId: string, consultantId: string) => {
  // 1. Get active POA
  const { data: poa } = await supabase
    .from('power_of_attorney')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE')
    .gte('valid_to', new Date().toISOString())
    .single();

  if (!poa) {
    throw new Error('No active Power of Attorney found. Customer must authorize tax partner first.');
  }

  // 2. Create tax filing
  const { data, error } = await supabase
    .from('tax_filing')
    .insert({
      customer_id: customerId,
      consultant_id: consultantId,
      power_of_attorney_id: poa.id,
      tax_type: 'PPh21',
      tax_period: '2025-01',
      status: 'DRAFT'
    })
    .select()
    .single();

  return data;
};
```

**Database Validation Trigger**:
```sql
CREATE TRIGGER validate_tax_filing_poa_trigger
BEFORE INSERT OR UPDATE ON tax_filing
FOR EACH ROW EXECUTE FUNCTION validate_tax_filing_poa();

-- Function checks:
-- 1. If status is FILED or UNDER_REVIEW
-- 2. Active POA exists for customer + tax_partner
-- 3. POA scope covers the tax_type
-- 4. POA is within valid date range
```

### 6. POA Expiration (Automatic)

```typescript
// Daily cron job (or application scheduler)
const expirePOAs = async () => {
  const { data, error } = await supabase.rpc('update_poa_status');

  console.log(`Expired ${data} POAs`);
};

// Schedule: Every day at midnight
// cron.schedule('0 0 * * *', expirePOAs);
```

**Database Function**:
```sql
CREATE OR REPLACE FUNCTION update_poa_status()
RETURNS void AS $$
BEGIN
    UPDATE power_of_attorney
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE status = 'ACTIVE'
    AND valid_to < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
```

### 7. POA Revocation (Manual)

```typescript
// Customer revokes POA
const revokePOA = async (poaId: string, reason: string) => {
  const { data, error } = await supabase
    .from('power_of_attorney')
    .update({
      status: 'REVOKED',
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: currentUser.id,
      revocation_reason: reason
    })
    .eq('id', poaId)
    .eq('customer_id', currentCustomer.id)
    .eq('status', 'ACTIVE')
    .select()
    .single();

  if (error) throw error;

  // Note: Revocation creates audit trail automatically via trigger
  return data;
};
```

**RLS Check**: Customer can revoke own POA
```sql
CREATE POLICY "Customers can revoke POAs"
ON power_of_attorney FOR UPDATE
USING (
    is_customer() AND
    customer_id = get_customer_id() AND
    status = 'ACTIVE'
)
WITH CHECK (
    status = 'REVOKED' AND
    revoked_by_user_id = auth.uid()
);
```

## Helper Functions

### Check Active POA

```sql
-- Usage: SELECT has_active_poa(customer_id, tax_partner_id, tax_type, filing_date);
CREATE FUNCTION has_active_poa(
    p_customer_id UUID,
    p_tax_partner_id UUID,
    p_tax_type tax_type,
    p_filing_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_poa BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM power_of_attorney
        WHERE customer_id = p_customer_id
        AND tax_partner_id = p_tax_partner_id
        AND status = 'ACTIVE'
        AND p_filing_date BETWEEN valid_from AND valid_to
        AND (
            scope = 'ALL_TAX_TYPES'
            OR (scope = 'PPh21_ONLY' AND p_tax_type = 'PPh21')
            OR (scope = 'PPh23_ONLY' AND p_tax_type = 'PPh23')
            OR (scope = 'PPN_ONLY' AND p_tax_type = 'PPN')
            OR (scope = 'SPT_TAHUNAN_ONLY' AND p_tax_type = 'SPT_TAHUNAN')
            OR scope = 'CUSTOM'
        )
    ) INTO v_has_poa;

    RETURN v_has_poa;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

## Audit Trail Integration

All POA activities are automatically logged:

```sql
CREATE TRIGGER poa_audit_trigger
AFTER INSERT OR UPDATE ON power_of_attorney
FOR EACH ROW EXECUTE FUNCTION log_poa_activity();
```

**Activity Types**:
- `POA_CREATED` - Customer creates new POA
- `POA_SIGNED` - Customer or tax partner signs POA
- `POA_ACTIVATED` - POA status changes to ACTIVE
- `POA_REVOKED` - Customer revokes POA

**Query POA History**:
```sql
SELECT
    tal.*,
    u.email as actor_email,
    poa.poa_number,
    poa.valid_from,
    poa.valid_to
FROM tax_activity_log tal
JOIN auth.users u ON tal.actor_user_id = u.id
JOIN power_of_attorney poa ON (tal.activity_details->>'poa_id')::uuid = poa.id
WHERE tal.customer_id = '<customer_id>'
AND tal.activity_type IN ('POA_CREATED', 'POA_SIGNED', 'POA_ACTIVATED', 'POA_REVOKED')
ORDER BY tal.created_at DESC;
```

## RLS Policies Summary

| User Role | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| CUSTOMER | Own POAs | Own (DRAFT) | Own (DRAFT/sign/revoke) | No |
| CONSULTANT_JTC | Partner POAs | No | Partner POAs (sign) | No |
| TAX_ADVISOR_JTC | Partner POAs | No | Partner POAs (sign) | No |
| PLATFORM_ADMIN | All (view only) | No | No | No |
| SYSTEM | No | No | No | No |

## Common Queries

### Get Customer's Active POAs
```sql
SELECT
    poa.*,
    tp.name as tax_partner_name,
    c.full_name as customer_name
FROM power_of_attorney poa
JOIN tax_partner tp ON poa.tax_partner_id = tp.id
JOIN customer c ON poa.customer_id = c.id
WHERE poa.customer_id = '<customer_id>'
AND poa.status = 'ACTIVE'
AND CURRENT_DATE BETWEEN poa.valid_from AND poa.valid_to;
```

### Get POAs Expiring Soon (within 30 days)
```sql
SELECT
    poa.*,
    c.full_name,
    c.email,
    poa.valid_to - CURRENT_DATE as days_remaining
FROM power_of_attorney poa
JOIN customer c ON poa.customer_id = c.id
WHERE poa.status = 'ACTIVE'
AND poa.valid_to BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY poa.valid_to ASC;
```

### POA Coverage Report
```sql
SELECT
    COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_poas,
    COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired_poas,
    COUNT(*) FILTER (WHERE status = 'REVOKED') as revoked_poas,
    COUNT(*) FILTER (WHERE status = 'DRAFT') as draft_poas,
    COUNT(*) as total_poas
FROM power_of_attorney
WHERE tax_partner_id = '<tax_partner_id>';
```

## UI/UX Considerations

### Customer Dashboard
- **POA Status Card**: Show active POA with validity dates
- **Expiration Warning**: Alert 30 days before expiry
- **Quick Actions**: Renew POA, Revoke POA, View Document

### Consultant Dashboard
- **Pending POA Signatures**: List POAs waiting for signature
- **Customer Authorization Status**: Check if customer has valid POA before starting work
- **POA Expiry Calendar**: Visual calendar of expiring POAs

### Tax Filing Form
- **POA Validation**: Check active POA before allowing FILED status
- **Error Message**: "You must authorize Jakarta Tax Consulting via Power of Attorney before filing."
- **Quick Link**: "Create Power of Attorney Now"

## Security Considerations

1. **Document Integrity**: SHA-256 hash prevents document tampering
2. **IP Address Logging**: Track customer IP when signing for legal evidence
3. **Signature Timestamps**: Immutable record of when each party signed
4. **Revocation Trail**: Cannot delete revoked POAs (audit requirement)
5. **RLS Enforcement**: Database-level access control prevents unauthorized access

## Testing Checklist

- [ ] Customer can create POA in DRAFT status
- [ ] Customer can upload and sign POA document
- [ ] Consultant can sign POA on behalf of tax partner
- [ ] POA becomes ACTIVE only after both signatures
- [ ] Tax filing blocked if no active POA exists
- [ ] POA automatically expires after valid_to date
- [ ] Customer can revoke POA with reason
- [ ] Audit trail created for all POA activities
- [ ] RLS policies prevent unauthorized access
- [ ] Document hash validation works correctly

## Legal Compliance

### Indonesian Tax Law Requirements
- **Surat Kuasa**: Written authorization required for tax representation
- **Validity Period**: POA must specify start and end dates
- **Revocability**: Customer can revoke authorization at any time
- **Signatures**: Both parties must sign the POA
- **Record Keeping**: POA must be retained for audit purposes

### Data Privacy (GDPR/Indonesian DPP)
- **Consent**: POA establishes explicit consent for data processing
- **Purpose Limitation**: POA scope limits authorization to specific tax types
- **Right to Withdraw**: Customer can revoke POA (withdraw consent)
- **Audit Trail**: All access to customer data logged via POA reference

## Next Steps

1. **Legal Review**: Have POA template reviewed by legal team
2. **Digital Signature**: Integrate with e-signature provider (e.g., Privy, Dokobit)
3. **Notification System**: Email alerts for POA expiration
4. **Renewal Workflow**: Streamlined POA renewal process
5. **Mobile Support**: POA signing via mobile app
6. **DJP Integration**: Submit POA to DJP for official registration

## References

- [DATABASE_DESIGN.md](DATABASE_DESIGN.md) - Complete database schema
- [LEGAL_STRUCTURE.md](LEGAL_STRUCTURE.md) - Legal framework
- [20251223000004_power_of_attorney.sql](../supabase/migrations/20251223000004_power_of_attorney.sql) - Migration file
- Indonesian Tax Law: Peraturan Menteri Keuangan tentang Konsultan Pajak
