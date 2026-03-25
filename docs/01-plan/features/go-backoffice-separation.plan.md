# Plan: Go 백오피스 분리 및 아키텍처 재설계

> **Feature**: go-backoffice-separation
> **Created**: 2026-03-25
> **Status**: Plan
> **Owner**: ichang-yeol

---

## 1. 배경 및 목적

### 현재 상태 (As-Is)
- **아키텍처**: Next.js 16 모놀리스 (프론트엔드 + 백엔드 API Routes)
- **DB**: Supabase PostgreSQL 17 — 26개 트리거 (22 updated_at + 4 비즈니스 로직)
- **API**: 40+ 엔드포인트가 Vercel Serverless에 직접 배포
- **문제점**:
  1. 세금 계산/PDF 생성 등 heavy computation이 serverless cold start에 취약
  2. 트리거 기반 감사 로그 — 디버깅 불가, Supabase Cloud에서 제한적
  3. 백오피스(관리자)와 고객 포털이 동일 앱에 혼재
  4. 단일 tax_partner(JTC) 전제 설계 — 멀티테넌시 확장 불가

### 목표 상태 (To-Be)
- **프론트엔드**: Next.js → 고객 포털 전용 (SSR + i18n)
- **백오피스 API**: Go → 관리, 세금 계산, DJP 연동, 배치 처리
- **DB**: 트리거 완전 제거 → 앱 레벨 처리
- **확장성**: 멀티 tax_partner, 대량 고객 처리 가능

### 비즈니스 맥락
- **Phase 1 MVP 목표**: 세금 시즌(3월) 맞춰 200 세무사 + 2,000 UMKM + 1,000 개인
- **연 매출 목표**: Rp 11B+ (개인 250M + UMKM 4.8B + 기업 6B)
- **인도네시아 납세자 4천만명** 대상 스케일 필요

---

## 2. 범위 (Scope)

### In-Scope

| # | 작업 | 우선순위 | 복잡도 |
|---|------|---------|--------|
| S1 | Go 백오피스 프로젝트 초기 세팅 (구조, 의존성, 빌드) | P0 | Medium |
| S2 | DB 트리거 제거 마이그레이션 작성 | P0 | High |
| S3 | Go Auth 미들웨어 (Supabase JWT 검증 + RBAC) | P0 | Medium |
| S4 | Go Repository 레이어 (updated_at 앱 레벨, 감사 로그) | P0 | High |
| S5 | Go 서비스 레이어 (POA 검증, 상태 변경 + 트랜잭션 내 감사) | P0 | High |
| S6 | Go API 핸들러 (고객, 신고, 감사 로그, 관리자 대시보드) | P1 | Medium |
| S7 | Docker + Makefile + CI/CD 설정 | P1 | Low |
| S8 | Next.js ↔ Go API 통합 (프록시 또는 직접 호출) | P1 | Medium |
| S9 | 기존 Next.js API Routes → Go 마이그레이션 가이드 | P2 | Low |

### Out-of-Scope (Phase 2+)
- 세금 계산 엔진 Go 포팅 (현재 TypeScript 유지, 추후 마이그레이션)
- DJP 연동 Go 재구현
- Midtrans 결제 Go 재구현
- 모바일 앱 API
- 멀티 tax_partner DB 스키마 변경 (별도 feature)

---

## 3. 기술 결정 (Technical Decisions)

### TD-1: 백오피스 언어 — Go 선택 이유

| 기준 | Go | Node.js (현재) |
|------|-----|---------------|
| 세금 계산 성능 | goroutine 병렬 처리 | 단일 스레드 이벤트 루프 |
| 메모리 사용량 | ~30MB | ~150MB+ |
| 배포 | 단일 바이너리 (~15MB) | node_modules 포함 ~300MB |
| 동시 접속 | 10K+ 연결 안정적 | I/O bound에서 유리 |
| 타입 안전성 | 컴파일타임 보장 | TS로 런타임 보완 |

### TD-2: 주요 Go 라이브러리

| 목적 | 라이브러리 | 이유 |
|------|-----------|------|
| HTTP Router | chi v5 | 표준 net/http 호환, 경량 |
| DB Driver | pgx v5 | 최고 성능 PostgreSQL 드라이버, 커넥션풀 내장 |
| JWT | golang-jwt v5 | Supabase HMAC 검증 |
| Config | godotenv | .env 로딩, 심플 |
| Logging | slog (표준) | Go 1.21+ 내장, 구조화 로깅 |
| CORS | go-chi/cors | chi 에코시스템 |

### TD-3: 트리거 제거 전략

| 트리거 종류 | 개수 | 대체 방식 |
|------------|------|----------|
| `updated_at` 자동 갱신 | 22 | Repository 레이어에서 `updated_at = NOW()` 명시적 포함 |
| `tax_filing_audit` 감사 | 1 | Service 레이어에서 트랜잭션 내 `tax_activity_log` INSERT |
| `poa_audit` 감사 | 1 | Service 레이어에서 트랜잭션 내 `tax_activity_log` INSERT |
| `validate_tax_filing_poa` 검증 | 1 | Service 레이어에서 POA 유효성 사전 검증 |
| `generate_poa_number` 번호생성 | 1 | Service에서 `nextval('poa_number_seq')` 직접 호출 |

**핵심 원칙**: 비즈니스 로직은 앱 레이어에서, DB는 저장소 역할만.

### TD-4: 아키텍처 분리

```
┌─────────────────────────┐     ┌──────────────────────────┐
│   Next.js (고객 포털)     │     │   Go (백오피스 API)        │
│   :3000                  │     │   :8080                   │
│   - SSR + i18n           │     │   - REST API              │
│   - 로그인/회원가입        │ ──→ │   - 고객 CRUD             │
│   - 세금 폼 입력          │     │   - 신고 관리              │
│   - 문서 업로드           │     │   - 감사 로그              │
│   - 결제 UI              │     │   - POA 검증              │
│                          │     │   - 관리자 대시보드         │
└──────────┬───────────────┘     └──────────┬───────────────┘
           │                                │
           └────────────┬───────────────────┘
                        ▼
              ┌──────────────────┐
              │   PostgreSQL      │
              │   (Supabase)     │
              │   RLS 유지        │
              │   트리거 제거      │
              └──────────────────┘
```

---

## 4. 구현 단계 (Implementation Phases)

### Phase A: 기반 구축 (Do 1차)

```
A1. Go 프로젝트 초기화 [S1]
    - go.mod, 디렉토리 구조
    - cmd/server/main.go
    - internal/ 패키지 구조

A2. Config + DB 연결 [S1]
    - .env 로딩
    - pgxpool 커넥션풀
    - Health check 엔드포인트

A3. Auth 미들웨어 [S3]
    - Supabase JWT 검증 (HMAC)
    - user_roles DB 조회
    - SessionContext (UserID, Role, OrgID)

A4. RBAC + Security 미들웨어 [S3]
    - RequireRole(roles...)
    - BlockPlatformAdmin (Hard Rule #1)
    - Request logging
```

### Phase B: 데이터 레이어 (Do 2차)

```
B1. Repository 기반 [S4]
    - AuditRepo (감사 로그 삽입/조회)
    - CustomerRepo (CRUD, 검색, 페이지네이션)
    - TaxFilingRepo (CRUD, 상태 변경 + FOR UPDATE 잠금)
    - POARepo (유효성 검증, 번호 생성)

B2. 트리거 제거 마이그레이션 [S2]
    - DROP TRIGGER × 26
    - DROP FUNCTION × 5
    - ALTER TABLE ... SET DEFAULT NOW() (updated_at)
    - RLS 헬퍼 함수는 유지
```

### Phase C: 비즈니스 로직 (Do 3차)

```
C1. Service 레이어 [S5]
    - TaxFilingService
      - UpdateStatus: 트랜잭션 내 [상태변경 + 감사로그]
      - POA 사전 검증 (Hard Rule #3)
    - CustomerService
      - List/Get with pagination

C2. API 핸들러 [S6]
    - GET/POST /api/v1/customers
    - GET/PUT /api/v1/filings/{id}/status
    - GET /api/v1/audit/customers/{id}
    - GET /api/v1/admin/dashboard
```

### Phase D: 빌드 & 통합 (Do 4차)

```
D1. Dockerfile (multi-stage build) [S7]
D2. Makefile (dev/build/test/lint) [S7]
D3. .env.example [S7]
D4. Next.js → Go API 호출 연결 [S8]
```

---

## 5. 5대 보안 규칙 적용

| 규칙 | Go 구현 위치 |
|------|-------------|
| #1 PLATFORM_ADMIN 세금 데이터 접근 차단 | `middleware.BlockPlatformAdmin` |
| #2 Consultant은 JTC 소속 | `Repository` FK + RLS 유지 |
| #3 Tax Filing Actor ≠ Platform | `TaxFilingService.UpdateStatus` 역할 검증 |
| #4 Billing Collector ≠ Service Provider | SYSTEM 전용 라우트 분리 |
| #5 감사 추적 필수 | `AuditRepo.Log` 트랜잭션 내 기록 |

---

## 6. 리스크 및 완화

| 리스크 | 영향 | 확률 | 완화 방안 |
|--------|------|------|----------|
| 트리거 제거 시 기존 Next.js 앱 호환 | High | Medium | Next.js API에도 updated_at 명시적 추가 필요 |
| 두 서버 간 인증 동기화 실패 | High | Low | 동일 Supabase JWT Secret 사용 |
| Go 개발자 수급 (인도네시아) | Medium | Medium | 핵심 로직만 Go, 프론트는 Next.js 유지 |
| DB 마이그레이션 다운타임 | High | Low | 트리거 DROP은 비파괴적, 점진적 적용 |

---

## 7. 성공 기준 (Definition of Done)

- [ ] Go 서버 `make dev`로 실행, Health check 200 OK
- [ ] JWT 인증 + RBAC 미들웨어 동작 (5개 역할 모두)
- [ ] BlockPlatformAdmin → 403 반환 확인
- [ ] Customer CRUD API 동작 (페이지네이션, 검색)
- [ ] Tax Filing 상태 변경 시 트랜잭션 내 감사 로그 기록
- [ ] POA 검증 없이 FILED 상태 변경 시 에러 반환
- [ ] 트리거 제거 마이그레이션 적용 후 기존 기능 정상 동작
- [ ] Docker 빌드 성공 (이미지 < 30MB)
- [ ] `go test ./...` 모든 테스트 통과

---

## 8. 기존 구현 현황

> 이전 세션에서 부분적으로 생성된 파일들

| 파일 | 상태 | 비고 |
|------|------|------|
| `backoffice/go.mod` | ✅ 생성됨 | 의존성 정의 |
| `backoffice/cmd/server/main.go` | ✅ 생성됨 | 메인 엔트리포인트 |
| `backoffice/internal/config/` | ✅ 생성됨 | Config + 테스트 |
| `backoffice/internal/database/` | ✅ 생성됨 | pgxpool 연결 |
| `backoffice/internal/middleware/` | ✅ 생성됨 | Auth, RBAC, Logging |
| `backoffice/internal/model/` | ✅ 생성됨 | 전체 모델 정의 |
| `backoffice/internal/repository/` | ✅ 생성됨 | Audit, Customer, TaxFiling, POA |
| `backoffice/internal/service/` | ✅ 생성됨 | TaxFiling, Customer 서비스 |
| `backoffice/internal/handler/` | ✅ 생성됨 | Health, Customer, TaxFiling, Audit |
| `backoffice/internal/response/` | ✅ 생성됨 | JSON 응답 헬퍼 |
| `backoffice/pkg/auth/` | ✅ 생성됨 | JWT 검증 |
| `backoffice/pkg/logger/` | ✅ 생성됨 | slog 설정 |
| `backoffice/Dockerfile` | ❌ 미생성 | 거부됨 |
| `backoffice/Makefile` | ❌ 미생성 | 거부됨 |
| `backoffice/.env.example` | ❌ 미생성 | |
| DB 트리거 제거 마이그레이션 | ❌ 미생성 | |
| go.sum | ❌ 미생성 | `go mod tidy` 필요 |

---

## 9. 다음 단계

1. **`/pdca design go-backoffice-separation`** → 상세 설계 문서 작성
2. **`/pdca do go-backoffice-separation`** → 구현 시작 (미완성 파일 + 신규 파일)
3. **`/pdca analyze go-backoffice-separation`** → 설계 대비 구현 갭 분석
