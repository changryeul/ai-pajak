# 운영팀(Tax Operator) 매뉴얼

> **대상**: AI Pajak 백오피스에서 고객이 제출한 세무 신고 건을 **DJP에 실제로 제출**하는 업무를 담당하는 **JTC 운영팀** 구성원
>
> **세 가지 레벨**:
> - **TAX_OPERATOR** — 큐 처리, 자료 검토 (주니어/상담원)
> - **TAX_OPERATOR_SUPERVISOR** — 승인 권한, 업무 분배, 팀 통계
> - **TAX_OPERATOR_MASTER** — 플랫폼 전체 통계, 맞춤 가격 발행, 특수 서비스(세무조사·TP) 견적

## 1. 운영팀이 담당하는 것

법인·개인·외부 사무소 고객이 **AI Pajak 앱에서 "제출" 버튼**을 누르면, 해당 신고 건은 `djp_submission_queue` 테이블에 **PENDING** 상태로 들어옵니다. 그 후 **DJP에 실제로 납부되고 접수증(BPE)이 업로드되기까지**의 11단계 워크플로우(완료 시점 `COMPLETED` 까지)를 운영팀이 책임집니다.

운영팀은 고객의 "제출" 이후 사건의 모든 실무를 처리하므로, AI Pajak 전체의 신뢰와 납부 정확성이 이 팀에 달려 있습니다.

**절대 규칙**
- 고객의 개인 세무 데이터는 **직접 편집하지 않습니다**. 오류 발견 시 **반려(Reject)** 하여 고객 또는 담당 컨설턴트가 수정하게 합니다.
- 모든 상태 전이는 **`withAudit` 미들웨어**로 자동 기록됩니다. 로그는 영구 보존됩니다.
- 승인·반려 같은 되돌리기 어려운 조치는 **Supervisor 이상**만 가능합니다.

## 2. 접속과 권한

### 2.1. 로그인
운영팀 계정은 **JTC 관리자가 직접 생성**하여 이메일로 초대합니다. 일반 회원가입 화면으로는 운영팀 계정을 만들 수 없습니다.

- 로그인 후 대시보드 좌측 사이드바에 **"운영자"** 섹션이 자동으로 표시됩니다.
- 역할에 따라 보이는 메뉴가 다릅니다.

### 2.2. 역할별 권한 표

| 메뉴/기능 | OPERATOR | SUPERVISOR | MASTER |
|---|:-:|:-:|:-:|
| 운영자 대시보드 (`/operator/dashboard`) | ✓ | ✓ | ✓ |
| 제출 큐 (`/operator/queue`) | ✓ | ✓ | ✓ |
| 자료 검토 | ✓ | ✓ | ✓ |
| 승인/반려 | — | ✓ | ✓ |
| 업무 분배 | — | ✓ | ✓ |
| 운영자 통계 | — | ✓ | ✓ |
| 승인 규칙 관리 | — | ✓ | ✓ |
| 고객 컴플레인 | — | ✓ | ✓ |
| 마스터 대시보드 (`/admin/master`) | — | — | ✓ |
| 맞춤 가격 (`/admin/master/custom-pricing`) | — | — | ✓ |

### 2.3. 데이터 접근 범위
- 운영팀은 **제출된 신고 건의 메타데이터**(고객명, NPWP, 신고 유형, 금액, 기간, 첨부 문서)만 볼 수 있습니다.
- **고객의 대시보드·월 신고 상세·회계 연동 데이터**에는 접근하지 않습니다. (PLATFORM_ADMIN과는 다릅니다 — 플랫폼 관리자는 아예 세무 데이터 차단)

## 3. 제출 큐 워크플로우 (핵심)

`djp_submission_queue` 는 11단계로 진행됩니다 (`PENDING` → ... → `COMPLETED`).

```
PENDING → DATA_REVIEW → PENDING_APPROVAL → APPROVED → EBILLING_GENERATED
  → PAYMENT_PENDING → PAYMENT_UPLOADED → PAYMENT_VERIFIED → DJP_SUBMITTED
  → BPE_UPLOADED → COMPLETED
```

각 상태에서 실패하거나 반려되면 **FAILED**로 이동합니다.

### 3.1. 각 단계에서 누가 무엇을 하는가

| 상태 | 담당 | 다음 액션 |
|---|---|---|
| **PENDING** | 시스템 | Operator에게 자동 배정 |
| **DATA_REVIEW** | Operator | 입력 데이터·첨부 문서 검토 → 결재 상신(`PENDING_APPROVAL`로 전이) 또는 반려(`FAILED`) |
| **PENDING_APPROVAL** | Supervisor | 승인(`APPROVED`) 또는 반려(`FAILED`) |
| **APPROVED** | Operator | DJP에서 eBilling 번호 생성 → `EBILLING_GENERATED` |
| **EBILLING_GENERATED** | 시스템 → 고객 | 고객에게 "eBilling 번호 받으셨습니다" 알림 발송, 상태 `PAYMENT_PENDING` |
| **PAYMENT_PENDING** | 고객 | 고객이 해당 번호로 국세 납부 → 영수증 업로드 → `PAYMENT_UPLOADED` |
| **PAYMENT_UPLOADED** | Operator | 영수증과 실제 납부 내역 교차 확인 → `PAYMENT_VERIFIED` 또는 반려 |
| **PAYMENT_VERIFIED** | Operator | Coretax/DJP에 실제 신고서 전송 → `DJP_SUBMITTED` |
| **DJP_SUBMITTED** | Operator | DJP가 발급한 **BPE(전자접수증)** PDF를 업로드 → `BPE_UPLOADED` |
| **BPE_UPLOADED** | 시스템 | 고객에게 완료 알림 + BPE 전달 → `COMPLETED` |

### 3.2. API
모든 상태 전이는 `PUT /api/operator/queue` 한 엔드포인트로 처리됩니다.

```
PUT /api/operator/queue
body: { itemId: "...", action: "review" | "submit_for_approval" | "approve" | "reject" | "generate_ebilling" | "verify_payment" | "submit_djp" | "upload_bpe" | "complete" }
```

미들웨어가 역할을 검증하여 **OPERATOR 계정이 `approve`를 호출하면 거부**됩니다.

## 4. 플로우별 상세 가이드

### 4.1. 플로우 A — Operator 하루 업무

1. **운영자 대시보드** 진입 → "내 큐(Assigned to me)" 섹션에서 오늘 처리할 항목 확인
2. 상단 필터로 **DATA_REVIEW** 상태만 보기
3. 항목 클릭 → 상세 화면
   - 좌측: 신고 유형, 기간, 고객 메타, 금액 요약
   - 우측: 첨부 문서 썸네일 (Faktur, 급여 대장 등)
4. 데이터 일관성 검증 체크리스트:
   - NPWP 16자리 정상 여부
   - 신고 기간과 기한 정합성
   - 금액 자리수(0이 하나 빠지는 실수 잦음)
   - 첨부 증빙과 입력 금액 일치
5. 이상 없으면 **"승인 요청"** → `PENDING_APPROVAL`
6. 이상 있으면 **"반려"** → 사유 입력 필수 (고객·컨설턴트에게 전달됨)
7. 다음 항목으로 이동

### 4.2. 플로우 B — Supervisor 결재

1. **승인 대기** 메뉴 → `PENDING_APPROVAL` 목록
2. 항목 클릭 → 검토자 Operator의 코멘트 확인
3. 스팟 체크(무작위 샘플) 또는 고액 건(예: PPN 5천만 루피아 이상) 전수 확인
4. **승인** — 상태 `APPROVED`
5. **반려** 시 Operator에게 피드백 입력 → 큐가 `FAILED` 대신 `DATA_REVIEW`로 되돌아가도록 설정된 경우도 있음 (승인 규칙에 따름)

### 4.3. 플로우 C — eBilling 생성과 납부 확인

1. `APPROVED` 항목 → **"eBilling 생성"** 버튼
2. 시스템이 DJP Coretax API를 호출 (또는 수동 입력)
3. 번호와 기한을 입력하면 상태 `EBILLING_GENERATED`
4. 고객 앱에 알림 자동 발송
5. 고객이 영수증 업로드하면 상태 `PAYMENT_UPLOADED` → 운영자 큐에 다시 나타남
6. 영수증 사진/PDF 확인 → 금액, 납부일, VA 번호 일치 여부 점검
7. **Payment Verified** 버튼 → `PAYMENT_VERIFIED`

### 4.4. 플로우 D — DJP 제출과 BPE 업로드

1. `PAYMENT_VERIFIED` 항목 → **"DJP 제출"** 버튼
2. Coretax/e-SPT 시스템에 실제 신고서 업로드 (현재 일부 수동 단계 포함)
3. DJP가 **BPE PDF**를 발급
4. 해당 PDF를 **"BPE 업로드"** 로 첨부 → 상태 `BPE_UPLOADED`
5. 시스템이 자동으로 `COMPLETED`로 이동, 고객·컨설턴트에게 완료 알림 발송

## 5. Supervisor 전용 기능

### 5.1. 업무 분배 (`/operator/workload`)
- 미배정 PENDING 건을 운영자별로 수동 분배
- 자동 배정 규칙 설정: 균등 분배 / 난이도별 / 특정 고객 전담

### 5.2. 운영자 통계 (`/operator/statistics`)
- 운영자별 일·주·월 처리 건수
- 평균 처리 시간 (PENDING → COMPLETED)
- 반려율, 재반려율
- 생산성 랭킹

### 5.3. 고객 컴플레인 (`/operator/complaints`)
- 고객이 제기한 불만 목록
- 원인 분석 카테고리 태깅 (지연·오류·UX·기타)
- 담당 운영자와 연결, 재발 방지 메모

### 5.4. 승인 규칙 (`/operator/approval-rules`)
- 자동 승인 가능 기준 정의: "금액 1천만 루피아 이하 + 동일 고객 3회 이상 무사고면 Operator 단독 승인 허용"
- 규칙은 `approval_rule` 테이블에 저장되며 큐 처리 시 자동 적용

## 6. Master 전용 기능

### 6.1. 마스터 대시보드 (`/admin/master`)

플랫폼 전체 KPI를 한 화면에 집계:

- **전체 법인·개인 고객 수**
- **MRR (월간 반복 수익)** — 구독료 합계 (VAT 별도)
- **플랜별 분포** — UMKM / Basic / Pro / 외부사무소 Starter~Enterprise
- **이번 달 신고 처리 볼륨** — 유형별(PPh21/PPh23/PPN/Final)
- **Pro 초과 고객 목록** — 현재 Pro 플랜 한도를 넘었거나 근접한 고객. 이 목록을 기반으로 맞춤 견적을 발행합니다.
- **최근 맞춤 견적 상태** — DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED

### 6.2. 맞춤 가격 관리 (`/admin/master/custom-pricing`)

**CustomPricingQuote** 레코드를 생성·편집·발행합니다.

1. **신규 견적**
2. 고객 선택 (검색)
3. 서비스 유형 선택:
   - `CORPORATE_PLAN` — Pro를 초과하는 법인 고객용 커스텀 요금
   - `TAX_AUDIT` — 세무조사 대응 서비스
   - `TRANSFER_PRICING` — 이전가격 분석 용역
   - `ADVISORY` — 일반 자문
   - `OTHER`
4. 가격(IDR), 유효 기간, 서비스 범위 설명, 조건 입력
5. **SENT** 상태로 전환 → 고객 대시보드에 알림 발송
6. 고객이 **수락(ACCEPTED)** 하면 `customer_subscription.custom_pricing_quote_id` 에 연결되어 다음 결제 주기부터 적용됩니다.

### 6.3. Master가 모니터링해야 할 수치

- **Churn 고객** — 구독이 CANCELED/EXPIRED로 전환된 고객
- **외부 사무소 Tier 업그레이드 대기** — Growth 한도 근접 사무소
- **자동 승인 규칙 효과** — 규칙 도입 후 Supervisor 업무량 감소율
- **평균 제출 리드타임** — PENDING → COMPLETED

## 7. 에러 처리와 장애 대응

### 7.1. DJP Coretax 장애
- DJP 시스템이 응답하지 않으면 **Circuit Breaker**가 작동하여 자동 재시도 후 Sentry에 경고
- Operator는 해당 건을 **재시도 버튼** 또는 수동 처리로 전환
- 당일 내 처리 불가 시 Master에게 보고하여 고객 커뮤니케이션 결정

### 7.2. 영수증 불일치
- 고객이 업로드한 영수증 금액이 eBilling 금액과 다르면 즉시 **반려**
- 사유에 "금액 불일치 — 실제 납부 Rp X, 청구 Rp Y"로 명시
- 고객이 재납부 또는 추가 납부를 처리하면 재제출 가능

### 7.3. 중복 제출
- 같은 고객이 같은 기간의 같은 신고 유형을 여러 번 제출한 경우, 큐 화면 상단에 **경고 배지**가 뜸
- 최신 건을 기준으로 처리하고 구 건은 반려

## 8. 보안과 감사

- 운영팀 모든 조치는 `audit_log` 테이블에 자동 기록. `activity_type`, `actor_user_id`, `activity_details`, IP, User-Agent, 타임스탬프가 함께 저장됩니다.
- 감사 로그는 PLATFORM_ADMIN과 MASTER만 조회 가능합니다.
- 운영팀 계정은 **2FA 필수**입니다 (정책 강제 예정).
- 비밀번호 정책: 8자 이상 + 대/소/숫자/특수문자

## 9. 자주 묻는 질문

**Q. Operator인데 승인이 필요한 건은 어떻게 처리하나요?**
A. **"승인 요청"** 버튼으로 `PENDING_APPROVAL` 상태로 전이시키면 자동으로 Supervisor 큐에 들어갑니다. Operator가 직접 승인할 수는 없습니다.

**Q. 반려한 건을 다시 검토할 수 있나요?**
A. 고객 또는 컨설턴트가 재제출하면 새로운 `PENDING` 건으로 다시 큐에 들어옵니다. 과거 반려 기록은 감사 로그와 연결되어 표시됩니다.

**Q. 큐가 너무 많이 쌓였습니다.**
A. Supervisor가 **업무 분배**에서 균등 재배정 또는 **승인 규칙**을 조정해 자동 승인 범위를 늘릴 수 있습니다. 근본적으로 부족하면 Master에게 인력 증원을 요청하세요.

**Q. Supervisor가 장기 휴가인 경우 승인은 누가 하나요?**
A. 다른 Supervisor 또는 Master가 커버합니다. **업무 분배** 에서 부재자의 큐를 다른 Supervisor에게 이관 가능합니다.

**Q. Master 대시보드의 MRR이 실제 수치와 다릅니다.**
A. MRR은 `customer_subscription` 과 `tax_partner_subscription` 의 **ACTIVE** 건만 합산합니다. PENDING_PAYMENT나 CANCELED는 제외됩니다. 집계 시점 차이 최대 5분.

**Q. 맞춤 견적을 보냈는데 고객이 안 봅니다.**
A. SENT 상태에서 7일 후 자동으로 리마인드 이메일이 발송됩니다. 30일 경과 시 `EXPIRED`로 전환되며 새 견적을 발행해야 합니다.

## 10. 용어

| 용어 | 뜻 |
|---|---|
| **djp_submission_queue** | 운영팀 큐의 DB 테이블 |
| **BPE** | Bukti Penerimaan Elektronik (전자접수증) |
| **eBilling** | 국세 납부 VA 번호 체계 |
| **Coretax** | 2025년부터 DJP가 운영하는 통합 세무 시스템 |
| **MRR** | Monthly Recurring Revenue (월간 반복 수익) |
| **Churn** | 구독 해지·만료 |
| **Circuit Breaker** | 외부 API 장애 시 자동 차단·재시도 로직 (`src/lib/resilience/`) |
| **withAudit** | 모든 쓰기 조치를 감사 로그에 자동 기록하는 미들웨어 |

---

**문서 버전**: 2026-04-11 v1
**운영 기준 변경**: JTC 마스터 또는 플랫폼 관리자 승인 필요
