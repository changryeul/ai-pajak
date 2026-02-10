# Tax Filing API

## Overview
The Tax Filing API provides endpoints for managing tax filings throughout their lifecycle - from creation through DJP submission and archival. This is the core API for the AI-Pajak platform.

**Base Path:** `/v1/tax-filings`

---

## Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tax-filings` | Create new tax filing |
| GET | `/tax-filings` | List tax filings |
| GET | `/tax-filings/{id}` | Get filing details |
| PATCH | `/tax-filings/{id}` | Update filing |
| DELETE | `/tax-filings/{id}` | Delete filing |
| POST | `/tax-filings/{id}/submit` | Submit to DJP |
| POST | `/tax-filings/{id}/approve` | Approve filing |
| POST | `/tax-filings/{id}/reject` | Reject filing |
| POST | `/tax-filings/{id}/calculate` | Calculate tax amount |
| POST | `/tax-filings/{id}/validate` | Validate filing data |
| GET | `/tax-filings/{id}/documents` | Get filing documents |
| GET | `/tax-filings/{id}/history` | Get filing history |
| GET | `/tax-filings/{id}/export` | Export filing (PDF/Excel) |

---

## Data Models

### Tax Filing Object

```json
{
  "id": "filing_123abc",
  "client_id": "client_456def",
  "client": {
    "id": "client_456def",
    "name": "PT Maju Jaya",
    "npwp": "01.234.567.8-901.000"
  },
  "tax_type": "PPh21",
  "period": "2025-12",
  "due_date": "2026-01-20",
  "status": "draft",
  "assigned_to": "user_789ghi",
  "accountant": {
    "id": "user_789ghi",
    "name": "Siti Wijaya",
    "email": "siti@example.com"
  },
  "data": {
    "company_info": {...},
    "income_data": {...},
    "deductions": {...},
    "tax_calculation": {...}
  },
  "tax_amount": 62500000,
  "filing_number": "BPE-2025-12345",
  "submitted_at": null,
  "approved_at": null,
  "approved_by": null,
  "djp_submission": {
    "submission_id": null,
    "confirmation_number": null,
    "submitted_at": null,
    "status": null
  },
  "metadata": {
    "version": 1,
    "ai_validated": true,
    "ai_confidence": 0.95,
    "manual_review_required": false
  },
  "created_at": "2025-12-01T10:00:00Z",
  "updated_at": "2025-12-23T10:00:00Z",
  "created_by": "user_789ghi",
  "updated_by": "user_789ghi"
}
```

### Tax Types

| Code | Name | Description |
|------|------|-------------|
| `PPh21` | Employee Income Tax | Tax withheld from employee salaries |
| `PPh23` | Withholding Tax on Services | Tax on service payments |
| `PPh25` | Monthly Installment | Corporate income tax installment |
| `PPh29` | Annual Corporate Tax | Annual corporate tax reconciliation |
| `PPN` | Value Added Tax | VAT on goods and services |
| `PPh_Final` | Final Withholding Tax | Final tax on specific incomes |
| `PPh_Badan` | Corporate Income Tax | Annual corporate income tax |

### Filing Status Flow

```
draft → in_review → ready_for_approval → approved → submitted → completed
   ↓         ↓             ↓                 ↓
rejected  rejected     rejected          failed
```

**Status Definitions:**
- `draft` - Initial creation, being worked on
- `in_review` - Submitted for internal review
- `ready_for_approval` - Reviewed, awaiting executive approval
- `approved` - Approved by executive
- `submitted` - Submitted to DJP
- `completed` - Successfully filed with DJP
- `rejected` - Rejected by reviewer/executive
- `failed` - DJP submission failed
- `cancelled` - Filing cancelled

---

## Create Tax Filing

**Endpoint:** `POST /v1/tax-filings`

**Permission:** `filings:write`

**Request:**
```json
{
  "client_id": "client_456def",
  "tax_type": "PPh21",
  "period": "2025-12",
  "assigned_to": "user_789ghi",
  "data": {
    "company_info": {
      "name": "PT Maju Jaya",
      "npwp": "01.234.567.8-901.000",
      "address": "Jl. Sudirman No. 123, Jakarta",
      "business_type": "Manufacturing"
    },
    "income_data": {
      "total_employees": 45,
      "gross_salary": 1250000000,
      "allowances": {
        "transport": 15000000,
        "meal": 18000000,
        "health": 25000000
      }
    }
  }
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "filing_123abc",
    "client_id": "client_456def",
    "tax_type": "PPh21",
    "period": "2025-12",
    "due_date": "2026-01-20",
    "status": "draft",
    "assigned_to": "user_789ghi",
    "tax_amount": null,
    "created_at": "2025-12-23T10:00:00Z"
  }
}
```

**Validation:**
- `client_id` - Must be valid, active client
- `tax_type` - Must be valid tax type code
- `period` - Format: YYYY-MM, must be valid month
- `assigned_to` - Must be valid accountant user ID

---

## List Tax Filings

**Endpoint:** `GET /v1/tax-filings`

**Permission:** `filings:read`

**Query Parameters:**
```
page=1
per_page=20
status=draft,in_review
tax_type=PPh21
client_id=client_456def
assigned_to=user_789ghi
period=2025-12
due_date[gte]=2025-12-01
due_date[lte]=2025-12-31
sort=-created_at
expand=client,accountant
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "filing_123abc",
      "client": {
        "id": "client_456def",
        "name": "PT Maju Jaya"
      },
      "tax_type": "PPh21",
      "period": "2025-12",
      "status": "draft",
      "tax_amount": 62500000,
      "due_date": "2026-01-20",
      "assigned_to": "user_789ghi",
      "accountant": {
        "id": "user_789ghi",
        "name": "Siti Wijaya"
      },
      "created_at": "2025-12-23T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

---

## Get Tax Filing Details

**Endpoint:** `GET /v1/tax-filings/{id}`

**Permission:** `filings:read`

**Query Parameters:**
```
expand=client,accountant,documents
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "filing_123abc",
    "client_id": "client_456def",
    "client": {
      "id": "client_456def",
      "name": "PT Maju Jaya",
      "npwp": "01.234.567.8-901.000",
      "business_type": "Manufacturing"
    },
    "tax_type": "PPh21",
    "period": "2025-12",
    "due_date": "2026-01-20",
    "status": "draft",
    "assigned_to": "user_789ghi",
    "accountant": {
      "id": "user_789ghi",
      "name": "Siti Wijaya",
      "email": "siti@example.com"
    },
    "data": {
      "company_info": {...},
      "income_data": {
        "total_employees": 45,
        "gross_salary": 1250000000,
        "tax_withheld": 62500000,
        "allowances": {
          "transport": 15000000,
          "meal": 18000000,
          "health": 25000000
        }
      },
      "deductions": {...},
      "tax_calculation": {
        "gross_income": 1308000000,
        "deductions": 58000000,
        "taxable_income": 1250000000,
        "tax_rate": 0.05,
        "tax_amount": 62500000
      }
    },
    "tax_amount": 62500000,
    "documents": [
      {
        "id": "doc_111",
        "type": "financial_statement",
        "name": "Laporan Keuangan Des 2025.pdf",
        "url": "https://docs.ai-pajak.com/doc_111"
      }
    ],
    "validation": {
      "is_valid": true,
      "checks_passed": 15,
      "warnings": 2,
      "errors": 0,
      "details": [...]
    },
    "created_at": "2025-12-01T10:00:00Z",
    "updated_at": "2025-12-23T10:00:00Z"
  }
}
```

---

## Update Tax Filing

**Endpoint:** `PATCH /v1/tax-filings/{id}`

**Permission:** `filings:write`

**Request:**
```json
{
  "data": {
    "income_data": {
      "gross_salary": 1300000000
    }
  },
  "status": "in_review"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "filing_123abc",
    "status": "in_review",
    "data": {
      "income_data": {
        "gross_salary": 1300000000
      }
    },
    "updated_at": "2025-12-23T10:30:00Z"
  }
}
```

**Business Rules:**
- Cannot update if status is `submitted` or `completed`
- Status transitions must be valid (see status flow)
- Updates create audit trail entries
- AI re-validates on significant data changes

---

## Delete Tax Filing

**Endpoint:** `DELETE /v1/tax-filings/{id}`

**Permission:** `filings:delete`

**Response: 204 No Content**

**Business Rules:**
- Cannot delete if status is `submitted` or `completed`
- Soft delete (archived, not permanently removed)
- Associated documents retained for audit
- Deletion logged in audit trail

**Error: 409 Conflict**
```json
{
  "success": false,
  "error": {
    "code": "FILING_ALREADY_SUBMITTED",
    "message": "Cannot delete filing that has been submitted to DJP"
  }
}
```

---

## Calculate Tax Amount

**Endpoint:** `POST /v1/tax-filings/{id}/calculate`

**Permission:** `filings:write`

**Request:**
```json
{
  "data": {
    "income_data": {
      "gross_salary": 1250000000,
      "allowances": 58000000
    },
    "deductions": {
      "standard_deduction": 58000000
    }
  }
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "calculation": {
      "gross_income": 1308000000,
      "total_deductions": 58000000,
      "taxable_income": 1250000000,
      "tax_rate": 0.05,
      "tax_amount": 62500000,
      "breakdown": {
        "tier_1": {
          "range": "0 - 60M",
          "rate": 0.05,
          "amount": 3000000
        },
        "tier_2": {
          "range": "60M - 250M",
          "rate": 0.15,
          "amount": 28500000
        },
        "tier_3": {
          "range": "250M - 500M",
          "rate": 0.25,
          "amount": 31000000
        }
      }
    },
    "comparison": {
      "previous_period": 55000000,
      "variance": 7500000,
      "variance_percentage": 13.64
    },
    "ai_insights": [
      "Tax amount increased 13.64% from last month",
      "Salary increase due to year-end bonuses detected",
      "All calculations verified and accurate"
    ]
  }
}
```

**Algorithm:**
- Apply Indonesian tax brackets
- Calculate tier-by-tier
- Round to nearest Rupiah
- Validate against business rules

---

## Validate Tax Filing

**Endpoint:** `POST /v1/tax-filings/{id}/validate`

**Permission:** `filings:write`

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "checks_passed": 15,
    "warnings": 2,
    "errors": 0,
    "validations": [
      {
        "category": "compliance",
        "checks": [
          {
            "name": "NPWP Format",
            "status": "passed",
            "severity": "error"
          },
          {
            "name": "Tax Rate Correct",
            "status": "passed",
            "severity": "error"
          }
        ]
      },
      {
        "category": "calculations",
        "checks": [
          {
            "name": "Income Total Accurate",
            "status": "passed",
            "severity": "error"
          },
          {
            "name": "Tax Amount Correct",
            "status": "passed",
            "severity": "error"
          }
        ]
      },
      {
        "category": "documents",
        "checks": [
          {
            "name": "Financial Statement Present",
            "status": "passed",
            "severity": "error"
          },
          {
            "name": "Payroll Records Complete",
            "status": "warning",
            "severity": "warning",
            "message": "One payroll record missing signature"
          }
        ]
      },
      {
        "category": "business_rules",
        "checks": [
          {
            "name": "Variance Within Threshold",
            "status": "warning",
            "severity": "warning",
            "message": "Salary increased 13% from last month. Verify accuracy."
          }
        ]
      }
    ],
    "ai_validation": {
      "confidence_score": 0.95,
      "anomalies_detected": 0,
      "suggestions": [
        "Add explanation for salary variance in notes"
      ]
    }
  }
}
```

**Validation Categories:**
1. **Compliance** - Tax regulations, DJP requirements
2. **Calculations** - Math accuracy, formulas
3. **Documents** - Required attachments, completeness
4. **Business Rules** - Company policies, thresholds
5. **AI Validation** - Anomaly detection, pattern matching

---

## Submit to DJP

**Endpoint:** `POST /v1/tax-filings/{id}/submit`

**Permission:** `filings:submit`

**Request:**
```json
{
  "submitter_name": "Budi Santoso",
  "digital_signature": "base64_encoded_signature",
  "notes": "Final submission for December 2025"
}
```

**Response: 202 Accepted** (Async operation)
```json
{
  "success": true,
  "data": {
    "job_id": "job_submit_123",
    "status": "processing",
    "message": "Filing submission to DJP in progress",
    "estimated_completion": "2025-12-23T10:05:00Z"
  },
  "links": {
    "status": "/v1/jobs/job_submit_123"
  }
}
```

**Job Status Check:**
```http
GET /v1/jobs/job_submit_123
```

**Response when complete:**
```json
{
  "success": true,
  "data": {
    "job_id": "job_submit_123",
    "status": "completed",
    "result": {
      "submission_id": "djp_789xyz",
      "confirmation_number": "BPE-2025-12345",
      "submitted_at": "2025-12-23T10:03:25Z",
      "djp_status": "accepted",
      "receipt_url": "https://docs.ai-pajak.com/receipts/BPE-2025-12345.pdf"
    }
  }
}
```

**Business Rules:**
- Filing must be in `approved` status
- All validations must pass
- Digital signature required
- Cannot resubmit if already submitted
- Updates filing status to `submitted` on success

**Error Scenarios:**
```json
{
  "success": false,
  "error": {
    "code": "FILING_NOT_APPROVED",
    "message": "Filing must be approved before submission to DJP"
  }
}
```

---

## Approve Tax Filing

**Endpoint:** `POST /v1/tax-filings/{id}/approve`

**Permission:** `filings:approve`

**Request:**
```json
{
  "notes": "Approved. All calculations verified.",
  "auto_submit": true,
  "digital_signature": "base64_encoded_signature"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "filing_123abc",
    "status": "approved",
    "approved_at": "2025-12-23T10:00:00Z",
    "approved_by": "user_exec_456",
    "approver": {
      "id": "user_exec_456",
      "name": "Pak Wijaya",
      "role": "executive"
    },
    "next_step": "submit_to_djp"
  }
}
```

**Auto-Submit:**
If `auto_submit: true`, automatically triggers DJP submission after approval.

---

## Reject Tax Filing

**Endpoint:** `POST /v1/tax-filings/{id}/reject`

**Permission:** `filings:approve`

**Request:**
```json
{
  "reason": "incorrect_calculations",
  "notes": "Please verify the allowance calculations for health benefits.",
  "return_to": "user_789ghi"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "filing_123abc",
    "status": "rejected",
    "rejected_at": "2025-12-23T10:00:00Z",
    "rejected_by": "user_exec_456",
    "rejection_reason": "incorrect_calculations",
    "notes": "Please verify the allowance calculations for health benefits.",
    "assigned_to": "user_789ghi"
  }
}
```

**Rejection Reasons:**
- `incorrect_calculations`
- `missing_documents`
- `invalid_data`
- `needs_clarification`
- `other`

---

## Get Filing Documents

**Endpoint:** `GET /v1/tax-filings/{id}/documents`

**Permission:** `filings:read`

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_111",
      "filing_id": "filing_123abc",
      "type": "financial_statement",
      "name": "Laporan Keuangan Des 2025.pdf",
      "size": 2457600,
      "mime_type": "application/pdf",
      "url": "https://docs.ai-pajak.com/doc_111",
      "status": "verified",
      "uploaded_by": "user_789ghi",
      "uploaded_at": "2025-12-15T10:00:00Z"
    },
    {
      "id": "doc_222",
      "type": "payroll_records",
      "name": "Payroll December 2025.xlsx",
      "size": 1048576,
      "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "url": "https://docs.ai-pajak.com/doc_222",
      "status": "processing",
      "uploaded_at": "2025-12-20T14:30:00Z"
    }
  ]
}
```

---

## Get Filing History

**Endpoint:** `GET /v1/tax-filings/{id}/history`

**Permission:** `filings:read`

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "history_789",
      "filing_id": "filing_123abc",
      "action": "created",
      "user_id": "user_789ghi",
      "user": {
        "id": "user_789ghi",
        "name": "Siti Wijaya"
      },
      "changes": null,
      "timestamp": "2025-12-01T10:00:00Z"
    },
    {
      "id": "history_790",
      "action": "updated",
      "user_id": "user_789ghi",
      "changes": {
        "data.income_data.gross_salary": {
          "from": 1200000000,
          "to": 1250000000
        }
      },
      "timestamp": "2025-12-10T14:30:00Z"
    },
    {
      "id": "history_791",
      "action": "submitted_for_review",
      "user_id": "user_789ghi",
      "timestamp": "2025-12-20T16:00:00Z"
    },
    {
      "id": "history_792",
      "action": "approved",
      "user_id": "user_exec_456",
      "notes": "Approved. All calculations verified.",
      "timestamp": "2025-12-23T10:00:00Z"
    }
  ]
}
```

---

## Export Tax Filing

**Endpoint:** `GET /v1/tax-filings/{id}/export`

**Permission:** `filings:read`

**Query Parameters:**
```
format=pdf
include_attachments=true
```

**Formats:**
- `pdf` - Formatted PDF report
- `excel` - Excel workbook with data
- `json` - Raw JSON data

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "export_id": "export_123",
    "format": "pdf",
    "url": "https://exports.ai-pajak.com/filing_123abc_2025-12-23.pdf",
    "expires_at": "2025-12-24T10:00:00Z",
    "size": 3145728
  }
}
```

---

## Bulk Operations

### Bulk Update Status

**Endpoint:** `PATCH /v1/tax-filings/bulk/status`

**Request:**
```json
{
  "filing_ids": ["filing_123", "filing_456", "filing_789"],
  "status": "in_review"
}
```

### Bulk Delete

**Endpoint:** `DELETE /v1/tax-filings/bulk`

**Request:**
```json
{
  "filing_ids": ["filing_123", "filing_456"]
}
```

---

## Webhooks

Events emitted for tax filings:

- `tax_filing.created`
- `tax_filing.updated`
- `tax_filing.submitted_for_review`
- `tax_filing.approved`
- `tax_filing.rejected`
- `tax_filing.submitted_to_djp`
- `tax_filing.completed`
- `tax_filing.failed`

---

## Related Documentation
- [API Overview](/Users/tommy/git/ai-pajak/docs/02-design/api/README.md)
- [Authentication](/Users/tommy/git/ai-pajak/docs/02-design/api/authentication.md)
- [Customer API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/customer-api.md)
- [Document API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/document-api.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Maintained By:** API Team
