# 세무 컨설팅 법인 관리자 (FIRM_ADMIN) 매뉴얼

> **대상**: 세무 컨설팅 법인 (EXTERNAL tax_partner) 의 대표·운영 관리자
>
> **한 줄 요약**: 자기 회사 안의 직원 (컨설턴트·세무사) 을 초대·자격증 임명·비활성화하고, 자기 회사 클라이언트를 담당 직원에게 배정하고, 청구·구독을 관리합니다. **자기 tenant 안에서만** — 다른 세무 컨설팅 법인 데이터는 절대 볼 수 없습니다 (Hard Rule #7).
>
> **관련 role**: `CONSULTANT` (실무 직원) · `TAX_ADVISOR` (자격증 소지자) · `FIRM_ADMIN` (이 매뉴얼 대상)

---

## 1. 이 role 이 왜 필요한가

지금까지 세무 컨설팅 법인은 대표 컨설턴트가 인사·배정·청구를 겸직해서 처리했지만 권한과 화면이 명확하지 않았습니다. FIRM_ADMIN 은 이 관리 업무를 별도 계정으로 분리해 다음을 명확히 담당합니다.

- **직원 관리** — CONSULTANT·TAX_ADVISOR 초대·비활성화
- **자격증 임명·해임** — 컨설턴트를 TAX_ADVISOR 로 승격, 자격 해제
- **클라이언트 배정** — 자기 회사 클라이언트를 담당 직원에게 지정·재배정
- **청구·구독 관리** — 현재 Tier, 업그레이드, 결제 이력

## 2. FIRM_ADMIN 이 절대 못 하는 것

- **다른 tenant 데이터 조회** — RLS 이중 차단 (Hard Rule #7)
- **Coretax 접속** — 자기 회사 안에서도 최종 신고 제출은 TAX_ADVISOR 자격증 소지자 만
- **JTC 대행 큐 접근** — 세무 컨설팅 법인은 self-service, JTC 개입 없음
- **PLATFORM_MASTER 기능 (요금 편집, 시스템 통계)** — MonoFlip 만

## 3. 사이드바와 화면

FIRM_ADMIN 으로 로그인하면 `/dashboard` 대신 **직원 관리로 자동 진입**하고, 사이드바에 **"세무 컨설팅 법인 관리"** 섹션만 노출됩니다 (customer/JTC 메뉴 없음). 5개 언어 (ko/en/id/ja/zh) 지원.

| 메뉴 | URL | 담당 |
|---|---|---|
| 직원 관리 | `/consultant-erp/firm-admin/staff` | 초대·자격증 임명·활성 목록·대기중 초대 |
| 클라이언트 관리 | `/consultant-erp/firm-admin/clients` | 직원별 워크로드·전체 목록·재배정 |
| 청구·구독 | `/consultant-erp/firm-admin/billing` | 현재 Tier·플랜 변경·결제 이력 |

## 4. 핵심 플로우

### 4.1. 직원 초대 → 자격증 임명

1. 직원 관리 → **직원 초대** → 이메일 (+이름) + 역할 (컨설턴트/세무사) 선택 → 초대 메일 발송
2. 초대 링크는 **7일 유효** — 수락 시 비밀번호 설정 → 자동으로 자기 회사 `tax_partner_id` 에 연결. 대기중 초대는 "대기중 초대" 목록에서 언제든 취소 가능
3. 컨설턴트가 세무사 자격증을 취득하면 → 직원 행의 **세무사 임명** 버튼으로 승격, **임명 해제** 버튼으로 해제 (모두 audit_log 기록)
4. **비활성화** 버튼으로 퇴사·휴직 처리 (로그인 role 도 함께 비활성). 단, **자기 자신은 비활성화 불가**
5. 활성 세무사가 0명이면 화면 상단에 경고 배너 — 자기 이름 신고에 최소 1명 필요 (Hard Rule #3)

### 4.2. 클라이언트 배정

1. 클라이언트 관리 → 상단 **직원별 워크로드** 카드에서 부하 확인
2. 전체 클라이언트 테이블에서 행별 **담당 직원 선택 박스**로 재배정 → 이전 배정은 비활성 이력으로 보존 (audit 기록)
3. 다른 법인 직원·비활성 직원으로는 배정 불가 (서버 검증)

### 4.3. 청구·구독 관리

1. 청구·구독 → **현재 구독** 카드 (Tier·클라이언트 한도·관리중 클라이언트 수, 한도 초과 시 빨간 경고)
2. **플랜 변경** 카드 → 추천 배지 확인 → 신청 → Midtrans 결제 페이지 → 웹훅 완료 시 즉시 반영 (결제 링크 생성이 지연되면 신청 건은 보존되고 재시도 안내)
3. **결제 이력** 테이블에서 과거 청구·주문번호·결제일 확인

## 5. 신고 자격증 요건 (Hard Rule 3)

자기 회사가 자기 이름으로 SPT 를 제출하려면 tenant 안에 **활성 TAX_ADVISOR (자격증 소지자) 최소 1명** 필요 (P4 게이트).

- 없으면 SPT 최종 제출 버튼 비활성화
- FIRM_ADMIN 이 컨설턴트를 TAX_ADVISOR 로 임명하면 즉시 자격 활성화
- 자격증 자체는 실제 세무사 자격증 (Brevet A/B/C, CPA 등) 서류 검증 후 임명 (수동)

## 6. Hard Rule 준수 (요약)

| # | Rule | 어떻게 적용되나 |
|---|---|---|
| 2 | Consultant 는 반드시 tax_partner 에 소속 | 초대 시 자동으로 자기 tax_partner_id 에 연결 |
| 3 | SPT 제출은 TAX_ADVISOR 만 | 자격증 임명 관리로 통제 |
| 5 | Audit Trail | 임명·해임·배정 모두 audit_log 기록 |
| 7 | FIRM_ADMIN 은 자기 tenant only | RLS + `requireFirmAdmin` 미들웨어 이중 차단 |

## 7. 테스트 계정

| 계정 | 비밀번호 | 소속 |
|---|---|---|
| firmadmin.test@mitrapajak.com | TestPassword123! | PT Mitra Pajak Sentosa (EXTERNAL) |

## 8. 관련 문서

- 세무 컨설팅 법인 매뉴얼 (self-service 워크플로우): [`02-external-consultant.md`](./02-external-consultant.md)
- 개념·설계: [`../guides/roles.md`](../guides/roles.md) §2 그룹 D
- P6.2 착수 이력: [`../guides/domain-model-corrections-20260707.md`](../guides/domain-model-corrections-20260707.md)

---

**문서 버전**: 2026-07-08 v2 (실기능 + 5-로케일 i18n + 접근 게이트 반영. v1: 2026-07-07 P6.2 스캐폴딩)
