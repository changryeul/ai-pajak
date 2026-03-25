# Design: Go 백오피스 분리 및 아키텍처 재설계

> **Feature**: go-backoffice-separation
> **Created**: 2026-03-25
> **Phase**: Design
> **Plan Reference**: [go-backoffice-separation.plan.md](../../01-plan/features/go-backoffice-separation.plan.md)

---

## 1. 시스템 아키텍처

### 1.1 전체 구조 (To-Be)

```
                    ┌─────────────┐
                    │   Vercel CDN │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
┌─────────────────────┐   ┌─────────────────────────┐
│  Next.js (고객 포털)  │   │  Go (백오피스 API)         │
│  Vercel Serverless   │   │  Docker / Cloud Run       │
│  :3000               │   │  :8080                    │
│                      │   │                           │
│  [고객 대면]          │   │  [관리/운영]               │
│  - 로그인/회원가입     │   │  - 고객 관리 CRUD          │
│  - 세금 폼 입력       │   │  - 컨설턴트 배정           │
│  - 문서 업로드/OCR    │   │  - 빌링/인보이스 관리       │
│  - 결제 (Midtrans)   │   │  - 관리자 대시보드 통계     │
│  - POA 서명 워크플로우 │   │  - 감사 로그 조회          │
│  - 세금 신고 (DJP)    │   │  - 구독 관리              │
│  - 리포트 조회        │   │                           │
│  - 알림              │   │  [향후 확장]               │
│                      │   │  - 세금 계산 엔진 (Phase 2) │
│  [유지하는 API]       │   │  - DJP 연동 (Phase 2)      │
│  - /api/tax/*        │   │  - 배치 처리              │
│  - /api/poa/*        │   │  - PDF 생성              │
│  - /api/documents/*  │   │                           │
│  - /api/webhooks/*   │   │                           │
│  - /api/reports/*    │   │                           │
└──────────┬───────────┘   └──────────┬────────────────┘
           │                          │
           └──────────┬───────────────┘
                      ▼
            ┌──────────────────┐
            │   PostgreSQL      │
            │   (Supabase)     │
            │                  │
            │   - RLS 정책 유지  │
            │   - 트리거 전부 제거│
            │   - 헬퍼 함수 유지  │
            └──────────────────┘
```

### 1.2 API 분리 기준

| 기준 | Next.js 유지 | Go 이관 |
|------|-------------|---------|
| **고객 직접 접근** | 세금 폼, 문서, 결제, 리포트 | - |
| **세무사/어드바이저 관리** | - | 고객 CRUD, 컨설턴트 배정 |
| **법적 민감 작업** | DJP 신고, POA 서명 | - |
| **빌링/운영** | - | 인보이스, 구독, 사용량 |
| **관리자 전용** | - | 대시보드 통계 (마스킹) |
| **시스템 내부** | 웹훅, cron | - |

### 1.3 API 이관 상세 목록

#### Go 백오피스로 이관 (7개 엔드포인트)

| # | Endpoint | Method | 현재 Next.js | Go 신규 |
|---|----------|--------|-------------|---------|
| 1 | 고객 목록 | GET | `/api/customers` | `/api/v1/customers` |
| 2 | 고객 상세 | GET | `/api/customers/[id]` | `/api/v1/customers/{id}` |
| 3 | 고객 수정 | PATCH | `/api/customers/[id]` | `/api/v1/customers/{id}` |
| 4 | 컨설턴트 배정 | POST/DELETE/GET | `/api/customers/[id]/assign` | `/api/v1/customers/{id}/assign` |
| 5 | 인보이스 조회 | GET | `/api/billing/invoices` | `/api/v1/billing/invoices` |
| 6 | 구독 관리 | GET | `/api/billing/subscription` | `/api/v1/billing/subscription` |
| 7 | 관리자 대시보드 | GET | `/api/admin/dashboard` | `/api/v1/admin/dashboard` |

#### Next.js에 유지 (나머지 전부)

- `/api/tax/*` — 세금 계산, SPT 양식, 신고 (법적 민감)
- `/api/poa/*` — 위임장 서명 워크플로우
- `/api/documents/*` — 문서 관리/OCR
- `/api/webhooks/*` — DJP, Midtrans 웹훅
- `/api/reports/*` — 고객 리포트
- `/api/auth/*` — 인증
- `/api/notifications/*` — 알림
- `/api/health` — 헬스체크

---

## 2. Go 패키지 설계

### 2.1 디렉토리 구조

```
backoffice/
├── cmd/
│   └── server/
│       └── main.go              # 서버 엔트리포인트
├── internal/
│   ├── config/
│   │   ├── config.go            # ✅ 구현됨
│   │   └── config_test.go       # ✅ 구현됨
│   ├── database/
│   │   └── postgres.go          # ✅ 구현됨 (pgxpool)
│   ├── middleware/
│   │   ├── auth.go              # ✅ 구현됨 (JWT + DB role 조회)
│   │   ├── rbac.go              # ✅ 구현됨 (RequireRole, BlockPlatformAdmin)
│   │   └── logging.go           # ✅ 구현됨
│   ├── model/
│   │   └── models.go            # ✅ 구현됨 (전체 enum + struct)
│   ├── repository/
│   │   ├── audit.go             # ✅ 구현됨 (Log, ListByCustomer)
│   │   ├── customer.go          # ✅ 구현됨 (CRUD + 검색)
│   │   ├── tax_filing.go        # ✅ 구현됨 (상태변경 + FOR UPDATE)
│   │   ├── poa.go               # ✅ 구현됨 (HasActivePOA, GeneratePOANumber)
│   │   ├── billing.go           # ❌ 신규 — 인보이스/구독 조회
│   │   └── consultant.go        # ❌ 신규 — 컨설턴트 조회/배정
│   ├── service/
│   │   ├── customer.go          # ✅ 구현됨 (List, GetByID)
│   │   ├── tax_filing.go        # ✅ 구현됨 (UpdateStatus + 감사)
│   │   ├── billing.go           # ❌ 신규 — 빌링 서비스
│   │   └── admin.go             # ❌ 신규 — 대시보드 통계
│   ├── handler/
│   │   ├── health.go            # ✅ 구현됨
│   │   ├── customer.go          # ✅ 구현됨 (List, GetByID)
│   │   ├── tax_filing.go        # ✅ 구현됨 (List, GetByID, UpdateStatus)
│   │   ├── audit.go             # ✅ 구현됨 (ListByCustomer)
│   │   ├── billing.go           # ❌ 신규 — 빌링 핸들러
│   │   └── admin.go             # ❌ 신규 — 관리자 핸들러
│   └── response/
│       └── response.go          # ✅ 구현됨
├── pkg/
│   ├── auth/
│   │   └── jwt.go               # ✅ 구현됨 (Supabase JWT 검증)
│   └── logger/
│       └── logger.go            # ✅ 구현됨 (slog JSON)
├── go.mod                       # ✅ 구현됨
├── go.sum                       # ❌ 미생성 (go mod tidy 필요)
├── Dockerfile                   # ❌ 미생성
├── Makefile                     # ❌ 미생성
├── .env.example                 # ❌ 미생성
└── README.md                    # ❌ 미생성
```

### 2.2 구현 현황 요약

| 분류 | 파일 수 | 라인 수 | 상태 |
|------|--------|--------|------|
| 기존 구현 | 22 | 1,746 | 컴파일 가능 (이슈 1건) |
| 신규 필요 | 8 | ~600 예상 | 미구현 |

**알려진 이슈**: `service/tax_filing.go:73` — JTC ID 하드코딩 → consultant의 `tax_partner_id` 조회로 수정 필요

---

## 3. 신규 구현 상세 설계

### 3.1 ConsultantRepo (신규)

```go
// internal/repository/consultant.go

type ConsultantRepo struct {
    pool *pgxpool.Pool
}

// GetByUserID: Auth 미들웨어에서 로드된 user_id로 consultant 조회
func (r *ConsultantRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*model.Consultant, error)
// 쿼리: SELECT * FROM consultant WHERE user_id = $1 AND is_active = true

// GetTaxPartnerID: consultant의 tax_partner_id 반환 (POA 검증용)
func (r *ConsultantRepo) GetTaxPartnerID(ctx context.Context, consultantID uuid.UUID) (uuid.UUID, error)
// 쿼리: SELECT tax_partner_id FROM consultant WHERE id = $1

// AssignCustomer: customer_consultant 테이블에 배정 추가
func (r *ConsultantRepo) AssignCustomer(ctx context.Context, customerID, consultantID, assignedByUserID uuid.UUID) error
// 쿼리: INSERT INTO customer_consultant (customer_id, consultant_id, assigned_by_user_id, is_active, updated_at)
//        VALUES ($1, $2, $3, true, NOW())
//        ON CONFLICT (customer_id, consultant_id) WHERE is_active = true DO NOTHING

// UnassignCustomer: 배정 해제 (소프트 삭제)
func (r *ConsultantRepo) UnassignCustomer(ctx context.Context, customerID, consultantID uuid.UUID) error
// 쿼리: UPDATE customer_consultant SET is_active = false, updated_at = NOW()
//        WHERE customer_id = $1 AND consultant_id = $2 AND is_active = true

// ListAssignedCustomers: 컨설턴트에 배정된 고객 목록
func (r *ConsultantRepo) ListAssignedCustomers(ctx context.Context, consultantID uuid.UUID) ([]uuid.UUID, error)
// 쿼리: SELECT customer_id FROM customer_consultant
//        WHERE consultant_id = $1 AND is_active = true
```

### 3.2 BillingRepo (신규)

```go
// internal/repository/billing.go

type BillingRepo struct {
    pool *pgxpool.Pool
}

// ListInvoices: 고객별 인보이스 목록 (페이지네이션)
func (r *BillingRepo) ListInvoices(ctx context.Context, customerID uuid.UUID, page, perPage int) ([]model.BillingTransaction, int, error)
// 쿼리: SELECT * FROM billing_transaction WHERE customer_id = $1
//        ORDER BY created_at DESC LIMIT $2 OFFSET $3

// GetSubscription: 고객 활성 구독 조회
func (r *BillingRepo) GetSubscription(ctx context.Context, customerID uuid.UUID) (*model.Subscription, error)
// 쿼리: SELECT * FROM subscription WHERE customer_id = $1 AND is_active = true

// GetUsageMetrics: 현재 기간 사용량 조회
func (r *BillingRepo) GetUsageMetrics(ctx context.Context, customerID uuid.UUID) (*model.UsageMetrics, error)
// 쿼리:
//   tax_filings_count: SELECT COUNT(*) FROM tax_filing WHERE customer_id = $1 AND tax_period LIKE $currentYear
//   documents_count: SELECT COUNT(*) FROM tax_document td JOIN tax_filing tf ON ... WHERE tf.customer_id = $1
//   storage_bytes: SELECT COALESCE(SUM(file_size_bytes), 0) FROM tax_document td JOIN ...
```

### 3.3 AdminService (신규)

```go
// internal/service/admin.go

type AdminService struct {
    pool   *pgxpool.Pool
    logger *slog.Logger
}

type DashboardStats struct {
    TotalCustomers     int            `json:"total_customers"`
    TotalConsultants   int            `json:"total_consultants"`
    TotalFilings       int            `json:"total_filings"`
    FilingsByStatus    map[string]int `json:"filings_by_status"`
    FilingsByType      map[string]int `json:"filings_by_type"`
    RevenueThisMonth   int64         `json:"revenue_this_month"`
    ActiveSubscriptions int           `json:"active_subscriptions"`
    PendingPOAs        int            `json:"pending_poas"`
}

// GetDashboardStats: 집계 통계 (PII 없음, 마스킹 적용)
func (s *AdminService) GetDashboardStats(ctx context.Context) (*DashboardStats, error)
// 쿼리들:
//   SELECT COUNT(*) FROM customer
//   SELECT COUNT(*) FROM consultant WHERE is_active = true
//   SELECT COUNT(*) FROM tax_filing
//   SELECT status, COUNT(*) FROM tax_filing GROUP BY status
//   SELECT tax_type, COUNT(*) FROM tax_filing GROUP BY tax_type
//   SELECT COALESCE(SUM(amount_total), 0) FROM billing_transaction
//          WHERE payment_status = 'PAID' AND created_at >= date_trunc('month', NOW())
//   SELECT COUNT(*) FROM subscription WHERE is_active = true
//   SELECT COUNT(*) FROM power_of_attorney WHERE status = 'PENDING_SIGNATURE'
```

### 3.4 모델 추가 (models.go에 추가)

```go
// 기존 models.go에 추가

type BillingTransaction struct {
    ID                   uuid.UUID `json:"id"`
    CustomerID           uuid.UUID `json:"customer_id"`
    TransactionType      string    `json:"transaction_type"`
    AmountTotal          float64   `json:"amount_total"`
    AmountBase           float64   `json:"amount_base"`
    AmountTax            float64   `json:"amount_tax"`
    Currency             string    `json:"currency"`
    PaymentStatus        string    `json:"payment_status"`
    PaymentMethod        *string   `json:"payment_method"`
    InvoiceNumber        *string   `json:"invoice_number"`
    ServiceType          *string   `json:"service_type"`
    Description          *string   `json:"description"`
    BillingPeriod        *string   `json:"billing_period"`
    DueDate              *time.Time `json:"due_date"`
    PaidAt               *time.Time `json:"paid_at"`
    CreatedAt            time.Time  `json:"created_at"`
    UpdatedAt            time.Time  `json:"updated_at"`
}

type Subscription struct {
    ID                 uuid.UUID `json:"id"`
    CustomerID         uuid.UUID `json:"customer_id"`
    PlanType           string    `json:"plan_type"`
    BillingCycle       string    `json:"billing_cycle"`
    Price              float64   `json:"price"`
    CurrentPeriodStart time.Time `json:"current_period_start"`
    CurrentPeriodEnd   time.Time `json:"current_period_end"`
    IsActive           bool      `json:"is_active"`
    CancelledAt        *time.Time `json:"cancelled_at"`
    CreatedAt          time.Time  `json:"created_at"`
    UpdatedAt          time.Time  `json:"updated_at"`
}

type UsageMetrics struct {
    TaxFilingsCount int   `json:"tax_filings_count"`
    DocumentsCount  int   `json:"documents_count"`
    StorageBytes    int64 `json:"storage_bytes"`
}
```

---

## 4. DB 트리거 제거 마이그레이션 상세 설계

### 4.1 제거 대상 (26개 트리거 + 5개 함수)

#### Category A: updated_at 자동 갱신 트리거 (22개)

| # | 트리거명 | 테이블 | 타입 |
|---|---------|--------|------|
| 1 | update_platform_owner_updated_at | platform_owner | BEFORE UPDATE |
| 2 | update_platform_updated_at | platform | BEFORE UPDATE |
| 3 | update_tax_partner_updated_at | tax_partner | BEFORE UPDATE |
| 4 | update_user_roles_updated_at | user_roles | BEFORE UPDATE |
| 5 | update_consultant_updated_at | consultant | BEFORE UPDATE |
| 6 | update_tax_advisor_updated_at | tax_advisor | BEFORE UPDATE |
| 7 | update_customer_updated_at | customer | BEFORE UPDATE |
| 8 | update_tax_filing_updated_at | tax_filing | BEFORE UPDATE |
| 9 | update_billing_transaction_updated_at | billing_transaction | BEFORE UPDATE |
| 10 | update_revenue_split_updated_at | revenue_split | BEFORE UPDATE |
| 11 | update_subscription_updated_at | subscription | BEFORE UPDATE |
| 12 | update_poa_updated_at | power_of_attorney | BEFORE UPDATE |
| 13 | update_tax_calculation_updated_at | tax_calculation | BEFORE UPDATE |
| 14 | update_notification_updated_at | notification | BEFORE UPDATE |
| 15 | update_notification_preferences_updated_at | notification_preferences | BEFORE UPDATE |
| 16 | update_customer_consultant_updated_at | customer_consultant | BEFORE UPDATE |
| 17 | update_document_updated_at | document | BEFORE UPDATE |
| 18 | update_djp_job_updated_at | djp_job | BEFORE UPDATE |
| 19 | update_djp_billing_updated_at | djp_billing | BEFORE UPDATE |
| 20 | update_tax_law_analyses_updated_at | tax_law_analyses | BEFORE UPDATE |
| 21 | update_dynamic_tax_rates_updated_at | dynamic_tax_rates | BEFORE UPDATE |
| 22 | update_luxury_items_updated_at | luxury_item_classifications | BEFORE UPDATE |

**대체 전략**: 모든 UPDATE 쿼리에 `updated_at = NOW()` 명시적 포함
- Go Repository: 이미 적용됨 (`customer.go`, `tax_filing.go`)
- Next.js API: **수정 필요** — Supabase `.update()` 호출 시 `updated_at: new Date().toISOString()` 추가

#### Category B: 비즈니스 로직 트리거 (4개)

| # | 트리거명 | 함수 | 테이블 | 로직 |
|---|---------|------|--------|------|
| 23 | tax_filing_audit_trigger | log_tax_filing_activity() | tax_filing | AFTER INSERT/UPDATE/DELETE → tax_activity_log |
| 24 | poa_audit_trigger | log_poa_activity() | power_of_attorney | AFTER INSERT/UPDATE → tax_activity_log |
| 25 | validate_tax_filing_poa_trigger | validate_tax_filing_poa() | tax_filing | BEFORE UPDATE → POA 검증 |
| 26 | generate_poa_number_trigger | generate_poa_number() | power_of_attorney | BEFORE INSERT → POA 번호 생성 |

**대체 전략**:

| 트리거 | Go 대체 | Next.js 대체 |
|--------|---------|-------------|
| #23 tax_filing_audit | `AuditRepo.Log()` 트랜잭션 내 | `/api/tax/filings` POST/PATCH에 감사 로그 INSERT 추가 |
| #24 poa_audit | Go에 해당 없음 (POA는 Next.js) | `/api/poa/*` 라우트에 감사 로그 INSERT 추가 |
| #25 validate_poa | `TaxFilingService.UpdateStatus()` | `/api/tax/file` POST에 POA 검증 유지 (이미 미들웨어) |
| #26 generate_poa_number | `POARepo.GeneratePOANumber()` | `/api/poa/create`에서 시퀀스 직접 호출 |

### 4.2 유지 대상

#### RLS 헬퍼 함수 (유지)
```sql
-- 이 함수들은 RLS 정책에서 사용되므로 반드시 유지
get_user_role()              -- user_roles 테이블에서 역할 조회
get_user_organization_id()   -- 조직 ID 조회
get_user_organization_type() -- 조직 타입 조회
is_customer()                -- CUSTOMER 역할 확인
is_jtc_consultant()          -- CONSULTANT_JTC or TAX_ADVISOR_JTC 확인
is_platform_admin()          -- PLATFORM_ADMIN 확인
get_customer_id()            -- customer 테이블 ID 조회
get_consultant_id()          -- consultant 테이블 ID 조회
has_active_poa()             -- POA 유효성 확인 (RLS에서 사용)
update_poa_status()          -- POA 만료 상태 갱신
```

#### 시퀀스 (유지)
```sql
poa_number_seq  -- POA 번호 생성용 시퀀스 (앱에서 nextval 직접 호출)
```

### 4.3 마이그레이션 SQL

```sql
-- 파일명: supabase/migrations/20260325000001_remove_all_triggers.sql
-- 설명: 모든 트리거를 제거하고 앱 레벨 처리로 전환
-- 주의: 비파괴적 작업 (데이터 손실 없음)

-- ============================================
-- Step 1: updated_at 트리거 제거 (22개)
-- ============================================
DROP TRIGGER IF EXISTS update_platform_owner_updated_at ON platform_owner;
DROP TRIGGER IF EXISTS update_platform_updated_at ON platform;
DROP TRIGGER IF EXISTS update_tax_partner_updated_at ON tax_partner;
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
DROP TRIGGER IF EXISTS update_consultant_updated_at ON consultant;
DROP TRIGGER IF EXISTS update_tax_advisor_updated_at ON tax_advisor;
DROP TRIGGER IF EXISTS update_customer_updated_at ON customer;
DROP TRIGGER IF EXISTS update_tax_filing_updated_at ON tax_filing;
DROP TRIGGER IF EXISTS update_billing_transaction_updated_at ON billing_transaction;
DROP TRIGGER IF EXISTS update_revenue_split_updated_at ON revenue_split;
DROP TRIGGER IF EXISTS update_subscription_updated_at ON subscription;
DROP TRIGGER IF EXISTS update_poa_updated_at ON power_of_attorney;
DROP TRIGGER IF EXISTS update_tax_calculation_updated_at ON tax_calculation;
DROP TRIGGER IF EXISTS update_notification_updated_at ON notification;
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
DROP TRIGGER IF EXISTS update_customer_consultant_updated_at ON customer_consultant;
DROP TRIGGER IF EXISTS update_document_updated_at ON document;
DROP TRIGGER IF EXISTS update_djp_job_updated_at ON djp_job;
DROP TRIGGER IF EXISTS update_djp_billing_updated_at ON djp_billing;
DROP TRIGGER IF EXISTS update_tax_law_analyses_updated_at ON tax_law_analyses;
DROP TRIGGER IF EXISTS update_dynamic_tax_rates_updated_at ON dynamic_tax_rates;
DROP TRIGGER IF EXISTS update_luxury_items_updated_at ON luxury_item_classifications;

-- ============================================
-- Step 2: 비즈니스 로직 트리거 제거 (4개)
-- ============================================
DROP TRIGGER IF EXISTS tax_filing_audit_trigger ON tax_filing;
DROP TRIGGER IF EXISTS poa_audit_trigger ON power_of_attorney;
DROP TRIGGER IF EXISTS validate_tax_filing_poa_trigger ON tax_filing;
DROP TRIGGER IF EXISTS generate_poa_number_trigger ON power_of_attorney;

-- ============================================
-- Step 3: 트리거 전용 함수 제거 (5개)
-- ============================================
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS log_tax_filing_activity();
DROP FUNCTION IF EXISTS log_poa_activity();
DROP FUNCTION IF EXISTS validate_tax_filing_poa();
DROP FUNCTION IF EXISTS generate_poa_number();

-- ============================================
-- Step 4: 코멘트 추가 (운영 가이드)
-- ============================================
COMMENT ON TABLE tax_activity_log IS
  'Audit log - INSERT only from app layer (Go/Next.js). DB triggers removed 2026-03-25.';
COMMENT ON TABLE tax_filing IS
  'POA validation and audit logging handled by app layer. Triggers removed 2026-03-25.';
COMMENT ON TABLE power_of_attorney IS
  'POA number generation via app-level nextval(poa_number_seq). Triggers removed 2026-03-25.';
```

### 4.4 Next.js 코드 수정 (트리거 제거 대응)

트리거 제거 후 Next.js API Routes에서 반드시 수정해야 할 파일:

| 파일 | 수정 내용 |
|------|----------|
| `src/app/api/tax/filings/route.ts` (POST) | `updated_at: new Date().toISOString()` 추가 + 감사 로그 INSERT |
| `src/app/api/tax/filings/[id]/route.ts` (PATCH) | `updated_at` 명시적 추가 |
| `src/app/api/poa/create/route.ts` (POST) | `nextval('poa_number_seq')` 호출로 POA 번호 생성 |
| `src/app/api/poa/[id]/route.ts` (PATCH) | `updated_at` 추가 + 감사 로그 INSERT |
| `src/app/api/poa/[id]/customer-sign/route.ts` | 감사 로그 INSERT 추가 |
| `src/app/api/poa/[id]/advisor-sign/route.ts` | 감사 로그 INSERT 추가 |
| `src/app/api/poa/[id]/revoke/route.ts` | 감사 로그 INSERT 추가 |
| `src/app/api/customers/[id]/route.ts` (PATCH) | `updated_at` 추가 |
| `src/app/api/billing/create/route.ts` | `updated_at` 추가 |
| `src/app/api/settings/*/route.ts` | `updated_at` 추가 |

**추정 수정 규모**: ~15개 API Route 파일, 각각 1-3줄 수정

---

## 5. 인증 흐름 설계

### 5.1 공유 인증 체계

```
                    Supabase Auth
                    (JWT 발급)
                         │
           ┌─────────────┼─────────────┐
           ▼                           ▼
    Next.js Middleware            Go Auth Middleware
    (cookie-based)               (Bearer token)
           │                           │
    @supabase/ssr               golang-jwt/jwt/v5
    createClient()               VerifyToken()
           │                           │
           ▼                           ▼
    RLS 자동 적용                 user_roles DB 조회
    (Supabase SDK)               (pgx 직접 쿼리)
```

**핵심**: 동일한 `SUPABASE_JWT_SECRET`을 사용하므로 토큰 호환성 보장

### 5.2 Go Auth 미들웨어 흐름

```
Request → Extract Bearer Token
       → jwt.ParseWithClaims(token, secret)
       → claims.UserID() → uuid.Parse(sub)
       → SELECT role FROM user_roles WHERE user_id = $1 AND is_active = true
       → Set Context: (UserID, Role, OrgID, OrgType, IP, UA)
       → next.ServeHTTP()
```

---

## 6. 감사 로그 설계 (트리거 대체)

### 6.1 감사 로그 흐름

```
[Service Layer]
     │
     ├─ Begin Transaction
     │
     ├─ SELECT ... FOR UPDATE (기존 상태 조회)
     │
     ├─ UPDATE ... SET status = $new, updated_at = NOW()
     │
     ├─ INSERT INTO tax_activity_log (
     │      customer_id, tax_filing_id, actor_user_id,
     │      actor_role, activity_type,
     │      activity_details: {"old_status": X, "new_status": Y},
     │      ip_address, user_agent
     │  )
     │
     └─ COMMIT
```

### 6.2 감사 보장

- **트랜잭션 내 원자성**: 상태 변경과 감사 로그가 동일 트랜잭션
- **감사 실패 시 롤백**: 로그 INSERT 실패하면 상태 변경도 롤백
- **FOR UPDATE 잠금**: 동시 수정 방지

---

## 7. 구현 순서 (Do Phase 가이드)

### Step 1: 미완성 파일 완성 (빌드 환경)
```
1.1 go.sum 생성 (go mod tidy)
1.2 Dockerfile 작성
1.3 Makefile 작성
1.4 .env.example 작성
```

### Step 2: 알려진 이슈 수정
```
2.1 service/tax_filing.go — JTC ID 하드코딩 → ConsultantRepo.GetTaxPartnerID() 사용
```

### Step 3: 신규 Repository 구현
```
3.1 repository/consultant.go (GetByUserID, GetTaxPartnerID, Assign/Unassign)
3.2 repository/billing.go (ListInvoices, GetSubscription, GetUsageMetrics)
```

### Step 4: 신규 Service 구현
```
4.1 service/admin.go (GetDashboardStats)
4.2 service/billing.go (ListInvoices, GetSubscription)
```

### Step 5: 신규 Handler + 라우트 등록
```
5.1 handler/billing.go
5.2 handler/admin.go
5.3 handler/customer.go에 Assign/Unassign 핸들러 추가
5.4 cmd/server/main.go 라우트 추가
```

### Step 6: 모델 추가
```
6.1 model/models.go에 BillingTransaction, Subscription, UsageMetrics 추가
```

### Step 7: DB 마이그레이션
```
7.1 supabase/migrations/20260325000001_remove_all_triggers.sql 작성
7.2 Next.js API Route 수정 (updated_at + 감사 로그)
```

### Step 8: 테스트
```
8.1 go mod tidy && go build ./...
8.2 go test ./...
8.3 Docker 빌드 확인
```

---

## 8. 성공 기준 (Design → Do 게이트)

| # | 기준 | 검증 방법 |
|---|------|----------|
| 1 | Go 서버 정상 빌드 및 실행 | `make build && make dev` |
| 2 | 22개 파일 컴파일 에러 없음 | `go build ./...` |
| 3 | 헬스체크 정상 | `curl localhost:8080/health` → 200 |
| 4 | JWT 인증 동작 | Supabase 토큰으로 /api/v1/customers 호출 |
| 5 | 5대 보안 규칙 적용 | PLATFORM_ADMIN → 403, CUSTOMER → 403 등 |
| 6 | 감사 로그 트랜잭션 내 기록 | Filing 상태 변경 시 tax_activity_log 확인 |
| 7 | 트리거 제거 마이그레이션 적용 | `supabase migration up` 성공 |
| 8 | Next.js 기존 기능 정상 | 트리거 제거 후 E2E 테스트 통과 |
| 9 | Docker 이미지 < 30MB | `docker images` 확인 |
| 10 | 단위 테스트 통과 | `go test ./...` |
