# AI Pajak - 전체 작업 요약서

> 작업 기간: 2026-03-26 ~ 2026-03-29
> 배포 URL: https://ai-pajak.vercel.app
> Repository: https://github.com/changryeul/ai-pajak

---

## 1. 인프라 구축

### Supabase (Database)
- 리모트 프로젝트 연결 (Mumbai 리전)
- 30+ 마이그레이션 파일 적용
- 테스트 유저 4개 역할 시딩 (Customer, Consultant, Tax Advisor, Admin)
- 3개 신규 테이블: `tax_monthly_payment`, `tax_counterparty`, `pph23_transaction`, `ppn_faktur_monthly`, `tax_rate_config`
- RLS 정책 전체 적용

### Vercel (Hosting)
- 프로젝트 연결 + 환경변수 설정
- Production + Preview 환경 분리
- 총 30+ 회 배포
- ANTHROPIC_API_KEY, Supabase 키 등 설정

---

## 2. AI 기능 (6개)

| # | 기능 | 기술 | 파일 |
|---|------|------|------|
| 1 | **SPT Auto-fill** | Claude Vision OCR → 폼 자동 채움 | `SPT1770SSGenerator.tsx`, `ocr-extract/route.ts` |
| 2 | **세금 절약 추천** | 9가지 규칙 + Claude 분석 | `tax-savings-advisor.ts`, `TaxSavingsAdvisor.tsx` |
| 3 | **서류 자동 분류** | Claude Vision → 문서 유형 감지 | `DocumentUploader.tsx`, `ocr-extract/route.ts` |
| 4 | **신고 오류 검증** | 6카테고리 검증 + AI 요약 | `filing-validator.ts`, `SPT1770SSPreview.tsx` |
| 5 | **컨설턴트 리포트** | Claude → 종합 분석 보고서 | `report-generator.ts`, `ClientReportGenerator.tsx` |
| 6 | **AI Tax Chatbot** | Claude 실시간 대화 | `TaxChatbot.tsx`, `chat/route.ts` |

---

## 3. 핵심 세금 기능

### 연간 세금 (SPT Tahunan)
- SPT 1770SS (간단), 1770S (표준), 1770 (사업), 1771 (법인)
- 자동 계산, PDF 생성, BPE QR 코드
- 검증 (6카테고리: 신원, 완전성, 계산, 이상, 준수, 마감일)

### 월별 세금 (SPT Masa)
- PPh 21/23/25, PPN, PPh Final 월별 납부 추적
- 12개월 그리드 UI (납부/미납/연체 시각화)
- NTPN 기록, 연체 자동 감지 + 벌금 계산
- PPh 25 분할 납부 자동 생성

### 거래 상대방 관리
- Vendor/Client/Employee NPWP 관리
- PPh 23 거래 내역 (9가지 서비스 유형, NPWP 없으면 2배 세율)
- PPN Faktur 매칭 (Keluaran vs Masukan, Net PPN 자동 계산)

### 세율 관리 (Admin)
- PPh 21 누진세 (5단계), PPh 23 (8유형), PTKP (12상태)
- PPN, PPh Final, 법인세, PPh 22 수입, NPWP 할증
- Admin이 인라인 수정 가능

---

## 4. 플랫폼 기능

### Phase 4 (18개)
| 카테고리 | 기능 |
|----------|------|
| **AI** | Chatbot, Anomaly Detection, Predictive Planning, Document Summarizer |
| **비즈니스** | Multi-Entity, Referral Program, Consultant Marketplace, Usage Billing |
| **커뮤니케이션** | In-App Chat, WhatsApp Integration, Email Templates |
| **세금 고급** | Transfer Pricing (AI), Tax Calendar, Customs Tax, Regional Tax |
| **분석** | Industry Benchmarking, Cash Flow Forecasting, Compliance Score |

### 외부 연동
- **Accurate Online** - OAuth2, 직원/급여/재무제표 동기화
- **Jurnal.id (Mekari)** - OAuth2, COA/인보이스/보고서 동기화
- **Bank Account (Brick)** - 6개 은행, 자동 매출 추적
- **E-commerce** - Shopee/Tokopedia/TikTok CSV 가져오기
- **DJP** - e-Filing, e-Billing, NPWP 검증
- **Midtrans** - 결제 게이트웨이

### Enterprise
- Public API (`/api/v1/tax/calculate`) - API 키 인증
- PPh 21 + Bulk 계산 지원

---

## 5. Admin 기능 (7개)

| # | 기능 | 경로 |
|---|------|------|
| 1 | 시스템 모니터링 | `/admin/monitoring` |
| 2 | 사용자 관리 | `/admin/users` |
| 3 | 구독/결제 관리 | `/admin/billing` |
| 4 | 컨설턴트 관리 | `/admin/consultants` |
| 5 | 감사 로그 | `/admin/audit-logs` |
| 6 | 세율 관리 | `/admin/tax-rates` |
| 7 | 플랫폼 통계 | `/dashboard` (Admin) |

---

## 6. UI/UX 디자인

### 리디자인 (7개 페이지)
- 대시보드: 그라디언트 히어로, AI 바로가기, 호버 애니메이션
- 로그인: backdrop-blur, 그라디언트 버튼
- 사이드바: 그라디언트 활성 메뉴, AI 배지
- 랜딩 페이지: 고정 네비, AI 기능 섹션
- SPT 선택: 그라디언트 아이콘, hover lift
- 고객 목록: 그라디언트 아바타
- 설정: 그라디언트 탭

### "사진 찍으면 끝" 간편 모드
- 대시보드 최상단 "Foto Slip Gaji" 버튼
- AI OCR → 데이터 확인 → SPT 완성 (3단계)
- 쉬운 인도네시아어 (세금 용어 → 일상 표현)
- 예시 이미지 안내 (1721-A1이 뭔지)

### 온보딩
- 5단계 위저드 (유형 → 목표 → AI 기능 소개 → 추천)
- 대시보드 시작 가이드 체크리스트 (5단계)
- "다음 할 일" 위저드 (6단계 진행 상황)

---

## 7. 국제화 (i18n)

- **5개 언어**: Indonesian, English, Korean, Japanese, Chinese
- **220+ 번역 키** (4배치에 걸쳐 추가)
- **적용 파일**: 23+ 페이지/컴포넌트
- **섹션**: common, nav, dashboard, guide, calendar, help, integrations, platformStats, pages, spt, sptSelect, taxSavingsPage, months

---

## 8. SEO & PWA

- `robots.txt` - 공개/비공개 경로 분리
- `sitemap.ts` - 5언어 x 5페이지 동적 생성
- OpenGraph / Twitter Card 메타 태그
- JSON-LD 구조화 데이터 (SoftwareApplication)
- PWA manifest + 아이콘 (192/512)
- OG 이미지 (1200x630 SVG)

---

## 9. 성능 최적화

- `optimizePackageImports` (lucide, recharts, radix)
- Dynamic imports (Charts, ClientList, PlatformStats)
- 이미지 AVIF/WebP + 30일 캐시
- Static assets immutable 캐시 (1년)
- 최대 청크: 402KB → 309KB (-23%)

---

## 10. 테스트

- **유닛 테스트**: 322/322 통과 (15 파일)
  - PPh 21/23/PPN 계산기
  - SPT 1770SS/S/1770/1771 계산기
  - DJP 서비스, Logger, Resilience
  - Banking 서비스
- **E2E 테스트**: 106/127 통과 (83%)
  - RBAC 보안, Audit Trail, Tax Filing, POA, Payment

---

## 11. 보안

### 6 Hard Rules (DB + API 레벨)
1. PLATFORM_ADMIN은 고객 세금 데이터 접근 불가
2. Consultant은 JTC 소속이어야 함
3. Tax Filing Actor ≠ Platform
4. Billing Collector ≠ Service Provider
5. Audit Trail 필수 (immutable)
6. POA를 통한 법적 위임

### 구현
- `blockPlatformAdmin` 미들웨어
- Row Level Security (RLS) 47+ 정책
- `withAudit` 미들웨어
- `composeMiddleware` 패턴

---

## 12. 파일 통계

- **총 커밋**: 40+
- **파일 변경**: 600+
- **코드 추가**: 130,000+ 줄
- **API 엔드포인트**: 45+
- **UI 페이지**: 35+
- **컴포넌트**: 50+

---

## 13. 테스트 계정

| Role | Email | Password |
|------|-------|----------|
| 납세자 | customer.test@example.com | TestPassword123! |
| 컨설턴트 | consultant.test@jakartatax.co.id | TestPassword123! |
| 세무사 | advisor.test@jakartatax.co.id | TestPassword123! |
| 관리자 | admin.test@aipajak.com | TestPassword123! |

---

## 14. 향후 과제

| 우선순위 | 항목 |
|---------|------|
| 긴급 | Anthropic API 키 재발급 |
| 높음 | 실사용자 베타 테스트 (100명) |
| 높음 | DJP ASP 인증 신청 |
| 중간 | 커스텀 도메인 (app.aipajak.com) |
| 중간 | SimpleMode를 처음 사용자에게만 표시 |
| 중간 | 모바일 최적화 강화 |
| 낮음 | React Native 앱 개발 |
| 낮음 | Sentry 에러 모니터링 연동 |
