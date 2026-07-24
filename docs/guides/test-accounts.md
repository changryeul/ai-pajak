# 테스트 계정 및 계정별 테스트 방법

> **이 문서의 목적**: 테스트 계정 10개의 로그인 정보와, 각 계정으로 로그인했을 때 "무엇이 보여야 하고, 무엇이 차단되어야 하며, 어떤 흐름을 눌러봐야 하는지"를 한 파일에 정리.
>
> - 계정이 프로덕션에 실제로 몇 명 있는지(실사)는 [`accounts.md`](./accounts.md)
> - 역할 설계·권한 이론은 [`roles.md`](./roles.md)
> - 역할별 상세 사용법은 [`../manuals/`](../manuals/) (01~08)
>
> 마지막 갱신: 2026-07-11 (P6 완료 기준 — PLATFORM_MASTER / FIRM_ADMIN 포함)

---

## 1. 테스트 환경

| 환경 | URL | DB |
|---|---|---|
| **Production** (기본 테스트 대상) | https://ai-pajak.vercel.app | Supabase Cloud |
| 로컬 | http://localhost:3000 (`npm run dev`) | `supabase start` (Studio: http://127.0.0.1:54323) |

프로덕션도 현재 스테이징을 겸하므로 아래 계정으로 자유롭게 테스트해도 됩니다.

### 계정이 없거나 깨졌을 때 (시드)

```bash
npm run db:seed-test-users                                        # JTC 고객 + 컨설턴트 + admin (로컬)
SEED_TARGET=prod npx tsx scripts/seed-test-users.ts               # 같은 것을 prod 에
SEED_TARGET=prod npx tsx scripts/seed-master-and-external.ts      # 운영팀(master 겸직 포함) + EXTERNAL 법인 + FIRM_ADMIN
SEED_TARGET=prod npx tsx scripts/seed-company-customer.ts         # company.test 를 COMPANY 고객으로 패치
SEED_TARGET=prod npx tsx scripts/seed-individual-billing.ts       # 개인 고객 /tax/billing 데모용 ID Billing 2건
```

---

## 2. 계정 총표

비밀번호는 **전 계정 공통: `TestPassword123!`**

| #   | 역할                                           | 이메일                                | 소속 (tenant)            | 로그인 후 착지                                 |
| --- | -------------------------------------------- | ---------------------------------- | ---------------------- | ---------------------------------------- |
| 1   | CUSTOMER (INDIVIDUAL 개인)                     | customer.test@example.com          | —                      | `/dashboard` (개인 SPT 대시보드)               |
| 2   | CUSTOMER (COMPANY 법인)                        | company.test@example.com           | —                      | `/dashboard` (월 신고·결산 대시보드)              |
| 5   | CONSULTANT (EXTERNAL, ERP Staff)             | external.consultant@mitrapajak.com | PT Mitra Pajak Sentosa | `/dashboard` (컨설턴트 뷰)                    |
| 6   | FIRM_ADMIN (EXTERNAL 법인 관리자)                 | firmadmin.test@mitrapajak.com      | PT Mitra Pajak Sentosa | `/consultant-erp/firm-admin/staff`       |
| 7   | TAX_OPERATOR (운영팀 상담원)                       | operator.test@aipajak.com          | JTC 운영팀                | `/operator/my-work`                      |
| 8   | TAX_OPERATOR_SUPERVISOR (운영팀 팀장)             | supervisor.test@aipajak.com        | JTC 운영팀                | `/operator/dashboard`                    |
| 9   | TAX_OPERATOR_MASTER **+ PLATFORM_MASTER 겸직** | master.test@aipajak.com            | JTC 운영팀 / MonoFlip     | `/admin/master`                          |
| 10  | PLATFORM_ADMIN (기술 관리자)                      | admin.test@aipajak.com             | MonoFlip               | `/dashboard` → `/admin/monitoring` 메뉴 사용 |

착지 분기는 `src/middleware.ts`(edge, 운영팀 tier)와 `(dashboard)/dashboard/page.tsx`(FIRM_ADMIN 포함)가 담당합니다. 착지가 어긋나거나 `/dashboard ↔ /operator` 핑퐁이 생기면 그 두 파일의 PRIORITY 목록 불일치를 의심하세요.

---

## 3. 계정별 테스트 방법

### 3-1. customer.test@example.com — 개인 고객 (INDIVIDUAL)

**핵심 흐름** (매뉴얼: [`03-individual-customer.md`](../manuals/03-individual-customer.md))
1. 로그인 → 개인 SPT 위주 대시보드가 뜨는지 확인 (1770SS/S/1770 카드)
2. `/tax` → SPT 신고 wizard 5단계 (고객선택 → 소득 → 공제 → 서류 → 검토) 진행
3. `/tax/billing` → 시드된 ID Billing 2건 (PPh21 5M / PPh23 2M) 표시 확인, 납부 증빙 업로드 (`PAYMENT_PENDING → PAYMENT_UPLOADED` — 고객이 트리거하는 유일한 상태 전이)
4. 개인 SPT 건당 결제 (1770SS 등) → Midtrans sandbox → 주문번호 `PAY-` prefix 확인
5. 우하단 AI 상담원 FAB → 메시지 전송 → 운영팀 inbox 에 도착하는지 (계정 7로 교차 확인)

**차단 확인 (RBAC)**: `/operator/*`, `/admin/*`, `/customers` 접근 시 리다이렉트 또는 403.

**자동 회귀**: `customer.spec.ts`, `real-customer-flow.spec.ts` (e2e) / smoke의 customer-ai inbox·individual billing 단계.

---

### 3-2. company.test@example.com — 법인 고객 (COMPANY)

**핵심 흐름** (매뉴얼: [`01-corporate-customer.md`](../manuals/01-corporate-customer.md))
1. 로그인 → 같은 `/dashboard` URL 인데 **월 신고·결산 wizard 위주 화면**이 떠야 함 (INDIVIDUAL 과 자동 분기)
2. 월 신고: `/tax/pph23` (원천세 일괄 임포트 — 표준 템플릿 xlsx 업로드), `/tax/ppn` (VAT OUT/IN), `/tax/pph42` (PPh4(2) 부분 뷰), 급여명세(PPh21)
3. 업로드 후 인라인 편집 (연필 아이콘) → 저장 → 운영팀 chat 에 변경 알림이 가는지
4. SPT Masa 생성 요청 → "제출" → 3-state 배너 (요청됨/처리중/완료) 확인
5. 결산(annual closing) wizard 8단계: ID Billing 발급 → 납부 → DJP 제출 → BPE → 완료
6. `/billing` → Corporate 플랜 구독 (UMKM/Basic/Pro, 주문번호 `CORP-`)

**차단 확인**: 개인 SPT (1770SS 등) 메뉴가 보이지 않아야 함. `/operator/*`, `/admin/*` 403.

**자동 회귀**: `monthly-filing.spec.ts`, `billing-phases.spec.ts` (e2e) / smoke의 importer·PUT contract·closing·company signup 단계.

---

### 3-3 / 3-4. (폐지) JTC 내부 CONSULTANT / TAX_ADVISOR

> **product-identity 결정 ① (2026-07-24)**: `CONSULTANT`/`TAX_ADVISOR` role 과 `consultant`
> 테이블은 **EXTERNAL 세무법인 전용**입니다. JTC 신고 실무는 전부 `TAX_OPERATOR` 계열이 수행합니다.
> 따라서 옛 `consultant.test@jakartatax.co.id`(폐기) / `advisor.test@jakartatax.co.id`
> (consultant 은퇴 후 supervisor 로 존속) 는 더 이상 JTC 컨설턴트 테스트 계정이 아닙니다.
> - JTC 컨설턴트 흐름 → **운영팀 계정**(operator.test / supervisor.test / master.test)으로 검증.
> - ERP(consultant) 흐름 → **EXTERNAL 계정**(external.consultant, 3-5)으로 검증.
> - 신규 JTC consultant INSERT 는 `forbid_jtc_consultant` 트리거가 DB 레벨에서 차단합니다.

---

### 3-5. external.consultant@mitrapajak.com — 외부 사무소 컨설턴트 (EXTERNAL, ERP Staff)

**이 계정의 존재 이유는 테넌트 격리 검증**입니다 (매뉴얼: [`02-external-consultant.md`](../manuals/02-external-consultant.md)).
1. 로그인 → `/customers` — **PT Mitra Pajak Sentosa 고객만** 보여야 함
2. JTC 고객 id 를 URL 로 직접 쳐서 진입 시도 → 404/403 (RLS 최종 게이트)
3. 자기 고객 신고 흐름은 JTC 컨설턴트와 동일하게 동작
4. 공동 거래처 DB (`counterparty`) 는 cross-tenant **읽기 공유**이므로 보이는 게 정상

**자동 회귀**: `SEED_TARGET=prod npx tsx scripts/test-external-consultant-isolation.ts`, `scripts/verify-rls-isolation.ts` / `security-rls.spec.ts` (e2e).

---

### 3-6. firmadmin.test@mitrapajak.com — 외부 법인 관리자 (FIRM_ADMIN, P6.2)

**핵심 흐름** (매뉴얼: [`07-firm-admin.md`](../manuals/07-firm-admin.md)) — 착지: `/consultant-erp/firm-admin/staff`
1. **직원 관리** (`/staff`): 직원 초대 → 초대 메일 수락 흐름 → TAX_ADVISOR 임명 (자격증) → 비활성화
2. **클라이언트 관리** (`/clients`): 고객 ↔ 직원 배정/재배정, 직원별 워크로드 확인
3. **청구·구독** (`/billing`): 현재 플랜 (Starter/Growth/Enterprise), 결제 이력, 업그레이드 (주문번호 `CONS-`)

**차단 확인**: JTC·타 법인 데이터 절대 안 보임. `/operator/*`, `/admin/*` 403. 반대로 **일반 consultant 계정(3-5)으로 `/consultant-erp/firm-admin/*` 진입 → 403** 도 확인.

**자동 회귀**: `firm-admin.spec.ts` 27 cases (e2e) / `scripts/test-firm-admin-flow.ts` (14 asserts), `scripts/test-firm-signup-admin-invite.ts` (가입 → 초대 → 수락 골든패스).

---

### 3-7. operator.test@aipajak.com — 운영팀 상담원 (TAX_OPERATOR)

**핵심 흐름** (매뉴얼: [`04-tax-operator.md`](../manuals/04-tax-operator.md)) — 착지: `/operator/my-work`
1. 큐에서 케이스 선택 → 11-state 워크플로우를 순서대로 진행:
   `review → request-approval → (팀장 승인 대기) → generate-ebilling → notify-customer → (고객 납부 증빙 대기) → verify-payment → submit-djp → upload-bpe → complete`
2. eBilling 코드/BPE 번호 수기 입력 (Coretax API 토글이 꺼져 있으면 수동 모드가 기본)
3. 메신저 inbox (⑤번 메뉴): 고객 메시지 확인 → AI draft 보라색 pill [수락] → 답장. 상단 amber 패널의 SPT Masa 검토 대기 카드에서 바로 생성
4. 고객 (계정 1·2) 과 교차: 고객이 납부 증빙을 올리면 `PAYMENT_UPLOADED` 로 바뀌는지

**차단 확인**: `approve`/`reject`/`reassign` 버튼이 **없어야 함** (팀장 전용). `/consultant-erp/supervisor/*`, `/admin/master/*` 403.

**⚠️ 2FA 강제 정책**: master가 `/operator/settings`의 "운영팀 2FA" 토글을 켜면 운영팀 계정(7·8·9)은 TOTP 미등록 시 `/settings?mfa=required`로 튕깁니다. **켠 상태로는 운영팀 계정 브라우저 e2e가 실패**하니 테스트 전에 토글 상태를 확인하세요 (기본 off).

**자동 회귀**: `operator-queue-workflow.spec.ts` (e2e) / `scripts/test-operator-queue-flow.ts` (11-state 전이 전체).

---

### 3-8. supervisor.test@aipajak.com — 운영팀 팀장 (TAX_OPERATOR_SUPERVISOR)

**핵심 흐름** (매뉴얼: [`04-tax-operator.md`](../manuals/04-tax-operator.md)) — 착지: `/operator/dashboard`
1. 운영 큐에서 `PENDING_APPROVAL` 케이스 → **approve / reject** (반려 사유 입력) → reassign
2. **Supervisor ERP 9메뉴** (`/consultant-erp/supervisor/*`): approval(케이스 상세 + 6개월 트렌드) · team · customers · revisions · legality · calendar · coretax · quality · settings
3. 케이스 상세에서 invoice 라인 검토: ✓ 토글, 노트, "전체 ✓ / 전체 해제"
4. settings 저장 → 새로고침 후 유지되는지 (`tax_partner.settings` JSONB round-trip)
5. team 재배정 → 대상 세션의 담당 컨설턴트가 실제로 바뀌는지

**차단 확인**: 같은 supervisor 메뉴를 컨설턴트 계정(3-3)으로 열면 403.

**자동 회귀**: `supervisor-erp.spec.ts` 54 cases (e2e) / smoke의 supervisor P1 + settings round-trip + trend 단계.

---

### 3-9. master.test@aipajak.com — 두 MASTER 겸직 (TAX_OPERATOR_MASTER + PLATFORM_MASTER)

**착지: `/admin/master`** (매뉴얼: [`08-platform-master.md`](../manuals/08-platform-master.md))

**신고운영 (TAX_OPERATOR_MASTER 소관)**:
1. `/operator/settings` §3 — Coretax API 토글 on/off (DB `system_setting` round-trip, 60초 캐시)
2. `/operator/settings` — "운영팀 2FA" 토글 (운영팀 2FA 강제 정책, 계정 7·8·9에 적용. 테스트 후 반드시 원상복구)
3. Tax Code Rule 인라인 편집 → 저장 → §5 audit timeline 에 diff 기록 확인
4. PPN luxury 분류 관리

**사업운영 (PLATFORM_MASTER 소관)**:
4. `/admin/master` — MRR·플랜 분포·Pro 한도 초과 고객 통계
5. `/admin/master/custom-pricing` — 맞춤 견적 발행 → 고객 수락 흐름 (계정 1·2로 교차)
6. ERP 테넌트 관리 — EXTERNAL 법인 목록, 중지/재개

**차단 확인**: 두 MASTER 모두 **고객 세무 데이터 원장에는 직접 접근 불가**여야 함. 신고운영 메뉴(Coretax 등)와 사업운영 메뉴(요금 등)가 서로 소관이 분리되어 있는지 (일반 운영 계정 7로 열면 403).

**자동 회귀**: `scripts/test-tax-code-rule.ts` (18 asserts), `test-coretax-toggle.ts`, `test-operator-mfa-toggle.ts` (6 asserts), `test-master-tenants.ts` (8 asserts), `test-custom-pricing-flow.ts`.

---

### 3-10. admin.test@aipajak.com — 플랫폼 기술 관리자 (PLATFORM_ADMIN)

**이 계정의 핵심 테스트는 "세무 데이터가 안 보이는 것"입니다** (Hard Rule #1, 매뉴얼: [`06-platform-admin.md`](../manuals/06-platform-admin.md)).
1. `/admin/monitoring` — 에러 통계, circuit breaker, 메모리, 활동 로그가 뜨는지
2. 고객 세무 화면 (`/tax/*`, `/customers/*`) 진입 시도 → 차단
3. 세무 데이터 API 를 직접 호출해도 `blockPlatformAdmin` 미들웨어가 403 을 주는지

**자동 회귀**: `platform-admin.spec.ts`, `security-rls.spec.ts` (e2e) / `scripts/test-monitoring-flow.ts`.

---

## 4. 교차 시나리오 (계정 2개 이상)

| 시나리오 | 계정 조합 | 확인 포인트 |
|---|---|---|
| 신고 골든패스 | 2 (법인) → 7 (상담원) → 8 (팀장) | 고객 제출 → 큐 진입 → 승인 → eBilling → 고객 납부 증빙 → DJP → BPE → 완료 |
| AI 상담 왕복 | 1 (개인) ↔ 7 (상담원) | 고객 FAB 메시지 → operator inbox 도착 → AI draft 수락 → 답장이 고객 화면에 표시 |
| 테넌트 격리 | 3 (JTC) ↔ 5 (EXTERNAL) | 서로의 고객이 절대 교차 노출되지 않음 |
| 법인 관리자 초대 | 6 (FIRM_ADMIN) → 신규 직원 | 초대 → 수락 → 신규 계정이 자기 법인 고객만 접근 |
| 맞춤 견적 | 9 (master) → 2 (법인) | 견적 발행 → 고객 화면에서 수락 → 청구 반영 |

---

## 5. 자동 회귀 한 방 명령

수동 테스트 전후로 아래를 돌리면 서버 계약 회귀를 즉시 잡습니다.

```bash
npm run test:smoke:prod        # ~41 steps 통합 회귀 (prod) — 가장 먼저 실행
npm run test:e2e               # Playwright 전체 (로컬 dev 서버 + Supabase 필요)

# 특정 spec 만 prod 에 (계정 시드 완료 상태 가정)
E2E_SKIP_GLOBAL_SETUP=1 BASE_URL=https://ai-pajak.vercel.app npx playwright test firm-admin.spec.ts
```

개별 검증 스크립트 전체 목록은 [`CLAUDE.md`](../../CLAUDE.md) "Verification / regression scripts" 섹션 참조.
