# 모노플립 마스터 (PLATFORM_MASTER) 매뉴얼

> **대상**: MonoFlip 사업 운영 최고권한 계정. 플랫폼 요금·상품·통계·계약·입점사 관리.
>
> **중요**: PLATFORM_MASTER 는 **세무신고 실무를 절대 수행할 수 없습니다**. Coretax 접속 X, tax_filing 조회·수정 X, 고객 세무 데이터 조회 X (Hard Rule #1 + #6 이중 차단).
>
> **JTC 와의 관계**: MonoFlip 은 플랫폼 운영사이고 JTC 는 세무신고 대행 실무자입니다. 두 주체는 완전히 분리됩니다. MonoFlip 마스터는 JTC 의 업무를 **진행 상태·품질·계약 범위 내에서만** 관리합니다 (실무 통제 X).

---

## 1. 이 role 이 왜 존재하는가

이전에는 `TAX_OPERATOR_MASTER` 하나가 "JTC 신고운영 + MonoFlip 사업운영" 을 겸했지만, 세무신고 자격이 없는 MonoFlip 이 신고 실무를 통제하는 것처럼 보이는 문제가 있었습니다.

P6.1 (2026-07-07) 에서 두 마스터를 분리:

| Role | 소속 | 담당 |
|---|---|---|
| **PLATFORM_MASTER** (이 매뉴얼) | MonoFlip | 요금·상품·통계·EXTERNAL 입점·계약 |
| **TAX_OPERATOR_MASTER** | JTC | Coretax·Tax Code Rule·Luxury Classification 편집 |

## 2. PLATFORM_MASTER 가 하는 일

### 2.1. 플랫폼 통계
- 총 고객 수 (개인/법인/EXTERNAL)
- MRR (월 반복 수익)
- 플랜 분포 (UMKM · Basic · Pro · Starter · Growth · Enterprise)
- 최근 가입자
- Pro 한도 초과 고객 (커스텀 견적 후보)
- AI 처리량 스냅샷

**Endpoint**: `GET /api/admin/master/stats`

### 2.2. 커스텀 가격 발행
Pro 한도 초과 고객 · 특수 서비스 (세무조사·이전가격·자문 등) 를 위한 맞춤 견적 발행.

- DRAFT → SENT → ACCEPTED/REJECTED/CANCELED/EXPIRED
- 서비스 타입: CORPORATE_PLAN · TAX_AUDIT · TRANSFER_PRICING · ADVISORY · OTHER
- 월 요금 + 일회성 요금 조합 가능

**Endpoint**: `/api/admin/master/custom-pricing`

### 2.3. 상품·요금제 관리
- 개인 SPT 건당 요금 (1770SS / 1770S / 1770)
- 법인 월 구독 (UMKM · Basic · Pro)
- 세무 컨설팅 법인 Tier (Starter · Growth · Enterprise)

### 2.4. EXTERNAL 입점사 관리
새로운 세무 컨설팅 법인이 `/register/firm` 으로 가입하면 tax_partner (EXTERNAL) 이 자동 생성됩니다. PLATFORM_MASTER 는 이 입점사 목록을 보고 계약 상태·사용량·장애를 관리합니다.

### 2.5. 계약·정책 관리
- 개별 계약 조건 (특수 SLA · 커스텀 결제 주기)
- 이용 약관 버전 관리
- 프로모션 코드

## 3. PLATFORM_MASTER 가 절대 못 하는 것

이 부분이 이 role 의 존재 이유입니다. 세무신고 대행 자격이 없으므로:

- **Coretax 접속 불가** — DJP 시스템 API 호출 X
- **tax_filing INSERT/UPDATE 불가** — `blockPlatformAdmin` 미들웨어 차단 (Hard Rule #6)
- **고객 세무 데이터 조회 불가** — 통계는 집계 값만, 개별 신고 내용 접근 X
- **Tax Code Rule / Luxury Classification 편집 불가** — TAX_OPERATOR_MASTER 만 (JTC 세무 지식 필요)

## 4. TAX_OPERATOR_MASTER 와의 겸직 (테스트 계정)

프로덕션의 `master.test@aipajak.com` 은 P6.1 이후 **두 role 겸직** 상태입니다.

- TAX_OPERATOR_MASTER — 신고 실무 최상 (Coretax·Tax Rule)
- PLATFORM_MASTER — 사업 운영 최상 (요금·상품·통계)

이는 **테스트 편의** 를 위한 겸직이고, 실 운영에서는 두 역할이 다른 사람에게 분리 부여될 것을 상정합니다.

## 5. 사이드바와 화면 구조

원본 정정 문서 §9 에 따르면 **화면 5** (모노플립 마스터) 하나가 이 role 전용 화면입니다. ERP 입점사 관리 메뉴는 이 화면 안에 통합됩니다.

관련 endpoint:
- `/api/admin/master/stats` — 통계 대시보드
- `/api/admin/master/custom-pricing` — 커스텀 견적 관리
- (미래) `/api/admin/master/erp-tenants` — EXTERNAL 입점사 관리

## 6. Hard Rule 준수

| # | Rule | 어떻게 적용되나 |
|---|---|---|
| 1 | PLATFORM_ADMIN 은 세무 데이터 접근 불가 | `blockPlatformAdmin` 미들웨어 확장으로 PLATFORM_MASTER 도 동시 차단 |
| 6 (신설) | MonoFlip 은 세무신고 실무 불가 | 위와 동일 미들웨어 + RLS |
| 5 | Audit Trail | 커스텀 견적·요금 변경·계약 수정 모두 audit_log 기록 |

## 7. 관련 문서

- MonoFlip 시스템 관리자 매뉴얼 (기술관리): [`06-platform-admin.md`](./06-platform-admin.md)
- JTC 세무 매뉴얼: [`05-jtc-consultant.md`](./05-jtc-consultant.md)
- 개념·설계: [`../guides/roles.md`](../guides/roles.md) §2 그룹 C
- P6.1 착수 이력: [`../guides/domain-model-corrections-20260707.md`](../guides/domain-model-corrections-20260707.md)

---

**문서 버전**: 2026-07-07 v1 (P6.1 신설 반영)
