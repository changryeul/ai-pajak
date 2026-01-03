# 데이터 모델 문서

## 개요

AI Pajak는 PostgreSQL 데이터베이스와 Prisma ORM을 사용합니다. 스키마는 `prisma/schema.prisma`에 정의되어 있습니다.

## 엔티티 관계도

```
┌─────────────┐     ┌─────────────────┐
│    User     │────▶│   CompanyUser   │
└─────────────┘     └─────────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────────┐
│   Company   │────▶│    TaxCase      │
└─────────────┘     └─────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ WorkflowState │  │   AIResult    │  │  HumanReview  │
└───────────────┘  └───────────────┘  └───────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   TaxFiling   │  │ Communication │  │   AuditLog    │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Enums

### TaxType

| 값 | 설명 |
|------|------|
| `PPh21` | 직원 소득세 |
| `PPh23` | 원천징수세 |
| `VAT` | 부가가치세 |
| `ANNUAL` | 연간 세금 |

### WorkflowStage

| 값 | 설명 |
|------|------|
| `UPLOADED` | 문서 업로드됨 |
| `AI_ANALYZED` | AI 분석 완료 |
| `HUMAN_REVIEW` | 휴먼 리뷰 중 |
| `APPROVED` | 승인됨 |
| `FILED` | 신고 완료 |

### SenderType

| 값 | 설명 |
|------|------|
| `HUMAN` | 사람 |
| `AI` | AI |

### FilingStatus

| 값 | 설명 |
|------|------|
| `SUBMITTED` | 제출됨 |
| `ACCEPTED` | 수락됨 |
| `REJECTED` | 거부됨 |

## 모델 정의

### User

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `email` | String | 고유, 이메일 |
| `name` | String? | 이름 (선택) |
| `createdAt` | DateTime | 생성 시간 |

**관계**:
- `companyUsers` → CompanyUser[]
- `auditLogs` → AuditLog[]
- `reviews` → HumanReview[]

### Company

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `name` | String | 회사명 |
| `npwp` | String | 고유, 납세자번호 |
| `createdAt` | DateTime | 생성 시간 |

**관계**:
- `users` → CompanyUser[]
- `taxCases` → TaxCase[]

### CompanyUser

| 필드 | 타입 | 설명 |
|------|------|------|
| `companyId` | BigInt | FK → Company |
| `userId` | BigInt | FK → User |
| `role` | String | 역할 |
| `joinedAt` | DateTime | 가입 시간 |

**PK**: (companyId, userId)

### TaxCase

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `companyId` | BigInt | FK → Company |
| `taxType` | TaxType | 세금 유형 |
| `period` | String | 기간 |
| `status` | String | 상태 (기본: "OPEN") |
| `createdAt` | DateTime | 생성 시간 |

**관계**:
- `company` → Company
- `workflow` → WorkflowState?
- `aiResults` → AIResult[]
- `reviews` → HumanReview[]
- `filings` → TaxFiling[]
- `messages` → Communication[]
- `audits` → AuditLog[]

### WorkflowState

| 필드 | 타입 | 설명 |
|------|------|------|
| `taxCaseId` | BigInt | PK, FK → TaxCase |
| `stage` | WorkflowStage | 현재 스테이지 |
| `updatedAt` | DateTime | 업데이트 시간 |

### AIResult

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `taxCaseId` | BigInt | FK → TaxCase |
| `suggestedTax` | String | 제안된 세금 |
| `confidence` | Float | 신뢰도 |
| `rawResponse` | Json | 원시 응답 |
| `createdAt` | DateTime | 생성 시간 |

### HumanReview

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `taxCaseId` | BigInt | FK → TaxCase |
| `reviewerId` | BigInt | FK → User |
| `finalTax` | String | 최종 세금 |
| `overrideFlag` | Boolean | 오버라이드 여부 |
| `reason` | String? | 사유 |
| `reviewedAt` | DateTime | 리뷰 시간 |

### TaxFiling

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `taxCaseId` | BigInt | FK → TaxCase |
| `filingStatus` | FilingStatus | 신고 상태 |
| `filedBy` | BigInt? | 신고자 ID |
| `filedAt` | DateTime? | 신고 시간 |
| `submissionRef` | String? | 제출 참조번호 |
| `createdAt` | DateTime | 생성 시간 |

### Communication

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `taxCaseId` | BigInt | FK → TaxCase |
| `senderType` | SenderType | 발신자 유형 |
| `senderId` | BigInt? | 발신자 ID |
| `message` | String | 메시지 내용 |
| `createdAt` | DateTime | 생성 시간 |

### AuditLog

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigInt | PK, 자동 증가 |
| `taxCaseId` | BigInt | FK → TaxCase (인덱스) |
| `actorId` | BigInt? | FK → User |
| `action` | String | 액션 |
| `createdAt` | DateTime | 생성 시간 |

## BigInt 처리

PostgreSQL의 BigInt를 사용하므로 JSON 직렬화 시 문자열로 변환됩니다:

```typescript
// main.ts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
```

## 마이그레이션

자세한 마이그레이션 가이드는 [개발 가이드](./development-guide.md#database-migration)를 참조하세요.
