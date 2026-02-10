# Customer (Client) Management API

## Overview
The Customer API provides endpoints for managing client companies and their information. Clients are the businesses whose tax compliance is being managed through the AI-Pajak platform.

**Base Path:** `/v1/clients`

---

## Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/clients` | Create new client |
| GET | `/clients` | List clients |
| GET | `/clients/{id}` | Get client details |
| PATCH | `/clients/{id}` | Update client |
| DELETE | `/clients/{id}` | Delete client |
| GET | `/clients/{id}/filings` | Get client's tax filings |
| GET | `/clients/{id}/documents` | Get client's documents |
| GET | `/clients/{id}/contacts` | Get client contacts |
| POST | `/clients/{id}/contacts` | Add client contact |
| GET | `/clients/{id}/timeline` | Get client activity timeline |
| POST | `/clients/bulk` | Bulk create clients |
| POST | `/clients/{id}/verify-npwp` | Verify NPWP with DJP |

---

## Data Models

### Client Object

```json
{
  "id": "client_123abc",
  "name": "PT Maju Jaya",
  "npwp": "01.234.567.8-901.000",
  "business_type": "PT",
  "industry": "Manufacturing",
  "address": {
    "street": "Jl. Sudirman No. 123",
    "city": "Jakarta Selatan",
    "province": "DKI Jakarta",
    "postal_code": "12190",
    "country": "Indonesia"
  },
  "contact": {
    "phone": "+62-21-5555-1234",
    "email": "admin@majujaya.co.id",
    "website": "https://www.majujaya.co.id"
  },
  "tax_info": {
    "npwp": "01.234.567.8-901.000",
    "npwp_verified": true,
    "verified_at": "2025-12-23T10:00:00Z",
    "pkp_status": "PKP",
    "pkp_number": "PKP-123456",
    "tax_office": "KPP Pratama Jakarta Kebayoran Baru Satu"
  },
  "billing_info": {
    "billing_email": "finance@majujaya.co.id",
    "billing_contact": "Budi Hartono",
    "payment_terms": "net_30"
  },
  "assigned_consultant": "user_789ghi",
  "consultant": {
    "id": "user_789ghi",
    "name": "Siti Wijaya",
    "email": "siti@taxconsultant.com"
  },
  "assigned_accountant": "user_456def",
  "accountant": {
    "id": "user_456def",
    "name": "Ahmad Rahman",
    "email": "ahmad@taxconsultant.com"
  },
  "status": "active",
  "onboarding_status": "completed",
  "risk_level": "low",
  "tags": ["manufacturing", "high-value", "automated-filing"],
  "custom_fields": {
    "company_size": "medium",
    "annual_revenue": "10B-50B"
  },
  "preferences": {
    "communication_channel": "email",
    "language": "id-ID",
    "timezone": "Asia/Jakarta"
  },
  "statistics": {
    "total_filings": 48,
    "pending_filings": 2,
    "completed_filings": 46,
    "total_tax_paid": 1250000000,
    "documents_uploaded": 156
  },
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-12-23T10:00:00Z",
  "created_by": "user_789ghi",
  "updated_by": "user_789ghi"
}
```

### Business Types

| Code | Name | Description |
|------|------|-------------|
| `PT` | Perseroan Terbatas | Limited Liability Company |
| `CV` | Commanditaire Vennootschap | Limited Partnership |
| `UD` | Usaha Dagang | Sole Proprietorship |
| `Firma` | Firma | General Partnership |
| `Koperasi` | Koperasi | Cooperative |
| `Yayasan` | Yayasan | Foundation |

### Client Status

- `active` - Active client, normal operations
- `inactive` - Inactive but not deleted
- `suspended` - Temporarily suspended
- `pending` - Pending approval/verification
- `archived` - Archived (no longer active)

### Onboarding Status

- `pending` - Initial creation
- `documents_required` - Awaiting documents
- `verification` - Verifying information
- `completed` - Onboarding complete
- `failed` - Onboarding failed

---

## Create Client

**Endpoint:** `POST /v1/clients`

**Permission:** `clients:write`

**Request:**
```json
{
  "name": "PT Maju Jaya",
  "npwp": "01.234.567.8-901.000",
  "business_type": "PT",
  "industry": "Manufacturing",
  "address": {
    "street": "Jl. Sudirman No. 123",
    "city": "Jakarta Selatan",
    "province": "DKI Jakarta",
    "postal_code": "12190"
  },
  "contact": {
    "phone": "+62-21-5555-1234",
    "email": "admin@majujaya.co.id"
  },
  "assigned_consultant": "user_789ghi",
  "assigned_accountant": "user_456def"
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "client_123abc",
    "name": "PT Maju Jaya",
    "npwp": "01.234.567.8-901.000",
    "status": "pending",
    "onboarding_status": "documents_required",
    "created_at": "2025-12-23T10:00:00Z",
    "next_steps": [
      "Upload company registration documents",
      "Verify NPWP with DJP",
      "Complete tax information"
    ]
  }
}
```

**Validation:**
- `name` - Required, 2-100 characters
- `npwp` - Required, valid NPWP format (XX.XXX.XXX.X-XXX.XXX)
- `business_type` - Required, valid type code
- `email` - Valid email format
- `phone` - Valid Indonesian phone number

**NPWP Validation:**
- Format check: 15 digits in correct pattern
- Check digit validation (Luhn algorithm)
- Optional: Real-time verification with DJP API

---

## List Clients

**Endpoint:** `GET /v1/clients`

**Permission:** `clients:read`

**Query Parameters:**
```
page=1
per_page=20
status=active
business_type=PT
industry=Manufacturing
assigned_consultant=user_789ghi
assigned_accountant=user_456def
search=Maju Jaya
sort=-created_at
expand=consultant,accountant
tags=high-value,automated-filing
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "client_123abc",
      "name": "PT Maju Jaya",
      "npwp": "01.234.567.8-901.000",
      "business_type": "PT",
      "industry": "Manufacturing",
      "status": "active",
      "consultant": {
        "id": "user_789ghi",
        "name": "Siti Wijaya"
      },
      "statistics": {
        "total_filings": 48,
        "pending_filings": 2
      },
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "total_pages": 8
  }
}
```

**Search:**
Searches across:
- Client name
- NPWP
- Email
- Phone
- Address

---

## Get Client Details

**Endpoint:** `GET /v1/clients/{id}`

**Permission:** `clients:read`

**Query Parameters:**
```
expand=consultant,accountant,statistics
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "client_123abc",
    "name": "PT Maju Jaya",
    "npwp": "01.234.567.8-901.000",
    "business_type": "PT",
    "industry": "Manufacturing",
    "address": {...},
    "contact": {...},
    "tax_info": {
      "npwp_verified": true,
      "verified_at": "2025-12-23T10:00:00Z",
      "pkp_status": "PKP"
    },
    "consultant": {...},
    "accountant": {...},
    "statistics": {
      "total_filings": 48,
      "pending_filings": 2,
      "total_tax_paid": 1250000000
    },
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-12-23T10:00:00Z"
  }
}
```

---

## Update Client

**Endpoint:** `PATCH /v1/clients/{id}`

**Permission:** `clients:write`

**Request:**
```json
{
  "contact": {
    "phone": "+62-21-5555-5678",
    "email": "newadmin@majujaya.co.id"
  },
  "assigned_accountant": "user_999zzz",
  "tags": ["manufacturing", "high-value", "automated-filing", "priority"],
  "status": "active"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "client_123abc",
    "contact": {
      "phone": "+62-21-5555-5678",
      "email": "newadmin@majujaya.co.id"
    },
    "assigned_accountant": "user_999zzz",
    "tags": ["manufacturing", "high-value", "automated-filing", "priority"],
    "updated_at": "2025-12-23T10:30:00Z"
  }
}
```

**Restrictions:**
- Cannot change NPWP once verified
- Status changes may require additional validation
- Reassignment may trigger notifications

---

## Delete Client

**Endpoint:** `DELETE /v1/clients/{id}`

**Permission:** `clients:delete`

**Query Parameters:**
```
permanent=false
```

**Response: 204 No Content**

**Soft Delete (default):**
- Client archived, not permanently deleted
- Historical data retained
- Can be restored

**Permanent Delete:**
```
DELETE /v1/clients/{id}?permanent=true
```

**Business Rules:**
- Cannot delete if active filings exist
- Must archive or transfer filings first
- Deletion logged in audit trail
- GDPR compliance: Personal data anonymized after 90 days

**Error: 409 Conflict**
```json
{
  "success": false,
  "error": {
    "code": "CLIENT_HAS_ACTIVE_FILINGS",
    "message": "Cannot delete client with active tax filings. Archive or complete filings first.",
    "details": {
      "active_filings": 2,
      "filing_ids": ["filing_123", "filing_456"]
    }
  }
}
```

---

## Get Client's Tax Filings

**Endpoint:** `GET /v1/clients/{id}/filings`

**Permission:** `clients:read`, `filings:read`

**Query Parameters:**
```
status=pending,in_review
tax_type=PPh21
period=2025-12
sort=-created_at
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "filing_123",
      "tax_type": "PPh21",
      "period": "2025-12",
      "status": "pending",
      "due_date": "2026-01-20",
      "tax_amount": 62500000,
      "created_at": "2025-12-01T10:00:00Z"
    }
  ],
  "meta": {
    "total": 48,
    "by_status": {
      "draft": 1,
      "pending": 1,
      "completed": 46
    },
    "total_tax_amount": 1250000000
  }
}
```

---

## Get Client's Documents

**Endpoint:** `GET /v1/clients/{id}/documents`

**Permission:** `clients:read`, `documents:read`

**Query Parameters:**
```
type=company_registration,npwp_card
status=verified
sort=-uploaded_at
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_111",
      "type": "company_registration",
      "name": "Akta Pendirian PT Maju Jaya.pdf",
      "size": 2457600,
      "status": "verified",
      "url": "https://docs.ai-pajak.com/doc_111",
      "uploaded_at": "2025-01-15T10:00:00Z"
    },
    {
      "id": "doc_222",
      "type": "npwp_card",
      "name": "NPWP Card.pdf",
      "size": 524288,
      "status": "verified",
      "url": "https://docs.ai-pajak.com/doc_222",
      "uploaded_at": "2025-01-15T10:05:00Z"
    }
  ]
}
```

---

## Get Client Contacts

**Endpoint:** `GET /v1/clients/{id}/contacts`

**Permission:** `clients:read`

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "contact_111",
      "client_id": "client_123abc",
      "name": "Budi Hartono",
      "role": "Finance Director",
      "email": "budi.hartono@majujaya.co.id",
      "phone": "+62-812-3456-7890",
      "is_primary": true,
      "receives_notifications": true,
      "created_at": "2025-01-15T10:00:00Z"
    },
    {
      "id": "contact_222",
      "name": "Siska Amelia",
      "role": "Accounting Manager",
      "email": "siska@majujaya.co.id",
      "phone": "+62-813-5555-1234",
      "is_primary": false,
      "receives_notifications": true,
      "created_at": "2025-02-01T14:00:00Z"
    }
  ]
}
```

---

## Add Client Contact

**Endpoint:** `POST /v1/clients/{id}/contacts`

**Permission:** `clients:write`

**Request:**
```json
{
  "name": "Dewi Susanti",
  "role": "Tax Manager",
  "email": "dewi@majujaya.co.id",
  "phone": "+62-815-9999-8888",
  "is_primary": false,
  "receives_notifications": true
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "contact_333",
    "client_id": "client_123abc",
    "name": "Dewi Susanti",
    "role": "Tax Manager",
    "email": "dewi@majujaya.co.id",
    "phone": "+62-815-9999-8888",
    "is_primary": false,
    "receives_notifications": true,
    "created_at": "2025-12-23T10:00:00Z"
  }
}
```

---

## Get Client Timeline

**Endpoint:** `GET /v1/clients/{id}/timeline`

**Permission:** `clients:read`

**Query Parameters:**
```
limit=50
before=2025-12-23T10:00:00Z
types=filing,document,communication
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "event_999",
      "type": "filing_created",
      "title": "New tax filing created",
      "description": "PPh 21 filing for December 2025",
      "related_object": {
        "type": "tax_filing",
        "id": "filing_123",
        "link": "/v1/tax-filings/filing_123"
      },
      "user": {
        "id": "user_789ghi",
        "name": "Siti Wijaya"
      },
      "timestamp": "2025-12-01T10:00:00Z"
    },
    {
      "id": "event_998",
      "type": "document_uploaded",
      "title": "Document uploaded",
      "description": "Financial statement for December 2025",
      "related_object": {
        "type": "document",
        "id": "doc_333"
      },
      "user": {
        "id": "contact_111",
        "name": "Budi Hartono"
      },
      "timestamp": "2025-12-15T14:30:00Z"
    },
    {
      "id": "event_997",
      "type": "communication",
      "title": "Message sent",
      "description": "When will the December filing be ready?",
      "related_object": {
        "type": "message",
        "id": "msg_555"
      },
      "user": {
        "id": "contact_111",
        "name": "Budi Hartono"
      },
      "timestamp": "2025-12-20T09:15:00Z"
    }
  ],
  "meta": {
    "has_more": true,
    "next_cursor": "2025-12-01T10:00:00Z"
  }
}
```

---

## Verify NPWP

**Endpoint:** `POST /v1/clients/{id}/verify-npwp`

**Permission:** `clients:write`

**Request:**
```json
{
  "npwp": "01.234.567.8-901.000"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "npwp": "01.234.567.8-901.000",
    "verified": true,
    "verification_source": "DJP API",
    "company_name": "PT MAJU JAYA",
    "pkp_status": "PKP",
    "tax_office": "KPP Pratama Jakarta Kebayoran Baru Satu",
    "verified_at": "2025-12-23T10:00:00Z",
    "details": {
      "registration_date": "2020-01-15",
      "status": "active"
    }
  }
}
```

**Error: Verification Failed**
```json
{
  "success": false,
  "error": {
    "code": "NPWP_VERIFICATION_FAILED",
    "message": "NPWP not found in DJP database",
    "details": {
      "npwp": "01.234.567.8-901.000",
      "reason": "not_registered"
    }
  }
}
```

---

## Bulk Create Clients

**Endpoint:** `POST /v1/clients/bulk`

**Permission:** `clients:write`

**Request:**
```json
{
  "clients": [
    {
      "name": "PT Client One",
      "npwp": "01.111.111.1-111.111",
      "business_type": "PT",
      "contact": {...}
    },
    {
      "name": "CV Client Two",
      "npwp": "02.222.222.2-222.222",
      "business_type": "CV",
      "contact": {...}
    }
  ],
  "skip_verification": false,
  "assigned_consultant": "user_789ghi"
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 0,
    "results": [
      {
        "id": "client_111",
        "name": "PT Client One",
        "status": "created",
        "index": 0
      },
      {
        "id": "client_222",
        "name": "CV Client Two",
        "status": "created",
        "index": 1
      }
    ]
  }
}
```

**Partial Success:**
```json
{
  "success": true,
  "data": {
    "created": 1,
    "failed": 1,
    "results": [
      {
        "id": "client_111",
        "status": "created"
      },
      {
        "status": "failed",
        "error": "Duplicate NPWP",
        "index": 1
      }
    ]
  }
}
```

---

## Client Statistics

**Endpoint:** `GET /v1/clients/{id}/statistics`

**Permission:** `clients:read`

**Query Parameters:**
```
period=last_12_months
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "filings": {
      "total": 48,
      "completed": 46,
      "pending": 2,
      "by_type": {
        "PPh21": 24,
        "PPN": 12,
        "PPh_Badan": 12
      },
      "on_time_rate": 0.96
    },
    "tax_payments": {
      "total_paid": 1250000000,
      "average_per_month": 104166667,
      "by_type": {
        "PPh21": 500000000,
        "PPN": 450000000,
        "PPh_Badan": 300000000
      }
    },
    "documents": {
      "total_uploaded": 156,
      "verified": 150,
      "pending": 6
    },
    "compliance_score": 95,
    "health_score": 92,
    "trend": "improving"
  }
}
```

---

## Webhooks

Events emitted for clients:

- `client.created`
- `client.updated`
- `client.deleted`
- `client.contact_added`
- `client.npwp_verified`
- `client.onboarding_completed`
- `client.status_changed`

---

## Related Documentation
- [API Overview](/Users/tommy/git/ai-pajak/docs/02-design/api/README.md)
- [Tax Filing API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/tax-filing-api.md)
- [Document API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/document-api.md)
- [Authentication](/Users/tommy/git/ai-pajak/docs/02-design/api/authentication.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Maintained By:** API Team
