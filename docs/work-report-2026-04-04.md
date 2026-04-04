# AI Pajak 작업 보고서 — 2026-04-04

## 개요

| 항목 | 수치 |
|------|------|
| 커밋 | **34개** |
| 파일 변경 | **91개** |
| 코드 추가 | **11,476줄** |
| 코드 삭제 | **1,184줄** |
| 테스트 | **541개** (478 → 541, +63) |
| Vercel 배포 | **20+회** 모두 성공 |

---

## 1. 킬러 서비스 (19개 구현)

### S-Tier (고객 핵심)
| # | 기능 | 경로 |
|---|------|------|
| 1 | 고객 제출현황 | `/submissions` |
| 2 | 사진→자동신고 (AI OCR) | `/invoice-capture` |

### A-Tier (차별화)
| # | 기능 | 경로 |
|---|------|------|
| 3 | WhatsApp 봇 알림 (Fonnte) | cron 3종 |
| 4 | AI 월간 절세 리포트 | `/tax/monthly-report` |
| 5 | 세금 캘린더 강화 | `/tax/calendar` |
| 6 | 회계SW 연동 UI | `/settings/integrations` |

### B-Tier (프리미엄)
| # | 기능 | 경로 |
|---|------|------|
| 7 | 세무조사 대비 리포트 | `/tax/anomaly` |
| 8 | Transfer Pricing 문서화 | `/tax/transfer-pricing` |
| 9 | 다중 법인 대시보드 | `/tax/multi-entity` |

### C-Tier (편의)
| # | 기능 | 경로 |
|---|------|------|
| 10 | 셀프 온보딩 (NPWP OCR) | 온보딩 위저드 |
| 11 | e-Faktur PPN 검증 | `/tax/efaktur-verify` |
| 12 | PWA 모바일 앱 | SW + 설치 프롬프트 |

### D/E-Tier (확장)
| # | 기능 | 경로 |
|---|------|------|
| 13 | AI 세무 챗봇 | `/chat` |
| 14 | e-SPT XML 생성 | API |
| 15 | UMKM 간편 신고 | `/tax/umkm` |

### F-Tier (프리미엄+)
| # | 기능 | 경로 |
|---|------|------|
| 16 | 세무조사 시뮬레이션 | `/tax/audit-simulation` |
| 17 | 자동 세금 최적화 | `/tax/optimizer` |
| 18 | Referral 프로그램 강화 | `/referral` |
| 19 | 세금 뉴스 큐레이션 (AI) | `/news` |

---

## 2. 품질 활동

### 테스트 (478 → 541)
| 테스트 파일 | 케이스 | 내용 |
|------------|--------|------|
| efaktur-validation | 20 | Faktur 번호 형식/중복/유효성 |
| umkm-calculation | 9 | PP 55/2022 면세 계산 |
| invoice-classify-flow | 14 | 세목 분류→해석 + NPWP 가산 |
| spt-xml-generation | 8 | XML 구조 + 이스케이프 |
| whatsapp-service | 12 | 번호 포맷 + 알림 |
| E2E killer-services | 25 | API 통합 + 보안 + cron |

### 보안
- **export-xml**: requireRole + 소유권 검증 추가 (CRITICAL 수정)
- **npm audit**: 12 → 2 취약점 (xlsx 간접 의존성만 잔존)

### 접근성 (a11y)
- 7개 컴포넌트: aria-label, role, keyboard 지원 추가
- StatusTimeline, InvoiceCaptureFlow, Chat, eFaktur, UMKM, Optimizer, InstallPrompt

### 성능
- cron N+1 쿼리 배치화 (101쿼리 → 2쿼리)
- fmtRp 공통 유틸 추출 (8개 파일 중복 제거)
- 빈 catch 블록 → console.error 로깅 (6개 파일)

### 에러 처리
- error.tsx: 대시보드 + 글로벌 레벨
- ErrorBoundary 컴포넌트
- KillerPageSkeleton 스켈레톤

---

## 3. i18n 로컬라이즈

### 전수검사 (총 약 300개 번역 키 추가)
| 대상 | 키 수 |
|------|------|
| 킬러 서비스 21개 컴포넌트 | ~180 |
| PPN 페이지 | 50 |
| SPT Masa | 20 |
| 월신고 대시보드 | 19 |
| 월별 납부 | 11 |
| 설정 | 17 |
| 월별납부 상세 | 29 |
| 세금 도구 | 7 |
| e-Bupot | 14 |
| 운영자 대시보드 | 10 |
| PPh 21 | 17 |
| 보고서 | 5 |
| 다년도 비교 | 23 |
| 랜딩 AI Features | 16 |
| navDesc 누락 | 11 |

### 지원 locale: ko, en, id, ja, zh (5개)

---

## 4. UI/UX 개선

### 사이드바 재구성
```
- 대시보드
- 세금 뉴스
- ▼ 월 신고 (서브메뉴)
    · 근로소득세 (PPh 21)
    · 원천세 (PPh 23/4(2))
    · 법인소득세 (PPh 25/UMKM)
    · 부가가치세 (PPN)
- ▼ 연 신고 (서브메뉴)
    · 법인 연신고 (SPT Badan)
    · 개인 연신고 (SPT Pribadi)
- 신고 관리 / 문서 / 보고서 / ...
```

### 대시보드 정리
- 삭제: SimpleMode, AI 3개 박스, POA위젯, 빠른작업, 문서업로드/SPT버튼
- 유지: 세금신고현황(상단이동), 마감일, 시작하기, 준수점수, 차트

### 모바일 반응형
- 5개 페이지 그리드 수정 (PPN/PPh21/UMKM/월신고/랜딩)
- 고정 col → 반응형 breakpoint 적용

### 버그 수정
- 월신고 대시보드 무한 로딩 (session 로딩 분리)
- SPT 1771 법인신고 CUSTOMER 접근 오류
- 사이드바 메뉴 동시 활성화 (설정/법인신고)
- ComplianceScore "Skor Kepatuhan" 한글화

---

## 5. 인프라

### WhatsApp (Fonnte)
- 연동 완료 + 인니 번호 발송 테스트 성공
- 환경변수: `FONNTE_API_TOKEN` (Vercel Production)

### Cron 작업 (5종)
| 작업 | 스케줄 |
|------|--------|
| 마감 리마인더 | 매일 08:00 |
| 납부 리마인더 | 매일 09:00 |
| 세금 뉴스 수집 | 매일 07:00 |
| 월간 리포트 | 매월 1일 10:00 |
| 토큰 정리 | 매일 00:00 |

### Admin Cron 관리
- `/admin/cron`: 상태 조회 + 수동 실행 + 활성/비활성 토글
- DB: `cron_settings` 테이블
- Guard: 비활성 cron 자동 skip

### AI 사용량 모니터링
- `/admin/ai-usage`: 추정 비용 + 실제 비용 (ai_usage_log 기반)
- 기능별 호출수/토큰/비용/에러 테이블

### DB 마이그레이션 (4개 추가)
| # | 파일 | 내용 |
|---|------|------|
| 1 | 20260404000001 | tax_calculation 고객 OCR 확장 |
| 2 | 20260404000002 | WhatsApp 알림 (phone/wa_log) |
| 3 | 20260404000003 | tax_news 뉴스 테이블 |
| 4 | 20260404000004 | cron_settings 크론 관리 |

### Vercel 환경변수
| 변수 | 상태 |
|------|------|
| ANTHROPIC_API_KEY | ✅ 설정 (크레딧 $5.50) |
| FONNTE_API_TOKEN | ✅ 설정 |
| CRON_SECRET | ✅ 설정 |
| SUPABASE 3종 | ✅ 기존 |

---

## 6. 프로덕션 URL

https://ai-pajak.vercel.app

---

## 7. 남은 작업 (다음 세션)

### 인프라 (보류)
- Supabase 프로덕션 마이그레이션 일괄 적용
- 커스텀 도메인 (aipajak.com)
- Accurate/Jurnal 연동 완성

### 추가 가능
- SEO 최적화
- 데모 모드 (로그인 없이 체험)
- 이메일 템플릿 디자인
- 온보딩 플로우 개선
