# 매뉴얼 스크린샷 수집 체크리스트

> **목적**: 역할별 매뉴얼에 삽입할 스크린샷을 수동으로 수집하기 위한 가이드
>
> **왜 수동인가**: UI가 아직 자주 변경되는 BETA+ 단계라 자동화 캡처는 빠르게 구식이 됩니다. GA 직전에 Playwright 스크립트로 전환 예정입니다.
>
> **저장 위치**: `docs/manuals/images/{role}/{###-name}.png`

## 공통 촬영 규칙

- **해상도**: 1440×900 또는 1920×1080 (데스크톱 표준)
- **브라우저**: Chrome (Edge 가능). 시크릿 모드로 확장 프로그램 제거
- **언어**: 한국어 locale (`/ko/...`)
- **데이터**: 로컬 Supabase 시드 데이터 사용 (실고객 데이터 절대 금지)
- **개인정보 마스킹**: NPWP, 이메일, 전화번호는 X 처리 또는 블러
- **파일명**: `01-dashboard.png`, `02-sidebar.png` 식의 순번 + 영문 slug
- **포맷**: PNG, 손실 압축 없이

## 01. 법인 납세자 (`docs/manuals/images/corporate/`)

| # | 스크린 | 경로 |
|---|---|---|
| 01 | 회원가입 — 법인 선택 | `/ko/register` |
| 02 | 첫 로그인 대시보드 | `/ko/dashboard` |
| 03 | 회사 프로필 입력 | `/ko/company-profile` |
| 04 | 사이드바 — 월 신고 그룹 | 좌측 메뉴 전체 |
| 05 | PPh21 입력 화면 | `/ko/tax/pph21` |
| 06 | PPN Faktur 업로드 | `/ko/tax/ppn` |
| 07 | 인보이스 캡처 OCR 결과 | `/ko/invoice-capture` |
| 08 | 제출 현황 큐 | `/ko/submissions` |
| 09 | 요금제 선택 (UMKM/Basic/Pro) | `/ko/pricing` (로그인 상태) |
| 10 | `CurrentPlanWidget` — 추천 | 대시보드 우측 |

## 02. 외부 세무 사무소 (`docs/manuals/images/external/`)

| # | 스크린 | 경로 |
|---|---|---|
| 01 | 사무소 회원가입 | `/ko/register` (외부 옵션) |
| 02 | 첫 로그인 — Tier 미선택 상태 | `/ko/dashboard` |
| 03 | Tier 선택 (Starter/Growth/Enterprise) | `/ko/pricing` (CONSULTANT 탭) |
| 04 | 고객 목록 (비어 있음) | `/ko/customers` |
| 05 | 신규 고객 추가 다이얼로그 | `/ko/customers` + "추가" |
| 06 | 고객 상세 — 프로필 탭 | `/ko/customers/[id]` |
| 07 | 월 대시보드 — 다중 고객 | `/ko/tax/monthly-dashboard` |
| 08 | 일괄 PPh21 (Growth 이상) | `/ko/tax/pph21-bulk` |
| 09 | `ConsultantTierWidget` 상태 | 대시보드 우측 |
| 10 | 팀 관리 | `/ko/admin/team` |

## 03. 개인 납세자 (`docs/manuals/images/individual/`)

| # | 스크린 | 경로 |
|---|---|---|
| 01 | 회원가입 — 개인 | `/ko/register` |
| 02 | 개인 대시보드 | `/ko/dashboard` |
| 03 | SPT 양식 선택 도우미 | `/ko/tax/spt-tahunan` |
| 04 | A1 OCR 업로드 화면 | `/ko/documents/upload` |
| 05 | 1770S 입력 — 소득 스텝 | `/ko/tax/spt-tahunan/1770s` |
| 06 | 계산 요약 — 환급 표시 | 위 화면 마지막 스텝 |
| 07 | 결제 화면 — Midtrans | 제출 직후 |
| 08 | 완료 — BPE PDF | `/ko/filings` |

## 04. 운영팀 (`docs/manuals/images/operator/`)

| # | 스크린 | 경로 | 권한 |
|---|---|---|---|
| 01 | 운영자 대시보드 | `/ko/operator/dashboard` | Operator+ |
| 02 | 제출 큐 목록 — DATA_REVIEW | `/ko/operator/queue?status=DATA_REVIEW` | Operator+ |
| 03 | 큐 항목 상세 — 검토 화면 | `/ko/operator/queue/[id]` | Operator+ |
| 04 | 승인 대기 큐 | `/ko/operator/queue?status=PENDING_APPROVAL` | Supervisor+ |
| 05 | 승인/반려 모달 | 위 화면 액션 | Supervisor+ |
| 06 | 업무 분배 | `/ko/operator/workload` | Supervisor+ |
| 07 | 운영자 통계 | `/ko/operator/statistics` | Supervisor+ |
| 08 | **마스터 대시보드 — KPI** | `/ko/admin/master` | Master |
| 09 | **Pro 초과 고객 목록** | 위 화면 섹션 | Master |
| 10 | **맞춤 가격 생성 폼** | `/ko/admin/master/custom-pricing` | Master |

## 05. JTC 세무사 (`docs/manuals/images/jtc/`)

| # | 스크린 | 경로 |
|---|---|---|
| 01 | JTC 대시보드 (내 고객 카드) | `/ko/dashboard` |
| 02 | 고객 목록 | `/ko/customers` |
| 03 | 고객 상세 — 메모/POA 탭 | `/ko/customers/[id]` |
| 04 | 월 대시보드 교차표 | `/ko/tax/monthly-dashboard` |
| 05 | 일괄 PPh21 결과 | `/ko/tax/pph21-bulk` |
| 06 | 이상 탐지 결과 | `/ko/tax/anomaly` |
| 07 | 이전가격 분석 | `/ko/tax/transfer-pricing` |
| 08 | 팀 관리 (ADVISOR 전용) | `/ko/admin/team` |
| 09 | 클라이언트 리포트 생성 | `/ko/tax/report` |

## 06. 플랫폼 관리자 (`docs/manuals/images/admin/`)

| # | 스크린 | 경로 |
|---|---|---|
| 01 | Admin 대시보드 | `/ko/admin/monitoring` |
| 02 | 시스템 모니터링 — Circuit Breaker | 위 화면 스크롤 |
| 03 | 사용자 관리 | `/ko/admin/users` |
| 04 | 역할 편집 다이얼로그 | 사용자 목록 → 편집 |
| 05 | 외부 사무소 승인 대기 | `/ko/admin/consultants` |
| 06 | 감사 로그 검색 | `/ko/admin/audit-logs` |
| 07 | AI 사용량 차트 | `/ko/admin/ai-usage` |
| 08 | 세율 설정 | `/ko/admin/tax-rates` |
| 09 | 크론 관리 | `/ko/admin/cron` |
| 10 | 사이드바 — 관리자 전용 섹션 | 좌측 메뉴 |

## 촬영 후 적용 절차

1. `docs/manuals/images/{role}/*.png` 에 저장
2. 해당 매뉴얼 `*.md`에 이미지 삽입:
   ```markdown
   ![법인 대시보드](./images/corporate/02-dashboard.png)
   ```
3. 이미지는 **섹션 끝**에 놓고 **다음 문단이 시작되기 전에 배치** (렌더링 시 텍스트 흐름 방해 최소화)
4. 이미지마다 **캡션**(alt text)을 간결하게 작성 — 스크린리더·SEO·이미지 로드 실패 대응
5. `/help/manuals/[role]` 라우트에서도 자동으로 표시됨 (react-markdown이 이미지 렌더링 지원)

## 촬영 담당자를 위한 팁

- **같은 데이터**로 모든 화면을 연달아 찍으면 연속성이 살아납니다
- **사이드바 하이라이트**: 해당 메뉴 항목이 활성(파란 배경) 상태로 찍어 독자가 위치를 알 수 있게
- **모달**: 배경을 흐리게 놔두고 모달만 선명하게
- **표/데이터**: 너무 적지도 많지도 않게, 5~8행이 읽기 좋음
- **다크모드**: 현재 버전은 라이트 모드 기본. 다크 모드 스크린샷은 GA 이후
- **브라우저 UI 제거**: 주소 바·탭 바를 포함하지 말고 앱 영역만 크롭

---

**체크리스트 버전**: 2026-04-11 v1
**자동화 전환 예정 시점**: UI 안정화(GA) 단계
