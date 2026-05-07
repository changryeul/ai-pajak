# AI Pajak 전체 시스템 테스트 가이드 (2026-05)

이 문서는 시스템 전체를 **역할별로** 단독 테스트하고, 다중 역할이 협업하는 **크로스체크 시나리오**를 검증하기 위한 작업 매뉴얼입니다.

> 매번 prod에 배포된 화면으로 테스트해도 됩니다. CLAUDE.md 메모리: "프로덕션도 테스트 환경" 정책. 마이그레이션 자유.

---

## 0. 사전 준비

### 0-1. 환경

| 환경 | URL | 비고 |
|---|---|---|
| **prod** | `https://ai-pajak.vercel.app` | 권장 — 항상 최신 |
| local dev | `http://localhost:3000` | `npm run dev` + `supabase start` |

### 0-2. 시드 (한 번만)

prod는 이미 시드되어 있음. 로컬은 다음 한 번:

```bash
# 기본 사용자 (개인 / 컨설턴트 / 어드바이저 / 어드민)
npm run db:seed-test-users

# 운영팀 12명 + EXTERNAL tax_partner + 그 컨설턴트
SEED_TARGET=local npx tsx scripts/seed-master-and-external.ts

# 회사 고객 (company.test@example.com → COMPANY)
SEED_TARGET=local npx tsx scripts/seed-company-customer.ts

# 슈퍼바이저 데모 케이스 (C-001 ~ C-006, EMP001~EMP012)
SEED_TARGET=local npx tsx scripts/seed-supervisor-demo.ts
```

prod에 시드 다시 돌릴 때는 위 `SEED_TARGET=local` → `SEED_TARGET=prod`. **두 명령 시드는 idempotent** — 여러 번 돌려도 안전.

### 0-3. 회귀 자동 검증 스크립트

본격 수동 테스트 전에 데이터 정합성 한 번:

```bash
SEED_TARGET=prod npx tsx scripts/verify-staff-demo-cases.ts        # EMP001 4 demo 케이스 OK?
SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts            # Phase 1~6 데이터 흐름
SEED_TARGET=prod npx tsx scripts/test-closing-bpe-sync.ts          # 결산 ↔ Coretax BPE 동기화
SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts           # JTC ↔ EXTERNAL tenant isolation
SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts              # 3 billing endpoint smoke
```

**모두 ✅ 떨어져야** 다음 단계로.

### 0-4. e2e 회귀

```bash
npm run test:e2e:operator-staff         # 9 cases — Phase 1~6 + OCR
npm run test:e2e:operator-staff-pages   # 6 cases — UI 렌더링
npm run test:e2e:operator               # supervisor 콘솔
npm run test:e2e:audit                  # 감사로그
```

---

## 1. 계정 일람

| 역할 | 이메일 | 비밀번호 | 진입 후 자동 이동 |
|---|---|---|---|
| **CUSTOMER (INDIVIDUAL)** | `customer.test@example.com` | `TestPassword123!` | `/dashboard` 개인 |
| **CUSTOMER (COMPANY)** | `company.test@example.com` | `TestPassword123!` | `/dashboard` 법인 |
| **CONSULTANT_JTC** (JTC 내부) | `consultant.test@jakartatax.co.id` | `TestPassword123!` | `/dashboard` 컨설턴트 |
| **TAX_ADVISOR_JTC** (JTC 내부) | `advisor.test@jakartatax.co.id` | `TestPassword123!` | `/dashboard` 컨설턴트 |
| **CONSULTANT_JTC** (EXTERNAL — PT Mitra Pajak Sentosa) | `external.consultant@mitrapajak.com` | `TestPassword123!` | `/dashboard` 컨설턴트 (다른 partner) |
| **TAX_OPERATOR** (일반 상담원, EMP001 김상담) | `op-emp001@aipajak.com` | `TestPassword123!` | **`/operator/my-work`** ⭐ |
| TAX_OPERATOR (EMP002~012) | `op-emp002~012@aipajak.com` | 동일 | 동일 |
| **TAX_OPERATOR_SUPERVISOR** (SUP002 박수퍼) | `sv-annual@aipajak.com` | `TestPassword123!` | `/operator/dashboard` 콘솔 |
| TAX_OPERATOR_SUPERVISOR (SUP001 / SUP003) | `sv-corporate@aipajak.com` / `sv-personal@aipajak.com` | 동일 | 동일 |
| **TAX_OPERATOR_SUPERVISOR** (legacy) | `supervisor.test@aipajak.com` | `TestPassword123!` | 동일 |
| **TAX_OPERATOR_MASTER** | `master.test@aipajak.com` | `TestPassword123!` | `/admin/master` |
| **PLATFORM_ADMIN** | `admin.test@aipajak.com` | `TestPassword123!` | `/dashboard` 어드민 |

### 시드된 데모 케이스 (EMP001 = `op-emp001@aipajak.com` 배정)
| Case | 회사 | 상태 | 흐름 시작점 |
|---|---|---|---|
| **C-001** | PT Hijau Lumut | DATA_REVIEW (검토중, 4 reviewItems) | 검토 화면 |
| **C-002** | PT ABC | PENDING_APPROVAL (승인요청 중, 4 reviewItems, reviewRequired=3) | 승인요청 (Final Review) |
| **C-005** | PT Sehat Sentosa | APPROVED (승인 완료, reviewRequired=0) | Coretax 처리 (ID Billing 발행) |
| **C-006** | PT Maju Bersama | EBILLING_GENERATED (ebilling=820123456789012) | Coretax 처리 (NTPN/BPE) |
| **C-001-2025** | PT Hijau Lumut | COMPLETED | 이력 확인 |

---

## 2. 역할별 단독 시나리오

각 역할이 **다른 역할 도움 없이** 자기 화면만으로 검증할 수 있는 흐름. 처음 한 번은 **모든 항목 ✅** 가 떨어져야 합니다.

---

### 2-1. CUSTOMER (INDIVIDUAL — 개인)

로그인: `customer.test@example.com / TestPassword123!`

#### A. 사이드바 / 라우팅
- [ ] 7 평면 메뉴 (대시보드 / 연 신고 / ID Billing / 보고서 / 내 정보 / 결제 / 도움말)
- [ ] 「Pelaporan Pajak」 또는 「세금 신고」 섹션 보임
- [ ] PLATFORM_ADMIN 메뉴(Monitoring/Cron 등) **안 보임** (RLS)

#### B. 연 신고
- [ ] `/tax/spt-tahunan` 진입 → 1770/1770S/1770SS 선택 가능
- [ ] 1770SS wizard 1~5 step 진행 가능
- [ ] PDF 미리보기 / 제출

#### C. ID Billing
- [ ] `/tax/billing` 진입
- [ ] 발행된 Billing 코드 확인
- [ ] 납부 증빙(NTPN) 업로드

#### D. 다국어
- [ ] 사이드바에서 언어 전환 (id/en/ko/ja/zh) → 모든 텍스트가 모국어로 변경
- [ ] 결산 「제출 완료」 카드의 status/BPE/NTPN 라벨도 모국어

---

### 2-2. CUSTOMER (COMPANY — 법인)

로그인: `company.test@example.com / TestPassword123!`

#### A. 사이드바 5 dropdown
- [ ] 대시보드 / 월 신고 / 연 신고 / 신고관리 / 계정 (5 큰 메뉴)
- [ ] 각 dropdown 펼침/접힘 토글
- [ ] 현재 페이지가 속한 dropdown은 **자동 펼침**

#### B. 월 신고 (PPh21/PPh23/PPN/UMKM/PPh25)
- [ ] `/tax/pph21` PPh21 현황 + 입력
- [ ] `/tax/pph23` PPh23 거래 입력
- [ ] `/tax/ppn` PPN 매출/매입
- [ ] `/tax/umkm` UMKM final tax 0.5% 계산
- [ ] `/tax/billing` ID Billing 발행 화면

#### C. 연 신고 ⭐ (Phase E 핵심)
- [ ] `/tax/annual` 결산 wizard 진입
- [ ] UMKM 또는 PPh25 분기 선택
- [ ] basic / dokumen / sales / cogs / opex / closing / submit 각 단계
- [ ] 마지막 「SPT 제출 + 결산 완료」 클릭
- [ ] **`<ClosingSubmissionStatus />` 카드 표시**:
  - 🟡 SUBMITTED (운영팀 검증 대기) → 운영팀이 처리하면 자동 갱신
  - 🟢 COMPLETED (BPE 번호 + NTPN 강조 박스)
  - 🔴 FAILED (failure_reason 본문)

#### D. AI Payroll (직원 인사)
- [ ] `/tax/payroll/employees` 직원 master 리스트
- [ ] Employee HR Record 12 섹션 편집
- [ ] Excel/CSV 일괄 import

#### E. 신고관리 / 보고서
- [ ] `/filings` 신고 이력
- [ ] `/reports` 세금 보고서
- [ ] `/counterparties` 거래처 입력

---

### 2-3. CONSULTANT_JTC (JTC 내부 컨설턴트)

로그인: `consultant.test@jakartatax.co.id / TestPassword123!`

#### A. 고객 관리
- [ ] `/customers` 고객 리스트 (필터/정렬/페이지네이션)
- [ ] `/customers/new` 고객 생성 dialog
- [ ] `/customers/[id]` 고객 상세 (profile / filings / poa / notes / activity 5 탭)
- [ ] 고객 노트 추가 / 핀

#### B. 세금 신고 도구
- [ ] `/tax/monthly-dashboard` 월별 대시보드
- [ ] `/tax/spt-masa` SPT Masa 입력
- [ ] `/tax/pph21-bulk` PPh21 일괄 계산
- [ ] `/tax/anomaly` 이상치 탐지

#### C. POA (위임장)
- [ ] `/poa` POA 목록
- [ ] POA 상세 / 서명 흐름

> ⚠️ **CONSULTANT_JTC는 신고 제출 권한 없음** — TAX_ADVISOR_JTC만 가능 (Hard rule #3)

---

### 2-4. TAX_ADVISOR_JTC (JTC 내부 어드바이저)

로그인: `advisor.test@jakartatax.co.id / TestPassword123!`

CONSULTANT_JTC의 모든 시나리오 + 추가:

#### A. 신고 제출
- [ ] 고객 신고 제출 (active POA 보유 케이스만 가능)
- [ ] POA 만료/삭제 케이스는 제출 불가 (RLS + middleware 차단)

#### B. 어드바이저 전용
- [ ] 본인이 담당하는 모든 고객 신고 일괄 처리

---

### 2-5. EXTERNAL CONSULTANT (PT Mitra Pajak Sentosa)

로그인: `external.consultant@mitrapajak.com / TestPassword123!`

#### A. Tenant 격리 ⭐
- [ ] `/customers` 자기 partner의 고객만 보임
- [ ] **JTC partner 고객(consultant.test의 고객)은 안 보임** (Phase B-1 RLS)
- [ ] `/tax/multi-entity` 등 partner 단위 모든 메뉴 자기 partner 데이터만

#### B. 신고 제출
- [ ] 본인 partner의 고객에 대해 신고 제출 가능 (Phase B-2.1로 권한 확장됨)

---

### 2-6. TAX_OPERATOR (일반 상담원, EMP001 김상담) ⭐⭐

로그인: `op-emp001@aipajak.com / TestPassword123!`

자동 리다이렉트 → `/operator/my-work`

#### A. 사이드바 (5 평면 메뉴)
- [ ] 내 업무 / 검토 / 승인요청 / Coretax 처리 / 이력
- [ ] 슈퍼바이저 메뉴(워크로드 관리 / 승인 규칙) **안 보임**
- [ ] 상단 stepper (1 고객선택 → 5 완료) — 현재 단계 자동 highlight
- [ ] 우상단 「내 상태」 카드: 김상담 EMP001 + work_state 배지 + 로그인/내 배정/자동배정

#### B. ① 내 업무
- [ ] 4 KPI: 긴급 / 검토필요 / 승인대기 / Coretax 대기
- [ ] 시드 4 케이스 카드 (PT Hijau Lumut / PT ABC / PT Sehat Sentosa / PT Maju Bersama)
- [ ] 카드별 4 메트릭 + D-Day + 다음 작업 다크 배너
- [ ] 빠른 필터 3종 토글 (승인요청 / Coretax / 자료요청)
- [ ] 카드 클릭 → review-case로 이동, lastCase 저장

#### C. ② 검토 (3-pane)
- [ ] 좌측 「내 고객」 4건 — 현재 케이스 하이라이트
- [ ] 중앙 다크 헤더 + 메타 카드(서비스/원천세 합계/Supervisor 승인)
- [ ] 「확인할 항목」 N개 — 자료보기 / 확인완료 / 자료요청 3 액션
- [ ] **「Invoice OCR 추가」 버튼** (보라색) — JPG/PNG 업로드 → AI 분류 결과 박스
- [ ] 우측 sticky 「다음 작업」 4 액션 — 상태에 따라 자동 disable
- [ ] 고객 NTPN + 상담원 수정값 input

#### D. ③ 승인요청 (Final Review)
- [ ] 4 KPI (고객 / 서비스 / 검토필요 / 자료요청중)
- [ ] reviewRequired>0 → 🔴 빨간 경고 + 「먼저 ② 검토」 안내
- [ ] reviewRequired=0 → 🟢 OK + 가이드 3 step
- [ ] **최종 원천세 적용값 테이블** — Vendor input / 최종 세목 select / 최종 Tax Code input / DPP & 세액 number inputs
- [ ] onBlur 시 PUT — 변경 즉시 반영
- [ ] 합계 우상단 다크 배지
- [ ] 제출자료 / 처리 이력
- [ ] 「최종 검토 완료」 체크박스 + 「Supervisor 승인요청 보내기」 버튼

#### E. ④ Coretax 처리
- [ ] 모드 배지 (🔌 API 자동 / 📝 수동 모드) — `CORETAX_SUBMIT_ENABLED` env
- [ ] 처리 순서 4 카드 (1.접속 → 2.Billing → 3.NTPN → 4.BPE)
- [ ] 1. Coretax 접속 — 새 탭 / 현재 탭 / 주소 복사
- [ ] 2. ID Billing — Billing ID input + 발행완료 기록 (승인 후만 활성)
- [ ] 3. NTPN — 고객 제출값 vs 상담원 수정값 + 확인
- [ ] 4. BPE — BPE 번호 input + 신고완료/BPE 반영 클릭 → status COMPLETED 전환
- [ ] 체크리스트 6항목 select (대기/진행/완료/미완)
- [ ] 빠른 액션 (접근권한 / 납부증빙 요청)
- [ ] 수동 처리 로그 — 자유 입력 + 누적 표시
- [ ] **「결산 wizard 연동」 배지** (closing_session_id 채워진 케이스에서만)

#### F. ⑤ 이력
- [ ] 5 KPI (선택 고객 / 메시지 / 자료요청 / 처리로그 / 회사 전체)
- [ ] 케이스별 상세 타임라인 — 색상 배지 (처리 / Coretax / 시스템 / 고객 NTPN)
- [ ] 회사별 전체 이력 — 케이스 테이블(Case/서비스/상태/담당/Billing/NTPN/신고완료) + 통합 타임라인
- [ ] 내 고객 전체 최근 이력 — 모든 케이스 시간순 30건

#### G. 다국어 (5 locales)
- [ ] id/en/ko/ja/zh 전환 시 모든 텍스트 모국어 변환
- [ ] eventLabel / caseStatus / nextAction 모두 i18n

---

### 2-7. TAX_OPERATOR_SUPERVISOR ⭐

로그인: `sv-annual@aipajak.com / TestPassword123!` (SUP002 박수퍼)

#### A. 사이드바 (4 dropdown)
- [ ] Dashboard / 업무 / 인사·평가 / 시스템
- [ ] 일반 상담원 5 메뉴 **안 보임**

#### B. Dashboard
- [ ] 큐 통계 / 승인 대기 / 최근 케이스

#### C. 업무
- [ ] `/operator/workload` — 3-column 콘솔(내 팀 / 미배정 / 우선순위)
  - 우측 어시스트 패널: 선택 결정 / 우선지원 / 자동배정 / 제외 / 환수·재배정 / SV 이관
  - **Bulk Transfer**(상담원/슈퍼바이저 퇴사) preview + 실행
- [ ] `/operator/approvals` — PENDING_APPROVAL 케이스 승인/반려
- [ ] `/operator/cases` — 전체 케이스 검색
- [ ] `/operator/queue` — 11-state 워크플로우
- [ ] `/operator/review` / complaints / clients / calendar

#### D. 인사·평가
- [ ] `/operator/team` — 12 상담원 상태 + Span of Control
- [ ] `/operator/statistics` — 평가 가중치 + 인센티브 정책 (5 KPI)

#### E. 시스템
- [ ] `/operator/audit` — case_audit_log 풍부 이벤트 + 필터 chip
- [ ] `/operator/approval-rules` — 자동 승인 임계값
- [ ] `/operator/settings` — 양식 버전

---

### 2-8. TAX_OPERATOR_MASTER

로그인: `master.test@aipajak.com / TestPassword123!`

자동 리다이렉트 → `/admin/master`

#### A. Master Dashboard
- [ ] MRR / 플랜 분포 / Pro 한도 초과 고객
- [ ] `/admin/master/custom-pricing` — 커스텀 가격 견적

---

### 2-9. PLATFORM_ADMIN (반-부정 테스트 ⭐)

로그인: `admin.test@aipajak.com / TestPassword123!`

#### A. 어드민 메뉴
- [ ] `/admin/monitoring` 에러/회로 차단기/메모리/활동
- [ ] `/admin/users` 사용자 관리
- [ ] `/admin/billing` 결제 관리
- [ ] `/admin/audit-logs` 감사로그

#### B. **Hard rule #1 검증** ⚠️
- [ ] 직접 URL `/customers` 또는 `/tax/spt-tahunan` 입력 → **403 또는 redirect**
- [ ] API `/api/customer/[id]` 직접 호출 → **`blockPlatformAdmin` middleware로 차단**
- [ ] `/admin/master` 접근 → **403** (master만)

---

## 3. 크로스체크 시나리오 (다중 역할 닫힌 루프)

여러 역할이 협업하는 흐름. **각 시나리오는 한 번에 끝까지 진행**해야 의미가 있습니다.

---

### 시나리오 ① 결산 wizard ↔ 운영팀 BPE 자동 반영 ⭐⭐⭐

**참여 역할**: COMPANY 고객 → SUPERVISOR → 상담원 → COMPANY 고객 (재방문)

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | COMPANY 고객 | `/tax/annual` 에서 결산 wizard 끝까지 → 「제출」 | `<ClosingSubmissionStatus />` 카드 🟡 SUBMITTED 표시 |
| 2 | SUPERVISOR | `/operator/cases` 또는 workload에서 신규 케이스 찾기 | case_code = `CL-XXXXXXXX` 확인. 자동 생성된 SPT_TAHUNAN 케이스 |
| 3 | SUPERVISOR | 케이스를 EMP001에 배정 | tax_operators에 카운트 +1 |
| 4 | SUPERVISOR | 「승인」 클릭 (Approval Console) | status APPROVED |
| 5 | 상담원 (EMP001) | `/operator/coretax/[id]` 진입 | 「🔌 결산 wizard 연동」 배지 표시 |
| 6 | 상담원 | Billing ID 입력 → 「발행완료 기록」 | 고객 wizard에서 새로고침 시 🔵 PROCESSING |
| 7 | 상담원 | BPE 번호 입력 → 「Coretax 신고완료/BPE 반영」 | status COMPLETED, completed_at 채워짐 |
| 8 | COMPANY 고객 (재방문) | `/tax/annual` 새로고침 | 🟢 COMPLETED + BPE 번호 + NTPN 강조 박스 표시 ⭐ |

**검증 핵심**:
- closing_submission.{status, bpe_number, ntpn, completed_at, operator_id} 모두 채워짐
- closing_id_billing.{status='PAID', ntpn} 동기화
- case_audit_log + coretax_step_log 양쪽 누적

---

### 시나리오 ② 상담원 검토 → 승인 → Coretax 닫힌 루프

**참여 역할**: 상담원 (EMP001) → SUPERVISOR → 상담원

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | EMP001 | `/operator/my-work` 에서 C-001 카드 클릭 | review-case 진입, lastCase 저장 |
| 2 | EMP001 | 「확인할 항목」 4건 — 「확인완료」 3번, 「자료요청」 1번 | reviewRequired 카운트 감소, status PENDING_DOCS 전환 |
| 3 | EMP001 | 「Invoice OCR 추가」 → JPG 업로드 | 새 ReviewItem push, AI 분류 결과 박스 |
| 4 | EMP001 | review-case 우측 「1. Supervisor 승인요청」 | status PENDING_APPROVAL, approval-request 페이지로 이동 |
| 5 | EMP001 | 승인요청 페이지 — 「최종 검토 완료」 체크 → 「Supervisor 승인요청 보내기」 | 카드가 my-work에서 「승인요청」 상태로 |
| 6 | SUPERVISOR | `/operator/approvals` 에서 승인 | status APPROVED |
| 7 | EMP001 | `/operator/coretax/[id]` → ID Billing 발행 → BPE 입력 | status COMPLETED |
| 8 | EMP001 | `/operator/history/[id]` | 회사 전체 이력에 모든 단계 타임라인 표시 |

---

### 시나리오 ③ Tenant 격리 (JTC ↔ EXTERNAL)

**참여 역할**: CONSULTANT_JTC → EXTERNAL CONSULTANT

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | CONSULTANT_JTC | 새 고객 X 생성 | tax_partner_id = JTC |
| 2 | EXTERNAL CONSULTANT | `/customers` 진입 | 고객 X **안 보임** (RLS) |
| 3 | EXTERNAL CONSULTANT | 새 고객 Y 생성 | tax_partner_id = PT Mitra Pajak Sentosa |
| 4 | CONSULTANT_JTC | `/customers` 진입 | 고객 Y **안 보임** (RLS) |
| 5 | EXTERNAL CONSULTANT | 고객 Y 신고 제출 | OK (Phase B-2.1) |
| 6 | CONSULTANT_JTC | 고객 X 신고 제출 시도 | **403** (TAX_ADVISOR_JTC 만 가능) |

자동 검증 스크립트: `SEED_TARGET=prod npx tsx scripts/verify-rls-isolation.ts`

---

### 시나리오 ④ 다국어 일관성 (5 locales 전환)

**참여 역할**: 동일한 사용자가 언어만 전환

| Step | 동작 | 검증 |
|---|---|---|
| 1 | EMP001 로그인 → `/ko/operator/my-work` | 한국어 텍스트, 「내 업무」 헤더 |
| 2 | URL을 `/id/operator/my-work`로 변경 | 인도네시아어 「Pekerjaan Saya」 |
| 3 | `/en/operator/my-work` | 영어 「My Work」 |
| 4 | `/ja/operator/my-work` | 일본어 「マイ業務」 |
| 5 | `/zh/operator/my-work` | 중국어 「我的工作」 |
| 6 | 5 단계 모두 동일하게 검증 (review-case / approval-request / coretax / history) | 헤더, 버튼, KPI, 메시지 모두 모국어 |

**검증 자동화**: `for loc in id en ko ja zh; do for path in my-work review-case approval-request coretax history; do curl -sI -o /dev/null -w "$loc/$path -> %{http_code}\n" "https://ai-pajak.vercel.app/$loc/operator/$path"; done; done`

---

### 시나리오 ⑤ Bulk Transfer (운영팀 퇴사) ⭐

**참여 역할**: SUPERVISOR (SUP002 박수퍼)

| Step | 동작 | 검증 |
|---|---|---|
| 1 | `/operator/workload` → 「환수·재배정」 패널 → 「퇴사 Bulk Transfer」 | preview UI 열림 |
| 2 | EMP001을 from, EMP005를 to로 선택 → preview | 활성 케이스 N건, 고객 M명 표시 |
| 3 | 「확정」 | 모든 케이스의 operator_id가 EMP005로, EMP001은 status=inactive, work_state=resigned |
| 4 | `/operator/audit` 새로고침 | BULK_TRANSFERRED 이벤트 N건 누적 |
| 5 | EMP001 로그인 시도 | 정상 로그인되지만 my-cases는 0건 |
| 6 | EMP005 로그인 | my-work에 EMP001의 모든 케이스가 보임 |

---

### 시나리오 ⑥ Coretax API 자동 모드 (선택)

prod에 `CORETAX_SUBMIT_ENABLED=true`가 켜진 경우만:

| Step | 역할 | 동작 | 검증 |
|---|---|---|---|
| 1 | 상담원 | Coretax 처리 진입 | 「🔌 API 자동」 배지 |
| 2 | 상담원 | Billing ID input 비워두고 「API로 자동 발행」 | DJP API 호출 → billingCode 자동 채워짐 |
| 3 | 상담원 | BPE input 비워두고 「API로 자동 제출」 | bpe_number 자동 채워짐, status COMPLETED |
| 4 | 검증 | closing_submission.raw_response (있으면) | DJP 응답 JSON 저장 확인 |

env 미설정 시는 「📝 수동 모드」로 자동 fallback — 기존 시나리오 ②와 동일.

---

### 시나리오 ⑦ Invoice OCR (Anthropic 비용 발생)

**참여 역할**: 상담원 + Anthropic API

| Step | 동작 | 검증 |
|---|---|---|
| 1 | EMP001 → review-case → 「Invoice OCR 추가」 | file picker 열림 |
| 2 | 실제 invoice JPG/PNG 업로드 | spinner → AI 분류 결과 박스 |
| 3 | 결과 박스 — taxKind / taxCode / 신뢰도 % | 신뢰도 ≥ 70% → state=자동확인, < 70% → AI 확인필요 |
| 4 | review_summary.items 새 항목 push | 「확인할 항목」 카드에 즉시 표시 |
| 5 | history 진입 | OCR 이벤트 (`step='OCR'`) 표시 |

자동 smoke: `ANTHROPIC_API_KEY=sk-... npx tsx scripts/test-ocr-real.ts`

---

## 4. 회귀 자동 검증 (각 시나리오와 매핑)

| 시나리오 | 자동화 스크립트 | 위치 |
|---|---|---|
| ① 결산 ↔ Coretax | `test-closing-bpe-sync.ts` | scripts/ |
| ② 상담원 5단계 | `test-staff-workflow.ts` + `operator-staff-workflow.spec.ts` | scripts/, tests/e2e |
| ③ Tenant 격리 | `verify-rls-isolation.ts` | scripts/ |
| ④ 다국어 | (수동: curl 5×5) | — |
| ⑤ Bulk Transfer | `operator-queue-workflow.spec.ts` 일부 | tests/e2e |
| ⑥ Coretax API | `coretax/client.test.ts` (vitest) | src/lib/coretax/ |
| ⑦ OCR | `test-ocr-real.ts` (ANTHROPIC_API_KEY 필요) | scripts/ |

---

## 5. 알려진 제약 / 주의사항

### 5-1. 진행 중 / 미구현
- **Coretax API**: 실제 DJP API spec 미공개. graceful-degrade adapter 구조만 완성, env 활성화 전엔 수동 모드 (`📝`).
- **Anthropic OCR 호출**: prod에 invoice 이미지를 직접 업로드해 검증 시 ANTHROPIC API 비용 발생 (~$0.003/이미지).
- **Invoice/Contract/Bank PDF preview**: 현재는 mock 데이터. Phase 7+에서 실제 document 테이블과 연동 예정.

### 5-2. 환경변수 의존성
| Var | 영향 |
|---|---|
| `CORETAX_SUBMIT_ENABLED='true'` | 운영팀 화면 「🔌 API 자동」 모드 |
| `MIDTRANS_IS_PRODUCTION='true'` | 결제 prod 엔드포인트 |
| `ANTHROPIC_API_KEY` | Invoice OCR 호출 |

### 5-3. 데이터 관성 (시드 재실행)
시드 스크립트는 idempotent — 다시 실행해도 케이스가 중복되지 않습니다 (case_code unique). 단, 사용자가 임의로 case status를 변경한 후 재시드하면 상태가 시드 기본값으로 되돌아갑니다.

### 5-4. RLS 우회는 admin client만
모든 mutation은 service-role admin client + middleware auth를 거칩니다. 일반 사용자가 직접 supabase API를 부르면 RLS가 차단합니다.

### 5-5. dev server hot reload
`useTranslations` 등 i18n 키를 추가했는데 페이지가 raw key로 보이면 dev server를 재시작하세요. messages JSON은 빌드 타임에 import되므로 .next/cache가 stale일 수 있습니다.

---

## 6. 빠른 체크리스트 (10분 smoke)

처음 들어왔을 때 시스템 정상 여부를 가장 빠르게 확인:

```bash
# 1. 자동 회귀 (1분)
SEED_TARGET=prod npx tsx scripts/test-staff-workflow.ts

# 2. 5 locales × 5 staff pages = 25 라우트
for loc in id en ko ja zh; do
  for path in my-work review-case approval-request coretax history; do
    code=$(curl -sI -o /dev/null -w "%{http_code}" "https://ai-pajak.vercel.app/$loc/operator/$path")
    [ "$code" = "200" ] && echo "✓ $loc/$path" || echo "✗ $loc/$path → $code"
  done
done

# 3. e2e API 회귀 (1분)
npm run test:e2e:operator-staff

# 4. 수동 — EMP001로 로그인해 Phase 1~5 카드 클릭
# (op-emp001@aipajak.com / TestPassword123!)
```

모두 ✅ 떨어지면 시스템 정상. 단계별 시나리오 ①~⑦은 그 다음 실시.

---

## 7. 이슈 발견 시 보고 형식

```
[버그 #N] 짧은 제목

## 환경
- 역할: TAX_OPERATOR (EMP001)
- 페이지: /ko/operator/review-case/<uuid>
- 브라우저: Chrome 126 / Safari 17

## 재현
1. ...
2. ...
3. ...

## 기대 / 실제
기대: ...
실제: ...

## 첨부
- 콘솔 첫 빨간 줄 (TypeError: ... 같은 message)
- 또는 화면 「오류 상세 보기」의 name + message
```

이 형식으로 보고하면 **5분 내 root cause 식별** 가능. minified stack만 보내면 진단이 어렵습니다.
