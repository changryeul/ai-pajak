# API 계약 문서

## 개요

AI Pajak API는 RESTful 엔드포인트를 제공합니다. Swagger UI에서 전체 API 문서를 확인할 수 있습니다.

**Swagger UI**: `http://localhost:3000/swagger`

## 기본 URL

- **개발**: `http://localhost:3000/api`
- **프로덕션**: TBD

## 인증

> **TODO**: 인증 메커니즘 구현 필요

## 엔드포인트

### Company API

#### 회사 생성

```http
POST /api/companies
Content-Type: application/json

{
  "name": "string",
  "npwp": "string"
}
```

**Response**: `201 Created`

#### 회사 조회

```http
GET /api/companies/:id
```

**Response**: `200 OK`
```json
{
  "id": "bigint",
  "name": "string",
  "npwp": "string",
  "createdAt": "datetime"
}
```

#### 회사의 세금 케이스 목록

```http
GET /api/companies/:id/tax-cases
```

**Response**: `200 OK`
```json
[
  {
    "id": "bigint",
    "taxType": "PPh21|PPh23|VAT|ANNUAL",
    "period": "string",
    "status": "string",
    "workflow": {
      "stage": "UPLOADED|AI_ANALYZED|HUMAN_REVIEW|APPROVED|FILED"
    }
  }
]
```

---

### TaxCase API

#### 세금 케이스 생성

```http
POST /api/tax-cases
Content-Type: application/json

{
  "companyId": "bigint",
  "taxType": "PPh21|PPh23|VAT|ANNUAL",
  "period": "string"
}
```

**Response**: `201 Created`

#### 세금 케이스 조회

```http
GET /api/tax-cases/:id
```

**Response**: `200 OK`
```json
{
  "id": "bigint",
  "companyId": "bigint",
  "taxType": "string",
  "period": "string",
  "status": "string",
  "workflow": {
    "stage": "string",
    "updatedAt": "datetime"
  },
  "aiResults": [...],
  "reviews": [...],
  "filings": [...],
  "messages": [...]
}
```

#### AI 분석 결과 적용

```http
POST /api/tax-cases/:id/ai-result
Content-Type: application/json

{
  "suggestedTax": "string",
  "confidence": "number",
  "rawResponse": "object"
}
```

**조건**: `workflow.stage === 'UPLOADED'`

**Response**: `200 OK`

#### 휴먼 리뷰 요청

```http
POST /api/tax-cases/:id/review
```

**조건**: `workflow.stage === 'AI_ANALYZED'`

**Response**: `200 OK`

#### AI 결과 오버라이드

```http
POST /api/tax-cases/:id/override
Content-Type: application/json

{
  "reviewerId": "bigint",
  "finalTax": "string",
  "reason": "string"
}
```

**조건**: `workflow.stage === 'HUMAN_REVIEW'`

**Response**: `200 OK`

#### 승인

```http
POST /api/tax-cases/:id/approve
```

**조건**: `workflow.stage === 'HUMAN_REVIEW'`

**Response**: `200 OK`

---

### Query API

#### 케이스 개요

```http
GET /api/tax-cases/:id/overview
```

**Response**: `200 OK`

#### 타임라인 조회

```http
GET /api/tax-cases/:id/timeline
```

**Response**: `200 OK`

---

### Filing API

#### 세금 신고 제출

```http
POST /api/filings/:id/file
Content-Type: application/json

{
  "filedBy": "bigint",
  "submissionRef": "string"
}
```

**조건**: `workflow.stage === 'APPROVED'`

**Response**: `200 OK`

---

### Communication API

#### 메시지 전송

```http
POST /api/communication/:id/messages
Content-Type: application/json

{
  "senderType": "HUMAN|AI",
  "senderId": "bigint|null",
  "message": "string"
}
```

**Response**: `201 Created`

## 에러 응답

```json
{
  "statusCode": 400,
  "message": "string",
  "error": "Bad Request"
}
```

### 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성됨 |
| 400 | 잘못된 요청 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

## 워크플로우 제약

API 호출은 워크플로우 스테이지에 따라 제한됩니다:

| 스테이지 | 허용 API |
|---------|----------|
| UPLOADED | `POST /ai-result` |
| AI_ANALYZED | `POST /review` |
| HUMAN_REVIEW | `POST /override`, `POST /approve` |
| APPROVED | `POST /file` |
| FILED | (읽기 전용) |
