# 사용자·역할·조직 정리 (이론·설계)

> AI Pajak 의 조직(Organization) 3종, 역할(Role) 11개, 그리고 각 역할이 실제로 무엇을 볼 수 있고 못 보는지 한눈에.
>
> 원본 정의: `src/types/auth.ts` (`UserRole`, `OrganizationType`), `CLAUDE.md` §RBAC & Auth.
> **실제 프로덕션 계정 실사**는 [`accounts.md`](./accounts.md) 참고.
> 상세 역할별 사용 매뉴얼: `docs/manuals/`.
> 이 문서는 **P6 (2026-07-07 모노플립/JTC 분리)** 반영 버전입니다. P0~P5 완료 후 상위 계층을 재편.

---

## 0. 큰 그림 — 세 주체

```
                                MonoFlip (플랫폼 운영사)
                                        │
                            ┌───────────┴────────────┐
                            ▼                        ▼
                        Platform 관리                Platform 서비스 제공
                        (요금, 상품,                    │
                         계약, 통계)               ┌────┴─────────────────┐
                                                    ▼                      ▼
                                            JTC (대행 실무)         세무컨설팅 법인 (Self-Service)
                                            = default filing partner   = EXTERNAL tax_partner
                                            │
                                            ▼
                                    개인·일반법인 고객의 세무신고 대행
                                    (Coretax 접속 + 자격증 필요)
```

### 세 주체 분리 원칙 (P6 핵심)

1. **MonoFlip = 플랫폼 운영사** — AI Pajak 시스템 소유. 요금·상품·계약·플랫폼 통계 관리. **세무신고 실무 자격 없음**. Coretax 절대 접속 안 함.
2. **JTC = 세무신고 대행 실무 주체** — 개인·일반법인 고객을 대신 신고. Coretax 접속, ID Billing 발행, NTPN 확인, BPE 업로드. **세무사 자격증 보유**.
3. **세무컨설팅 법인 (EXTERNAL)** — AI Pajak 을 도구로 사용해 자기 회사 직원 + 자기 클라이언트를 self-service 로 처리. JTC 개입 없음.

**AI Pajak 은 "Assisted DIY Filing"** 모델: 고객이 자료 입력·업로드는 직접, JTC 상담원이 검토·부족자료 보완·Coretax 처리·신고 완료 수행.

---

## 1. 조직 (Organization) — 3종

| 조직 타입 | 무엇? | 대표 계정 |
|---|---|---|
| **PLATFORM_OWNER** | 플랫폼 최상위 소유주 = **MonoFlip** | Winway 대표 |
| **PLATFORM** | 플랫폼 운영 조직 (MonoFlip 사업/기술) | MonoFlip 운영팀 |
| **TAX_PARTNER** | 세무 사무소 (2 종 병존) | ① **JTC** (default filing partner) ② **EXTERNAL** (세무컨설팅 법인) |

### `tax_partner` 두 종류
- **JTC** — `partner_type='JTC'`, `is_default_filing_partner=true` (P6.3 rename, 기존 이름은 `is_platform_partner`). **한 행만** 존재. 개인·일반법인 고객의 default 대행자.
- **EXTERNAL** — `partner_type='EXTERNAL'`. 세무컨설팅 법인 자체 등록으로 생기는 독립 tenant. Self-service.

두 tenant 간 데이터는 RLS (`get_consultant_tax_partner_id()`) 로 완벽 격리.

---

## 2. 역할 (Role) — 11개, 5 그룹

### 그룹 A — 고객 (실제 세금 내는 사람)

| 서브 타입 | customer_type | 자체 tax_partner? | 처리 주체 | 주된 화면 |
|---|---|---|---|---|
| **개인 납세자** | INDIVIDUAL | 없음 | JTC 대행 | 개인 SPT (1770SS/S/1770) wizard |
| **일반 법인 납세자** | COMPANY | 없음 | JTC 대행 | 월신고 + 결산 wizard |
| **세무컨설팅 법인 고객** | COMPANY | ✅ EXTERNAL tax_partner | self-service | 위 + 자기 클라이언트 관리 + 자기 직원 관리 |

### 그룹 B — JTC 신고운영 (신고 실무 주체)

**JTC 소속** 만. 세무컨설팅 법인 (EXTERNAL) 소속 직원도 아래 CONSULTANT / TAX_ADVISOR role 을 쓸 수 있으나, 화면·업무 흐름은 완전히 다름 (self-service).

| Role | 등급 | 주된 역할 |
|---|---|---|
| **CONSULTANT** | JTC 상담원 | 고객 자료 검토, 부족자료 요청, **Coretax 처리**, ID Billing 발행, NTPN 확인, BPE 업로드 |
| **TAX_ADVISOR** | JTC 세무사 (자격증) | 승인 + SPT 최종 제출 (Hard Rule 3) |
| **TAX_OPERATOR_SUPERVISOR** | JTC 수퍼바이저 | 상담원 배정, 승인·반려, 품질 관리, 업무량 관리 |
| **TAX_OPERATOR_MASTER** | JTC 신고운영 최고권한 | 🔒 Coretax API 토글, Tax Code Rule 편집, Luxury Classification 편집 |

### 그룹 C — MonoFlip 플랫폼 운영 (신설/재편)

**세무신고 실무 권한 없음** — Coretax 접속 X, 신고 데이터 조회는 메타데이터 수준만.

| Role | 등급 | 주된 역할 |
|---|---|---|
| **PLATFORM_MASTER** (신규 P6) | MonoFlip 사업운영 최고권한 | 🔝 플랫폼 통계 (MRR), 상품·요금제 관리, 커스텀 가격 발행, EXTERNAL 입점사 관리, 계약 관리 |
| **PLATFORM_ADMIN** | MonoFlip 기술관리자 | 사용자·인프라·모니터링·감사 로그·크론. **고객 세무 데이터 접근 절대 불가** |

### 그룹 D — 세무컨설팅 법인 (EXTERNAL tenant 내부)

| Role | 등급 | 주된 역할 |
|---|---|---|
| **CONSULTANT** | 실무 직원 | 자기 회사 클라이언트/직원 세무 처리 |
| **TAX_ADVISOR** | 세무사 (자격증) | 자기 이름으로 SPT 최종 제출 |
| **FIRM_ADMIN** (신규 P6) | ERP 관리자 | 직원 초대·비활성화, TAX_ADVISOR 임명·해임, 클라이언트 배정, 청구·구독 관리 |

### 그룹 E — 시스템 (사람 아님)

| Role | 주된 역할 | 절대 못 하는 것 |
|---|---|---|
| **SYSTEM** | Midtrans 웹훅 등 billing 자동화 | 세무 데이터 접근 불가, UI 없음 |

### 참고 — deprecated

- **TAX_OPERATOR_LEAD** — 초기 3-tier 설계 잔재. 신규 부여 없음. 로드맵상 완전 폐기 검토.

---

## 3. "이 사람은 뭘 볼 수 있나?" — 요약

```
개인 납세자                     → 자기 SPT 개인 신고 화면
일반 법인 납세자                → 자기 월 신고 + 결산 (JTC 가 실 처리)
세무컨설팅 법인 고객            → 위 + 자기 클라이언트·직원 관리 (self-service)
CONSULTANT (JTC)                → JTC 담당 개인·일반법인 고객 Coretax 처리
CONSULTANT (EXTERNAL)           → 자기 회사 클라이언트·직원                   ← 같은 role, tenant 격리
TAX_ADVISOR (JTC)               → 위와 동일 + SPT 최종 제출
TAX_ADVISOR (EXTERNAL)          → 자기 회사 안 신고 최종 제출
TAX_OPERATOR_SUPERVISOR (JTC)   → 위 + 승인 + 팀장 ERP
TAX_OPERATOR_MASTER (JTC)       → 🔒 Coretax 토글 · Tax Rule · Luxury 편집 (신고 실무 최고권한)
FIRM_ADMIN (EXTERNAL, 신규)     → 자기 회사 직원·클라이언트·청구 관리
PLATFORM_MASTER (MonoFlip, 신규)→ 🔝 플랫폼 사업 운영 (요금·상품·통계·EXTERNAL 입점)
PLATFORM_ADMIN (MonoFlip)       → 시스템 관리 (사용자·인프라·감사), 세무 데이터 0
SYSTEM                          → 웹훅 뒤, UI 없음
```

---

## 4. 헷갈리기 쉬운 8가지 함정 (P6 갱신)

1. **MonoFlip ≠ JTC** — 이전에는 "JTC 가 default 파트너 겸 플랫폼 파트너" 로 표기됐지만 P6 부터 **완전 분리**. MonoFlip 이 플랫폼 owner, JTC 는 대행 실무만.
2. **CONSULTANT 는 JTC 소속만 뜻하지 않음** — 세무컨설팅 법인 (EXTERNAL) 직원도 같은 role. `consultant.tax_partner_id` 로만 구분.
3. **PLATFORM_ADMIN ≠ PLATFORM_MASTER** — Admin 은 기술관리자 (인프라·로그), Master 는 사업운영자 (요금·상품·계약). 두 개 분리.
4. **TAX_OPERATOR_MASTER 는 JTC 신고운영 최고권한만** — 플랫폼 사업 결정 (요금·상품) 은 `PLATFORM_MASTER` 로 이관 (P6).
5. **모노플립 마스터가 신고 실무 통제 못 함** — Coretax 접속 없음. JTC 업무는 진행상태·품질·계약 범위 내에서만 관리.
6. **CUSTOMER 하나에 3가지 얼굴** — INDIVIDUAL / COMPANY(일반) / COMPANY(세무컨설팅 법인).
7. **세무컨설팅 법인은 JTC 를 안 거침** — 자체 세무사가 자기 이름으로 신고. 운영팀 큐 없음.
8. **SYSTEM 은 사람 아님** — Midtrans/DJP 서비스 계정.

---

## 5. 5-hard-rule 재검토 (P6 이후)

| # | Hard rule | 강제 지점 | 관련 role |
|---|---|---|---|
| 1 | PLATFORM_ADMIN cannot access customer tax data | 미들웨어 `blockPlatformAdmin` + RLS | PLATFORM_ADMIN, PLATFORM_MASTER (신규 동일 차단) |
| 2 | Consultant must belong to a registered tax_partner (JTC 또는 EXTERNAL) | FK + `get_consultant_tax_partner_id()` RLS | CONSULTANT, TAX_ADVISOR |
| 3 | Tax Filing Actor ≠ Platform | `requireRole` on 제출 endpoint | TAX_ADVISOR (JTC 또는 EXTERNAL) |
| 4 | Billing Collector ≠ Service Provider | `requireRole(SYSTEM)` on billing ops | SYSTEM |
| 5 | Audit Trail Required | `withAudit` 미들웨어 | 모든 role |

**신설 원칙 (P6)**:
- **6. MonoFlip cannot perform tax filing actions** — Coretax API 호출, tax_filing INSERT 등은 PLATFORM_MASTER/PLATFORM_ADMIN 로 절대 실행 불가. JTC 소속 세무사만.
- **7. FIRM_ADMIN 은 자기 tenant 안에서만 관리 권한** — 다른 EXTERNAL tax_partner 절대 접근 불가 (RLS).

---

## 6. 화면 구조 (사업 관점 7 + 내부 1)

| # | 화면 | 소속 | 담당 role |
|---|---|---|---|
| 1 | 개인 납세자 | 고객 | CUSTOMER · INDIVIDUAL |
| 2 | 법인 납세자 | 고객 | CUSTOMER · COMPANY |
| 3 | JTC 상담원 | JTC | CONSULTANT (JTC) |
| 4 | JTC 수퍼바이저 | JTC | TAX_OPERATOR_SUPERVISOR |
| 5 | 모노플립 마스터 | MonoFlip | PLATFORM_MASTER (ERP 테넌트 관리 메뉴 포함) |
| 6 | ERP 직원 | 세무컨설팅 법인 | CONSULTANT (EXTERNAL) |
| 7 | ERP 관리자 (신규) | 세무컨설팅 법인 | FIRM_ADMIN |
| (내부) 8 | 모노플립 시스템 관리자 | MonoFlip | PLATFORM_ADMIN |

**JTC 신고운영 최고권한** (`TAX_OPERATOR_MASTER`) 은 별도 화면 아니고 JTC 수퍼바이저 화면 내부의 **§Coretax·Tax Rule·Luxury 편집** 메뉴 로 표현. (편의상 supervisor 페이지 확장.)

---

## 7. 테스트 계정 (Prod = staging, P6 이후)

| 시나리오 | 이메일 | Role · Tenant |
|---|---|---|
| 개인 고객 UX | customer.test@example.com | CUSTOMER · INDIVIDUAL |
| 법인 고객 UX | company.test@example.com | CUSTOMER · COMPANY |
| JTC 상담원 | consultant.test@jakartatax.co.id | CONSULTANT · JTC |
| JTC 세무사 | advisor.test@jakartatax.co.id | TAX_ADVISOR · JTC |
| 세무컨설팅 법인 컨설턴트 | external.consultant@mitrapajak.com | CONSULTANT · EXTERNAL |
| 세무컨설팅 법인 관리자 (ERP 관리자) | firmadmin.test@mitrapajak.com | FIRM_ADMIN · EXTERNAL (PT Mitra Pajak Sentosa) |
| JTC 상담 운영자 | operator.test@aipajak.com | TAX_OPERATOR · JTC |
| JTC 수퍼바이저 | supervisor.test@aipajak.com | TAX_OPERATOR_SUPERVISOR · JTC |
| **JTC 신고운영 마스터 + MonoFlip 마스터** (겸직) | master.test@aipajak.com | TAX_OPERATOR_MASTER + PLATFORM_MASTER |
| MonoFlip 시스템 관리자 | admin.test@aipajak.com | PLATFORM_ADMIN |

비밀번호는 모두 `TestPassword123!`.

**신규 시나리오** (P6.2 이후):
- ✅ FIRM_ADMIN 테스트 계정 신설 완료 (P6.5, 2026-07-07) — `firmadmin.test@mitrapajak.com`, `seed-master-and-external.ts` 로 seed (FIRM_ADMIN role + PT Mitra consultant row)

---

## 8. UI 카피 정합 지침 (P6 §Q4 답 반영)

| 지금 표현 | 새 표현 |
|---|---|
| "AI Pajak 운영팀" | **"JTC 신고 상담원"** |
| "AI Pajak 상담원" | **"JTC 소속 신고 상담원"** |
| "TAX_OPERATOR_MASTER" (사이드바/화면 label) | **"JTC 신고운영 마스터"** |
| "PLATFORM_ADMIN" | **"모노플립 시스템 관리자"** |
| "PLATFORM_MASTER" (신규) | **"모노플립 마스터"** |
| "FIRM_ADMIN" (신규) | **"세무컨설팅 법인 관리자"** or "ERP 관리자" |

내부 role 이름 (enum 값) 은 영어 유지 · 화면 label 은 위 표대로 5-로케일 i18n 정합.

---

## 9. 로드맵 (P0~P6 완료)

| Phase | 범위 | 상태 |
|---|---|---|
| **P0** | 도메인 모델 교정 v1 (JTC + EXTERNAL 병존) | ✅ 완료 (2026-07-03) |
| **P1** | 개인/일반법인 가입 → 미배정 큐 진입 + Supervisor 배정 UI | ✅ 완료 (2026-07-03) |
| ~~P2~~ | ~~법인 다중 사용자~~ | 스코프 아웃 |
| **P3** | `_JTC` suffix 제거 (CONSULTANT / TAX_ADVISOR 통일) | ✅ 완료 (2026-07-05) |
| **P4** | `tax_filing.tax_partner_id` + 세무컨설팅 법인 자격증 게이트 | ✅ 완료 (2026-07-03) |
| **P5** | 매뉴얼 정리 v1 | ✅ 완료 (2026-07-03) |
| **P6.0** | **roles.md 목표 모델 재작성 (이 문서)** | ✅ 완료 (2026-07-07) |
| **P6.1** | `PLATFORM_MASTER` role 신설 (마이그 + enum + 미들웨어) | ✅ 완료 (2026-07-07) — 마이그 `20260707000001`, `blockPlatformAdmin` 확장, `/admin/master/stats`+`custom-pricing` PLATFORM_MASTER 허용, master.test 겸직 부여 |
| **P6.2** | `FIRM_ADMIN` role 신설 + ERP 관리자 UI 스캐폴딩 | ✅ 완료 (2026-07-07) — 마이그 `20260707000002`, `requireFirmAdmin` 미들웨어, 3 페이지 뼈대 + 사이드바 + 5-로케일 i18n |
| **P6.3** | `TAX_OPERATOR_MASTER` 좁힘 + `is_platform_partner` → `is_default_filing_partner` rename | ✅ 완료 (2026-07-07) — 마이그 `20260707000003` + 13 파일 grep-replace. TAX_OPERATOR_MASTER 는 문서상 §2 그룹B 로 이미 좁혀서 명시 |
| **P6.4** | 매뉴얼 재작성 (신규 07-firm-admin, 08-platform-master + 기존 4개 정정) | ✅ 완료 (2026-07-07) — `docs/manuals/README.md` 목차 + 01/04/06 정정 + 신규 07/08 신설 |
| **P6.5** | `master.test` 계정 겸직 세팅 + memory/CLAUDE.md 정합 | ✅ 완료 (2026-07-07) — 겸직은 P6.1 때 prod 반영 확인, seed 스크립트 multi-role 지원 + FIRM_ADMIN 테스트 계정 (`firmadmin.test@mitrapajak.com`) prod seed + CLAUDE.md RBAC/계정 표 정합 |

**P6 완료** (2026-07-07): 모노플립/JTC 분리 role 재편 마감. 남은 후속은 firm-admin 화면 실기능 (P6.2 스캐폴딩의 다음 iteration) 뿐.

---

## 10. 착수 시 확정된 답 (2026-07-07)

- **Q1 권한 경계**: 통계·요금·상품·EXTERNAL 입점·커스텀 가격 → PLATFORM_MASTER · Coretax/Tax Rule/Luxury → TAX_OPERATOR_MASTER
- **Q2 FIRM_ADMIN**: 컨설턴트 초대·자격증 임명·고객 배정·청구 관리 모두 가능
- **Q3 master.test**: PLATFORM_MASTER + TAX_OPERATOR_MASTER 겸직
- **Q4 UI 카피**: §8 표 그대로 일괄 치환
- **Q5 컬럼 rename**: `is_default_filing_partner` → `is_default_filing_partner`

---

## 11. 더 파고들 곳

- 이 문서의 사전 정정 문서: [`domain-model-corrections-20260707.md`](./domain-model-corrections-20260707.md)
- 실 계정 인벤토리: [`accounts.md`](./accounts.md)
- 역할별 사용 매뉴얼: `docs/manuals/{01~06}-*.md`
- 미들웨어 stack: `src/middleware/compose.ts`
- RLS 정책: `supabase/migrations/*`
- 세무컨설팅 법인 self-service ERP: `src/app/[locale]/(dashboard)/consultant-erp/`
