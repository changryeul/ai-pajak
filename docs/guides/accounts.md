# 계정 · 역할 지도 (실제 프로덕션 관점)

> **이 문서의 목적**: "어떤 계정이 어떤 역할을 가지고, 지금 프로덕션에 몇 명 있는지" 를 사람 관점에서 정리.
> 이론·설계·로드맵은 [`roles.md`](./roles.md), 각 역할별 사용 방법은 [`../manuals/`](../manuals/).
>
> 실사일: **2026-07-05** (report-accounts.ts 실행)
> 갱신 주기: 계정 구조 크게 바뀔 때. `SEED_TARGET=prod npx tsx scripts/report-accounts.ts` 재실행 후 갱신.

---

## 0. 한 화면 요약

```
                    Platform (AI Pajak)
                          │
   ┌──────────────────────┼──────────────────────────────┐
   ▼                      ▼                              ▼
 JTC 하나                 EXTERNAL 3개                    (기타 tenant 없음)
 = default 대행자         = 세무 컨설팅 법인               
 │                        │
 ├─ 컨설턴트 4명           ├─ PT Mitra Pajak Sentosa      (실 seed)
 ├─ 담당 고객 16명         ├─ PT Mitra Pajak Demo         (demo, 확인 필요)
 └─ 운영팀 22명            └─ PT Repro Firm               (스모크 잔재 의심)
                          └─ 각 사무소별 자체 컨설턴트 1~3명

 관리자 (세무 X): 1명
 시스템 (웹훅): 0 (활성 role row 없음)
```

**한 문장 요약**: 실 서비스는 JTC 하나가 default 대행자로 굴러가고, 외부 세무사무소 3개 tenant 는 seed 이거나 방치 상태. Tommy Lee 가 실 컨설턴트 워크로드의 대부분을 맡고 있음.

---

## 1. 조직 (tax_partner) — 4개

| Type | 이름 | 상태 | 특징 |
|---|---|---|---|
| **JTC** | Jakarta Tax Consulting | ✅ 유일 default 대행자 | `is_default_filing_partner=true`. 개인·일반법인 고객 신고 담당. |
| **EXTERNAL** | PT Mitra Pajak Sentosa | ✅ 초기 seed | 격리 검증용. Eddy External Consultant 소속. |
| **EXTERNAL** | PT Mitra Pajak Demo | ⚠ 확인 필요 | Sarah Kim 이 3명 고객 담당. seed 인지 실 데이터인지 확인 필요. |
| **EXTERNAL** | PT Repro Firm | ⚠ 스모크 잔재 의심 | Firm Rep (repro.firm.*@example.com) 하나만. load=0. |

**JTC 이외의 EXTERNAL 은 self-service tenant**로 세무 신고를 자체 처리합니다. JTC 운영팀 큐에 안 올라감.

---

## 2. 컨설턴트 (consultant) — 7명, 모두 활성

### 2.1. JTC 내부 (4명)

| 이름 | 이메일 | Role | 담당 고객 수 | 성격 |
|---|---|---|---|---|
| **Tommy Lee** | iamtommylee66@gmail.com | TAX_ADVISOR | **13** | ⭐ 실 컨설턴트 (오늘 대량 배정) |
| **CR Lee** (사용자님) | crlee123@gmail.com | TAX_ADVISOR + CUSTOMER | 2 | 👤 소유주 겸 세무사. 개인 customer 로도 등록됨 |
| Test Consultant | consultant.test@jakartatax.co.id | CONSULTANT | 1 | 🧪 테스트 계정 |
| Test Tax Advisor | advisor.test@jakartatax.co.id | TAX_ADVISOR | 0 | 🧪 테스트 계정 |

### 2.2. EXTERNAL (3명 — 각 세무 컨설팅 법인 소속)

| 이름 | 이메일 | Role | 소속 tenant | 담당 고객 수 |
|---|---|---|---|---|
| Sarah Kim (Demo) | demo.consultant@mitrapajak.com | CONSULTANT | PT Mitra Pajak **Demo** | 3 |
| Eddy External Consultant | external.consultant@mitrapajak.com | CONSULTANT | PT Mitra Pajak **Sentosa** | 1 |
| Firm Rep | repro.firm.*@example.com | TAX_ADVISOR | PT **Repro Firm** | 0 |

> 📌 **네이밍**: 위 3명은 role 이 `CONSULTANT` / `TAX_ADVISOR` 이지만 **모두 EXTERNAL tenant 소속**. 소속은 `consultant.tax_partner_id` 로만 결정. (`_JTC` 접미사는 P3 로 2026-07-05 제거됨.)

---

## 3. 고객 (customer) — 20명 (개인 8 · 법인 12)

### 3.1. Tommy Lee 담당 (13명, 오늘 배정)

**개인 (4)**: SUNG LIM CHEMICAL · Budi Santoso · EMILIANA LILIS PRASETYO RINI · 이창열 · 이창렬

**법인 (9)**: BLUE ZEN GROUP · PT Maju Bersama · PT Sehat Sentosa · PT Konstruksi Jaya · PT ABC · PT Hijau Lumut · PT Baru Masuk · PT. Mono Flip Global

### 3.2. 그 외 실 고객 (6명)

| 유형 | 이름 | 이메일 | 담당 |
|---|---|---|---|
| 개인 | Test User (CR Lee 본인) | crlee123@gmail.com | 본인 겸 소유주 |
| 개인 | Test Customer | customer.test@example.com | 🧪 테스트 |
| 법인 | PT Example Indonesia | company.test@example.com | 🧪 테스트 |
| — | Sarah Kim 담당 3명 | (EXTERNAL Demo 소속) | Sarah Kim |
| — | Eddy 담당 1명 | (EXTERNAL Sentosa 소속) | Eddy |

### 3.3. Dangling CUSTOMER role (~11건)

user_roles.role='CUSTOMER' 이지만 customer 테이블에 매칭 없음. 오늘 스모크 잔재 정리 (`delete-smoke-orphans.ts`) 로 customer 는 삭제됐지만 auth.users + user_roles 는 남은 잔재. **무해** (로그인해도 대시보드 열림 안 함).

---

## 4. 운영팀 — 22명 (JTC only)

| Role | 카운트 | 대표 계정 |
|---|---|---|
| **TAX_OPERATOR** | 16 | operator.test@aipajak.com |
| **TAX_OPERATOR_SUPERVISOR** | 5 | supervisor.test@aipajak.com |
| **TAX_OPERATOR_MASTER** | 1 | master.test@aipajak.com |
| ~~TAX_OPERATOR_LEAD~~ | 0 | deprecated, 신규 부여 없음 |

**⚠ 주의**: 운영팀 22명 중 상당수는 seed 또는 데모 계정으로 추정. 실 사람 카운트는 이보다 훨씬 적을 것.

**consultant 테이블에 나오지 않음** — 운영팀은 tax_partner 소속이 아니라 **플랫폼 소속** 이기 때문에 `consultant` 행 없이 `user_roles` 로만 관리.

---

## 5. 관리자 · 시스템

| Role | 카운트 | 계정 | 특징 |
|---|---|---|---|
| **PLATFORM_ADMIN** | 1 | admin.test@aipajak.com | **세무 데이터 접근 불가** (미들웨어 + RLS 이중 차단) |
| **SYSTEM** | 0 활성 rows | (없음) | Midtrans 웹훅 등이 SUPABASE_SERVICE_ROLE_KEY 로 직접 |

---

## 6. 헷갈리기 쉬운 8가지 지점

1. **CR Lee (crlee123@gmail.com) 가 CUSTOMER + TAX_ADVISOR 둘 다** — 소유주 겸 세무사 상태. 의도된 것.
2. **CONSULTANT 는 JTC 소속만 뜻하지 않음** — Sarah Kim, Eddy 도 같은 role. 소속은 tax_partner_id.
3. **TAX_ADVISOR 는 자격증 소지자** — 최종 제출 권한. JTC 내부 3명 (Tommy, CR, Test) + EXTERNAL 1명 (Firm Rep) = 4명.
4. **CUSTOMER role 카운트 (31) ≠ 실 고객 수 (20)** — 차이 11 은 스모크 잔재 dangling.
5. **운영팀 22명 = 실 사람 22명 아님** — seed 다수.
6. **EXTERNAL tenant 3개 중 신뢰 가능한 건 Sentosa 하나** — Demo, Repro Firm 은 확인 필요.
7. **PLATFORM_ADMIN 은 admin 이지만 세무 데이터 불가** — 이름이 오해 유발. 진짜 최고 권한은 TAX_OPERATOR_MASTER.
8. **SYSTEM role 활성 rows 0 임에도 웹훅은 작동** — Midtrans webhook 은 role 안 거치고 SERVICE_ROLE_KEY 로 직접 DB 조작.

---

## 7. 테스트 계정 (변경 없음, 참조용)

| 시나리오 | 이메일 | 비밀번호 |
|---|---|---|
| 개인 고객 UX | customer.test@example.com | TestPassword123! |
| 법인 고객 UX | company.test@example.com | TestPassword123! |
| JTC 내부 컨설턴트 | consultant.test@jakartatax.co.id | TestPassword123! |
| JTC 내부 시니어 | advisor.test@jakartatax.co.id | TestPassword123! |
| 세무 컨설팅 법인 소속 | external.consultant@mitrapajak.com | TestPassword123! |
| 운영팀 큐 | operator.test@aipajak.com | TestPassword123! |
| 승인 흐름 | supervisor.test@aipajak.com | TestPassword123! |
| 최고 권한 | master.test@aipajak.com | TestPassword123! |
| 관리자 (세무 X) | admin.test@aipajak.com | TestPassword123! |

---

## 8. 실 사용자 계정 (테스트 아닌 것)

| 이메일 | 역할 | 비고 |
|---|---|---|
| crlee123@gmail.com | 소유주 · TAX_ADVISOR · CUSTOMER | 사용자님 본인 |
| iamtommylee66@gmail.com | TAX_ADVISOR | Tommy Lee, 실 컨설턴트 (13 고객 담당) |
| iamtommylee@hotmail.com | CUSTOMER (COMPANY, PT. Mono Flip Global) | Tommy Lee 의 법인 고객으로 등록? 확인 필요 |
| lcr123@nate.com | CUSTOMER (INDIVIDUAL, 이창렬) | |
| lcr321@naver.com | CUSTOMER (INDIVIDUAL, 이창열) | |
| hopeemiliana@gmail.com | CUSTOMER (INDIVIDUAL, EMILIANA LILIS PRASETYO RINI) | |
| moniquewijs8@gmail.com | CUSTOMER (INDIVIDUAL, SUNG LIM CHEMICAL) | |
| bluzengroupindonesia@gmail.com | CUSTOMER (COMPANY, BLUE ZEN GROUP) | |
| demo.consultant@mitrapajak.com | CONSULTANT (EXTERNAL Demo) | Sarah Kim |
| external.consultant@mitrapajak.com | CONSULTANT (EXTERNAL Sentosa) | Eddy |

---

## 9. 정리 스크립트

```bash
# 계정·역할 실사 다시 뽑기
SEED_TARGET=prod npx tsx scripts/report-accounts.ts

# 미배정 큐 상태 확인
SEED_TARGET=prod npx tsx scripts/verify-p1-live.ts

# 새 미배정 고객 배정 (dry-run)
SEED_TARGET=prod npx tsx scripts/assign-unassigned-customers.ts

# 스모크 잔재 후보 조사
SEED_TARGET=prod npx tsx scripts/inspect-smoke-orphans.ts
```

---

## 10. 다음에 정리할 만한 것

- [ ] PT Mitra Pajak Demo · PT Repro Firm 이 seed 인지 실인지 판정 → 실이면 로드맵 편입, seed 면 정리
- [ ] Dangling CUSTOMER role 11건 (user_roles 정리)
- [ ] 운영팀 22 계정 중 실 사람 확인 → 데모 정리
- [ ] iamtommylee@hotmail.com (COMPANY 고객) 과 iamtommylee66@gmail.com (JTC 컨설턴트) 의 관계 확인
