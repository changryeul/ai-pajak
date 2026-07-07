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

FIRM_ADMIN 로그인 시 사이드바에 **"세무 컨설팅 법인 관리"** 섹션이 노출됩니다 (P6.2 신설).

| 메뉴 | URL | 담당 |
|---|---|---|
| 직원 관리 | `/consultant-erp/firm-admin/staff` | 초대·자격증 임명·활성 목록 |
| 클라이언트 관리 | `/consultant-erp/firm-admin/clients` | 배정·워크로드·전체 목록 |
| 청구·구독 | `/consultant-erp/firm-admin/billing` | 현재 Tier·업그레이드·결제 이력 |

## 4. 핵심 플로우

### 4.1. 직원 초대 → 자격증 임명

1. 직원 관리 → **직원 초대** → 이메일 + 역할 (CONSULTANT/TAX_ADVISOR) 선택
2. 초대 메일 → 링크 클릭 → 비밀번호 설정 → 자동으로 자기 회사 `tax_partner_id` 에 연결
3. 컨설턴트가 세무사 자격증을 취득하면 → **세무사 자격증 임명** 카드에서 승격
4. 자격 해제도 여기서 (사유 필수, audit_log 기록)

### 4.2. 클라이언트 배정

1. 클라이언트 관리 → 미배정 클라이언트 카드에서 담당 직원 선택
2. 재배정: 배정 관리 → 대상 클라이언트 → 새 담당자 선택 → 이전 이력 audit 기록

### 4.3. 청구·구독 관리

1. 청구·구독 → 현재 Tier 카드 (Starter / Growth / Enterprise) 확인
2. **Tier 업그레이드** 카드 → 상위 tier 선택 → Midtrans 결제 → 웹훅 완료 시 즉시 반영
3. 결제 이력 카드에서 과거 청구 확인

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

## 7. 관련 문서

- 세무 컨설팅 법인 매뉴얼 (self-service 워크플로우): [`02-external-consultant.md`](./02-external-consultant.md)
- 개념·설계: [`../guides/roles.md`](../guides/roles.md) §2 그룹 D
- P6.2 착수 이력: [`../guides/domain-model-corrections-20260707.md`](../guides/domain-model-corrections-20260707.md)

---

**문서 버전**: 2026-07-07 v1 (P6.2 신설 반영)
