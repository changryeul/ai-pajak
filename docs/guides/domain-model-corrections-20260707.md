# 도메인 모델 재정정 — 모노플립/JTC 분리 (2026-07-07 문서 정리)

> **원본**: `~/Downloads/AI 의견 정리.docx` (2026-07-07)
> **적용 phase**: P6 (대기, 별도 세션에서 착수)
> **왜 별 문서인가**: 2026-07-05 에 완료한 P0~P5 로드맵의 전제 (`JTC = 플랫폼 파트너 겸 default 대행자`) 를 뒤집는 큰 정정. 지금 세션에서 강행하면 half-baked. P6 로 예약.

---

## 1. 원본 문서의 핵심 논지

- **모노플립 = 플랫폼 운영사** (AI Pajak 시스템 소유)
- **JTC = 세무신고 대행 실무 주체** (Coretax 접속·자격증 필요)
- **두 주체가 겹치면 안 됨** — 세무신고 대행 자격 문제
- AI Pajak = "Assisted DIY Filing" (고객 입력 + JTC 상담원 처리, 순수 DIY 아님)

**설계 원칙 (§10 결론)**:
> 모노플립은 플랫폼 운영자이고, JTC는 신고대행 실무자다. 고객은 AI Pajak을 사용하지만, Coretax 처리와 세무신고 대행은 JTC 상담원/세무사가 수행한다. 외부 세무컨설팅 업체는 AI Pajak ERP를 사용하되, 자기 고객은 자기 책임으로 처리한다.

---

## 2. 지금 (P0~P5 완료 상태) 모델과의 gap 4가지

| # | 지금 (2026-07-05 완료) | 원본 문서 정정 |
|---|---|---|
| **1** | JTC 가 "default 대행자 겸 플랫폼 파트너" (`is_platform_partner=true`) 로 반쯤 겹침 | **모노플립 = 플랫폼 owner, JTC = 대행자만**. 완전 분리. `is_platform_partner` 개념 재정의 필요. |
| **2** | `TAX_OPERATOR_MASTER` 하나가 플랫폼 통계 + 커스텀 가격 + Coretax 토글 + Tax Rule 편집 모두 관리 | 두 개로 쪼갬: **JTC_OPERATION_MASTER** (Coretax·신고 실무 최상) + **PLATFORM_MASTER** (요금·상품·계약, 모노플립 사업 최상) |
| **3** | `PLATFORM_ADMIN` = 세무 X 관리자 하나 (기술관리자 성격) | 두 개로 쪼갬: **PLATFORM_ADMIN** (기술관리자 유지) + **PLATFORM_MASTER** (사업운영자 신설) |
| **4** | 세무컨설팅 법인 (EXTERNAL tax_partner) 안에 `CONSULTANT` + `TAX_ADVISOR` 만 | **FIRM_ADMIN 신설** — 직원배정·고객관리·업무배정·청구관리 (ERP 관리자 화면 담당) |

---

## 3. 최종 화면 구조 (7개 + 내부 1개)

원본 §9 표 그대로.

| 구분 | 화면 수 | 화면 이름 | 담당 |
|---|---|---|---|
| 고객용 DIY | 2 | 개인 납세자 · 법인 납세자 | INDIVIDUAL / COMPANY customer |
| JTC 신고운영 | 2 | JTC 상담원 · JTC 수퍼바이저 | JTC 소속 CONSULTANT / SUPERVISOR |
| 모노플립 플랫폼 운영 | 1 | 모노플립 마스터 (ERP 테넌트 관리 메뉴 포함) | **신규 PLATFORM_MASTER** |
| 세무컨설팅 ERP | 2 | ERP 직원 · **ERP 관리자 (신규)** | EXTERNAL CONSULTANT / **신규 FIRM_ADMIN** |
| (내부) 시스템 관리 | 1 | 모노플립 시스템 관리자 | PLATFORM_ADMIN (개발/서버/로그/장애/결제웹훅) |

**합계**: 사업 관점 7개, 개발 권한 관점 8개.

---

## 4. Role 재편 안 (원본 §5 발췌 + 우리 현 상태 매핑)

| 화면 (사람 관점) | 소속 | 지금 role | P6 후 |
|---|---|---|---|
| 개인 납세자 | 고객 | CUSTOMER · INDIVIDUAL | 유지 |
| 법인 납세자 | 고객 | CUSTOMER · COMPANY | 유지 |
| JTC 상담원 | JTC | `TAX_OPERATOR` 또는 `CONSULTANT` (혼재) | **`CONSULTANT` (JTC 소속)** 로 정리 |
| JTC 수퍼바이저 | JTC | `TAX_OPERATOR_SUPERVISOR` | 유지 (이름 명확화 검토) |
| JTC 세무사 (자격증) | JTC | `TAX_ADVISOR` | 유지 |
| 모노플립 마스터 (사업운영) | 모노플립 | `TAX_OPERATOR_MASTER` (혼용) | **신규 `PLATFORM_MASTER`** |
| 모노플립 관리자 (기술) | 모노플립 | `PLATFORM_ADMIN` | 유지 |
| ERP 직원 | 세무컨설팅 법인 (EXTERNAL) | `CONSULTANT` | 유지 |
| ERP 세무사 | 세무컨설팅 법인 (EXTERNAL) | `TAX_ADVISOR` | 유지 |
| ERP 관리자 | 세무컨설팅 법인 (EXTERNAL) | (없음) | **신규 `FIRM_ADMIN`** |
| 시스템 | 시스템 | `SYSTEM` | 유지 |

**정리**: 신규 role 2개 (`PLATFORM_MASTER`, `FIRM_ADMIN`) + 기존 `TAX_OPERATOR_MASTER` 를 좁혀서 "JTC 신고운영 최고권한" 만 담당하게 재정의.

---

## 5. 파일에서 유지할 부분 (원본 §6)

원본 문서가 명시적으로 "유지" 라고 언급:

- ✅ JTC 와 EXTERNAL tax partner 구분
- ✅ 개인·일반법인 → JTC 처리
- ✅ EXTERNAL 세무컨설팅 법인 self-service
- ✅ tenant 간 데이터 격리 (RLS)
- ✅ TAX_ADVISOR 최종 제출 권한
- ✅ SYSTEM role (결제·웹훅)
- ✅ Audit Trail

즉 **P0~P5 로 만든 기반 구조는 대부분 유지**, 상위 role 계층만 재편.

---

## 6. 잘못된 표현 정정 (원본 §3)

원본 문서가 명시적으로 "이렇게 바꿔야 한다" 라고 지시:

| 지금까지 오해했던 표현 | 정확한 표현 |
|---|---|
| AI Pajak 상담원 | **JTC 소속 AI Pajak 신고 상담원** |
| 모노플립 운영팀이 Coretax 처리 | **JTC 상담원이 Coretax 처리** |
| 모노플립 마스터가 신고업무까지 통제 | 모노플립 마스터는 시스템 운영. JTC 업무는 진행상태/품질/계약 범위 내에서만 관리 |
| 플랫폼 운영팀 = 신고 처리팀 | **플랫폼 운영팀과 신고 처리팀은 분리** |
| 상담원 = 모노플립 직원 | **상담원 = JTC 직원** |

이 정정은 앞으로 문서·UI 카피에 즉시 반영.

---

## 7. P6 실행 계획 초안 (별도 세션에서 확정)

| Sub-phase | 스코프 | 예상 규모 |
|---|---|---|
| P6.0 | 이 문서 승인 + `roles.md` 목표 모델 재작성 | 0.5일 |
| P6.1 | `PLATFORM_MASTER` role 신설 (마이그 + enum + 미들웨어) | 1일 |
| P6.2 | `FIRM_ADMIN` role 신설 (마이그 + ERP 관리자 UI 스캐폴딩) | 1~2일 |
| P6.3 | `TAX_OPERATOR_MASTER` 를 좁혀서 "JTC 신고운영 최고권한" 만 남김. Coretax/Tax Rule 편집은 여기, 요금·상품·계약은 `PLATFORM_MASTER` 로 이관 | 1일 |
| P6.4 | 매뉴얼 6개 (모노플립 마스터·ERP 관리자 신설, JTC 매뉴얼 카피 정정) | 1일 |
| P6.5 | Auto-memory · CLAUDE.md 정합 | 0.5일 |

**총 5~6일** 예상. P0~P5 (2026-07-03~05) 규모와 유사.

---

## 8. 착수 전 확인 필요 (P6 세션 시작 시 물어볼 것)

- **Q1**: `PLATFORM_MASTER` 와 `TAX_OPERATOR_MASTER` 사이 권한 경계 (예: 커스텀 가격 발행은 어느 쪽?)
- **Q2**: `FIRM_ADMIN` 이 자기 회사 안의 `TAX_ADVISOR` 를 임명·해임할 수 있나? (자격증 소지자 검증과 관계)
- **Q3**: 지금 프로덕션의 `master.test@aipajak.com` (`TAX_OPERATOR_MASTER`) 을 어떻게 나눌까? `PLATFORM_MASTER` 도 겸직?
- **Q4**: 사이드바 · UI 카피에 "AI Pajak 운영팀" 이라는 표현이 몇 군데 있음 → "JTC 신고 상담원" 으로 일괄 치환할까?
- **Q5**: `tax_partner.is_platform_partner=true` (JTC 만) 컬럼 의미 재정의 필요. 유지·삭제·이름 변경?

---

## 9. 참조

- 원본: `~/Downloads/AI 의견 정리.docx` (2026-07-07)
- 지금 상태: [`docs/guides/roles.md`](./roles.md), [`docs/guides/accounts.md`](./accounts.md)
- 완료된 로드맵: [`docs/guides/roles.md`](./roles.md) §7
