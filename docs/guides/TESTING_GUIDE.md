# AI Pajak 전체 시스템 테스트 가이드

> **대상 독자**: AI Pajak을 처음 테스트하거나 새 기능 회귀 검증을 해야 하는 모든 사람.
> **목표**: 5 역할 시점에서 단독 시나리오 + 다중 역할 닫힌 루프를 검증하고, 발견된 이슈를 표준 형식으로 보고할 수 있게 한다.
>
> 작성: 2026-05 / 마지막 갱신: 2026-05-08

---

## 0. 이 문서를 읽는 방법

| 처음이라면 | 회귀 테스트만 하려면 | 이슈를 보고하려면 |
|---|---|---|
| §1~3을 순서대로 읽고, §4의 「10분 smoke」 부터 시작 | §4 자동화 + §11 빠른 체크리스트 | §12 보고 형식 그대로 |

**소요 시간 목안**:
- 10분 smoke (자동) — **10분**
- 5 역할 단독 시나리오 — **각 15~30분**, 총 **2~3시간**
- 7 크로스체크 시나리오 — **각 10~20분**, 총 **1.5시간**
- 풀 회귀 (모든 항목) — **반나절**

---

## 1. 시스템 개요와 5 역할 모델

AI Pajak은 인도네시아 세무 신고 자동화 플랫폼입니다. 사용자는 크게 5 역할로 구분되며, 같은 역할 내에서도 서브타입(권한 차이)이 존재합니다.

### 1-1. 왜 5 역할인가

```
┌─────────────────┐         ┌─────────────────────────┐
│ ① 개인 고객      │         │ ⑤ 어드민                │
│ ② 법인 고객      │  세금   │ - 플랫폼 운영 (Monitoring)│
│  (납세자)       │  서비스  │ - 고객 데이터 접근 금지   │
└─────────────────┘   ↕     └─────────────────────────┘
        ↕                            
┌─────────────────────────────────────────────────┐
│ ③ 상담사                                          │
│  ├─ JTC 컨설턴트 (외부 고객 대면)                  │
│  ├─ 외부 세무법인 컨설턴트 (자기 partner 고객 한정) │
│  └─ JTC 내부 운영팀 (백오피스, 신고 처리 라인)      │
│      ├─ 상담원 (큐 처리)                          │
│      ├─ 슈퍼바이저 (승인 / 큐 분배 / 팀 관리)       │
│      └─ 마스터 (전체 KPI / 가격 결정)               │
└─────────────────────────────────────────────────┘
        ↕
┌─────────────────┐
│ ④ 어드바이저     │  ← 신고 제출 권한 (POA 필요)
└─────────────────┘
```

- **고객**(① ②)은 자기 데이터만 보고, 신고서 작성/제출/결제를 한다.
- **상담사**(③)는 고객 데이터에 접근해 도와주거나 신고를 처리한다. 외부 고객 대면(JTC 컨설턴트, 외부 컨설턴트)과 내부 운영(상담원/슈퍼바이저/마스터)이 같은 역할 안에서 분기.
- **어드바이저**(④)는 상담사 권한 + **신고 제출 권한**. 라이센스 보유 어드바이저만 가능.
- **어드민**(⑤)은 플랫폼 자체 관리. 모니터링/사용자 관리/감사로그. **고객 세금 데이터 접근 금지** (Hard Rule #1).

### 1-2. 「상담사」 권한 차이 (서브타입별)

| 서브타입 | 신고 제출 | 케이스 승인 | 가격 결정 | 큐 관리 | 진입 페이지 |
|---|---|---|---|---|---|
| JTC 컨설턴트 | × | × | × | × | `/dashboard` 컨설턴트 |
| 외부 세무법인 컨설턴트 | ○ (자기 partner) | × | × | × | `/dashboard` 컨설턴트 |
| 운영팀 — 상담원 | × (큐 처리만) | × | × | × | `/operator/my-work` |
| 운영팀 — 슈퍼바이저 | × | ○ | × | ○ | `/operator/dashboard` |
| 운영팀 — 마스터 | × | ○ | ○ | ○ | `/admin/master` |

### 1-3. 코드 enum (참고)

코드 내부에서는 더 세분화돼 있지만 가이드는 5 역할 시점에서 진행합니다:

| 5 역할 | 코드 enum |
|---|---|
| ① 개인 고객 | `CUSTOMER` + `customer_type='INDIVIDUAL'` |
| ② 법인 고객 | `CUSTOMER` + `customer_type='COMPANY'` |
| ③ 상담사 | `CONSULTANT` (JTC + 외부) / `TAX_OPERATOR` / `TAX_OPERATOR_LEAD` / `TAX_OPERATOR_SUPERVISOR` / `TAX_OPERATOR_MASTER` |
| ④ 어드바이저 | `TAX_ADVISOR` |
| ⑤ 어드민 | `PLATFORM_ADMIN` |

> **시스템(`SYSTEM`)**: 자동 결제 처리용 service-role. 사용자 계정 아니라 시나리오에서 제외.

---

## 2. 사전 준비

### 2-1. 환경 선택

| 환경 | URL | 언제 쓰나 |
|---|---|---|
| **prod** ⭐ 권장 | `https://ai-pajak.vercel.app` | 일반 테스트, 데모, 배포 검증 |
| local dev | `http://localhost:3000` | 새 기능 개발, 디버깅 |

> **메모리 정책**: 「프로덕션도 테스트 환경」. 마이그레이션/배포/시드 자유. prod에 데이터 누적 OK.

local dev로 띄우려면:
```bash
# 1. Supabase 로컬 DB
supabase start

# 2. 마이그레이션 동기화 (한 번)
supabase migration up --include-all

# 3. dev server
npm run dev
```

### 2-2. 시드 (한 번만)

각 역할의 테스트 계정을 만들고, 운영팀 데모 케이스(C-001~C-006)를 채워 넣습니다.

```bash
# 기본 사용자 — JTC 고객 / JTC 컨설턴트 / 어드바이저 / 어드민
npm run db:seed-test-users

# 운영팀 12명 + 외부 세무법인(PT Mitra Pajak Sentosa) + 그 컨설턴트
SEED_TARGET=local npx tsx scripts/seed-master-and-external.ts

# company.test@ 를 COMPANY 고객으로 패치 (listUsers 페이지네이션 우회)
SEED_TARGET=local npx tsx scripts/seed-company-customer.ts

# 슈퍼바이저 데모 — 6 케이스(C-001~C-006) + EMP001~012 + SUP001~003
SEED_TARGET=local npx tsx scripts/seed-supervisor-demo.ts
```

prod에 적용하려면 `SEED_TARGET=local` → `SEED_TARGET=prod`. **모든 시드는 idempotent**(여러 번 돌려도 안전).

### 2-3. 자동 회귀 (먼저 ✅ 확인)

**수동 테스트를 시작하기 전 5분만 투자**하면 데이터/스키마가 정상인지 한 번에 확인할 수 있습니다.

```bash
# 1. 4 demo 케이스가 EMP001에 배정되어 있고 review_summary가 정상인가
SEED_TARGET=prod npx tsx scripts/verify-staff-demo-cases.ts

# 2. Phase 1~6 데이터 흐름이 깨지지 않았나 (KPI / reviewItems / coretax_step_log 테이블 존재 등)
SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts

# 3. 결산 wizard ↔ 운영팀 BPE 자동 동기화 (임시 row 만들었다 정리)
SEED_TARGET=prod npx tsx scripts/test-closing-bpe-sync.ts

# 4. JTC ↔ 외부 세무법인 RLS 격리
SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts

# 5. 결제 (3 endpoint smoke, graceful-degrade 응답 허용)
SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts

# E2E
npm run test:e2e:operator-staff         # API 회귀 9 cases
npm run test:e2e:operator-staff-pages   # UI 렌더링 6 cases
```

**전부 ✅ 떨어진 후** 수동 시나리오로. 이 중 하나라도 실패하면 그것부터 잡고 시작.

### 2-4. 도구 / 화면 준비

| 도구 | 왜 |
|---|---|
| 브라우저 개발자도구 (Cmd+Opt+I) | 콘솔 에러 / Network 탭 / localStorage 확인 |
| 시크릿 창 ⭐ | 캐시 무효화 + 다른 역할 동시 로그인 (한 브라우저에 여러 세션) |
| 터미널 | 자동 회귀 / 시드 재실행 |

> ⚠️ **여러 역할을 동시에 검증할 때**: 한 브라우저로 ①을 일반 창, ③을 시크릿 창에서 띄우면 두 세션이 동시에 살아있어 시나리오 ②(닫힌 루프) 검증이 빠릅니다.

---

## 3. 계정 일람

각 줄의 「진입 후 도착 페이지」는 로그인 후 자동으로 가는 곳입니다.

| 역할 | 계정 | 비번 | 진입 후 도착 |
|---|---|---|---|
| **① 개인 고객** | `customer.test@example.com` | `TestPassword123!` | `/dashboard` 개인 |
| **② 법인 고객** | `company.test@example.com` | `TestPassword123!` | `/dashboard` 법인 (5 dropdown 사이드바) |
| **③ 상담사 — JTC** | `consultant.test@jakartatax.co.id` | `TestPassword123!` | `/dashboard` 컨설턴트 |
| **③ 상담사 — 외부** | `external.consultant@mitrapajak.com` | `TestPassword123!` | `/dashboard` 컨설턴트 (다른 partner) |
| **③ 상담사 — 운영팀(상담원)** | `op-emp001@aipajak.com` | `TestPassword123!` | **`/operator/my-work`** ⭐ |
| **③ 상담사 — 운영팀(슈퍼바이저)** | `sv-annual@aipajak.com` (SUP002 박수퍼) | `TestPassword123!` | `/operator/dashboard` 콘솔 |
| **③ 상담사 — 운영팀(마스터)** | `master.test@aipajak.com` | `TestPassword123!` | `/admin/master` |
| **④ 어드바이저** | `advisor.test@jakartatax.co.id` | `TestPassword123!` | `/dashboard` 컨설턴트 (어드바이저 권한) |
| **⑤ 어드민** | `admin.test@aipajak.com` | `TestPassword123!` | `/dashboard` 어드민 |

### 운영팀 12명 (필요 시)

| ID | 이름 | 슈퍼바이저 | work_state | 시드된 active 케이스 |
|---|---|---|---|---|
| **EMP001** ⭐ | 김상담 | SUP001 | reviewing | **4건 (C-001/002/005/006)** |
| EMP002 | 이상담 | SUP001 | available | 1건 (C-003) |
| EMP003~005 | 박/정/최상담 | SUP001/002/003 | break/coretax/available | 0~1건 |
| EMP006~012 | (생략) | 분산 | 다양 | 0~1건 |

→ EMP001이 모든 시나리오의 주연. 다른 EMP는 시나리오 ⑤ Bulk Transfer 등에서 사용.

### 운영팀 데모 케이스 (EMP001 배정)

| Case | 회사 (NPWP) | 상태 | 우선순위 | reviewItems | ebilling | 사용 흐름 |
|---|---|---|---|---|---|---|
| **C-001** | PT Hijau Lumut (010000020001000) | DATA_REVIEW | HIGH | 0 (시드는 빈 상태) | — | 검토 화면(자료요청/확인완료 흐름) |
| **C-002** | PT ABC (010000030001000) | PENDING_APPROVAL | URGENT | 4 (reviewRequired=3) | — | 승인요청(Final Review) |
| **C-005** | PT Sehat Sentosa (010000060001000) | APPROVED | HIGH | 3 (reviewRequired=0) | — | Coretax ID Billing 발행 |
| **C-006** | PT Maju Bersama (010000070001000) | EBILLING_GENERATED | NORMAL | 3 (reviewRequired=0) | 820123456789012 | Coretax NTPN/BPE |
| C-001-2025 | PT Hijau Lumut (같은 고객) | COMPLETED | NORMAL | 3 | — | 이력 조회(완료된 케이스) |

> ⚠️ **C-001은 review_summary가 비어있는 상태**로 시드됩니다. 검토 화면에서 「Invoice OCR 추가」 또는 manual edit으로 reviewItems를 채울 수 있습니다.

---

## 4. 10분 smoke (가장 빠른 검증)

처음 들어왔을 때 시스템 정상 여부를 빠르게 확인. **모든 항목 ✅** 떨어지면 시스템 살아있음 → 단계별 시나리오로.

### 4-1. 자동 회귀 (1분)

```bash
SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts
```

**기대 출력**:
```
✓ EMP001 active=4
✓ KPI urgent=1, needsReview=3, awaitingApproval=1, coretaxReady=2
✓ C-002 review items=4, reviewRequired=3
✓ C-005 reviewRequired=0
✓ C-006 ebilling=820..., coretax_step_log 존재
✓ case_audit_log readable, PT Hijau Lumut companyCases≥2
✅ All 6 phases pass on prod data.
```

### 4-2. 5 locales × 5 staff pages = 25 라우트 (1분)

```bash
for loc in id en ko ja zh; do
  for path in my-work review-case approval-request coretax history; do
    code=$(curl -sI -o /dev/null -w "%{http_code}" "https://ai-pajak.vercel.app/$loc/operator/$path")
    [ "$code" = "200" ] && echo "✓ $loc/$path" || echo "✗ $loc/$path → $code"
  done
done
```

**기대**: 25개 모두 `✓`. 만약 `✗ 500`이라면 그 페이지에 hooks rule 위반 또는 i18n 누락 가능.

### 4-3. e2e API 회귀 (1분)

```bash
npm run test:e2e:operator-staff
```

**기대**: `8 passed, 1 skipped`.

### 4-4. 수동 (5분) — 5 역할 한 명씩 1분씩 로그인

| 순 | 역할 | 무엇을 보나 |
|---|---|---|
| 1 | ① 개인 고객 | 사이드바 7 평면 메뉴, 어드민 메뉴 안 보임 |
| 2 | ② 법인 고객 | 사이드바 5 dropdown, 결산 wizard 진입 가능 |
| 3 | ③ 상담사(상담원, EMP001) | `/operator/my-work` 자동 이동, KPI + 4 카드 보임 |
| 4 | ④ 어드바이저 | 컨설턴트 화면, 「신고 제출」 버튼 활성 |
| 5 | ⑤ 어드민 | `/admin/monitoring` 진입, `/customers` 시도 → **403** |

전부 OK면 시스템 정상. ❌가 있으면 §12 보고 형식으로.

---

## 5. ① 개인 고객 단독 시나리오

> **시나리오 목적**: 개인 납세자가 SPT Tahunan 1770/1770S/1770SS를 작성하고 ID Billing 발행 + 납부 + NTPN 제출까지의 흐름을 검증.

로그인: `customer.test@example.com / TestPassword123!`

### 5-1. 사이드바 / 라우팅

법인과 다르게 평면 7 메뉴(드롭다운 없이 일렬 나열)가 보여야 합니다. 이건 「개인 고객은 메뉴 단순화 우선」 정책 (메모리: 「시작하기 납세자 선택 제거 요구사항」 + Pribadi keynote 기준).

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 7 메뉴: 대시보드 / 연 신고 / ID Billing 발행 / 세금 보고서 / 내 정보 / 결제 / 도움말 | 좌측 사이드바 직접 보기 |
| [ ] 어드민 메뉴(Monitoring/Cron/Users 등) **안 보임** | RLS + 메뉴 필터링 |
| [ ] 법인 전용 「월 신고」 dropdown **안 보임** | customer_type='INDIVIDUAL' 분기 |

### 5-2. 연 신고 wizard

| 체크 | 어떻게 확인 |
|---|---|
| [ ] `/tax/spt-tahunan` 진입 → 1770SS / 1770S / 1770 카드 3개 | 소득 종류에 따라 분기 |
| [ ] 1770SS 선택 → wizard 5 step 진행 | 1) 고객정보 2) 소득 3) 공제 4) 문서 5) 검토 |
| [ ] 마지막 step에서 PDF 미리보기 | `@react-pdf/renderer` 출력 |
| [ ] 「제출」 → 신고 row 생성 + closing_submission 생성 | DB 확인 |

### 5-3. ID Billing & 결제

| 체크 | 어떻게 확인 |
|---|---|
| [ ] `/tax/billing` Billing 코드 표시 | 시드된 Billing이 있어야 보임 |
| [ ] 「납부 증빙 업로드」 → NTPN 16자리 입력 + 영수증 파일 | 업로드 후 status PAYMENT_UPLOADED |
| [ ] `/billing` Midtrans 결제 페이지 | sandbox 모드 (`MIDTRANS_IS_PRODUCTION≠'true'`) 기본 |

### 5-4. 다국어 ⭐

가장 자주 누락이 발생하는 부분. 모든 텍스트가 모국어로 보여야 합니다.

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 사이드바 우측 하단 「언어」 dropdown → id/en/ko/ja/zh 전환 | URL의 locale prefix가 바뀜 |
| [ ] 결산 「제출 완료」 카드의 status/BPE/NTPN 라벨 모두 모국어 | `<ClosingSubmissionStatus />` |
| [ ] 빨간 raw key (`closingSubmission.title.SUBMITTED` 같이) **안 보임** | i18n 누락 의심 |

> 💡 **raw key가 보이면**: i18n 파일에 키가 누락되었다는 신호. 5 locales 동기화 누락. §12 형식으로 보고.

---

## 6. ② 법인 고객 단독 시나리오

> **시나리오 목적**: 법인 고객의 월 신고(PPh21/23/PPN/UMKM/PPh25), 연 신고(SPT Tahunan Badan/UMKM), 직원 인사 관리 흐름.

로그인: `company.test@example.com / TestPassword123!`

### 6-1. 사이드바 5 dropdown

법인 고객은 메뉴가 많아 **5 큰 dropdown**으로 묶었습니다 (메모리: 60c9ed1 refactor).

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 5 dropdown: 대시보드 / 월 신고 / 연 신고 / 신고관리 / 계정 | 좌측 |
| [ ] dropdown 헤더 클릭 → 펼침/접힘 토글 | 직접 클릭 |
| [ ] 현재 페이지가 속한 dropdown은 **자동 펼침** | 페이지 이동 시 |

### 6-2. 월 신고 (5 메뉴)

| 메뉴 | 페이지 | 핵심 체크 |
|---|---|---|
| PPh21 | `/tax/pph21` | 직원 급여 + 소득세 계산. 「제출」 버튼 |
| PPh23 | `/tax/pph23` | 거래처별 원천세 입력. PMK 141/2015 자동 분류 |
| PPN | `/tax/ppn` | 매출/매입 대시보드 |
| UMKM | `/tax/umkm` | 0.5% final tax 계산 (월별 그리드, 클릭으로 신고월 선택) |
| ID Billing | `/tax/billing` | Billing 발행 + 납부 증빙 |

### 6-3. 연 신고 ⭐ Phase E 핵심

법인 고객이 **결산 wizard 끝까지 진행** → 운영팀이 처리 → 고객 wizard에 BPE 자동 반영. 시나리오 ①(다중 역할)의 시작점.

| 체크 | 어떻게 확인 |
|---|---|
| [ ] `/tax/annual` 결산 wizard 진입 | UMKM 또는 PPh25 분기 선택 |
| [ ] basic / dokumen / sales / cogs / opex / closing / submit 단계 | 각 step navigate 가능 |
| [ ] 마지막 step「SPT 제출 + 결산 완료」 클릭 | toast: "SPT 제출 완료 — 운영팀 검증 대기중" |
| [ ] **`<ClosingSubmissionStatus />` 카드 표시** ⭐ | 화면 하단 노란 카드 (🟡 SUBMITTED) |
| [ ] 운영팀이 처리하면 카드가 자동 갱신 (시나리오 ①에서 검증) | 새로고침 시 색깔 변화 |

`ClosingSubmissionStatus` 카드의 상태별 색상/메시지:

| status | 색상 | 메시지 | 추가 정보 |
|---|---|---|---|
| SUBMITTED | 🟡 amber | 운영팀 검증 대기 | — |
| PROCESSING | 🔵 blue (icon spin) | Coretax 처리 중 | — |
| BPE_UPLOADED | 🔵 blue | BPE 업로드 완료 — NTPN 확인 대기 | — |
| **COMPLETED** | 🟢 emerald | SPT 신고가 정상 접수되었습니다 | **BPE 번호 + NTPN 강조 박스** |
| FAILED | 🔴 rose | 제출 처리 중 오류 | failure_reason 본문 |

### 6-4. 직원 인사 (AI Payroll)

| 체크 | 어떻게 확인 |
|---|---|
| [ ] `/tax/payroll/employees` 직원 master 리스트 | 검색/필터/페이지네이션 |
| [ ] 직원 클릭 → `EmployeeHrRecord.tsx` 12 섹션 편집 | preferred_name / nationality / family / education / career ... |
| [ ] Excel/CSV 일괄 import | 다국어 컬럼 매칭 (English/Indonesian/Korean) |
| [ ] 변경 이력 조회 | `employee_change_log` |

### 6-5. 신고관리

| 메뉴 | 페이지 | 체크 |
|---|---|---|
| 신고이력 | `/filings` | 모든 신고 row + 필터 |
| 세금 보고서 | `/reports` | 기간/세목별 집계 |
| 거래회사 입력 | `/counterparties` | 거래처 master |

### 6-6. 계정

| 체크 | 어떻게 확인 |
|---|---|
| [ ] `/company-profile` 회사 정보 편집 | NPWP/주소/대표자 |
| [ ] `/settings/integrations` Accurate / 회계SW 연동 | OAuth 연결 |
| [ ] `/settings` 보안 (비밀번호 변경 / 2FA) | TOTP 등록/해제 |
| [ ] `/billing` 결제 plan (UMKM/Basic/Pro) | 구독 관리 |
| [ ] `/notifications` 알림 설정 | toggle |

---

## 7. ③ 상담사 단독 시나리오

세 묶음으로 나눠 검증: **3-1 JTC** / **3-2 운영팀(상담원)** / **3-3 운영팀(슈퍼바이저)** / **3-4 운영팀(마스터)**.

운영팀(3-2~3-4)은 백오피스 화면이 별도로 있고 PDF 명세를 따릅니다 (메모리: 「상담원 백오피스」 / 「슈퍼바이저 백오피스」 PDF).

---

### 7-1. 상담사 — JTC 컨설턴트

> **시나리오 목적**: JTC 컨설턴트가 외부 고객을 관리하고 세금 도구를 사용. 신고 제출은 어드바이저(④)만 가능하다는 권한 제약 검증.

로그인: `consultant.test@jakartatax.co.id`

#### 고객 관리 (CRM)

| 체크 | 어떻게 확인 |
|---|---|
| [ ] `/customers` 고객 리스트 | 필터(type / POA status), 정렬(name / date / filings), 페이지네이션 |
| [ ] `/customers/new` 고객 생성 dialog | INDIVIDUAL/COMPANY 선택, 기본 정보 입력 |
| [ ] `/customers/[id]` 5 탭 | profile / filings / poa / notes / activity |
| [ ] 고객 노트 추가 + 핀 (pin) | `customer_note` 테이블 |
| [ ] 고객의 POA 발급/서명 | poa 탭 |

#### 세금 도구

| 메뉴 | 페이지 | 체크 |
|---|---|---|
| 월별 대시보드 | `/tax/monthly-dashboard` | 모든 고객의 월 신고 현황 |
| SPT Masa | `/tax/spt-masa` | 월간 신고서 일괄 |
| PPh21 일괄 | `/tax/pph21-bulk` | 다중 고객 PPh21 |
| 이상치 탐지 | `/tax/anomaly` | 평소 대비 비정상적 거래 |
| 다중 법인 | `/tax/multi-entity` | 그룹사 한 화면 |
| 고객 보고서 | `/tax/report` | 컨설턴트 시점 보고서 |

#### 신고 제출 권한 검증 ⭐

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 고객 신고 작성은 가능 | wizard 진행 |
| [ ] 「제출」 버튼 클릭 시 **차단** | "어드바이저 권한 필요" alert 또는 403 |

> ⚠️ **Hard Rule #3**: 신고 제출은 어드바이저(④)만. JTC 컨설턴트가 고객 신고를 도와줘도 마지막 제출은 어드바이저가 해야 함.

#### 외부 세무법인 컨설턴트 (`external.consultant@mitrapajak.com`)

같은 enum이지만 `tax_partner_id`가 다른 케이스. **Tenant 격리** 검증 (시나리오 ③에서 더 자세히):

| 체크 | 어떻게 확인 |
|---|---|
| [ ] `/customers` JTC 고객 안 보임 | RLS Phase B-1 |
| [ ] 자기 partner의 고객만 보임 | RLS scoped via `get_consultant_tax_partner_id()` |
| [ ] 자기 partner 한정으로 신고 제출 가능 | Phase B-2.1 (외부 컨설턴트는 어드바이저 권한 흡수) |

---

### 7-2. 상담사 — 운영팀(상담원) ⭐⭐ **(가장 큰 검증)**

> **시나리오 목적**: PDF 「백오피스_상담원」 명세대로 EMP001 김상담이 5단계 워크플로우(고객선택 → 검토 → 승인요청 → Coretax → 완료)를 처음부터 끝까지 진행할 수 있는지.

로그인: `op-emp001@aipajak.com / TestPassword123!`
자동 리다이렉트 → `/operator/my-work`

#### 사이드바 + 상단 공통

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 사이드바 5 평면 메뉴: 내 업무 / 검토 / 승인요청 / Coretax 처리 / 이력 | 좌측 |
| [ ] 슈퍼바이저 메뉴(워크로드 관리 / 승인 규칙) **안 보임** ⭐ | role 분기 |
| [ ] 상단 stepper (1 고객선택 → 5 완료) | 현재 단계 자동 highlight |
| [ ] 우상단 「내 상태」 카드 | 김상담 EMP001 + reviewing 배지 + 09:02 / 4건 / 자동배정 가능 |

#### ① 내 업무

> **이 화면이 모든 시나리오의 시작점**. 여기서 고객(케이스) 한 명을 골라 5단계를 진행.

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 4 KPI: 긴급 / 검토필요 / 승인대기 / Coretax 대기 | 시드 기준 1 / 3 / 1 / 2 |
| [ ] 4 케이스 카드 | PT Hijau Lumut(C-001) / PT ABC(C-002) / PT Sehat Sentosa(C-005) / PT Maju Bersama(C-006) |
| [ ] 카드별 4 메트릭 | 검토필요 / 자료요청 / 승인 / NTPN |
| [ ] 다음 작업 다크 배너 | status에 따라 12 안내문 자동 분기 |
| [ ] 카드 클릭 → review-case 이동 | URL이 `/operator/review-case/<uuid>` |
| [ ] localStorage `aip.operator.lastCase` 저장 | DevTools > Application > Local Storage |
| [ ] 빠른 필터 3종 토글 | 승인요청 / Coretax 가능 / 자료요청 |

#### ② 검토 (3-pane)

가장 화면이 큰 페이지. PDF p.3-4 그대로.

| 체크 | 어떻게 확인 |
|---|---|
| [ ] **좌(280px)**: 「내 고객」 4건, 현재 케이스 하이라이트 | 어두운 배경 |
| [ ] **중앙**: 다크 헤더(고객명 + 상태 배지) + 메타 카드(서비스/원천세 합계/Supervisor 승인) | C-002 진입 시 22M Rp, 승인=요청중 |
| [ ] 「확인할 항목」 N개 카드 | C-002에서 4개 (INV-W-001~004) |
| [ ] 카드 액션 버튼 3종: 자료보기 / 확인완료 / 자료요청 | 「확인완료」 클릭 → 카드 색이 emerald로 |
| [ ] **「Invoice OCR 추가」 보라색 버튼** ⭐ | 헤더 우측, 클릭 시 file picker |
| [ ] OCR 파일 업로드 → AI 분류 결과 박스 | taxKind / Tax Code / 신뢰도 % |
| [ ] **우측 sticky 「다음 작업」 4 액션** | 1.승인요청 / 2.Coretax 새 탭 / 3.ID Billing / 4.신고완료 |
| [ ] 4 액션이 status에 따라 자동 disable | C-001(DATA_REVIEW)에서는 1번만 활성 |
| [ ] 우측 「고객이 제출한 NTPN」 + 상담원 수정값 input | input edit 가능 |

#### ③ 승인요청 (Final Review)

PDF p.5-7. 운영팀이 슈퍼바이저에게 「상신」하기 전 마지막 점검 화면.

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 4 KPI (고객 / 서비스 / 검토필요 / 자료요청중) | 우상단 |
| [ ] reviewRequired>0 → 🔴 빨간 경고 + 「먼저 ② 검토」 안내 | C-002에서 보임 |
| [ ] reviewRequired=0 → 🟢 OK + 가이드 3 step | C-005에서 보임 |
| [ ] **최종 원천세 적용값 테이블** ⭐ | 7 컬럼 (Invoice/Vendor/AI 판단/최종 세목/최종 Tax Code/DPP/세액) |
| [ ] Vendor input / 세목 select / Tax Code input / DPP & 세액 number inputs | 모두 편집 가능 |
| [ ] onBlur 변경 시 즉시 PUT → 합계 자동 갱신 | 우상단 다크 배지 |
| [ ] 제출자료 / 파싱상태 (INVOICE/CONTRACT/BANK 3 row) | 좌하 |
| [ ] 상담원 수정/처리 이력 (case_audit_log) | 우하 |
| [ ] 「최종 검토 완료」 체크박스 + 「Supervisor 승인요청 보내기」 | 미체크면 button disabled |
| [ ] reviewRequired>0이면 button 영구 disabled | C-002에서 보임 |

#### ④ Coretax 처리

PDF p.9-11. 슈퍼바이저 승인 후 외부 DJP Coretax 사이트에서 처리한 결과를 우리 시스템에 기록.

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 모드 배지: **🔌 API 자동** / **📝 수동 모드** | env `CORETAX_SUBMIT_ENABLED` |
| [ ] 처리 순서 4 카드 (1.접속 / 2.Billing / 3.NTPN / 4.BPE) | 단계별 색상 (진행가능/완료/대기) |
| [ ] **1. Coretax 접속**: 새 탭 / 현재 탭 / 주소 복사 | 새 탭 열기 → coretaxdjp.pajak.go.id |
| [ ] **2. ID Billing**: Billing ID input + 「발행완료 기록」 | 승인 전엔 disabled |
| [ ] **3. NTPN 확인**: 고객 제출값 vs 상담원 수정값 + 「확인」 | 두 값 비교 |
| [ ] **4. BPE**: BPE 번호 input + 「Coretax 신고완료/BPE 반영」 | 클릭 시 status COMPLETED |
| [ ] **체크리스트 6항목** | 각 select (대기/진행/완료/미완) |
| [ ] 빠른 액션 (접근권한 / 납부증빙 요청) | 클릭 시 QUICK_ACTION 로그 |
| [ ] 수동 처리 로그 — 자유 입력 + 누적 표시 | manual log 영역 |
| [ ] **「결산 wizard 연동」 배지** | closing_session_id 있는 케이스에서만 |

#### ⑤ 이력

PDF p.12-13. 케이스/회사/내 고객 전체 통합 타임라인.

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 5 KPI (선택 고객 / 메시지 / 자료요청 / 처리로그 / 회사 전체) | 상단 |
| [ ] 케이스별 상세 타임라인 | 색상 배지 (처리=blue / Coretax=violet / 시스템=slate / 고객 NTPN=amber) |
| [ ] 회사별 전체 이력 — 케이스 테이블 | Case/서비스/상태/담당/Billing/NTPN/신고완료 7 컬럼 |
| [ ] 회사별 통합 타임라인 (모든 케이스 시간순) | C-001 + C-001-2025 + REQ-REPEAT-001 모두 |
| [ ] 내 고객 전체 최근 이력 | 30건 |

#### 다국어 (5 locales × 5 페이지 = 25 라우트)

| 체크 | 어떻게 확인 |
|---|---|
| [ ] id/en/ko/ja/zh 전환 시 모든 텍스트 모국어 변환 | URL의 locale prefix 변경 |
| [ ] eventLabel / caseStatus / nextAction 모두 i18n | 카드/타임라인/안내문 모두 |
| [ ] raw key (`operatorStaff.review.title` 등) **안 보임** | 누락 시 신호 |

---

### 7-3. 상담사 — 운영팀(슈퍼바이저)

> **시나리오 목적**: 슈퍼바이저가 케이스를 큐에서 분배(배정/회수/이관)하고, 상담원이 상신한 케이스를 승인/반려하는 흐름.

로그인: `sv-annual@aipajak.com / TestPassword123!` (SUP002 박수퍼)
자동 리다이렉트 → `/operator/dashboard`

#### 사이드바 4 dropdown

| 체크 | 어떻게 확인 |
|---|---|
| [ ] Dashboard / 업무 / 인사·평가 / 시스템 | 4 dropdown |
| [ ] 일반 상담원 5 메뉴 안 보임 | role 분기 |

#### Dashboard

| 체크 | 어떻게 확인 |
|---|---|
| [ ] 큐 통계 / 승인 대기 / 최근 케이스 | KPI |

#### 업무 dropdown (8 메뉴)

| 메뉴 | 페이지 | 체크 |
|---|---|---|
| 워크로드 관리 ⭐ | `/operator/workload` | **3-column 콘솔** + 어시스트 패널 6종 |
| 승인 | `/operator/approvals` | PENDING_APPROVAL 케이스 — 「승인」 / 「반려」 |
| 전체 케이스 | `/operator/cases` | 검색/필터 |
| 제출 대기열 | `/operator/queue` | 11-state 워크플로우 |
| 자료 검토 | `/operator/review` | 고객 자료 검토 |
| 민원 관리 | `/operator/complaints` | 고객 민원 |
| 담당 고객 | `/operator/clients` | SUP002의 모든 담당 고객 |
| 세금 캘린더 | `/tax/calendar` | 마감일 |

##### `/operator/workload` 어시스트 패널 6종

| 패널 | 동작 |
|---|---|
| 선택 결정 | 다중 선택 → 일괄 액션 |
| 우선지원 | URGENT 케이스 자동 우선 처리 |
| 자동배정 | auto_assign_enabled=true 상담원에게 분배 |
| 제외 설정 | 특정 상담원 제외 |
| **환수·재배정** ⭐ | 환수 / 재배정 / **Bulk Transfer**(퇴사) |
| SV 이관 | 다른 슈퍼바이저에게 케이스 이관 |

##### Bulk Transfer (퇴사 일괄 이관) ⭐

시나리오 ⑤에서 자세히. 핵심: EMP001 → EMP005로 한 번에 이관, EMP001 status=inactive.

#### 인사·평가 dropdown

| 메뉴 | 페이지 | 체크 |
|---|---|---|
| 상담원 관리 | `/operator/team` | 12명 work_state + Span of Control 카드 |
| 성과 통계 | `/operator/statistics` | 평가 가중치 + 인센티브 정책 + 5 KPI 랭킹 |

#### 시스템 dropdown

| 메뉴 | 페이지 | 체크 |
|---|---|---|
| 감사로그 | `/operator/audit` | case_audit_log + coretax_step_log + 합성 이벤트, 필터 chip 9종 |
| 승인 규칙 | `/operator/approval-rules` | 자동 승인 임계값 (금액/세목별) |
| 설정 | `/operator/settings` | 양식 버전 |

---

### 7-4. 상담사 — 운영팀(마스터) (선택)

> **시나리오 목적**: 마스터가 전사 KPI를 보고, 커스텀 가격이 필요한 고객(Pro 한도 초과 / 세무조사 / 이전가격)에 대해 견적을 발행.

로그인: `master.test@aipajak.com` → `/admin/master` 자동

| 체크 | 어떻게 확인 |
|---|---|
| [ ] MRR / 플랜 분포 / Pro 한도 초과 고객 | 대시보드 |
| [ ] `/admin/master/custom-pricing` 커스텀 가격 견적 발행 | `custom_pricing_quote` row 생성 |
| [ ] 슈퍼바이저 콘솔도 진입 가능 (상위 권한) | `/operator/dashboard` 등 |

---

## 8. ④ 어드바이저 단독 시나리오

> **시나리오 목적**: 어드바이저가 active POA 보유 고객의 신고를 제출. POA 만료/없음 케이스는 차단되는지.

로그인: `advisor.test@jakartatax.co.id`

상담사 — JTC 컨설턴트의 모든 시나리오 + **추가**:

| 체크 | 어떻게 확인 |
|---|---|
| [ ] **신고 제출 권한** ⭐ | active POA 있는 고객 → 제출 가능 |
| [ ] POA 만료/없음 케이스 → 제출 시도 시 **차단** | "유효한 POA 필요" 알림 / 403 |
| [ ] 본인 담당 모든 고객 일괄 처리 | `/tax/spt-masa` bulk |

> ⚠️ **Hard Rule #3** + middleware `requireValidPOA()` + RLS 이중 차단.

---

## 9. ⑤ 어드민 단독 시나리오 (반-부정 테스트) ⭐

> **시나리오 목적**: 어드민은 플랫폼 모니터링/사용자 관리만 가능. **고객 세금 데이터에 절대 접근 못 한다**(Hard Rule #1).

로그인: `admin.test@aipajak.com`

### 9-1. 어드민 메뉴 진입 가능

| 메뉴 | 페이지 | 체크 |
|---|---|---|
| 모니터링 | `/admin/monitoring` | 에러 / 회로 차단기 / 메모리 / 활동 |
| Cron | `/admin/cron` | 스케줄 작업 |
| 사용자 관리 | `/admin/users` | 사용자 / role 관리 |
| 결제 관리 | `/admin/billing` | 결제 transaction |
| 컨설턴트 관리 | `/admin/consultants` | tax_partner / consultant |
| AI 사용량 | `/admin/ai-usage` | Anthropic / OpenAI 호출 통계 |
| 감사 로그 | `/admin/audit-logs` | 모든 mutation log |
| 세율 관리 | `/admin/tax-rates` | PTKP / bracket |
| Override 규칙 | `/admin/override-rules` | TaxResolutionEngine override |
| 규칙 테스트 | `/admin/rule-test` | 가상 거래에 규칙 적용 |

### 9-2. **차단 검증** (Hard Rule #1) ⚠️

| 체크 | 어떻게 확인 |
|---|---|
| [ ] URL 직접 입력 `/customers` → 사이드바에 메뉴 없음 + redirect/403 | RLS + middleware |
| [ ] URL `/tax/spt-tahunan` → 차단 | tax 라우트 거부 |
| [ ] API 호출 (Network 탭에서 `fetch /api/customer/[id]`) → **403** | `blockPlatformAdmin` middleware |
| [ ] `/admin/master` 진입 시도 → **403** | 마스터만 |
| [ ] `/operator/*` 운영팀 화면 차단 | role 분기 |

> ⚠️ **이 검증이 깨지면 Hard Rule #1 위반** — 즉시 보고. 가장 critical한 보안 회귀.

---

## 10. 크로스체크 시나리오 (다중 역할 닫힌 루프)

여러 역할이 협업하는 시나리오. **한 시나리오는 한 번에 끝까지** 진행.

> **팁**: 시크릿 창을 활용하면 한 브라우저에서 두 세션을 동시에 띄울 수 있어 빠릅니다. 일반 창에 ②(법인 고객), 시크릿에 ③(상담원).

---

### 시나리오 ① 결산 wizard ↔ 운영팀 BPE 자동 반영 ⭐⭐⭐

> **목적**: 메모리 「2026-05-02 결산 wizard 완료, 다음 재개: 운영팀 큐 UI → BPE 자동 반영」의 핵심 흐름. 고객 → 운영팀 → 고객 닫힌 루프가 완전히 작동하는지.

**소요 시간**: 10분 (수동) — 운영팀이 모든 단계를 천천히 거칠 때

**참여 역할**: ② 법인 고객 → ③ 슈퍼바이저 → ③ 상담원 → ② 법인 고객

#### 흐름 다이어그램

```
[법인 고객]                            [슈퍼바이저]                  [상담원]
  │                                       │                            │
  ├─ wizard 「제출」                       │                            │
  │  closing_submission(SUBMITTED)         │                            │
  │  djp_submission_queue(PENDING)         │                            │
  │  case_code = CL-XXXXXXXX                │                            │
  │       ↓                                 │                            │
  │  🟡 SUBMITTED 카드 보임                  │                            │
  │                                  ←──── 큐에서 발견                    │
  │                                  ───── EMP001 배정                   │
  │                                  ───── 「승인」 클릭                  │
  │  새로고침                                                            │
  │  🔵 PROCESSING                                                       │
  │                                                          ←──── Coretax 진입
  │                                                          ───── 「🔌 결산 연동」 배지
  │                                                          ───── Billing ID 입력
  │                                                          ───── BPE 입력 → 신고완료
  │                                                          ───── status COMPLETED
  │                                                          ←──── closing_submission 갱신
  │  새로고침                                                            │
  │  🟢 COMPLETED + BPE 강조 박스                                         │
```

#### 단계별

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | 법인 고객 | `/tax/annual` wizard 끝까지 → 「제출」 | toast: "SPT 제출 완료". 화면 하단 🟡 SUBMITTED 카드 보임 |
| 2 | 슈퍼바이저 | `/operator/cases` 또는 workload에서 신규 케이스 검색 | case_code = `CL-XXXXXXXX` (session_id의 첫 8자) |
| 3 | 슈퍼바이저 | 케이스를 EMP001에 배정 | tax_operators(EMP001) 활성 케이스 +1 |
| 4 | 슈퍼바이저 | `/operator/approvals` → 「승인」 | status APPROVED |
| 5 | 법인 고객 (재방문) | `/tax/annual` 새로고침 | 카드가 🔵 PROCESSING 또는 🟡 그대로 (operator가 아직 record-billing 안 했으면) |
| 6 | 상담원 (EMP001) | `/operator/coretax/[id]` 진입 | 「🔌 결산 wizard 연동」 파란 배지 ⭐ |
| 7 | 상담원 | Billing ID 입력 (예: 820XXXXXX) → 「발행완료 기록」 | closing_submission.status = 'PROCESSING' |
| 8 | 법인 고객 (재방문) | 새로고침 | 🔵 PROCESSING |
| 9 | 상담원 | BPE 번호 입력 (예: BPE-2026-XXX) → 「Coretax 신고완료/BPE 반영」 | status COMPLETED, completed_at 채워짐, ntpn = ebilling_code |
| 10 | 법인 고객 (재방문) | 새로고침 | **🟢 COMPLETED + BPE 번호 + NTPN 강조 박스** ⭐ |

#### 검증 핵심

| DB 테이블 | 변화 |
|---|---|
| `closing_submission` | status SUBMITTED → PROCESSING → COMPLETED, bpe_number/ntpn/completed_at/operator_id 모두 채워짐 |
| `closing_id_billing` | status PENDING → PAID, ntpn 채워짐 |
| `djp_submission_queue` | status PENDING → APPROVED → EBILLING_GENERATED → COMPLETED |
| `case_audit_log` | ASSIGNED, APPROVED, INSTRUCTED 이벤트 누적 |
| `coretax_step_log` | ID_BILLING(record-billing), COMPLETE(record-completion) 이벤트 |

#### 자동 검증 (10초)

```bash
SEED_TARGET=prod npx tsx scripts/test-closing-bpe-sync.ts
```

이 스크립트는 임시 row를 만들고 위 흐름을 1번 시뮬레이션 → 결과 검증 → 모두 정리(tear-down).

---

### 시나리오 ② 상담원 검토 → 승인 → Coretax 닫힌 루프

> **목적**: 일반 운영(결산 wizard 없는) 케이스에서 상담원이 처음부터 끝까지 진행. 5 stepper 한 번에 통과.

**참여**: ③ 상담원 (EMP001) → ③ 슈퍼바이저 → ③ 상담원

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | 상담원 | my-work에서 C-001 카드 클릭 | review-case 진입, lastCase 저장 |
| 2 | 상담원 | C-001은 reviewItems가 비어있으므로 「Invoice OCR 추가」 → JPG 업로드 | review_summary.items에 push, status PENDING → DATA_REVIEW |
| 3 | 상담원 | reviewItems가 「자동확인」 또는 「확인완료」 처리 | reviewRequired = 0 |
| 4 | 상담원 | 우측 「1. Supervisor 승인요청」 클릭 | status PENDING_APPROVAL |
| 5 | 상담원 | approval-request 페이지 — 「최종 검토 완료」 체크 + 상신 | my-work 카드 「승인요청」 상태로 표시 |
| 6 | 슈퍼바이저 | `/operator/approvals` → 「승인」 | status APPROVED |
| 7 | 상담원 | `/operator/coretax/[id]` 진입 → ID Billing 발행 → BPE 입력 | status COMPLETED |
| 8 | 상담원 | `/operator/history/[id]` | 회사 전체 이력 타임라인에 모든 단계 (CASE_CREATED, INSTRUCTED, APPROVED, ID_BILLING, COMPLETE) |

---

### 시나리오 ③ JTC ↔ 외부 세무법인 격리 (멀티 테넌트)

> **목적**: Hard Rule #2 검증. 두 세무법인이 같은 플랫폼을 공유하지만 RLS로 데이터 완전 격리.

**참여**: ③ JTC 컨설턴트 ↔ ③ 외부 컨설턴트

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | JTC 컨설턴트 | 새 고객 X 생성 | tax_partner_id = JTC |
| 2 | 외부 컨설턴트 | `/customers` 진입 | 고객 X **안 보임** ⭐ (RLS Phase B-1) |
| 3 | 외부 컨설턴트 | 새 고객 Y 생성 | tax_partner_id = PT Mitra Pajak Sentosa |
| 4 | JTC 컨설턴트 | `/customers` | 고객 Y 안 보임 |
| 5 | 외부 컨설턴트 | 고객 Y 신고 제출 | OK (Phase B-2.1 — 외부 컨설턴트는 어드바이저 권한 흡수) |
| 6 | JTC 컨설턴트 | 고객 X 신고 제출 시도 | **403** (어드바이저만) |

#### 자동 검증

```bash
SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts
```

> ⚠️ **이 검증이 깨지면 Hard Rule #2 위반** — 다른 회사가 우리 고객 데이터를 볼 수 있다는 의미. critical.

---

### 시나리오 ④ 다국어 일관성 (5 locales × 5 pages)

> **목적**: 인도네시아 직원도 운영팀 화면을 모국어로 사용할 수 있는지. 사용자 요구로 옵션 B(전체 i18n)로 처리한 것의 회귀.

**참여**: ③ 상담원 (EMP001), 언어만 전환

| Step | URL | 검증 |
|---|---|---|
| 1 | `/ko/operator/my-work` | 「내 업무」 헤더 |
| 2 | `/id/operator/my-work` | 「Pekerjaan Saya」 |
| 3 | `/en/operator/my-work` | 「My Work」 |
| 4 | `/ja/operator/my-work` | 「マイ業務」 |
| 5 | `/zh/operator/my-work` | 「我的工作」 |

5 단계 페이지(my-work / review-case / approval-request / coretax / history) × 5 locales = **25 라우트** 모두 검증.

#### 자동 검증

```bash
for loc in id en ko ja zh; do
  for path in my-work review-case approval-request coretax history; do
    code=$(curl -sI -o /dev/null -w "%{http_code}" "https://ai-pajak.vercel.app/$loc/operator/$path")
    [ "$code" = "200" ] && echo "✓ $loc/$path" || echo "✗ $loc/$path → $code"
  done
done
```

**기대**: 25개 모두 ✓.

---

### 시나리오 ⑤ Bulk Transfer (운영팀 퇴사 일괄 이관)

> **목적**: 상담원이 퇴사할 때 그가 담당하던 모든 케이스를 다른 상담원에게 한 번에 이관. 슈퍼바이저 콘솔의 핵심 기능.

**참여**: ③ 슈퍼바이저 (SUP001 또는 SUP002)

| Step | 동작 | 검증 |
|---|---|---|
| 1 | `/operator/workload` → 우측 「환수·재배정」 패널 → 「퇴사 Bulk Transfer」 | preview UI 열림 |
| 2 | from = EMP001, to = EMP005 선택 → 「Preview」 | 활성 케이스 N건, 고객 M명 표시 |
| 3 | 「확정」 | 모든 케이스 operator_id가 EMP005로, EMP001은 status='inactive', work_state='resigned', auto_assign_enabled=false |
| 4 | `/operator/audit` 새로고침 | BULK_TRANSFERRED 이벤트 N건 누적 |
| 5 | EMP001 로그인 시도 | 정상 로그인되지만 my-cases 0건 |
| 6 | EMP005 로그인 | my-work에 EMP001의 모든 케이스가 보임 |
| 7 | EMP005 → C-001 진입 → 정상 작업 가능 | review-detail의 operator_id가 EMP005 |

> ⚠️ **시나리오 후 복원**: prod에서 진행했다면 EMP001 status를 다시 active로 되돌려야 다음 시나리오에서 EMP001을 다시 사용 가능. `scripts/seed-supervisor-demo.ts` 다시 돌리면 자동 복원.

---

### 시나리오 ⑥ Coretax API 자동 모드 (선택)

> **목적**: DJP의 실제 Coretax API가 활성화됐을 때 자동 호출이 manual 입력을 대체하는지. 현재는 env 미설정이라 수동 모드.

**전제 조건**: prod env에 다음 모두 설정
```
CORETAX_SUBMIT_ENABLED=true
CORETAX_API_BASE_URL=https://api-coretax.pajak.go.id
CORETAX_API_TOKEN=<DJP-issued-token>
```

| Step | 동작 | 검증 |
|---|---|---|
| 1 | 상담원 → Coretax 진입 | 「🔌 API 자동」 배지 |
| 2 | Billing ID input 비워두고 「API로 자동 발행」 | DJP API 호출 → billingCode 자동 채워짐 |
| 3 | BPE input 비워두고 「API로 자동 제출」 | bpe_number 자동 채워짐, status COMPLETED |
| 4 | DB `closing_submission.raw_response` 확인 | DJP 응답 JSON 저장 |

env 미설정 시는 「📝 수동 모드」로 자동 fallback — 시나리오 ②와 동일.

---

### 시나리오 ⑦ Invoice OCR (Anthropic API 비용 발생)

> **목적**: 실제 invoice 사진을 업로드하면 Claude Vision이 분류하고 PPh 종류를 자동 추정.
> **비용**: 이미지 1장 ≈ $0.003 (Claude Sonnet 4 vision)

**참여**: ③ 상담원

| Step | 동작 | 검증 |
|---|---|---|
| 1 | C-001 review-case 진입 → 「Invoice OCR 추가」 | file picker (jpg/png/webp/gif, 10MB) |
| 2 | 실제 invoice JPG/PNG 업로드 | spinner → AI 분류 결과 박스 |
| 3 | 결과 박스 — taxKind / Tax Code / 신뢰도 % / 추정 사유 | 신뢰도 ≥ 70% → state=자동확인, < 70% → AI 확인필요 |
| 4 | review_summary.items에 새 항목 push | 「확인할 항목」 카드 즉시 추가 표시 |
| 5 | history 진입 | OCR 이벤트 (`step='OCR'`) 표시 |

#### 자동 smoke (실제 호출)

```bash
ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-ocr-real.ts
# 또는 실제 이미지로:
OCR_TEST_IMAGE_PATH=./my-invoice.png ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-ocr-real.ts
```

키 무효 시 친절한 안내 + DB round-trip만 진행. ANTHROPIC_API_KEY 없으면 exit 0 (CI skip 안전).

---

## 11. 시나리오 ↔ 자동화 매핑

| 시나리오 | 자동화 스크립트 | 위치 |
|---|---|---|
| ① 결산 ↔ Coretax | `test-closing-bpe-sync.ts` | scripts/ |
| ② 상담원 5단계 | `test-staff-workflow.ts` + `operator-staff-workflow.spec.ts` | scripts/, tests/e2e/ |
| ③ Tenant 격리 | `verify-rls-isolation.ts` | scripts/ |
| ④ 다국어 | (수동: curl 5×5 또는 e2e) | — |
| ⑤ Bulk Transfer | `operator-queue-workflow.spec.ts` | tests/e2e/ |
| ⑥ Coretax API | `coretax/client.test.ts` (vitest) | src/lib/coretax/ |
| ⑦ OCR | `test-ocr-real.ts` | scripts/ |

---

## 12. 알려진 제약 / 주의사항

### 12-1. 진행 중 / 미구현

| 항목 | 현황 |
|---|---|
| **Coretax API** | 실제 DJP API spec 미공개. graceful-degrade adapter 구조만 완성, env 활성화 전엔 수동 모드(📝). |
| **Anthropic OCR 비용** | prod에 invoice 이미지 직접 업로드해 검증 시 ANTHROPIC API 비용 발생 (~$0.003/이미지). |
| **Invoice/Contract/Bank PDF preview** | 현재 mock 데이터. Phase 7+에서 실제 document 테이블과 연동 예정. |
| **새 PDF 명세** | 추가 PDF가 들어오면 새 phase로 처리. (예: 마스터 백오피스 등) |

### 12-2. 환경변수 의존성

| Var | 영향 |
|---|---|
| `CORETAX_SUBMIT_ENABLED='true'` | 운영팀 Coretax 「🔌 API 자동」 모드 |
| `CORETAX_API_BASE_URL` / `CORETAX_API_TOKEN` | API 모드 활성화에 필요 |
| `MIDTRANS_IS_PRODUCTION='true'` | 결제 prod 엔드포인트 (기본은 sandbox) |
| `ANTHROPIC_API_KEY` | Invoice OCR 호출 |
| `OPENAI_API_KEY` | OpenAI 보조 (있을 때만) |

### 12-3. Hard Rules (5종, 깨지면 안 됨)

| # | 규칙 | 깨졌을 때 영향 |
|---|---|---|
| 1 | 어드민(⑤)은 고객 세금 데이터 접근 금지 — `blockPlatformAdmin` middleware | 보안 사고 |
| 2 | 상담사(③)는 등록된 tax_partner 소속 필수 — JTC ↔ 외부 격리 | 멀티테넌트 누설 |
| 3 | 신고 제출은 어드바이저(④)만 — JTC 컨설턴트와 운영팀은 못 함 | 라이센스 위반 |
| 4 | 결제 시스템은 SYSTEM 전용 | 결제 위변조 |
| 5 | 모든 mutation은 audit_log — `withAudit` middleware | 감사 누락 |

### 12-4. 데이터 관성 (시드 재실행)

시드 스크립트는 idempotent — 다시 실행해도 케이스가 중복되지 않습니다 (case_code unique). 단, 사용자가 임의로 case status를 변경한 후 재시드하면 상태가 시드 기본값으로 되돌아갑니다.

### 12-5. RLS 우회는 admin client만

모든 mutation은 service-role admin client + middleware auth를 거칩니다. 일반 사용자가 직접 supabase API를 부르면 RLS가 차단합니다.

### 12-6. dev server hot reload

`useTranslations` 등 i18n 키를 추가했는데 페이지가 raw key로 보이면 dev server를 재시작하세요. messages JSON은 빌드 타임에 import되므로 `.next/cache`가 stale일 수 있습니다.

```bash
rm -rf .next/cache && npm run dev
```

---

## 13. 트러블슈팅

자주 발생하는 문제 + 해결법.

### 13-1. 「페이지 오류 — 일시적인 오류가 발생했습니다」 빨간 카드

| 원인 | 해결 |
|---|---|
| **React Hooks rules 위반** (early-return 뒤에 hook 호출) | 해당 컴포넌트의 모든 `useTranslations` / `useState` / `useMemo` 등을 early return **위로** 이동 |
| **i18n 키 누락** (5 locales 동기화 안 됨) | `request.ts` onError fallback이 막아주지만 console.warn 발생. 5 locales 모두에 키 추가 |
| Next.js server component에 함수 prop 전달 | 클라이언트 wrapper로 감싸거나 prop 자체를 빼기 |

진단: 화면 빨간 카드의 「오류 상세 보기」 펼치면 name + message 표시. 콘솔에도 `[Dashboard Error]` prefix로.

### 13-2. 사이드바 메뉴가 raw key로 보임 (`nav.opMyWork` 같이)

i18n 누락. 5 locales 모두에 키 추가:
```bash
for loc in id en ko ja zh; do grep "\"opMyWork\"" src/i18n/messages/$loc.json; done
```
누락된 locale에 추가.

### 13-3. dev server에서 500이 떨어짐

`.next/cache` stale 가능. dev server 재시작:
```bash
rm -rf .next/cache && npm run dev
```

또는 dev server 로그(`/tmp/dev.log` 또는 stdout) 직접 확인:
```bash
tail -100 /tmp/dev.log | grep -E "Error|error" | tail -10
```

### 13-4. e2e 테스트 1개만 fail (타이밍 이슈)

retry 1번 통과 = flaky. CI에선 retry 허용. 로컬에선:
```bash
npm run test:e2e:operator-staff -- --workers=1  # serial 실행
```

### 13-5. 운영팀 데모 케이스가 안 보임

EMP001로 로그인했는데 my-work에 카드 0건? 시드 안 됐거나 운영팀 row 누락.

```bash
SEED_TARGET=prod npx tsx scripts/verify-staff-demo-cases.ts
```

「✗ MISSING」 케이스 있으면 재시드:
```bash
SEED_TARGET=prod npx tsx scripts/seed-supervisor-demo.ts
```

### 13-6. 결산 wizard 「제출」 시 운영팀 큐에 안 보임

Phase B 마이그레이션(`20260507000003_djp_queue_closing_link.sql`) 누락 가능. prod에 적용:

Supabase Dashboard SQL Editor:
```sql
ALTER TABLE djp_submission_queue
  ADD COLUMN IF NOT EXISTS closing_session_id UUID
    REFERENCES tax_closing_session(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dsq_closing_session
  ON djp_submission_queue(closing_session_id) WHERE closing_session_id IS NOT NULL;
```

---

## 14. 용어집 (인도네시아 세무 + 시스템)

| 용어                            | 의미                                                   |
| ----------------------------- | ---------------------------------------------------- |
| **NPWP**                      | Nomor Pokok Wajib Pajak — 납세자 등록번호 (15자리)            |
| **NIK**                       | Nomor Induk Kependudukan — 주민등록번호 (개인)               |
| **DJP**                       | Direktorat Jenderal Pajak — 인도네시아 국세청                |
| **Coretax**                   | DJP의 차세대 통합 세무 행정 시스템 (2025+)                        |
| **SPT**                       | Surat Pemberitahuan — 세금 신고서                         |
| **SPT Masa**                  | 월간 세금 신고서 (PPh21/23/25/Final/PPN)                    |
| **SPT Tahunan**               | 연간 세금 신고서 (Badan/OP)                                 |
| **PPh21**                     | 급여 소득세 (직원)                                          |
| **PPh22**                     | 수입/구매 원천세                                            |
| **PPh23**                     | 서비스 원천세 (PMK 141/2015 분류)                            |
| **PPh4(2)**                   | Final tax (UMKM 0.5%, 임대료 등)                         |
| **PPh25**                     | 분기 corporate income tax 선납                           |
| **PPh26**                     | 비거주자 원천세                                             |
| **PPN**                       | Pajak Pertambahan Nilai — 부가가치세                      |
| **DPP**                       | Dasar Pengenaan Pajak — 과세 표준                        |
| **KAP**                       | Kode Akun Pajak — 세목 코드 (예: 411124 = PPh23)          |
| **KJS**                       | Kode Jenis Setoran — 납부 종류 코드 (예: 100 = Monthly)     |
| **NTPN**                      | Nomor Transaksi Penerimaan Negara — 납부 영수증 번호 (16자리) |
| **BPE**                       | Bukti Penerimaan Elektronik — 전자 접수 증명 (DJP 발급)      |
| **ID Billing / Kode Billing** | DJP 발급 결제 식별 번호 (납부 시 사용)                            |
| **POA**                       | Power of Attorney — 위임장 (어드바이저가 신고 대행 시 필수)          |
| **PMK 141/2015**              | 재무부 규정 — PPh23 서비스 분류                                |
| **e-Bupot**                   | 전자 원천징수 영수증 시스템                                      |
| **PKP**                       | Pengusaha Kena Pajak — VAT 등록 사업자                    |
| **UMKM**                      | Usaha Mikro, Kecil, Menengah — 소상공인. final tax 0.5%  |

### 시스템 용어

| 용어 | 의미 |
|---|---|
| **Phase A~H** | 개발 단계 라벨. 메모리에 진척 기록 |
| **case_code** | 운영팀 큐의 외부 식별자 (`C-001` `CL-XXXXXXXX` 등) |
| **closing_session** | 결산 wizard 진행 중 세션 (한 고객 + 한 fiscal year) |
| **closing_submission** | 결산 wizard에서 「제출」 누르면 만들어지는 row |
| **djp_submission_queue** | 운영팀 11-state 워크플로우 큐 |
| **case_audit_log** | 운영팀 케이스 이벤트(ASSIGNED/APPROVED/INSTRUCTED 등) 누적 |
| **coretax_step_log** | 상담원이 Coretax에서 한 작업(접속/Billing/NTPN/BPE) 누적 |
| **review_summary** | djp_submission_queue.review_summary JSONB. 「확인할 항목」 |
| **Bulk Transfer** | 상담원/슈퍼바이저 퇴사 시 케이스 일괄 이관 |
| **graceful-degrade** | 외부 서비스(Coretax API, Midtrans) 실패 시 row는 유지하고 응답에 에러 정보만 동봉 |
| **tenant** | tax_partner 단위 (JTC / 외부 세무법인) |
| **stepper** | my-work 등 운영팀 화면 상단의 1~5 진행바 |

---

## 15. 빠른 체크리스트 (10분 smoke 재확인)

```bash
# 1. 자동 회귀 (1분)
SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts

# 2. 5 locales × 5 staff pages (1분)
for loc in id en ko ja zh; do
  for path in my-work review-case approval-request coretax history; do
    code=$(curl -sI -o /dev/null -w "%{http_code}" "https://ai-pajak.vercel.app/$loc/operator/$path")
    [ "$code" = "200" ] && echo "✓ $loc/$path" || echo "✗ $loc/$path → $code"
  done
done

# 3. e2e (1분)
npm run test:e2e:operator-staff

# 4. 수동 — 5 역할 한 명씩 1분씩 (5분)
#    ① customer.test → 사이드바 7 메뉴 + 결산 wizard 진입
#    ② company.test → 사이드바 5 dropdown + 직원 인사 + 결산 wizard
#    ③ op-emp001 → /operator/my-work에 4 카드
#    ④ advisor.test → 컨설턴트 + 신고 제출 버튼
#    ⑤ admin.test → /admin/monitoring + /customers 시도 → 403
```

모두 ✅ → 시스템 정상. ❌가 있으면 §13 트러블슈팅 또는 §16 보고 형식으로.

---

## 16. 이슈 발견 시 보고 형식

```
[버그 #N] 짧은 제목

## 환경
- 역할: ③ 상담사 / 운영팀 / 상담원 (EMP001)
- 페이지: /ko/operator/review-case/<uuid>
- URL prefix locale: ko (또는 id/en/ja/zh)
- 브라우저: Chrome 126 / Safari 17

## 재현 단계
1. EMP001로 로그인
2. /operator/my-work에서 PT Sehat Sentosa 카드 클릭
3. 「Invoice OCR 추가」 클릭

## 기대 / 실제
기대: file picker 열림
실제: 빨간 「페이지 오류」 카드

## 첨부 (가장 중요)
- 콘솔 첫 빨간 줄 (TypeError: ... 같은 message 부분)
- 또는 화면 「오류 상세 보기」의 name + message
- 가능하면 Network 탭의 실패한 요청 (URL + status + response body)
- 캡처 (선택)

## 비고 (선택)
- 새로고침해도 재현
- 다른 역할/locale에서는 정상
```

이 형식으로 보고하면 **5분 내 root cause 식별** 가능. minified stack만 보내면 진단이 어렵습니다.

---

## 부록 A. 빌드/배포 빠른 명령

```bash
# 타입 체크
npx tsc --noEmit -p .

# 단위 테스트
npm test
npx vitest run src/lib/coretax/client.test.ts   # 단일 파일

# E2E (3 종)
npm run test:e2e:operator-staff
npm run test:e2e:operator-staff-pages
npm run test:e2e:operator   # supervisor 콘솔

# 커밋
git add <files> && git commit -m "..."

# 배포
vercel --prod --yes

# 배포 후 검증
curl -sI https://ai-pajak.vercel.app/ko/operator/my-work
```

## 부록 B. 자주 쓰는 SQL

```sql
-- EMP001의 활성 케이스 보기
SELECT q.case_code, q.status, q.priority, q.amount, c.company_name
FROM djp_submission_queue q
JOIN customer c ON c.id = q.customer_id
WHERE q.operator_id = (SELECT id FROM tax_operators WHERE employee_id = 'EMP001')
  AND q.status NOT IN ('COMPLETED', 'FAILED')
ORDER BY q.priority, q.due_date;

-- 결산 wizard ↔ 운영팀 큐 연결 케이스
SELECT q.case_code, q.status, s.session_id, s.bpe_number, s.ntpn
FROM djp_submission_queue q
LEFT JOIN closing_submission s ON s.session_id = q.closing_session_id
WHERE q.closing_session_id IS NOT NULL;

-- 최근 case_audit_log 50건
SELECT created_at, event_type, actor_label, payload
FROM case_audit_log
ORDER BY created_at DESC
LIMIT 50;

-- coretax_step_log
SELECT created_at, step, action, value, actor_label
FROM coretax_step_log
ORDER BY created_at DESC
LIMIT 50;
```

## 부록 C. 한국 직원 / 인도네시아 직원 사용 가이드

운영팀에 두 국가 직원이 함께 있는 경우:

| 사용자 | 추천 locale |
|---|---|
| 한국인 직원 | URL `/ko/...` 또는 사이드바에서 한국어 선택 |
| 인도네시아 직원 | URL `/id/...` 또는 사이드바에서 Bahasa Indonesia |
| 영어 사용 직원 | `/en/...` |

같은 케이스를 두 직원이 동시에 봐도 각자 모국어로 표시되며, 데이터(상태/금액/날짜)는 동일.

---

**문의 / 피드백**: 이 문서가 부족하다고 느끼는 부분이 있으면 §16 형식으로 알려주세요. 시나리오/트러블슈팅을 계속 보강합니다.
