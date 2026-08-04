# 마이그레이션 계획: JTC consultant → operator (CONSULTANT/TAX_ADVISOR = EXTERNAL 전용)

작성: 2026-07-24 · 상태: **완료 (2026-08-04 e2e 재편 + 잔재 정리로 종결)** · 근거: `docs/guides/product-identity.md` 결정 ①

> **후속 완료 (2026-08-04):**
> - e2e 재편: `global-setup.ts` 가 'PT Mitra Pajak E2E' EXTERNAL 파트너를 find-or-create 해 consultant/advisor 계정·POA 를 그 소속으로 생성 — `forbid_jtc_consultant` 트리거와 충돌 해소. `fixtures/users.ts` 에 `e2ePartnerId` 반영.
> - Phase 2 잔재 정리: 은퇴 JTC consultant 를 가리키던 active `customer_consultant` 15행(Tommy Lee 13/CR Lee 2) 비활성화 (`scripts/retire-jtc-customer-consultant.ts`, operator 백필 확인 후 --apply).
> - 미배정 고객 큐(`/api/operator/unassigned-customers`)가 `operator_client_assignments` 도 배정으로 인정하도록 수정 — JTC operator 모델 정합.

> **실행 요약 (2026-07-24, 커밋 3547a6a→3f70d38):**
> - Phase 1-3: 데이터 이관 완료. active JTC consultant **0**. CR Lee/Tommy Lee→operator, advisor.test→supervisor, consultant.test→무력화.
>   - ⚠️ consultant.test **auth 완전삭제는 불가** — `audit_log.actor_user_id` 513행이 참조. "감사 보존" 원칙상 **무력화(role 비활성+consultant row 삭제→requireAuth 401, 접근 0)** 로 종결. deleteUser 는 의도적으로 미실행.
> - Phase 4: `forbid_jtc_consultant` 트리거 적용+검증.
> - Phase 5: smoke 19건 재편 + **app 버그 1건 수정**(operator SPT Masa create 가 active JTC consultant 강제→500; consultant_id=null 허용으로 수정). seed-test-users JTC 생성 제거. docs 반영.
> - Phase 6: 전체 smoke GREEN (RLS 격리·external 격리·auto-assign 무변경 확인).
> - **미완**: e2e(`global-setup.ts`/`fixtures/users.ts`)가 JTC consultant 를 생성 → 트리거 충돌. CI 데일리 미포함이라 후속 재편 대상(EXTERNAL 파트너 시딩 추가 필요).

## 0. 목표와 원칙

**목표 상태:** `CONSULTANT`/`TAX_ADVISOR` role 과 `consultant` 테이블은 **외부 세무법인(EXTERNAL tenant) 전용**. JTC 신고 실무는 전부 `TAX_OPERATOR` 계열로 수행.

**핵심 원칙 — "물리적 재배선" 대신 "정의 우선 + 은퇴(retire)":**
조사 결과 두 가지가 이 방향을 강제한다.
1. **RLS linchpin `get_consultant_tax_partner_id()`** (13개 마이그레이션 의존)은 `consultant WHERE user_id=auth.uid() AND is_active` 만 읽는다. JTC 유저의 consultant row 를 **비활성(is_active=false)** 으로 만들면 → 이 함수가 NULL 반환 → 그 유저는 ERP 스코프에서 자동 탈락한다. **정책·미들웨어를 대거 뜯을 필요 없이** JTC 유저가 ERP 에서 빠진다.
2. **과거 신고 이력 재배선 불필요** — 실측상 `tax_filing/tax_calculation/tax_monthly_payment/faktur_pajak/consultation_message/counterparty_master` 의 JTC consultant 참조가 **전부 0건**. 즉 consultant_session·customer_consultant 만 다루면 되고, `consultant_id` FK 를 operator 로 재작성하는 스키마 변경은 **하지 않는다**(무결성·감사 보존).

→ 전략: JTC consultant row 는 **삭제하지 않고 is_active=false 로 은퇴**(FK 무결성 유지), JTC 유저는 `TAX_OPERATOR` 로 재배치, 진행 데이터(고객 배정 16 / 세션 5)만 이관, role 회수. EXTERNAL consultant 는 그대로 active → RLS linchpin 무변경.

## 1. 대상 인벤토리 (2026-07-24 실측)

| 항목 | 수량 | 처리 |
|---|---|---|
| JTC 소속 consultant | 4명 | operator 재배치 + row 은퇴 |
| ↳ 겸직 특수 케이스 | 1명 (CR Lee `dee525ef` = TAX_ADVISOR+CUSTOMER, 이미 tax_operators "Bob Johnson"/EMP-ADV-SUP) | 아래 §5 특수처리 |
| active `customer_consultant` (JTC) | 16건 | `operator_client_assignments` 백필 |
| open `consultant_session` (JTC, non-COMPLETED) | 5건 | 완결 또는 운영팀 이관 |
| 과거 신고이력 consultant_id 참조 | **0건** | 재배선 안 함 (보존) |
| 테스트 계정 | consultant.test/advisor.test @jakartatax.co.id | §6 재편 |

JTC consultant 4명: CR Lee(`6fdaa5c4`), Test Consultant(`e9d88904`), Test Tax Advisor(`32c80ecd`), Tommy Lee(`8b628a15`).

## 2. Phase 단계 (각 Phase 는 독립 배포 + 롤백 가능)

### Phase 0 — 사전 준비 (스냅샷 + 대상 확정)
- 백업 스냅샷: `consultant`, `customer_consultant`, `consultant_session`, `user_roles`, `operator_client_assignments`, `tax_operators` 의 대상 row 를 JSON 으로 덤프(스크립트).
- 대상 확정 스크립트 `scripts/plan-jtc-consultant-migration.ts` (dry-run): 위 인벤토리를 실시간 재계산해 계획과 실제 일치 확인.
- **롤백:** 없음(읽기 전용).

### Phase 1 — operator 신규 배치
- JTC consultant 4명을 `tax_operators` 에 매핑(1명 이미 존재 → 스킵/검증). `full_name→name`, `email/employee_id/user_id/phone` 복사, `role='tax_operator'`(또는 TAX_ADVISOR 였던 자는 승격 검토), `max_clients` 기본.
- `user_roles` 에 `TAX_OPERATOR` 부여(is_active=true). CONSULTANT/TAX_ADVISOR 는 **아직 유지**(다음 Phase 에서 회수).
- **롤백:** 신규 tax_operators row + TAX_OPERATOR user_roles 삭제.

### Phase 2 — 진행 데이터 이관
- **고객 배정(16):** 각 active `customer_consultant`(JTC) 를 대응 operator 의 `operator_client_assignments` 로 백필(자동배정 엔진 `assignCustomerToOperator` 재사용하되 sticky=해당 operator 강제, 또는 1:1 명시 매핑). 원 `customer_consultant.is_active=false` 로 비활성.
- **세션(5):** open `consultant_session` — 데모/테스트 세션이면 완결(COMPLETED) 또는 삭제, 실 업무면 운영팀 큐로 이관 판단. (5건 개별 검토 — 대부분 데모로 추정)
- **롤백:** operator_client_assignments 신규 row 삭제 + customer_consultant is_active 복원.

### Phase 3 — role 회수 + consultant row 은퇴
- JTC 유저의 `user_roles` CONSULTANT/TAX_ADVISOR → is_active=false.
- JTC `consultant` row → is_active=false (**삭제 금지** — FK/감사 보존, RLS linchpin 이 자동 탈락시킴).
- **롤백:** is_active 복원 → 즉시 원상 복구(이 Phase 가 가장 되돌리기 쉬움).

### Phase 4 — 불변식 강제 (신규 유입 차단)
- signup(`auth/signup`)·invitation(`accept-invitation`)·seed 에서 **JTC(tax_partner=default) 대상이면 consultant 생성 금지 → operator 경로로** 강제.
- (선택) `consultant` INSERT 트리거/CHECK: `tax_partner_id` 가 default_filing_partner 면 거부. 또는 애플리케이션 레벨 가드.
- `get_consultant_tax_partner_id()` 는 **변경 불필요**(EXTERNAL 만 active 로 남아 자연히 EXTERNAL 스코프).
- **롤백:** 가드 제거.

### Phase 5 — 테스트 계정 + smoke 재편 (§6)
### Phase 6 — 검증 (§7)

## 3. 하지 않는 것 (범위 명시)
- `consultant_id` FK 를 operator 로 재작성하는 스키마 변경 ❌ (과거 이력 0건, 무결성 보존).
- `consultant` row 삭제 ❌ (은퇴만).
- `get_consultant_tax_partner_id()` / 13개 RLS 정책 재작성 ❌ (linchpin 이 is_active 로 자동 처리).
- ERP 미들웨어(`requireConsultantOrSupervisor` 등) 로직 변경 ❌ (JTC 유저가 consultant active row 없어 자연 탈락). 단 §7 에서 실제 차단 검증 필수.

## 4. 리스크 & 완화
- **RLS 스코프 상실**: JTC 유저가 consultant active 를 잃으면 ERP 데이터 스코프 NULL — 의도된 결과지만, 그 유저가 만든 EXTERNAL 데이터가 없는지 Phase 0 에서 확인(JTC 는 EXTERNAL 데이터 없어야 정상).
- **겸직 계정(CR Lee)**: TAX_ADVISOR+CUSTOMER+operator 3중. CUSTOMER role 은 건드리지 않음(개인 고객 기능 유지). TAX_ADVISOR 만 회수, 이미 있는 operator(Bob Johnson) 와 동일 user_id 인지 확인 후 중복 정리.
- **진행 세션 5건**: 실 업무 세션이면 이관 중 상태 꼬임 — Phase 2 에서 건별 검토, 가능하면 완결 후 이관.
- **테스트 스위트 붕괴**: consultant.test/advisor.test 로그인하는 smoke/e2e 다수 → §5 에서 EXTERNAL 로 이전하거나 external.consultant 로 대체.

## 5. 겸직/특수 케이스
- **CR Lee (`dee525ef`)**: user_roles = CUSTOMER + TAX_ADVISOR, tax_operators = "Bob Johnson"(EMP-ADV-SUP, supervisor). → TAX_ADVISOR 회수, CUSTOMER 유지, operator(supervisor) 유지. consultant row 은퇴. 이름 불일치(CR Lee vs Bob Johnson)는 테스트 데이터 아티팩트 — 실 운영 전 정합.

## 6. 테스트 계정 & smoke 재편
- `consultant.test@jakartatax.co.id`(CONSULTANT), `advisor.test@jakartatax.co.id`(TAX_ADVISOR) 는 현재 seed-test-users 가 JTC consultant 로 생성 → **딜레마**: 목표상 JTC consultant 는 없어야 함.
  - 옵션 A: 두 계정을 **EXTERNAL(mitrapajak) 로 이전** → ERP staff 테스트 유지.
  - 옵션 B: 두 계정 폐기, ERP 테스트는 `external.consultant@mitrapajak.com` 단독 사용, JTC 테스트는 operator 계정으로.
- 영향 스크립트/스펙: `seed-test-users.ts`(consultant/tax_advisor/customer_consultant 생성), `seed-tax-data.ts`, `consultant.spec.ts`, `consultant-erp.spec.ts`, `tax-advisor.spec.ts`, `test-consultant-erp-flow.ts`, smoke 의 consultant.test 사용처(id-billing/approval-remodel 등). → 전부 EXTERNAL 계정 기준으로 재작성.
- `docs/guides/test-accounts.md` #3/#4 갱신, `docs/manuals/05-jtc-consultant.md` 재작성(JTC 상담원 = operator).

## 7. 검증 체크리스트 (Phase 6)
- [ ] JTC 유저 로그인 → operator 화면(`/operator/*`), ERP(`/consultant-erp/*`) 접근 시 redirect/403.
- [ ] JTC 유저의 `get_consultant_tax_partner_id()` = NULL (ERP RLS 스코프 없음).
- [ ] 이관된 고객 16건이 operator 배정으로 유지, 담당자 조회 정상.
- [ ] 과거 신고 이력(있다면) 조회 정상 — consultant_id FK 보존 확인.
- [ ] EXTERNAL consultant(mitrapajak) ERP 정상 동작(격리 무변경) — `verify-rls-isolation.ts` PASS.
- [ ] 신규 JTC 대상 signup 시 consultant 생성 안 됨(operator 경로).
- [ ] 전체 smoke(재편 후) + 관련 e2e GREEN.

## 8. 실행 순서 요약
Phase 0(스냅샷/dry-run) → 1(operator 배치) → 2(데이터 이관) → 3(role 회수+은퇴) → 4(불변식) → 5(테스트 재편) → 6(검증). 각 Phase 배포 후 smoke 확인, 문제 시 해당 Phase 롤백. **가장 위험한 건 Phase 2(데이터 이관)와 Phase 5(테스트 붕괴)** — 여기에 시간 집중.
