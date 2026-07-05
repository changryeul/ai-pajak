# 사용자·역할·조직 정리 (이론·설계)

> AI Pajak 의 조직(Organization) 3종, 역할(Role) 9개, 그리고 각 역할이 실제로 무엇을 볼 수 있고 못 보는지 한눈에.
>
> 원본 정의: `src/types/auth.ts` (`UserRole`, `OrganizationType`), `CLAUDE.md` §RBAC & Auth.
> **실제 프로덕션 계정 실사**는 [`accounts.md`](./accounts.md) 참고.
> 상세 역할별 사용 매뉴얼: `docs/manuals/`.
> 이 문서는 **P0 (2026-07-03 도메인 모델 교정)** 이후 버전입니다.

---

## 0. 큰 그림 — 가입 창구는 하나, 처리 주체는 둘

가입은 모두 **platform (AI Pajak)** 을 거치지만, 세무 신고를 **실제로 처리하는 주체** 는 고객 유형에 따라 갈립니다.

```
                     가입 창구: Platform (AI Pajak)
                                  │
        ┌─────────────────────────┼────────────────────────────────┐
        ▼                         ▼                                ▼
   개인 (INDIVIDUAL)         일반 법인 (COMPANY)         세무컨설팅 법인 (COMPANY 특수)
                                                        = EXTERNAL tax_partner 함께 보유
   → JTC 가 대행             → JTC 가 대행               → 스스로 처리 (self-service)
     (운영팀 큐로)               (운영팀 큐로)              자기 이름으로 신고, JTC 개입 없음
```

이 그림이 아래 모든 결정을 지배합니다.

---

## 1. 조직 (Organization) — 3종

| 조직 타입 | 무엇? | 예시 |
|---|---|---|
| **PLATFORM_OWNER** | 플랫폼 최상위 소유주 | Winway/JTC 대표 계정 |
| **PLATFORM** | 플랫폼 운영 조직 | AI Pajak 운영팀 |
| **TAX_PARTNER** | 세무 사무소 (2 종 병존) | ① **JTC** (내부, default 대행자) ② **EXTERNAL** (세무컨설팅 법인 self-service tenant) |

### `tax_partner` 두 종류
- **JTC** — `partner_type='JTC'`, `is_platform_partner=true`. **한 행만** 존재. 개인·일반법인 고객을 대신 처리하는 default 대행 사무소.
- **EXTERNAL** — `partner_type='EXTERNAL'`. **세무컨설팅 법인이 가입하면 자동 생성** 되는 독립 tenant. 자기 클라이언트·자기 직원의 세무 신고를 self-service 로 처리.

두 tenant 간 데이터는 RLS (`get_consultant_tax_partner_id()`) 로 완벽히 격리. JTC 는 EXTERNAL 데이터 못 보고, EXTERNAL 도 서로 못 봄.

---

## 2. 역할 (Role) — 9개, 4 그룹

### 그룹 A — 고객 (실제 세금 내는 사람)

같은 `CUSTOMER` role 이지만 `customer.customer_type` 값과 함께 **자체 tax_partner 보유 여부** 에 따라 3가지 얼굴로 갈립니다.

| 서브 타입 | customer_type | 자체 tax_partner? | 처리 주체 | 주된 화면 |
|---|---|---|---|---|
| **개인** | INDIVIDUAL | 없음 | JTC 대행 | 개인 SPT (1770SS/S/1770) wizard |
| **일반 법인** | COMPANY | 없음 | JTC 대행 | 월신고 + 결산 wizard |
| **세무컨설팅 법인** | COMPANY | ✅ EXTERNAL tax_partner 보유 | **self-service** | 위 + 자기 클라이언트 관리 + 자기 직원 관리 (`consultant-erp`) |

### 세무컨설팅 법인의 특별함

- **가입 경로**: `/register/firm` 페이지 → `tax_partner (EXTERNAL)` 자동 생성 + 대표 계정을 그 tax_partner 의 대표 consultant 로 등록.
- **관리 대상 (둘 다)**:
  - **(a) 자기 회사 직원의 세무** — 자체 급여 신고 PPh21 등
  - **(b) 자기 클라이언트의 세무 대행** — 자기 회사가 관리하는 다른 회사·개인들의 신고
- **처리 주체**: 위 두 대상 모두 **자체 처리**. JTC 는 개입하지 않음. SPT 는 자기 이름 (세무컨설팅 법인 이름) 으로 제출.
- **자격 요건**: 자기 안에 세무사 자격증 소지자 (`TAX_ADVISOR` role) 최소 1명 필요 (P4 에서 검증 강제 예정).

### 그룹 B — 세무 사무소 직원 (컨설턴트)

두 role 모두 **JTC 뿐 아니라 세무컨설팅 법인 (EXTERNAL) 직원도 함께 사용**합니다. 소속은 `consultant.tax_partner_id` FK 로만 결정.

> 📌 **P3 완료 (2026-07-05)**: 옛 이름 `CONSULTANT_JTC` / `TAX_ADVISOR_JTC` 의 `_JTC` 접미사가 오해를 유발해 아래 이름으로 rename 완료 (마이그 `20260705000001_role_rename_consultant_tax_advisor.sql`).

| Role | 등급 | 주된 역할 |
| --- | --- | --- |
| **CONSULTANT** | 실무 컨설턴트 | 고객 자료 수집·파싱·계산·초안 작성 |
| **TAX_ADVISOR** | 세무사 (자격증 소지자) | 승인 + SPT 최종 제출 |

두 role 모두 JTC 소속 (내부 직원) 이거나 세무컨설팅 법인 (EXTERNAL) 소속 직원일 수 있습니다.

### 그룹 C — 운영팀 (Operator) 4 계급 = **JTC 소속 only**

운영팀 4 role 은 **모두 JTC 소속입니다**. EXTERNAL tenant 에는 운영팀이 없습니다.

**이유**: 신고에는 세무사 자격증이 필요하고, JTC 는 default 대행자이므로 운영팀이 큐를 처리. EXTERNAL 은 자체 처리하므로 운영팀 개념 자체가 불필요.

| Role | 주된 역할 |
|---|---|
| **TAX_OPERATOR** | 큐 실무 — 자료검토 → e빌링 → 납부확인 → DJP 제출 → BPE 업로드 |
| **TAX_OPERATOR_LEAD** | 팀 리더 (현재 UI 사용 낮음) |
| **TAX_OPERATOR_SUPERVISOR** | 승인·반려·재배정 |
| **TAX_OPERATOR_MASTER** | 🔝 플랫폼 통계, 커스텀 가격 발행, Coretax API 토글, Tax Code Rule 편집 |

### 그룹 D — 특수 역할

| Role | 주된 역할 | 절대 못 하는 것 |
|---|---|---|
| **PLATFORM_ADMIN** | 사용자·요금제·모니터링 관리 | **고객 세무 데이터 접근 불가** — 미들웨어 `blockPlatformAdmin` + RLS 두 겹으로 차단 |
| **SYSTEM** | Midtrans 웹훅 등 billing 자동화 | 세무 데이터 접근 불가, UI 없음 |

---

## 3. "이 사람은 뭘 볼 수 있나?" — 3분 요약

```
CUSTOMER (INDIVIDUAL)              → 자기 SPT 개인 신고 화면
CUSTOMER (COMPANY, 일반)          → 자기 월 신고 + 결산 화면 (JTC 가 실 처리)
CUSTOMER (COMPANY, 세무컨설팅)   → 위 + 자기 클라이언트 관리 + 자기 사무소 직원 관리
CONSULTANT (JTC 소속)        → JTC 담당 개인·일반법인 고객
CONSULTANT (EXTERNAL 소속)   → 그 세무컨설팅 법인의 클라이언트·직원  ← 같은 role, 데이터만 격리
TAX_ADVISOR                    → 위와 동일 + SPT 최종 제출 버튼
TAX_OPERATOR                       → JTC 처리 큐만 (EXTERNAL 는 안 나옴)
TAX_OPERATOR_LEAD                  → 위와 동일
TAX_OPERATOR_SUPERVISOR            → 위 + 승인 + 팀장 ERP
TAX_OPERATOR_MASTER                → 위 전부 + 가격/Coretax 토글/Tax Rule 편집
PLATFORM_ADMIN                    → 시스템 대시보드만, 세무 데이터 0
SYSTEM                             → 웹훅 뒤에서만 돎, UI 없음
```

---

## 4. 헷갈리기 쉬운 6가지 함정

1. **"CONSULTANT = JTC 소속" 아님** — 세무컨설팅 법인 (EXTERNAL) 직원도 같은 role. `tax_partner_id` 로만 구분. (P3 로 `_JTC` 접미사 제거 완료, 2026-07-05)
2. **PLATFORM_ADMIN ≠ MASTER** — 관리자 이름이지만 세무 데이터 손도 못 댐. 진짜 최고 권한은 `TAX_OPERATOR_MASTER`.
3. **CUSTOMER 하나에 3가지 얼굴** — INDIVIDUAL / COMPANY(일반) / COMPANY(세무컨설팅). 마지막은 tax_partner 로도 함께 연결됨.
4. **세무컨설팅 법인은 JTC 를 안 거침** — 자체 처리. 운영팀 큐에 안 올라감. 자기 이름으로 신고.
5. **운영팀 = JTC only** — EXTERNAL 에는 운영팀이 없음.
6. **SYSTEM 은 사람 아님** — Midtrans/DJP 서비스 계정. Billing 5-hard-rule 중 "Billing Collector ≠ Service Provider" 를 만족시키기 위해 분리.

---

## 5. 5-hard-rule 재검토 (P0 이후)

| # | Hard rule | 강제 지점 | 관련 role |
|---|---|---|---|
| 1 | PLATFORM_ADMIN cannot access customer tax data | 미들웨어 `blockPlatformAdmin` + RLS | PLATFORM_ADMIN |
| 2 | Consultant must belong to a registered tax_partner (**JTC 또는 EXTERNAL**) | FK + `get_consultant_tax_partner_id()` RLS | CONSULTANT, TAX_ADVISOR |
| 3 | Tax Filing Actor ≠ Platform | `requireRole` on 제출 endpoint | TAX_ADVISOR (JTC 또는 EXTERNAL) |
| 4 | Billing Collector ≠ Service Provider | `requireRole(SYSTEM)` on billing ops | SYSTEM |
| 5 | Audit Trail Required | `withAudit` 미들웨어 | 모든 role |

---

## 6. 테스트 계정 (Prod = staging)

| 시나리오 | 이메일 | Role · Tenant |
|---|---|---|
| 개인 고객 UX | customer.test@example.com | CUSTOMER · INDIVIDUAL |
| 일반 법인 UX | company.test@example.com | CUSTOMER · COMPANY (일반, JTC 대행) |
| JTC 내부 컨설턴트 | consultant.test@jakartatax.co.id | CONSULTANT · JTC |
| JTC 내부 시니어 | advisor.test@jakartatax.co.id | TAX_ADVISOR · JTC |
| **세무컨설팅 법인 소속 컨설턴트** | external.consultant@mitrapajak.com | CONSULTANT · EXTERNAL (PT Mitra Pajak Sentosa) |
| 운영팀 큐 | operator.test@aipajak.com | TAX_OPERATOR · JTC |
| 승인 흐름 | supervisor.test@aipajak.com | TAX_OPERATOR_SUPERVISOR · JTC |
| 최고 권한 | master.test@aipajak.com | TAX_OPERATOR_MASTER · JTC |
| 관리자 (세무 X) | admin.test@aipajak.com | PLATFORM_ADMIN |

비밀번호는 모두 `TestPassword123!`.

Seed 스크립트:
- `npm run db:seed-test-users` — JTC 고객 + 컨설턴트 + 관리자
- `SEED_TARGET=prod npx tsx scripts/seed-master-and-external.ts` — 운영팀 + 세무컨설팅 법인 예시 tax_partner
- `SEED_TARGET=prod npx tsx scripts/seed-company-customer.ts` — company.test 를 일반 법인 COMPANY 로 패치

---

## 7. 남은 작업 (로드맵)

| Phase | 범위 | 상태 |
|---|---|---|
| **P0** | `roles.md` + external-consultant 매뉴얼 재작성 (이 문서) | ✅ 완료 |
| **P1** | 개인/일반법인 가입 → 미배정 큐 진입 + Supervisor 배정 UI | ✅ 완료 (2026-07-03) — `/operator/unassigned-customers`, `GET /api/operator/unassigned-customers`, `POST /api/customers/[id]/assign` 에 SUPERVISOR 허용 |
| ~~P2~~ | ~~법인 다중 사용자 (`company_member`)~~ | **스코프 아웃** |
| **P3** | Role name `_JTC` suffix 제거 (`CONSULTANT` / `TAX_ADVISOR` 로 통일) | ✅ 완료 (2026-07-05) — 마이그 `20260705000001_role_rename_consultant_tax_advisor.sql` + 179 파일 grep-replace + Vercel/Supabase 동시 배포. Drift 0 · P1 회귀 3/3 PASS 검증 |
| **P4** | `tax_filing.tax_partner_id` 컬럼 + 세무컨설팅 법인 자격증 소지자 검증 | ✅ 완료 (2026-07-03) — 마이그 `20260703000001_tax_filing_tax_partner_id.sql` + `/api/tax/file` gate. 마이그 배포는 사용자 push 대기 |
| **P5** | 매뉴얼 최종 정리 | ✅ 완료 (2026-07-03) — `docs/manuals/README.md`, `04-tax-operator.md` (§5.0 미배정 큐), `05-jtc-consultant.md` (naming 노트) 반영 |

**총 예상**: 3.5일.

---

## 8. 더 파고들 곳

- 역할별 사용 매뉴얼: `docs/manuals/{01~06}-*.md`
- 미들웨어 stack 구성: `src/middleware/compose.ts`
- RLS 정책: `supabase/migrations/*` (특히 `20260411000002_tax_partner_external.sql`)
- 세무컨설팅 법인 자체 가입 페이지: `src/app/[locale]/(auth)/register/firm/page.tsx`
- 세무컨설팅 법인 self-service 워크플로우 (ERP): `src/app/[locale]/(dashboard)/consultant-erp/` + `src/lib/consultant-erp/`
- Tenant 격리 회귀: `SEED_TARGET=prod npx tsx scripts/test-external-consultant-isolation.ts`
