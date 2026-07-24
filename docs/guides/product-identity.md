# AI Pajak — 제품 정체성 & 버전 정의

작성: 2026-07-24 · 상태: **확정(정의)**, 코드 정합 일부 후속 마이그레이션 필요

## 1. 핵심 전환: 하나의 앱이 아니라 두 개의 제품

AI Pajak 은 "고객 화면을 만들고 운영팀·ERP 화면을 덧붙인 하나의 앱"이 아니다.
**서로 다른 두 개의 제품**이 하나의 **공통 플랫폼** 위에 올라간 구조다.

```
                 ┌───────────────────────────┐
                 │      공통 플랫폼(Shared)     │
                 │  로그인 · AI 엔진 · 결제     │
                 │  OCR · 세무 규정/계산 엔진   │
                 └───────────────────────────┘
                    ↑                       ↑
        ┌───────────────────┐   ┌───────────────────────┐
        │  Assisted DIY      │   │  세무법인 ERP           │
        │  (일반 납세자)       │   │  (세무법인 업무 시스템)   │
        │  JTC 운영팀이        │   │  운영팀 전혀 개입 안 함   │
        │  품질 보증           │   │  (자기 tenant 내 완결)   │
        └───────────────────┘   └───────────────────────┘
```

- **Assisted DIY**: 일반 개인/법인 납세자가 직접 자료를 올리고, **JTC 운영팀**이 검토·승인·발행으로 품질을 보증한다. (Do-It-Yourself + 전문가 보증)
- **세무법인 ERP**: 외부 세무법인이 자기 고객을 처리하는 업무 시스템. **JTC 운영팀은 전혀 개입하지 않는다.** tenant(`tax_partner` EXTERNAL) RLS 로 JTC 데이터와 완전 격리.
- **공통 플랫폼**: 두 제품이 로그인, AI 엔진, 결제(Midtrans), OCR, 세무 규정/계산 엔진(TER·KAP/KJS·Coretax 작성본 등)을 공유한다. → 발행 보드처럼 도메인 로직은 한 번만 구현하고 제품별로 스코프만 가른다.

## 2. 버전 정의 (확정: "로그인 후 보는 화면" 기준)

> **버전 = 로그인 후 사용자가 보게 되는 화면**. 개인/법인은 SPT vs 월신고로 화면이 실제 크게 달라 별도 버전으로 센다. ERP 는 Admin/Staff 가 화면 90~95% 동일(메뉴만 차등)이라 한 버전으로 센다.

| # | 버전(화면) | 사용자 | 제품 |
|---|---|---|---|
| 1 | 개인 고객 | 개인 납세자 | Assisted DIY |
| 2 | 법인 고객 | 일반 법인 | Assisted DIY |
| 3 | 운영팀 상담원 | JTC | Assisted DIY (운영) |
| 4 | 운영팀 Supervisor | JTC | Assisted DIY (운영) |
| 5 | 운영팀 Master | JTC 신고운영 최상위 | Assisted DIY (운영) |
| 6 | ERP | 세무법인 (Admin/Staff 권한 차등) | 세무법인 ERP |

→ **6 버전.** ERP 내부는 하나의 대시보드에서 권한(Admin/Staff)에 따라 메뉴만 다르다.

```
ERP → ERP Dashboard → (권한에 따라 메뉴만)
  Admin: 직원관리 · 회사정보 · 구독/청구 · 권한
  Staff: 업무처리(고객·AI분석·신고서·메신저·ID Billing)
```

## 3. Role 정의 (7 제품 role + 2 플랫폼 인프라 role)

**제품 사용자 role (7):**
1. Personal Customer — `CUSTOMER` (customer_type=INDIVIDUAL)
2. Company Customer — `CUSTOMER` (customer_type=COMPANY)
3. Operator — `TAX_OPERATOR`
4. Supervisor — `TAX_OPERATOR_SUPERVISOR` (+ `TAX_OPERATOR_LEAD`)
5. Master(JTC 신고운영) — `TAX_OPERATOR_MASTER`
6. ERP Admin — `FIRM_ADMIN`
7. ERP Staff — `CONSULTANT` / `TAX_ADVISOR`

**플랫폼 인프라 role (제품 아님 — 공통 플랫폼 운영):**
- `PLATFORM_MASTER` — MFG(MonoFlip) 사업운영: 요금/플랜/커스텀 가격/EXTERNAL 온보딩/플랫폼 통계. **결정 ②: `TAX_OPERATOR_MASTER`(JTC 신고운영)와 합치지 않는다.** MFG=플랫폼 사업자, JTC=신고 대행 주체라는 분리가 "두 제품 + 공통 플랫폼" 모델과 정확히 맞다.
- `PLATFORM_ADMIN` — 기술 관리(서버/로그/웹훅), 세무 데이터 접근 불가.
- `SYSTEM` — billing 자동화 전용.

## 4. 결정 ① 의 코드 gap — CONSULTANT/TAX_ADVISOR = EXTERNAL 전용 (후속 마이그레이션)

**확정 정의:** `CONSULTANT`/`TAX_ADVISOR` 는 **세무법인 ERP(EXTERNAL) 전용** role 이다. JTC 실무는 전부 `TAX_OPERATOR` 계열로 수행한다.

**현재 gap (2026-07-24 기준):**
- JTC 소속 consultant 4명이 아직 존재(`consultant.tax_partner_id` = JTC 기본 파트너). 이들이 담당한 `customer_consultant` 활성 16건, JTC `consultant_session` 5건.
- P0~P5 에서 `CONSULTANT_JTC`→`CONSULTANT` rename 했던 이력 때문에 role 이름만으로는 JTC/EXTERNAL 구분 불가 — `tax_partner.partner_type` 조인 필요.

**목표 상태로 가는 마이그레이션(별도 트랙, 미착수):**
1. JTC 소속 실무자를 `TAX_OPERATOR` 로 전환(또는 그들의 담당 고객을 운영팀 배정 체계로 이관).
2. JTC `consultant_session` 5건을 운영팀 큐/흐름으로 이관하거나 정리.
3. `requireConsultantOrSupervisor` 등 미들웨어를 "EXTERNAL 전용" 전제로 재점검.
4. 완료 후 "consultant = EXTERNAL" 을 RLS/미들웨어에서 불변식으로 강제.

⚠️ 이 마이그레이션 전까지는 코드가 목표 상태와 다르다. 신규 기능은 목표 정의(consultant=EXTERNAL, JTC=operator)를 전제로 설계하되, 기존 JTC consultant 데이터를 깨지 않도록 주의.

## 5. 이 정의로 설명되는 최근 결정들
- **tenant RLS 격리(JTC↔EXTERNAL)** = "ERP 는 운영팀 미개입" 의 DB 강제.
- **ID Billing 발행 보드 공용 컴포넌트 + 2 진입점** = "제품은 둘, 도메인 엔진은 공통 플랫폼 공유".
- **P6 Master 이원화(TAX_OPERATOR_MASTER vs PLATFORM_MASTER)** = 결정 ②.
- **Coretax 납부=신고, 승인대기 4-값, 자동배정** 등 운영 기능 = Assisted DIY 제품의 품질보증 파이프라인.
