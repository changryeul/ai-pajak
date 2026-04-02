# AI Pajak — 기능 테스트 가이드

## 1. 테스트 환경

### 로컬 환경
- URL: http://localhost:3000
- DB: Supabase Local (http://127.0.0.1:54321)
- Studio: http://127.0.0.1:54323

### Production 환경
- URL: https://ai-pajak.vercel.app
- DB: Supabase Cloud (hqcjeenfhlaxwteqzzcf)

---

## 2. 테스트 계정

| 역할 | 이메일 | 비밀번호 | 설명 |
|------|--------|----------|------|
| CUSTOMER | customer.test@example.com | TestPassword123! | 납세자 (개인) |
| CONSULTANT_JTC | consultant.test@jakartatax.co.id | TestPassword123! | 세무 컨설턴트 |
| TAX_ADVISOR_JTC | advisor.test@jakartatax.co.id | TestPassword123! | 세무사 (Production에서 수퍼바이저 겸용) |
| PLATFORM_ADMIN | admin.test@aipajak.com | TestPassword123! | 플랫폼 관리자 |
| TAX_OPERATOR_SUPERVISOR | supervisor.test@jakartatax.co.id | TestPassword123! | 상담원 감독관 |
| TAX_OPERATOR | operator1.test@jakartatax.co.id | TestPassword123! | 상담원 1 (Lee) |
| TAX_OPERATOR | operator2.test@jakartatax.co.id | TestPassword123! | 상담원 2 (Park) |
| TAX_OPERATOR | operator3.test@jakartatax.co.id | TestPassword123! | 상담원 3 (Choi) |

> **Production 참고:** advisor 계정은 TAX_ADVISOR_JTC + TAX_OPERATOR_SUPERVISOR 2개 역할 보유. 로그인 후 사이드바 역할 뱃지 클릭으로 전환 가능.

---

## 3. 기능별 테스트 시나리오

### 3.1 상담원 자동 배분 (Auto-Assignment)

**전제조건:** 수퍼바이저 계정 로그인

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "워크로드 관리" | 워크로드 페이지 표시 |
| 2 | 상담원 카드 확인 | 4명의 상담원 + 활용률 바 표시 |
| 3 | "미배정 건" 섹션 확인 | PENDING 상태의 미배정 큐 아이템 목록 |
| 4 | "자동 배분" 버튼 클릭 | 배분 결과 메시지: "{n}건 배정, {m}건 초과" |
| 5 | 미배정 건 감소 확인 | 미배정 건이 0 또는 감소 |
| 6 | 상담원 카드 활용률 변화 확인 | 배정된 상담원의 active items 증가 |

**검증 포인트:**
- Sticky Assignment: 기존 담당 고객은 같은 상담원에게 배정
- Round-Robin: 워크로드가 가장 적은 상담원에게 우선 배정
- Overflow: 전원 초과 시 미배정 유지

---

### 3.2 수퍼바이저 재배정 (Reassignment)

**전제조건:** 수퍼바이저 계정 로그인

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "제출 대기열" | 큐 페이지 표시 |
| 2 | 진행 중인 아이템 행 클릭 | 상세 정보 펼침 |
| 3 | 하단 "재배정" 버튼 클릭 | 재배정 폼 표시 |
| 4 | 대상 상담원 선택 + 사유 입력 | 드롭다운에 상담원 목록(활용률 포함) |
| 5 | "재배정 확인" 클릭 | 성공 메시지 + 목록 갱신 |

**검증 포인트:**
- 수퍼바이저만 재배정 버튼 보임 (일반 상담원에게는 미표시)
- 재배정 이력이 `queue_reassignment_history`에 기록됨
- 대상 상담원 용량 초과 시 에러 메시지

---

### 3.3 자동 승인 (Auto-Approval)

**전제조건:** 상담원 계정 로그인 + DATA_REVIEW 상태의 큐 아이템

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "상담원 대시보드" | 대시보드 표시 |
| 2 | DATA_REVIEW 상태 아이템의 "승인 요청" 클릭 | Auto-Approval Engine 실행 |
| 3-A | (저위험) 모든 임계값 충족 시 | 바로 APPROVED로 전환 + "Auto-approved" 메시지 |
| 3-B | (고위험) 임계값 미충족 시 | PENDING_APPROVAL로 전환 (수퍼바이저 검토 필요) |
| 4 | 수퍼바이저: "승인 관리" 페이지 확인 | PENDING_APPROVAL 건에 review_summary(AI 점수) 표시 |

**자동승인 5개 점수:**
| 점수 | 기본 임계값 | 설명 |
|------|-----------|------|
| OCR Confidence | ≥ 0.85 | 문서 OCR 인식 신뢰도 |
| Risk Score | ≤ 30 | 이상탐지 리스크 (낮을수록 안전) |
| Compliance Score | ≥ 75 | 고객 세무 준수도 |
| Validation Score | ≥ 85 | 세금 데이터 검증 점수 |
| Trust Score | ≥ 70 | 고객 이력 기반 신뢰도 |

---

### 3.4 승인 규칙 설정

**전제조건:** 수퍼바이저 계정 로그인

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "승인 규칙" | 규칙 설정 페이지 표시 |
| 2 | 자동승인 통계 확인 | 총 처리, 자동승인수, 자동승인율, 수동검토 건 |
| 3 | "자동 승인 엔진" 토글 | 활성/비활성 전환 |
| 4 | 임계값 변경 (예: Risk Score → 50) | 입력값 반영 |
| 5 | "규칙 저장" 클릭 | 성공 메시지 |
| 6 | 새로고침 후 저장된 값 확인 | 변경값 유지 |

---

### 3.5 성과 통계 (Performance Statistics)

**전제조건:** 수퍼바이저 계정 로그인

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "성과 통계" | 통계 페이지 표시 |
| 2 | KPI 카드 확인 | 총 완료, 총 실패, 평균 처리시간, 민원수 |
| 3 | 기간 선택 (일별/주별/월별) | 데이터 갱신 |
| 4 | 상담원 순위 테이블 확인 | 순위(🥇🥈🥉), 완료수, 실패수, 성공률, 처리시간, 민원수 |
| 5 | 테이블 헤더 클릭 (정렬) | 선택한 컬럼 기준 정렬 변경 |

---

### 3.6 고객 민원 관리 (Complaints)

**전제조건:** 수퍼바이저 계정 로그인

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "민원 관리" | 민원 페이지 표시 |
| 2 | 요약 카드 확인 | 접수, 처리 중, 해결됨, 종료 건수 |
| 3 | "민원 등록" 클릭 | 등록 폼 표시 |
| 4 | Customer ID, 유형, 제목, 설명, 우선순위 입력 | 필수 필드 체크 |
| 5 | "확인" 클릭 | 민원 생성 + 목록에 추가 |
| 6 | 민원 카드 클릭 → 펼침 | 상세 설명 + 상태 전이 버튼 |
| 7 | "처리 시작" 클릭 | OPEN → IN_PROGRESS |
| 8 | 처리 내용 입력 → "해결 처리" | IN_PROGRESS → RESOLVED |
| 9 | "종료" 클릭 | RESOLVED → CLOSED |

**상태 흐름:** `OPEN → IN_PROGRESS → RESOLVED → CLOSED`

---

### 3.7 고객 납부증빙 업로드

**전제조건:** 고객 계정 로그인 + PAYMENT_PENDING 상태의 큐 아이템

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "납부 현황" | 납부 현황 페이지 표시 |
| 2 | PAYMENT_PENDING 건 확인 | 빨간색 강조 + "지금 업로드" 배지 |
| 3 | 아이템 클릭 → 펼침 | 세금유형, 기간, 금액, e-Billing 코드 표시 |
| 4 | "증빙 업로드 시작" 클릭 | 업로드 폼 표시 |
| 5 | 파일 드래그앤드롭 (JPG/PNG/PDF) | 미리보기 표시 (이미지) 또는 파일명 |
| 6 | 납부 금액, 납부일 입력 | 기본값: 큐 금액, 오늘 날짜 |
| 7 | "증빙 제출" 클릭 | 업로드 진행 → 성공 메시지 |
| 8 | 상태 변화 확인 | PAYMENT_PENDING → PAYMENT_UPLOADED |
| 9 | 상담원 로그인 → 큐 확인 | PAYMENT_UPLOADED 건 표시 + "납부 확인" 버튼 |

---

### 3.8 DJP 연동 자동화

**전제조건:** 상담원 계정 로그인 + PAYMENT_VERIFIED 상태의 큐 아이템

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 큐에서 PAYMENT_VERIFIED 아이템 찾기 | "DJP 제출" 버튼 표시 |
| 2 | "DJP 제출" 클릭 | DJP 잡 큐에 E_FILING 등록 + DJP_SUBMITTED 전환 |
| 3 | (DJP 응답 수신 시) 웹훅 처리 | BPE 번호/날짜 자동 저장 → BPE_UPLOADED |
| 4 | "완료" 클릭 | BPE_UPLOADED → COMPLETED |

> **참고:** 실제 DJP API 연동은 sandbox 환경에서만 테스트 가능. production에서는 DJP_ENABLED=true 필요.

---

### 3.9 실시간 대시보드

**전제조건:** 수퍼바이저 또는 상담원 계정 로그인

| # | 단계 | 예상 결과 |
|---|------|----------|
| 1 | 사이드바 → "상담원 대시보드" | 대시보드 + 차트 표시 |
| 2 | KPI 카드 확인 | 오늘 완료, 평균 처리시간, 자동승인율, 진행중, SLA 경고 |
| 3 | 상태별 분포 PieChart 확인 | 12가지 상태 색상 분포 |
| 4 | 24시간 처리량 AreaChart 확인 | 시간대별 완료 건수 트렌드 |
| 5 | 30초 대기 | "마지막 갱신" 타임스탬프 변경 (자동 갱신) |
| 6 | SLA 경고 확인 | 48시간 초과 건이 있으면 빨간 경고 박스 |

---

### 3.10 알림 시스템

**전제조건:** 각 역할 계정 로그인

| 상태 전환 | 알림 대상 | 확인 방법 |
|-----------|----------|----------|
| → PENDING_APPROVAL | 수퍼바이저 | 종 아이콘(🔔) 배지 숫자 증가 |
| → APPROVED (자동) | 상담원 | 종 아이콘 클릭 → "자동 승인" 알림 |
| → DATA_REVIEW (반려) | 상담원 | 종 아이콘 → "반려" 알림 (HIGH) |
| → PAYMENT_PENDING | 고객 | 종 아이콘 → "납부 요청" 알림 |
| → COMPLETED | 고객 | 종 아이콘 → "신고 완료" 알림 + BPE 번호 |
| → FAILED | 상담원 + 수퍼바이저 | 종 아이콘 → "실패" 알림 (HIGH) |

---

### 3.11 RBAC (역할 기반 접근 제어)

| 테스트 | 계정 | 예상 결과 |
|--------|------|----------|
| 고객 → /operator/workload | customer.test | 403 또는 리다이렉트 |
| 고객 → /operator/queue | customer.test | 403 |
| 상담원 → /operator/workload | operator1.test | 403 (수퍼바이저 전용) |
| 상담원 → /operator/statistics | operator1.test | 403 |
| 상담원 → /operator/approval-rules | operator1.test | 403 |
| 수퍼바이저 → /operator/workload | supervisor.test | 200 ✅ |
| 수퍼바이저 → /operator/statistics | supervisor.test | 200 ✅ |
| 관리자 → /operator/queue | admin.test | 403 (operator 전용) |

---

## 4. E2E 자동 테스트

### 실행 방법

```bash
# 전제조건: dev 서버 + Supabase 실행 중
npm run dev &
supabase start

# 전체 E2E 테스트
npm run test:e2e

# Operator 테스트만
npm run test:e2e:operator

# UI 모드 (브라우저에서 확인)
npm run test:e2e:ui

# 리포트 보기
npm run test:e2e:report
```

### 자동 테스트 커버리지

| 파일 | 테스트 수 | 설명 |
|------|----------|------|
| operator.spec.ts | 19 | 수퍼바이저/상담원/RBAC |
| customer.spec.ts | - | 고객 POA/신고 |
| consultant.spec.ts | - | 컨설턴트 세금 계산 |
| tax-advisor.spec.ts | - | 세무사 신고 제출 |
| platform-admin.spec.ts | - | 관리자 보안 (세금 데이터 접근 차단) |
| system.spec.ts | - | SYSTEM 역할 빌링 |
| audit.spec.ts | - | 감사 로그 |

---

## 5. 테스트 데이터 초기화

```bash
# 기본 테스트 유저 + 데이터
npm run db:seed-test-users

# Operator 테스트 데이터 (상담원 계정 + 큐 아이템)
npx tsx scripts/seed-operator-test.ts

# DB 완전 초기화 (주의: 모든 데이터 삭제)
supabase db reset
```

---

## 6. 전체 워크플로 End-to-End 시나리오

```
1. [상담원] 새 큐 아이템 도착 (PENDING)
   ↓
2. [수퍼바이저] "자동 배분" → 상담원에게 배정
   ↓
3. [상담원] "검토 시작" → DATA_REVIEW
   ↓
4. [상담원] "승인 요청" → Auto-Approval Engine 실행
   ↓
5-A. [자동] 저위험 → APPROVED (수퍼바이저 건너뜀)
5-B. [수퍼바이저] 고위험 → PENDING_APPROVAL → "승인" → APPROVED
   ↓
6. [상담원] "e-Billing 생성" → EBILLING_GENERATED
   ↓
7. [상담원] "고객 통보" → PAYMENT_PENDING + 고객 알림
   ↓
8. [고객] "납부 현황" → 증빙 업로드 → PAYMENT_UPLOADED + 상담원 알림
   ↓
9. [상담원] "납부 확인" → PAYMENT_VERIFIED
   ↓
10. [상담원] "DJP 제출" → DJP_SUBMITTED (DJP 잡 큐 자동 처리)
   ↓
11. [DJP 웹훅] FILING_ACCEPTED → BPE 자동 저장 → BPE_UPLOADED
   ↓
12. [상담원] "완료" → COMPLETED + 고객 알림 (BPE 번호 포함)
```
