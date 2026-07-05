<!--
  동기화 영향 보고서
  ==================
  버전 변경: 1.1.0 → 1.2.0

  수정된 원칙: N/A

  수정된 섹션:
  - 문서 참조 규칙: docs/ 폴더 구조 v2.0 모듈화 반영
    - 기존: 단일 파일 참조 (PRD.md, LEGAL_STRUCTURE.md 등)
    - 변경: 폴더 기반 참조 (01-product/, 02-design/ 등)

  추가된 내용:
  - 문서 구조 트리 다이어그램
  - Living/Archive Documents 구분 규칙
  - 문서 우선순위 체계 업데이트

  제거된 섹션: N/A

  템플릿 업데이트 필요 여부:
  - .specify/templates/plan-template.md: ✅ 업데이트 불필요
  - .specify/templates/spec-template.md: ✅ 업데이트 불필요
  - .specify/templates/tasks-template.md: ✅ 업데이트 불필요

  후속 TODO: 없음
-->

# AI Pajak 헌법 (Constitution)

## 핵심 원칙

### I. 법적 주체 분리 (절대 원칙)

AI Pajak은 모든 시스템 설계, 구현, 사용자 커뮤니케이션에서 반드시 유지되어야 하는 3자 법적 구조 하에 운영됩니다:

- **Mono Flip Global**: 플랫폼 운영자 및 소유자. 플랫폼 구독료 수취. 세무 서비스 제공 불가.
- **AI Pajak**: Mono Flip Global이 운영하는 소프트웨어 플랫폼. 세무 준비 도구만 제공. 세금 신고 및 세무 조언 불가.
- **Jakarta Tax Consulting (JTC)**: 공인 세무 컨설턴트. 모든 세무 신고 서비스 제공. 모든 세무 컨설턴트 및 세무사 고용.

**근거**: 인도네시아 세무 컨설팅 관련 법규 준수를 위해 이 분리가 필요합니다. AI Pajak은 세무 서비스 제공자로 표방할 수 없습니다.

### II. 이중 계약 요건 (절대 원칙)

모든 고객은 반드시 두 개의 별도 계약 관계를 체결해야 합니다:

1. **플랫폼 이용약관**: AI Pajak (Mono Flip Global)과의 플랫폼 사용 계약
2. **세무 서비스 계약 + 위임장 (Surat Kuasa)**: Jakarta Tax Consulting과의 세무 신고 대행 계약

**시행 방법**: 고객과 Jakarta Tax Consulting을 연결하는 유효한 위임장(POA) 없이는 어떤 세금 신고 작업도 진행할 수 없습니다. 데이터베이스 트리거와 API 미들웨어가 세금 제출 전 반드시 POA 상태를 검증해야 합니다.

**근거**: 법적 분리를 위해 별도의 계약이 필요합니다. POA는 JTC에게 고객 대신 신고할 법적 권한을 부여합니다.

### III. PLATFORM_ADMIN 데이터 격리 (절대 원칙)

플랫폼 관리자(AI Pajak / Mono Flip Global 직원)는 절대로 고객 세무 데이터에 접근할 수 없습니다:

- API 미들웨어가 반드시 PLATFORM_ADMIN 역할의 세무 데이터 엔드포인트 접근을 차단해야 합니다
- 데이터베이스 Row Level Security (RLS)가 반드시 데이터 격리를 시행해야 합니다
- 감사 로그가 반드시 차단된 접근 시도를 기록해야 합니다
- PLATFORM_ADMIN은 익명화/집계된 통계만 조회할 수 있습니다

**근거**: 플랫폼-서비스 분리 유지. 플랫폼 운영자는 기밀 세무 데이터에 접근할 법적 근거가 없습니다.

### IV. 2단계 권한 부여

모든 민감한 작업은 반드시 두 개의 독립적인 권한 부여 계층으로 보호되어야 합니다:

1. **API 계층 (1차 관문)**: 미들웨어 인증, 역할 기반 접근 제어, POA 검증
2. **데이터베이스 계층 (최종 관문)**: Row Level Security (RLS) 정책, 외래 키 제약, 검증 트리거

**근거**: 심층 방어. API 버그가 있어도 RLS가 올바르게 구성되어 있으면 데이터가 노출되지 않습니다.

### V. 불변 감사 추적

모든 세무 관련 작업은 반드시 불변 감사 추적에 기록되어야 합니다:

- 감사 로그에 반드시 포함되어야 하는 항목: 행위자(user_id), 조직, 활동 유형, 타임스탬프, IP 주소
- 감사 로그는 절대 삭제할 수 없습니다 (RLS: DELETE 권한 없음)
- 보존 기간: 10년 (인도네시아 세법 UU KUP에 따름)
- 모든 DJP 신고는 반드시 Jakarta Tax Consulting 명의로 귀속되어야 합니다 (AI Pajak 또는 Mono Flip Global 아님)

**근거**: 법적 준수 및 책임 추적. 세무 당국이 감사 추적을 요청할 수 있습니다.

### VI. 역할 기반 세무 신고 권한

세무 신고 권한은 역할에 따라 제한됩니다:

| 역할 | 세금 계산 | 세금 신고 |
|------|-----------|-----------|
| CUSTOMER | 본인 데이터 조회 | JTC를 통해서만 |
| CONSULTANT | 전체 (배정된 고객) | 불가 |
| TAX_ADVISOR | 전체 (모든 JTC 고객) | 가능 (유효한 POA 필요) |
| PLATFORM_ADMIN | 불가 | 불가 |
| SYSTEM | 불가 | 불가 (빌링만 가능) |

**시행 방법**: 라이선스를 보유한 세무사이며 유효한 POA가 있는 TAX_ADVISOR 역할만 DJP에 신고를 제출할 수 있습니다.

**근거**: 공인 세무사(Brevet 보유자)만이 고객을 대신하여 법적으로 신고할 수 있습니다.

## 법적·계약 프레임워크

### 수익 귀속

- **플랫폼 구독료** → 100% Mono Flip Global
- **세무 서비스 수수료** → 100% Jakarta Tax Consulting
- **수금 대행 모델**: Mono Flip Global이 JTC를 대신하여 세무 서비스 수수료를 수금하고 정기적으로 정산

### 금지 행위

- AI Pajak은 세무 신고 서비스 제공자로 자칭해서는 안 됩니다
- AI Pajak 직원은 "세무 컨설턴트" 또는 "세무사"가 포함된 직함을 사용해서는 안 됩니다
- PLATFORM_ADMIN은 개별 고객 세무 데이터에 접근해서는 안 됩니다
- SYSTEM 역할은 세무 데이터에 접근해서는 안 됩니다 (빌링 작업만 가능)

### 필수 고지 사항

모든 고객 대면 인터페이스에 다음 문구가 반드시 표시되어야 합니다:
> "세무 신고 서비스는 공인 세무 컨설턴트인 Jakarta Tax Consulting이 제공합니다. AI Pajak은 세무 준비를 지원하는 소프트웨어 플랫폼입니다."

## 기술 표준

### 기술 스택 요구사항

- **프론트엔드**: Next.js + React 19 + Tailwind CSS 4
- **백엔드**: Next.js API Routes
- **데이터베이스**: Supabase PostgreSQL (RLS 적용)
- **인증**: Supabase Auth
- **언어**: TypeScript (strict 모드)

### 보안 요구사항

- 세무 데이터를 처리하는 모든 API 엔드포인트는 반드시 미들웨어 스택을 사용해야 합니다: `requireAuth` → `blockPlatformAdmin` → `requireRole` → `withAudit`
- 세금 신고 엔드포인트는 추가로 `requireValidPOA` 미들웨어를 반드시 포함해야 합니다
- 데이터베이스 스키마는 반드시 조직 관계에 대한 외래 키 제약을 적용해야 합니다
- NPWP (납세자 번호) 필드는 반드시 공식 형식에 맞게 검증되어야 합니다

### 테스트 표준

- E2E 테스트는 반드시 5가지 역할 유형 (CUSTOMER, CONSULTANT, TAX_ADVISOR, PLATFORM_ADMIN, SYSTEM) 모두를 다루어야 합니다
- 보안 테스트는 반드시 PLATFORM_ADMIN이 세무 엔드포인트에서 차단되는지 검증해야 합니다
- POA 검증 테스트는 반드시 유효한 POA 없이 신고가 실패하는지 검증해야 합니다

## 거버넌스

이 헌법은 AI Pajak의 다른 모든 개발 관행보다 우선합니다.

### 개정 절차

1. 제안된 변경 사항은 반드시 근거와 함께 문서화되어야 합니다
2. 법적 주체 분리(원칙 I)에 영향을 미치는 변경은 법률 검토가 필요합니다
3. 모든 개정은 시맨틱 버저닝에 따라 버전 번호를 업데이트해야 합니다:
   - MAJOR: 역호환 불가능한 원칙 변경
   - MINOR: 새로운 원칙 또는 섹션 추가
   - PATCH: 명확화 또는 문구 수정

### 준수 검증

- 모든 PR은 반드시 이 원칙들의 준수 여부를 검증해야 합니다
- 코드 리뷰는 반드시 PLATFORM_ADMIN 데이터 접근 위반을 확인해야 합니다
- 데이터베이스 마이그레이션은 해당되는 경우 반드시 RLS 정책 업데이트를 포함해야 합니다

### 문서 참조 규칙

`docs/` 폴더가 이 프로젝트의 **단일 진실 공급원(Single Source of Truth)**입니다.

**문서 구조** (v2.0 모듈화):

```
docs/
├── 01-product/      # 제품 요구사항 (23개 파일)
├── 02-design/       # 설계 문서
│   ├── database/    # ERD, 스키마, RLS (9개, 5,243줄)
│   ├── api/         # REST API 명세 (6개)
│   └── ui-ux/       # UI/UX 설계 (15개)
├── 03-technical/    # 기술 문서 (보안, 통합)
├── 04-workflows/    # 운영 매뉴얼, SOP
├── 05-implementation/ # 구현 아카이브 (날짜별)
├── 06-reviews/      # 리뷰 아카이브
└── 07-changelogs/   # 변경 이력
```

**주요 참조 문서**:

| 폴더/문서 | 용도 | 우선순위 |
|----------|------|---------|
| `01-product/04-legal-structure.md` | 법적 주체 구조, 계약 관계 | 🔴 최우선 |
| `01-product/01-executive-summary.md` | 비전, 문제, 솔루션 | 🔴 최우선 |
| `01-product/features/` | 기능 명세, MVP 범위 | 🔴 최우선 |
| `01-product/user-stories/` | 사용자 스토리 | 🔴 최우선 |
| `02-design/database/` | ERD, 테이블 설계, RLS 정책 | 🟠 높음 |
| `02-design/api/` | REST API 명세 | 🟠 높음 |
| `03-technical/security/` | 인증, RBAC, 데이터 마스킹 | 🟠 높음 |
| `04-workflows/` | 컨설턴트 매뉴얼, 운영 절차 | 🟡 중간 |
| `01-product/05-project-status.md` | 구현 진행 상황 | 🟡 중간 |

**참조 원칙**:
- 새 기능 구현 시 반드시 `docs/01-product/`를 먼저 확인해야 합니다
- `specs/` 폴더의 개별 feature spec 생성은 선택 사항입니다 (docs/가 충분히 상세한 경우 생략 가능)
- 문서 간 충돌 시 `01-product/04-legal-structure.md` > `01-product/` > `02-design/` > 기타 순으로 우선합니다
- 구현 중 발견된 명세 누락은 해당 docs/ 문서에 직접 추가해야 합니다
- Living Documents (01~04)는 수시 업데이트, Archive Documents (05~07)는 변경 불가

**버전**: 1.2.0 | **제정일**: 2025-12-23 | **최종 개정일**: 2025-12-24
