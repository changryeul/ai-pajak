# AI Pajak - 프로젝트 문서

> 배포: https://ai-pajak.vercel.app
> 마지막 업데이트: 2026-07-02

---

## 문서 안내

- [사용자·역할·조직 정리](guides/roles.md) — 조직 3종 + 역할 9개 이론·설계
- [계정·역할 지도 (실사)](guides/accounts.md) — 지금 프로덕션에 실제로 있는 계정 인벤토리
- [아키텍처](guides/architecture.md) · [Resilience 패턴](guides/resilience-patterns.md)
- [역할별 사용 매뉴얼](manuals/README.md) — 고객·컨설턴트·운영팀·관리자별 상세
- [설정 · 테스트 가이드](guides/SETUP.md) · [테스트 시나리오](guides/TEST_SCENARIO.md)
- [기능 계획서](01-plan/) · [PRD](PRD/) · [API](API/) · [ERD](ERD/)

---

## 테스트 계정

| Role | Email | Password |
|------|-------|----------|
| 납세자 | customer.test@example.com | TestPassword123! |
| 컨설턴트 | consultant.test@jakartatax.co.id | TestPassword123! |
| 세무사 | advisor.test@jakartatax.co.id | TestPassword123! |
| 관리자 | admin.test@aipajak.com | TestPassword123! |

---

## 로컬 개발

```bash
npm install
supabase start
npm run dev          # http://localhost:3000
npm test             # 유닛 테스트 (322개)
npm run build        # 프로덕션 빌드
```

### 필수 환경 변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=
```

---

## 기능 요약

### 고객
- **"사진 찍으면 끝"** - 1721-A1 사진 → AI OCR → SPT 자동 완성
- SPT 1770SS/S/1770 연간 신고
- 월별 세금 납부 (PPh 21/23/25, PPN)
- 절세 추천 / 문서 AI 분류 / AI 챗봇

### 컨설턴트
- 클라이언트 대시보드 + PPh 21 Bulk + e-Bupot 일괄
- 이상 감지 / 리포트 / Transfer Pricing (AI)

### 관리자
- 사용자 / 결제 / 컨설턴트 / 세율 / 감사 로그

---

## 기술 스택

Next.js 16 · TypeScript · Supabase · Claude AI · Tailwind 4 · Midtrans · Vercel · 5개 언어

---

## 보안 (6 Hard Rules)

1. Admin은 세금 데이터 접근 불가
2. Consultant은 JTC 소속 필수
3. 세금 신고 = 컨설턴트만
4. 과금 = 시스템만
5. 감사 로그 immutable
6. POA 법적 위임

---

## 주요 API

| Path | 설명 |
|------|------|
| `POST /api/documents/ocr-extract` | AI OCR |
| `POST /api/tax/spt/1770ss` | SPT 생성 |
| `POST /api/tax/validate` | SPT 검증 |
| `POST /api/tax/savings-advice` | 절세 분석 |
| `POST /api/chat` | AI 챗봇 |
| `GET/POST /api/tax/monthly-payments` | 월별 납부 |
| `GET/PUT /api/admin/tax-rates` | 세율 관리 |
| `POST /api/v1/tax/calculate` | Enterprise API |

---

## 향후 과제

1. API 키 재발급 (보안)
2. 베타 테스트 (100명)
3. DJP ASP 인증
4. 커스텀 도메인
5. 모바일 UX 최적화
