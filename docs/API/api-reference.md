# API Reference

> AI PAJAK REST API 레퍼런스 문서

## Base URL

```
Production: https://app.aipajak.com/api
Development: http://localhost:3000/api
```

## Authentication

모든 API 요청에는 Bearer 토큰이 필요합니다.

```http
Authorization: Bearer <access_token>
```

토큰은 Supabase Auth를 통해 발급됩니다.

---

## Health & Monitoring

### GET /health

시스템 헬스 체크

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-14T10:00:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": { "status": "up", "latency": 15 },
    "redis": { "status": "up", "latency": 5 }
  }
}
```

| Status Code | Description |
|-------------|-------------|
| 200 | System healthy |
| 503 | System unhealthy |

---

## Tax Filing (세금 신고)

### POST /tax/spt/1770ss

SPT 1770 SS 생성 (직장인 소득 < 60M)

**Request:**
```json
{
  "customerId": "uuid",
  "taxYear": 2024,
  "taxpayer": {
    "npwp": "123456789012345",
    "nik": "3201011234567890",
    "fullName": "John Doe",
    "address": "Jl. Test No. 123",
    "occupation": "Employee"
  },
  "ptkpStatus": "K/1",
  "income1721A1": {
    "employerNpwp": "987654321098765",
    "employerName": "PT Test Company",
    "grossIncome": 50000000,
    "pph21Withheld": 2500000
  },
  "format": "json"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sptId": "uuid",
    "formType": "1770SS",
    "taxYear": 2024,
    "summary": {
      "grossIncome": 50000000,
      "ptkp": 58500000,
      "taxableIncome": 0,
      "taxDue": 0,
      "taxPaid": 2500000,
      "overpayment": 2500000
    }
  }
}
```

### POST /tax/spt/1770s

SPT 1770 S 생성 (직장인 소득 >= 60M 또는 복수 고용주)

### POST /tax/spt/1770

SPT 1770 생성 (사업자/프리랜서)

### POST /tax/spt/1771

SPT 1771 생성 (법인)

### POST /tax/calculate

세금 계산

**Required Role:** CONSULTANT_JTC, TAX_ADVISOR_JTC

**Request:**
```json
{
  "customerId": "uuid",
  "taxType": "PPh21",
  "taxPeriod": "2025-01",
  "taxYear": 2025,
  "incomeData": {
    "grossIncome": 10000000
  }
}
```

### POST /tax/file

세금 신고 제출

**Required Role:** TAX_ADVISOR_JTC (Active POA required)

---

## Payment (결제)

### POST /payment/initiate

결제 시작

**Headers:**
```
Idempotency-Key: unique-key-123
```

**Request:**
```json
{
  "transactionId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "paymentToken": "snap-token",
    "paymentUrl": "https://app.midtrans.com/snap/...",
    "expiresAt": "2026-02-15T10:00:00Z"
  }
}
```

**Response Headers:**
```
Idempotency-Replayed: true  // 캐시된 응답인 경우
```

### POST /webhooks/midtrans

Midtrans 웹훅 (Midtrans 서버에서 호출)

**Request:**
```json
{
  "transaction_status": "settlement",
  "order_id": "PAY-uuid-timestamp",
  "status_code": "200",
  "gross_amount": "555000.00",
  "payment_type": "bank_transfer",
  "transaction_id": "txn-id",
  "signature_key": "sha512-signature"
}
```

---

## Billing (청구)

### GET /billing/invoices

청구서 목록 조회

**Response:**
```json
{
  "success": true,
  "invoices": [
    {
      "id": "uuid",
      "invoiceNumber": "INV-2025-001",
      "amountTotal": 555000,
      "paymentStatus": "PENDING",
      "dueDate": "2025-02-15"
    }
  ]
}
```

### GET /billing/subscription

구독 상태 조회

**Response:**
```json
{
  "success": true,
  "subscription": {
    "plan": "professional",
    "status": "active",
    "currentPeriodEnd": "2025-03-01"
  }
}
```

### GET /billing/usage

사용량 조회

### POST /billing/create

청구서 생성

**Required Role:** SYSTEM

---

## Customer (고객)

### GET /customers

고객 목록 조회

### GET /customers/:id

고객 상세 조회

### POST /customers

고객 생성

### PUT /customers/:id

고객 수정

---

## POA (위임장)

### POST /poa/create

위임장 생성

**Request:**
```json
{
  "taxPartnerId": "uuid",
  "scope": "ALL_TAX_TYPES",
  "validFrom": "2025-01-01",
  "validTo": "2025-12-31",
  "documentUrl": "https://storage.../poa.pdf"
}
```

### POST /poa/sign

위임장 서명

### POST /poa/:id/revoke

위임장 철회

---

## Documents (문서)

### POST /documents/upload

문서 업로드

**Content-Type:** multipart/form-data

### GET /documents/:id

문서 조회

### POST /documents/:id/ocr

OCR 처리 요청

---

## Admin (관리자)

### GET /admin/dashboard

플랫폼 대시보드 (집계 데이터)

**Required Role:** PLATFORM_ADMIN

### GET /admin/system-status

시스템 상태 상세

**Authentication:** CRON_SECRET 또는 Service Role Key

**Response:**
```json
{
  "status": "operational",
  "timestamp": "2026-02-14T10:00:00Z",
  "services": [
    { "name": "Database", "status": "operational", "latency": 15 },
    { "name": "Redis", "status": "operational", "latency": 5 }
  ],
  "circuitBreakers": [
    { "name": "djp", "state": "CLOSED", "failures": 0 },
    { "name": "midtrans", "state": "CLOSED", "failures": 0 }
  ],
  "metrics": {
    "memory": { "used": 128, "total": 512, "percentage": 25 }
  }
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - 잘못된 요청 |
| 401 | Unauthorized - 인증 필요 |
| 403 | Forbidden - 권한 없음 |
| 404 | Not Found - 리소스 없음 |
| 409 | Conflict - 충돌 (예: 중복 데이터) |
| 429 | Too Many Requests - 요청 제한 초과 |
| 500 | Internal Server Error - 서버 오류 |

### RBAC Error

```json
{
  "error": "Forbidden",
  "message": "You do not have permission to perform this action",
  "requiredRoles": ["TAX_ADVISOR_JTC"],
  "currentRole": "CUSTOMER"
}
```

---

## Rate Limiting

API 요청은 다음과 같이 제한됩니다:

| Endpoint | Limit |
|----------|-------|
| `/api/auth/*` | 10 req/min |
| `/api/tax/*` | 30 req/min |
| `/api/documents/*` | 20 req/min |
| Other | 60 req/min |

Rate limit 초과 시:
```json
{
  "error": "Too Many Requests",
  "retryAfter": 30
}
```

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | No | 멱등성 키 (결제 등) |
| `Accept-Language` | No | 응답 언어 (ko, en, id) |

---

## Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | 요청 추적 ID |
| `Idempotency-Replayed` | 캐시된 응답 여부 |
| `X-RateLimit-Remaining` | 남은 요청 수 |

---

**Last Updated**: 2026-02-14
