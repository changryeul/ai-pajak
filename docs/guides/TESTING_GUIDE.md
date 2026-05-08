# AI Pajak 전체 시스템 테스트 가이드 (5 역할)

> 사용자 관점의 **5 역할**로 재구성.
> 코드 enum은 더 세분화돼 있지만(`TAX_OPERATOR_*` 4 tier 등) 권한 차이만 표로 정리하고, 시나리오는 5 역할 시점에서 진행합니다.

---

## 0. 5 역할 요약

| # | 역할 | 누가 | 코드 enum (참고) |
|---|---|---|---|
| **1** | **개인 고객** | 일반 납세자 | `CUSTOMER` + `INDIVIDUAL` |
| **2** | **법인 고객** | 회사 / 법인 납세자 | `CUSTOMER` + `COMPANY` |
| **3** | **상담사** (외부 + 내부 운영팀) | JTC 컨설턴트, 외부 세무법인 컨설턴트, JTC 백오피스 운영팀 | `CONSULTANT_JTC` + `TAX_OPERATOR_*` |
| **4** | **어드바이저** | 신고 제출 권한이 있는 라이센스 어드바이저 | `TAX_ADVISOR_JTC` |
| **5** | **어드민** | 플랫폼 관리자 | `PLATFORM_ADMIN` |

> **시스템(SYSTEM)**: 자동 결제 처리용 service-role. 사용자 계정이 아니라 시나리오에서 제외.

### 역할 3 「상담사」의 내부 분화 (권한 차이만)

| 서브타입 | 누가 | 신고 제출 | 케이스 승인 | 가격 결정 | 큐 관리 |
|---|---|---|---|---|---|
| **JTC 컨설턴트** | `consultant.test@jakartatax.co.id` | × (어드바이저만) | × | × | × |
| **외부 세무법인 컨설턴트** | `external.consultant@mitrapajak.com` | ○ (자기 partner 한정) | × | × | × |
| **운영팀 — 상담원** | `op-emp001~012@aipajak.com` | × (큐 처리만) | × | × | × |
| **운영팀 — 슈퍼바이저** | `sv-corporate@`, `sv-annual@`, `sv-personal@` | × | ○ | × | ○ |
| **운영팀 — 마스터** | `master.test@aipajak.com` | × | ○ | ○ | ○ |

UI 분기:
- **JTC/외부 컨설턴트** → `/dashboard` 컨설턴트 화면 (고객 관리 / 세금 도구 / POA)
- **운영팀** → `/operator/*` 백오피스 (5단계 워크플로우 또는 4-dropdown 콘솔)

---

## 1. 사전 준비

### 1-1. 환경

| 환경 | URL | 비고 |
|---|---|---|
| **prod** ⭐ | `https://ai-pajak.vercel.app` | 항상 최신 |
| local dev | `http://localhost:3000` | `npm run dev` + `supabase start` |

### 1-2. 시드 (한 번만)

```bash
# 기본 사용자
npm run db:seed-test-users

# 운영팀 12명 + 외부 세무법인
SEED_TARGET=local npx tsx scripts/seed-master-and-external.ts

# 회사 고객
SEED_TARGET=local npx tsx scripts/seed-company-customer.ts

# 슈퍼바이저 데모 케이스 (C-001~C-006)
SEED_TARGET=local npx tsx scripts/seed-supervisor-demo.ts
```

prod는 `SEED_TARGET=prod`. 모든 시드는 idempotent.

### 1-3. 자동 회귀 (먼저 ✅ 확인)

```bash
SEED_TARGET=prod npx tsx scripts/verify-staff-demo-cases.ts        # 4 demo 케이스
SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts            # 5단계 데이터 흐름
SEED_TARGET=prod npx tsx scripts/test-closing-bpe-sync.ts          # 결산 ↔ Coretax
SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts           # 외부 ↔ 내부 격리
SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts              # 결제

npm run test:e2e:operator-staff         # API 회귀 9 cases
npm run test:e2e:operator-staff-pages   # UI 렌더링 6 cases
```

전부 ✅ 떨어진 후 수동 시나리오로.

---

## 2. 계정 일람 (5 역할 시점)

| 역할 | 계정 | 비번 | 진입 후 도착 페이지 |
|---|---|---|---|
| **① 개인 고객** | `customer.test@example.com` | `TestPassword123!` | `/dashboard` 개인 |
| **② 법인 고객** | `company.test@example.com` | `TestPassword123!` | `/dashboard` 법인 (5 dropdown) |
| **③ 상담사 — JTC** | `consultant.test@jakartatax.co.id` | `TestPassword123!` | `/dashboard` 컨설턴트 |
| **③ 상담사 — 외부** | `external.consultant@mitrapajak.com` | `TestPassword123!` | `/dashboard` 컨설턴트 (다른 partner) |
| **③ 상담사 — 운영팀 (상담원)** | `op-emp001@aipajak.com` (EMP001 김상담) | `TestPassword123!` | `/operator/my-work` ⭐ |
| **③ 상담사 — 운영팀 (슈퍼바이저)** | `sv-annual@aipajak.com` (SUP002 박수퍼) | `TestPassword123!` | `/operator/dashboard` 콘솔 |
| **③ 상담사 — 운영팀 (마스터)** | `master.test@aipajak.com` | `TestPassword123!` | `/admin/master` |
| **④ 어드바이저** | `advisor.test@jakartatax.co.id` | `TestPassword123!` | `/dashboard` 컨설턴트 (어드바이저 권한) |
| **⑤ 어드민** | `admin.test@aipajak.com` | `TestPassword123!` | `/dashboard` 어드민 |

### 운영팀 데모 케이스 (EMP001 = 상담원 시나리오의 주연)
| Case | 회사 | 상태 | 사용 흐름 |
|---|---|---|---|
| **C-001** | PT Hijau Lumut | DATA_REVIEW (4 reviewItems) | 검토 화면 |
| **C-002** | PT ABC | PENDING_APPROVAL (reviewRequired=3) | 승인요청 (Final Review) |
| **C-005** | PT Sehat Sentosa | APPROVED (reviewRequired=0) | Coretax ID Billing 발행 |
| **C-006** | PT Maju Bersama | EBILLING_GENERATED (ebilling=820123456789012) | Coretax NTPN/BPE |

---

## 3. 역할별 단독 시나리오

### ① 개인 고객
로그인: `customer.test@example.com`

#### 사이드바 / 라우팅
- [ ] 7 평면 메뉴 (대시보드 / 연 신고 / ID Billing / 보고서 / 내 정보 / 결제 / 도움말)
- [ ] 어드민 메뉴(Monitoring 등) 안 보임

#### 연 신고
- [ ] `/tax/spt-tahunan` 1770/1770S/1770SS 선택
- [ ] 1770SS wizard 1~5 step
- [ ] PDF 미리보기 + 제출

#### ID Billing & 결제
- [ ] `/tax/billing` Billing 코드 확인
- [ ] 납부 증빙(NTPN) 업로드
- [ ] `/billing` Midtrans 결제 흐름

#### 다국어 ⭐
- [ ] 사이드바 언어 전환 (id/en/ko/ja/zh) → 모든 텍스트 모국어
- [ ] **결산 「제출 완료」 카드의 status 라벨/BPE/NTPN도 모국어**

---

### ② 법인 고객
로그인: `company.test@example.com`

#### 사이드바 5 dropdown
- [ ] 대시보드 / 월 신고 / 연 신고 / 신고관리 / 계정
- [ ] dropdown 펼침/접힘, 현재 페이지 자동 펼침

#### 월 신고
- [ ] `/tax/pph21` PPh21 / `/tax/pph23` PPh23 / `/tax/ppn` PPN
- [ ] `/tax/umkm` 0.5% / `/tax/billing` ID Billing
- [ ] `/tax/payroll/employees` 직원 인사 (12 섹션 + 일괄 import)

#### 연 신고 ⭐ (Phase E 핵심)
- [ ] `/tax/annual` UMKM 또는 PPh25 분기
- [ ] basic / dokumen / sales / cogs / opex / closing / submit 단계
- [ ] 「SPT 제출 + 결산 완료」 클릭
- [ ] **`<ClosingSubmissionStatus />` 카드 표시**:
  - 🟡 SUBMITTED → 운영팀 처리하면 자동 갱신
  - 🟢 COMPLETED + BPE 번호 + NTPN 강조
  - 🔴 FAILED + failure_reason

#### 신고관리
- [ ] `/filings` 이력 / `/reports` 보고서 / `/counterparties` 거래처

---

### ③ 상담사

3-1, 3-2, 3-3 세 묶음으로 나눠 검증.

---

#### 3-1. **상담사 — JTC 컨설턴트** (외부 / 어드바이저 위에 있는 그룹)

로그인: `consultant.test@jakartatax.co.id`

##### 고객 관리
- [ ] `/customers` 리스트 (필터/정렬/페이지네이션)
- [ ] `/customers/new` 고객 생성 dialog
- [ ] `/customers/[id]` 5 탭 (profile/filings/poa/notes/activity)
- [ ] 노트 추가 + 핀

##### 세금 도구
- [ ] `/tax/monthly-dashboard` / `/tax/spt-masa` / `/tax/pph21-bulk`
- [ ] `/tax/anomaly` 이상치
- [ ] `/poa` POA 목록 + 서명 흐름

##### 외부 세무법인 (`external.consultant@mitrapajak.com`)
- [ ] `/customers` — **JTC 컨설턴트의 고객은 안 보임 ⭐ (RLS Phase B-1)**
- [ ] 자기 partner의 고객만 보이고, 자기 partner 한정으로 신고 제출 가능

> ⚠️ **JTC 컨설턴트는 신고 제출 권한 없음** — 어드바이저(④)만 가능 (Hard rule #3)

---

#### 3-2. **상담사 — 운영팀 / 상담원** (가장 큰 검증) ⭐⭐

로그인: `op-emp001@aipajak.com` (EMP001 김상담) → `/operator/my-work` 자동

##### 사이드바 (5 평면 메뉴 + 상단)
- [ ] 내 업무 / 검토 / 승인요청 / Coretax 처리 / 이력
- [ ] 슈퍼바이저 메뉴 안 보임 ⭐
- [ ] 상단 stepper (1 고객선택 → 5 완료) 자동 highlight
- [ ] 우상단 「내 상태」 카드 (이름 + work_state + 로그인/배정/자동배정)

##### ① 내 업무
- [ ] 4 KPI (긴급/검토필요/승인대기/Coretax 대기)
- [ ] 4 케이스 카드 — 상태배지/우선순위/D-Day/4 메트릭/다음 작업 다크 배너
- [ ] 빠른 필터 3종 토글
- [ ] 카드 클릭 → review-case 이동, lastCase localStorage 저장

##### ② 검토 (3-pane)
- [ ] 좌 「내 고객」 4건, 현재 케이스 하이라이트
- [ ] 중앙 다크 헤더 + 메타 카드 (서비스/원천세 합계/Supervisor 승인)
- [ ] 「확인할 항목」 N개 — 자료보기 / 확인완료 / 자료요청 3 액션
- [ ] **「Invoice OCR 추가」 보라색 버튼** — 이미지 업로드 → AI 분류 결과
- [ ] 우 sticky 「다음 작업」 4 액션 (상태별 자동 disable)
- [ ] 고객 NTPN + 상담원 수정값 input

##### ③ 승인요청 (Final Review)
- [ ] 4 KPI
- [ ] reviewRequired>0 → 🔴 빨간 경고 + 「② 검토 먼저」
- [ ] reviewRequired=0 → 🟢 OK + 가이드 3 step
- [ ] **최종 원천세 적용값 테이블** — Vendor/세목/Tax Code/DPP/세액 모두 편집 (onBlur PUT)
- [ ] 합계 우상단 다크 배지
- [ ] 제출자료 + 처리 이력
- [ ] 「최종 검토 완료」 체크박스 → 「Supervisor 승인요청 보내기」 버튼

##### ④ Coretax 처리
- [ ] 모드 배지 (🔌 API 자동 / 📝 수동 모드, env 의존)
- [ ] 처리 순서 4 카드
- [ ] 1. Coretax 접속 — 새 탭/현재 탭/주소 복사
- [ ] 2. ID Billing — Billing ID input + 발행완료 기록 (승인 후만)
- [ ] 3. NTPN — 고객 제출값 vs 상담원 수정값 + 확인
- [ ] 4. BPE — BPE 번호 + 신고완료/BPE 반영 → status COMPLETED
- [ ] 체크리스트 6항목 select
- [ ] 빠른 액션 (접근권한/납부증빙)
- [ ] 수동 처리 로그
- [ ] **「결산 wizard 연동」 배지** (closing 케이스에서만)

##### ⑤ 이력
- [ ] 5 KPI
- [ ] 상세 타임라인 (kind 색상 배지)
- [ ] 회사별 전체 이력 + 케이스 테이블 (Case/서비스/상태/담당/Billing/NTPN/신고완료)
- [ ] 내 고객 전체 최근 이력 (시간순 30건)

##### 다국어 ⭐ (5 locales × 5 페이지 = 25 라우트)
- [ ] id/en/ko/ja/zh 전환 시 헤더/버튼/메시지 모두 모국어
- [ ] eventLabel / caseStatus / nextAction 모두 i18n

---

#### 3-3. **상담사 — 운영팀 / 슈퍼바이저**

로그인: `sv-annual@aipajak.com` (SUP002)

##### 사이드바 (4 dropdown)
- [ ] Dashboard / 업무 / 인사·평가 / 시스템
- [ ] 일반 상담원 5 메뉴 안 보임

##### 업무
- [ ] `/operator/workload` 3-column 콘솔 (내 팀 / 미배정 / 우선순위)
  - 우측 어시스트 패널 6종 (선택 결정 / 우선지원 / 자동배정 / 제외 / 환수·재배정 / SV 이관)
  - **Bulk Transfer**(상담원/슈퍼바이저 퇴사) preview + 실행
- [ ] `/operator/approvals` 승인/반려
- [ ] `/operator/cases` 전체 케이스
- [ ] `/operator/queue` 11-state 워크플로우
- [ ] `/operator/review` / complaints / clients / calendar

##### 인사·평가
- [ ] `/operator/team` 12명 상태 + Span of Control
- [ ] `/operator/statistics` 평가 가중치 + 인센티브 정책 (5 KPI)

##### 시스템
- [ ] `/operator/audit` 풍부 이벤트 + 필터 chip
- [ ] `/operator/approval-rules` 자동 승인 임계값
- [ ] `/operator/settings` 양식 버전

---

#### 3-4. **상담사 — 운영팀 / 마스터** (선택)

로그인: `master.test@aipajak.com` → `/admin/master` 자동

- [ ] MRR / 플랜 분포 / Pro 한도 초과 고객
- [ ] `/admin/master/custom-pricing` 커스텀 가격 견적
- [ ] 슈퍼바이저 콘솔도 진입 가능 (상위 권한)

---

### ④ 어드바이저
로그인: `advisor.test@jakartatax.co.id`

상담사 — JTC 컨설턴트의 모든 시나리오 + **추가**:

- [ ] **신고 제출 권한 ⭐** — active POA 보유 케이스만 제출 가능
- [ ] POA 만료/없음 케이스는 제출 불가 (RLS + middleware 차단)
- [ ] 본인 담당 모든 고객 일괄 처리

---

### ⑤ 어드민 (반-부정 테스트 ⭐)
로그인: `admin.test@aipajak.com`

#### 어드민 메뉴
- [ ] `/admin/monitoring` 에러/회로 차단기/메모리/활동
- [ ] `/admin/users` / `/admin/billing` / `/admin/audit-logs`

#### **Hard rule #1 검증** ⚠️
- [ ] URL 직접 입력 `/customers` 또는 `/tax/spt-tahunan` → **403 또는 redirect**
- [ ] API `/api/customer/[id]` 호출 → **`blockPlatformAdmin` 차단**
- [ ] `/admin/master` 진입 → **403** (마스터만)

---

## 4. 크로스체크 시나리오 (다중 역할 닫힌 루프)

### 시나리오 ① 결산 wizard ↔ 운영팀 BPE 자동 반영 ⭐⭐⭐

**참여**: 법인 고객 → 상담사(슈퍼바이저) → 상담사(상담원) → 법인 고객 (재방문)

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | 법인 고객 | `/tax/annual` wizard 끝까지 → 「제출」 | 🟡 SUBMITTED 카드 |
| 2 | 슈퍼바이저 | `/operator/cases` 새 케이스 발견 | case_code = `CL-XXXXXXXX` |
| 3 | 슈퍼바이저 | EMP001 배정 → 「승인」 | status APPROVED |
| 4 | 상담원 (EMP001) | `/operator/coretax/[id]` 진입 | 「🔌 결산 wizard 연동」 배지 |
| 5 | 상담원 | Billing ID 입력 → 발행완료 기록 | 고객 wizard 새로고침 시 🔵 PROCESSING |
| 6 | 상담원 | BPE 번호 입력 → 「Coretax 신고완료/BPE 반영」 | status COMPLETED |
| 7 | 법인 고객 (재방문) | `/tax/annual` 새로고침 | 🟢 COMPLETED + BPE/NTPN 강조 박스 ⭐ |

**검증 핵심**: closing_submission/closing_id_billing 모두 동기화, case_audit_log + coretax_step_log 누적.

---

### 시나리오 ② 상담원 검토 → 승인 → Coretax 닫힌 루프

**참여**: 상담사(상담원) → 상담사(슈퍼바이저) → 상담사(상담원)

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | 상담원 (EMP001) | my-work에서 C-001 클릭 | review-case 진입 |
| 2 | 상담원 | 「확인할 항목」 4건 — 확인완료 3 + 자료요청 1 | reviewRequired 감소 |
| 3 | 상담원 | 「Invoice OCR 추가」 JPG 업로드 | 새 ReviewItem push |
| 4 | 상담원 | 우측 「1. Supervisor 승인요청」 | status PENDING_APPROVAL |
| 5 | 상담원 | 승인요청 페이지 → 「최종 검토 완료」 + 상신 | my-work 카드 「승인요청」 상태 |
| 6 | 슈퍼바이저 | `/operator/approvals` 승인 | status APPROVED |
| 7 | 상담원 | Coretax → ID Billing 발행 → BPE 입력 | status COMPLETED |
| 8 | 상담원 | history → 회사 전체 이력 | 모든 단계 타임라인 |

---

### 시나리오 ③ JTC ↔ 외부 세무법인 격리

**참여**: 상담사(JTC 컨설턴트) ↔ 상담사(외부 컨설턴트)

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | JTC 컨설턴트 | 새 고객 X 생성 | tax_partner_id = JTC |
| 2 | 외부 컨설턴트 | `/customers` 진입 | 고객 X **안 보임** ⭐ |
| 3 | 외부 컨설턴트 | 새 고객 Y 생성 | tax_partner_id = PT Mitra |
| 4 | JTC 컨설턴트 | `/customers` | 고객 Y 안 보임 |
| 5 | 외부 컨설턴트 | 고객 Y 신고 제출 | OK (Phase B-2.1) |
| 6 | JTC 컨설턴트 | 고객 X 신고 제출 시도 | **403** (어드바이저만) |

자동: `SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts`

---

### 시나리오 ④ 다국어 일관성

**참여**: 동일 사용자, 언어만 전환

| Step | 동작 | 검증 |
|---|---|---|
| 1 | EMP001 → `/ko/operator/my-work` | 「내 업무」 |
| 2 | URL `/id/...` | 「Pekerjaan Saya」 |
| 3 | `/en/...` | 「My Work」 |
| 4 | `/ja/...` | 「マイ業務」 |
| 5 | `/zh/...` | 「我的工作」 |

5단계 페이지(my-work / review-case / approval-request / coretax / history) 모두 5 locales 검증.

---

### 시나리오 ⑤ Bulk Transfer (운영팀 퇴사)

**참여**: 상담사(슈퍼바이저)

| Step | 동작 | 검증 |
|---|---|---|
| 1 | `/operator/workload` → 「퇴사 Bulk Transfer」 | preview UI |
| 2 | EMP001 (from), EMP005 (to) | 활성 케이스 N건 표시 |
| 3 | 「확정」 | EMP001 status=inactive, EMP005에 케이스 모두 이관 |
| 4 | `/operator/audit` | BULK_TRANSFERRED 이벤트 N건 |
| 5 | EMP005 로그인 | my-work에 EMP001 케이스 모두 보임 |

---

### 시나리오 ⑥ Coretax API 자동 모드 (선택)

`CORETAX_SUBMIT_ENABLED=true`인 경우만:

| Step | 동작 | 검증 |
|---|---|---|
| 1 | 상담원 → Coretax 진입 | 🔌 API 자동 배지 |
| 2 | Billing ID 비워두고 「API로 자동 발행」 | DJP API 호출 → billingCode 자동 |
| 3 | BPE 비워두고 「API로 자동 제출」 | bpe_number 자동, status COMPLETED |

---

### 시나리오 ⑦ Invoice OCR (Anthropic 비용)

**참여**: 상담사(상담원) + Anthropic API

| Step | 동작 | 검증 |
|---|---|---|
| 1 | 「Invoice OCR 추가」 → 실제 invoice JPG/PNG 업로드 | spinner → AI 분류 박스 |
| 2 | 결과 박스 — taxKind/taxCode/신뢰도 | ≥70% → 자동확인, <70% → AI 확인필요 |
| 3 | review_summary.items push | 「확인할 항목」 즉시 표시 |
| 4 | history 진입 | OCR 이벤트 표시 |

자동: `ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-ocr-real.ts`

---

## 5. 시나리오 ↔ 자동화 매핑

| 시나리오 | 자동화 |
|---|---|
| ① 결산 ↔ Coretax | `test-closing-bpe-sync.ts` |
| ② 상담원 5단계 | `test-staff-workflow.ts` + `operator-staff-workflow.spec.ts` |
| ③ Tenant 격리 | `verify-rls-isolation.ts` |
| ④ 다국어 | (수동: curl 5×5) |
| ⑤ Bulk Transfer | `operator-queue-workflow.spec.ts` |
| ⑥ Coretax API | `coretax/client.test.ts` (vitest) |
| ⑦ OCR | `test-ocr-real.ts` |

---

## 6. 알려진 제약

- **Coretax API**: DJP API spec 미공개 → adapter 구조만 완성, env 활성화 전엔 수동 모드
- **OCR 비용**: Anthropic Claude Vision 1장 ≈ $0.003
- **Invoice/Contract/Bank PDF preview**: 현재 mock — Phase 7+에서 document 테이블 연동 예정

### 환경변수
| Var | 영향 |
|---|---|
| `CORETAX_SUBMIT_ENABLED='true'` | 운영팀 Coretax 「🔌 API 자동」 |
| `MIDTRANS_IS_PRODUCTION='true'` | 결제 prod |
| `ANTHROPIC_API_KEY` | Invoice OCR |

### Hard Rules (5 가지, 깨지면 안 됨)
1. **어드민(⑤)은 고객 세금 데이터 접근 금지** — `blockPlatformAdmin` middleware
2. **상담사(③)는 등록된 tax_partner 소속 필수** — JTC ↔ 외부 격리
3. **신고 제출은 어드바이저(④)만** — JTC 컨설턴트와 운영팀은 못 함
4. **결제 시스템은 SYSTEM 전용** — 다른 역할이 결제 자동 처리 불가
5. **모든 mutation은 audit_log** — `withAudit` middleware

---

## 7. 빠른 체크리스트 (10분 smoke)

```bash
# 1. 자동 회귀
SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts

# 2. 5 locales × 5 staff pages
for loc in id en ko ja zh; do
  for path in my-work review-case approval-request coretax history; do
    code=$(curl -sI -o /dev/null -w "%{http_code}" "https://ai-pajak.vercel.app/$loc/operator/$path")
    [ "$code" = "200" ] && echo "✓ $loc/$path" || echo "✗ $loc/$path → $code"
  done
done

# 3. e2e
npm run test:e2e:operator-staff

# 4. 수동 — 5 역할 한 명씩 로그인해 1분씩
#    (① customer.test  ② company.test  ③ op-emp001  ④ advisor.test  ⑤ admin.test)
```

---

## 8. 이슈 발견 시 보고 형식

```
[버그 #N] 짧은 제목

## 환경
- 역할: ③ 상담사 / 운영팀 / 상담원 (EMP001)
- 페이지: /ko/operator/review-case/<uuid>
- 브라우저: Chrome 126 / Safari 17

## 재현
1. ...
2. ...

## 기대 / 실제
기대: ...
실제: ...

## 첨부
- 콘솔 첫 빨간 줄 (TypeError: ... 같은 message)
- 또는 화면 「오류 상세 보기」의 name + message
```

이 형식으로 보고하면 5분 내 root cause 식별 가능. minified stack만 보내면 진단 어려움.
