# AI Pajak - 작업 요약서

> 작성일: 2026-03-26
> 브랜치: `001-initial-setup`
> 커밋: `fca9418`
> 배포: https://ai-pajak-k4occcu0p-lcr123s-projects.vercel.app

---

## 1. 인프라 설정

### 1.1 Supabase 리모트 DB
- 기존 프로젝트 (`hqcjeenfhlaxwteqzzcf`, South Asia Mumbai) 연결 확인
- 28개 마이그레이션 파일 모두 최신 상태
- 테스트 유저 4개 역할 시딩 완료

| Role | Email | Password |
|------|-------|----------|
| CUSTOMER | customer.test@example.com | TestPassword123! |
| CONSULTANT_JTC | consultant.test@jakartatax.co.id | TestPassword123! |
| TAX_ADVISOR_JTC | advisor.test@jakartatax.co.id | TestPassword123! |
| PLATFORM_ADMIN | admin.test@aipajak.com | TestPassword123! |

### 1.2 Vercel 배포
- 프로젝트: `lcr123s-projects/ai-pajak`
- 리전: sin1 (Singapore)
- 빌드: Next.js 16.1.0 (Turbopack)

**환경 변수 설정 (Production + Preview):**

| 변수 | 상태 |
|------|------|
| NEXT_PUBLIC_SUPABASE_URL | 설정됨 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 설정됨 |
| SUPABASE_SERVICE_ROLE_KEY | 설정됨 |
| ANTHROPIC_API_KEY | 설정됨 |
| NEXT_PUBLIC_APP_URL | 설정됨 |
| TWO_FACTOR_ENCRYPTION_KEY | 설정됨 |
| SESSION_SECRET | 설정됨 |
| DATABASE_URL | 설정됨 |
| DJP_API_URL | 설정됨 |
| RESEND_API_KEY | Production만 |
| NEXT_PUBLIC_SENTRY_DSN | Production만 |

---

## 2. AI 기능 구현 (5개)

### 2.1 SPT 1770SS 자동 작성 (OCR → Auto-fill)

**흐름:**
```
문서 업로드 → AI OCR (Claude Vision) → 데이터 추출 → 폼 자동 채움 → SPT 생성
```

**주요 파일:**
| 파일 | 설명 |
|------|------|
| `src/components/spt/SPT1770SSGenerator.tsx` | 3단계 플로우 (Upload → Form → Preview) |
| `src/app/api/documents/ocr-extract/route.ts` | 직접 OCR API (DB 저장 불필요) |
| `src/components/ocr/DocumentOCRUploader.tsx` | OCR 업로더 컴포넌트 |

**기능:**
- 1721-A1 문서 (PDF/이미지) 드래그&드롭 업로드
- Claude Vision으로 데이터 자동 추출 (고용주, 소득, 세금 등)
- 복수 문서 업로드 지원 (복수 고용주)
- 추출 데이터 미리보기 + 수정 가능
- PTKP 상태, 세금 연도 자동 감지
- sessionStorage로 상태 유지 (페이지 이동 시 데이터 보존)

### 2.2 세금 절약 추천

**흐름:**
```
고객 소득 데이터 → 규칙 기반 분석 (9개 항목) → AI 종합 분석 → 추천 목록
```

**주요 파일:**
| 파일 | 설명 |
|------|------|
| `src/lib/ai/tax-savings-advisor.ts` | 분석 엔진 (규칙 + AI) |
| `src/app/api/tax/savings-advice/route.ts` | API 엔드포인트 |
| `src/components/tax/TaxSavingsAdvisor.tsx` | UI 컴포넌트 |
| `src/app/[locale]/(dashboard)/tax/savings/page.tsx` | 페이지 |

**규칙 기반 검사 항목:**
1. PTKP 최적화 (결혼 상태)
2. PTKP 부양가족 추가
3. 배우자 소득 합산 (K/I)
4. 비아야 자바탄 최적화
5. 이우란 펜시운 / BPJS
6. 자캇 공제
7. UMKM 특별 세율 (PP 55/2022)
8. 과다 원천징수 환급
9. BPJS 케세하탄

**출력:** 현재 세금 vs 최적 세금 비교, 항목별 절감액, 난이도, 법적 근거, AI 종합 요약

### 2.3 서류 자동 분류

**흐름:**
```
문서 업로드 → AI 분류 (Claude Vision) → 유형 자동 감지 → DB 저장 → 목록 표시
```

**주요 파일:**
| 파일 | 설명 |
|------|------|
| `src/components/documents/DocumentUploader.tsx` | Auto-detect 모드 추가 |
| `src/components/documents/DocumentList.tsx` | AI 분류 결과 표시 |
| `src/app/api/documents/upload/route.ts` | document 테이블에 분류 저장 |
| `src/app/api/documents/route.ts` | standalone docs 병합 조회 |

**지원 문서 유형:**
- BUKTI_POTONG (PPh 21/23)
- FAKTUR_PAJAK (PPN)
- LAPORAN_KEUANGAN
- KTP / NPWP_CARD
- SPT

**저장:** `document.metadata.ai_classification` (category, confidence)

### 2.4 신고 오류 검증

**흐름:**
```
SPT 데이터 → 6개 카테고리 검증 → 스코어 (0-100) → AI 요약
```

**주요 파일:**
| 파일 | 설명 |
|------|------|
| `src/lib/ai/filing-validator.ts` | 검증 엔진 (규칙 + AI) |
| `src/app/api/tax/validate/route.ts` | API 엔드포인트 |
| `src/components/spt/SPT1770SSPreview.tsx` | "Validasi SPT" 버튼 + 결과 표시 |

**검증 카테고리:**
| 카테고리 | 검사 내용 |
|----------|----------|
| IDENTITY | NPWP 형식, NIK 16자리, 이름 누락 |
| COMPLETENESS | 소득원 누락, 고용주 NPWP, 부분 기간 |
| CALCULATION | 브루토/네토 합계, PTKP, PKP, 누진세 재계산 |
| ANOMALY | 고세율, 잘못된 폼, 복수 고용주, 과다 환급, 중복 고용주 |
| COMPLIANCE | 네토>브루토, 과도한 원천징수 |
| DEADLINE | 신고 기한 경과/임박 |

**출력:** 스코어, ERROR/WARNING/INFO 이슈 목록, AI 요약, sessionStorage 캐싱

### 2.5 컨설턴트 리포트 자동 생성

**흐름:**
```
고객 선택 → 소득 데이터 수집 → 섹션별 리포트 생성 → AI 분석 → 프린트 가능
```

**주요 파일:**
| 파일 | 설명 |
|------|------|
| `src/lib/ai/report-generator.ts` | 리포트 생성 엔진 |
| `src/app/api/tax/report/route.ts` | API 엔드포인트 |
| `src/components/tax/ClientReportGenerator.tsx` | UI 컴포넌트 |
| `src/app/[locale]/(dashboard)/tax/report/page.tsx` | 페이지 |

**리포트 섹션:**
1. 프로필 (NPWP, NIK, PTKP)
2. 소득 요약 (고용주별 브루토/네토/PPh 테이블)
3. 세금 계산 (누진세, 상태)
4. 신고 이력
5. AI 분석 & 추천 (링카산 에크세쿠티프, 분석, 최적화, 체크리스트)

**프린트:** `window.print()` 지원, print CSS 최적화

---

## 3. UI/UX 디자인 개선 (7개 페이지)

### 디자인 시스템

| 요소 | 스타일 |
|------|--------|
| 아이콘 배경 | `bg-gradient-to-br` + shadow |
| 카드 | `border-0 shadow-sm` + `hover:shadow-md` |
| 활성 메뉴 | `from-blue-600 to-indigo-600` 그라디언트 |
| 호버 효과 | `-translate-y-0.5` + 아이콘 `scale-110` |
| 모서리 | `rounded-xl` / `rounded-2xl` |
| AI 표시 | 골드 "AI" 배지, Sparkles 아이콘 |

### 페이지별 개선 내용

**1. 대시보드 (`/dashboard`)**
- 역할별 그라디언트 히어로 헤더 (고객: 블루, 컨설턴트: 다크, 관리자: 오렌지)
- AI 기능 바로가기 카드 (SPT Auto-fill, 절세, AI 분류/리포트)
- 통계 카드 호버 시 아이콘 확대 + 카드 리프트
- Quick Actions 그라디언트 아이콘

**2. 로그인 (`/login`)**
- 히어로 배경 장식 원형 + backdrop-blur
- 로그인 카드 shadow-xl, border-0
- 그라디언트 로그인 버튼 + shadow
- 기능 아이콘 호버 효과

**3. 사이드바**
- 그라디언트 로고 (blue→indigo) + shadow
- 활성 메뉴: 블루 그라디언트 배경 + shadow
- AI 메뉴에 골드 "AI" 배지
- 역할 뱃지 그라디언트 + 테두리
- 로그아웃 호버 시 빨간색 강조

**4. 랜딩 페이지 (`/`)**
- 고정 네비게이션 + backdrop-blur
- 히어로 블러 장식 + Sparkles 배지
- **새 AI 기능 섹션** (4개 AI 기능 카드)
- 통계 숫자 그라디언트 텍스트
- 프라이싱 인기 플랜 scale-105
- CTA 장식 원형

**5. SPT 폼 선택 (`/tax/spt-tahunan`)**
- AI Auto-fill Available 배지
- 카드 호버 시 리프트 + shadow-xl
- 그라디언트 아이콘 + 호버 확대
- 도움말 카드 그라디언트 배경

**6. 고객 목록 (`/customers`)**
- 통계 카드 그라디언트 아이콘 + 호버 확대
- 아바타 그라디언트 (개인: 블루, 법인: 퍼플)
- 카드 border-0 shadow-sm

**7. 설정 (`/settings`)**
- 활성 탭 그라디언트 (blue→indigo) + shadow
- 각 탭 아이콘 색상 차별화 (프로필: 블루, 보안: 그린, 알림: 앰버, 언어: 퍼플)

---

## 4. 기타 변경사항

### 네비게이션 메뉴 추가
- `nav.taxSavings`: "Hemat Pajak (AI)" (5개 언어)
- `nav.clientReport`: "Laporan Klien (AI)" (5개 언어)

### 테스트 도구
| 파일 | 설명 |
|------|------|
| `scripts/generate-sample-1721a1.ts` | 샘플 1721-A1 PDF 생성 (2개) |
| `scripts/seed-tax-data.ts` | 테스트 소득 데이터 시딩 |
| `test-data/sample-1721-A1.pdf` | 주 고용주 샘플 (Rp 237.6M) |
| `test-data/sample-1721-A1-second-employer.pdf` | 부 고용주 샘플 (Rp 150M) |

### API 엔드포인트 추가

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/documents/ocr-extract` | 직접 OCR 처리 |
| POST | `/api/tax/savings-advice` | 세금 절약 분석 |
| POST | `/api/tax/validate` | SPT 검증 |
| POST | `/api/tax/report` | 클라이언트 리포트 생성 |

---

## 5. 기술 스택 사용

| 기술 | 용도 |
|------|------|
| Claude Vision (Sonnet) | 문서 OCR, PDF 분석, 서류 분류 |
| Claude (Sonnet) | 세금 분석 요약, 리포트 생성, 검증 요약 |
| Supabase Storage | 문서 파일 저장 |
| Supabase DB | 분류 결과 저장 (document.metadata) |
| sessionStorage | SPT 폼 상태 유지, 검증 결과 캐싱 |
| Tailwind CSS 4 | 그라디언트, 애니메이션, 반응형 디자인 |

---

## 6. 미완료 / 후속 작업

| 항목 | 상태 | 설명 |
|------|------|------|
| API 키 재발급 | 필요 | 대화에 노출된 Anthropic 키 교체 |
| 커스텀 도메인 | 보류 | `app.aipajak.com` DNS 설정 필요 (가비아) |
| Midtrans 결제 | 미설정 | Sandbox 키 Vercel 설정 필요 |
| Upstash Redis | 미설정 | Rate Limiting용 |
| E2E 테스트 | 미실행 | 리모트 URL 대상 Playwright 테스트 |
| SPT 1770S/1770/1771 Auto-fill | 미구현 | 1770SS만 구현됨 |
| 다국어 실시간 번역 | 미구현 | AI 기반 세금 용어 번역 |
| 세무 조사 리스크 예측 | 미구현 | 장기 과제 |
| e-Faktur 자동 매칭 | 미구현 | 장기 과제 |

---

## 7. 파일 변경 통계

```
35 files changed
+5,071 lines added
-731 lines removed

신규 파일: 15개
수정 파일: 20개
```
