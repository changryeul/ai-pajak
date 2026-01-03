# API 아키텍처 문서

## 개요

AI Pajak API는 NestJS 기반의 모듈러 모놀리스 아키텍처를 따릅니다. Repository 패턴을 통해 데이터 접근을 중앙화하고, 도메인별 모듈로 비즈니스 로직을 분리합니다.

## 기술 스택

| 카테고리 | 기술 | 버전 |
|---------|------|------|
| Framework | NestJS | ^10.3.7 |
| Language | TypeScript | ^5.4.5 |
| ORM | Prisma | ^5.10.2 |
| Database | PostgreSQL | - |
| Validation | class-validator | ^0.14.3 |
| Documentation | Swagger | ^7.3.0 |
| Testing | Jest | ^29.7.0 |

## 아키텍처 패턴

### 레이어 구조

```
┌─────────────────────────────────────────────┐
│              Controllers                     │  ← HTTP 요청 처리
├─────────────────────────────────────────────┤
│              Services                        │  ← 비즈니스 로직
├─────────────────────────────────────────────┤
│              Repositories                    │  ← 데이터 접근 추상화
├─────────────────────────────────────────────┤
│              Prisma Client                   │  ← ORM
├─────────────────────────────────────────────┤
│              PostgreSQL                      │  ← 데이터베이스
└─────────────────────────────────────────────┘
```

### 모듈 구조

```
apps/api/src/
├── main.ts                    # 애플리케이션 엔트리포인트
├── app.module.ts              # 루트 모듈
│
├── repository/                # 중앙화된 데이터 접근 레이어
│   ├── prisma.service.ts      # Prisma 클라이언트 싱글톤
│   ├── repository.module.ts   # 레포지토리 모듈
│   └── repositories/          # 도메인별 레포지토리
│       ├── taxcase.repository.ts
│       ├── workflow.repository.ts
│       ├── company.repository.ts
│       ├── ai-result.repository.ts
│       ├── human-review.repository.ts
│       ├── tax-filing.repository.ts
│       ├── communication.repository.ts
│       ├── audit-log.repository.ts
│       └── membership.repository.ts
│
├── taxcase/                   # 핵심 도메인 모듈
│   ├── taxcase.module.ts
│   ├── taxcase.controller.ts
│   ├── taxcase.service.ts     # 기본 CRUD
│   ├── review-workflow.service.ts  # 워크플로우 상태 머신
│   ├── dto/                   # Data Transfer Objects
│   ├── types/                 # 타입 정의
│   ├── utils/
│   │   └── workflow-actions.ts  # 스테이지별 액션 권한
│   └── query/                 # 쿼리 전용 서브모듈
│
├── company/                   # 회사 관리 모듈
│   ├── company.module.ts
│   ├── company.controller.ts
│   ├── company.service.ts
│   └── dto/
│
├── filing/                    # 세금 신고 제출 모듈
│   ├── filing.module.ts
│   ├── filing.controller.ts
│   ├── filing.service.ts
│   └── dto/
│
├── communication/             # AI/Human 메시징 모듈
│   ├── communication.module.ts
│   ├── communication.controller.ts
│   ├── communication.service.ts
│   └── dto/
│
└── common/                    # 공통 유틸리티
    ├── auth.guard.ts
    └── http-exception.filter.ts
```

## 워크플로우 상태 머신

TaxCase 엔티티는 5단계 워크플로우를 따릅니다:

### 스테이지 흐름

```
UPLOADED → AI_ANALYZED → HUMAN_REVIEW → APPROVED → FILED
```

### 스테이지별 허용 액션

| 스테이지 | 허용 액션 |
|---------|----------|
| `UPLOADED` | Apply AI result |
| `AI_ANALYZED` | Move to human review |
| `HUMAN_REVIEW` | Override AI / Approve |
| `APPROVED` | File tax case |
| `FILED` | (터미널 상태) |

### 구현 코드

```typescript
// taxcase/utils/workflow-actions.ts
export function getWorkflowActions(stage: WorkflowStage | null): WorkflowActions {
  return {
    canApplyAI: stage === WorkflowStage.UPLOADED,
    canRequestReview: stage === WorkflowStage.AI_ANALYZED,
    canOverride: stage === WorkflowStage.HUMAN_REVIEW,
    canApprove: stage === WorkflowStage.HUMAN_REVIEW,
    canFile: stage === WorkflowStage.APPROVED,
  };
}
```

## 주요 서비스

### ReviewWorkflowService

워크플로우 상태 전이를 관리합니다:

- `applyAIResult()` - AI 분석 결과 적용
- `requestHumanReview()` - 휴먼 리뷰 요청
- `overrideAIResult()` - AI 결과 오버라이드
- `approve()` - 승인
- `file()` - 세금 신고 제출

## BigInt 처리

PostgreSQL의 BigInt ID를 사용합니다. JSON 직렬화를 위한 패치가 `main.ts`에 포함되어 있습니다:

```typescript
// main.ts
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
```

## API 문서

Swagger UI: `http://localhost:3000/swagger`

## 참고 문서

- [API 계약](./api-contracts.md)
- [데이터 모델](./data-models.md)
- [개발 가이드](./development-guide.md)
