# AI Pajak

인도네시아 세금 신고 자동화 플랫폼

## 프로젝트 구조

```
ai-pajak/
├── src/                    # 소스 코드
│   ├── app/               # Next.js App Router
│   │   ├── [locale]/      # 다국어 라우팅 (id/en)
│   │   │   ├── (auth)/    # 인증 페이지
│   │   │   └── (dashboard)/ # 대시보드
│   │   └── api/           # API 라우트
│   ├── components/        # React 컴포넌트
│   │   ├── ui/            # shadcn/ui 컴포넌트
│   │   └── layout/        # 레이아웃 컴포넌트
│   ├── lib/               # 유틸리티 라이브러리
│   │   ├── auth/          # 인증
│   │   ├── tax/           # 세금 계산
│   │   ├── payment/       # 결제
│   │   ├── ai/            # AI 기능
│   │   └── supabase/      # DB 클라이언트
│   ├── types/             # TypeScript 타입
│   ├── i18n/              # 다국어 설정
│   ├── middleware/        # 미들웨어
│   ├── config/            # 설정
│   └── tests/             # E2E 테스트
├── docs/                   # 문서
│   ├── API/               # API 명세
│   ├── ERD/               # 데이터베이스 설계
│   ├── PRD/               # 요구사항 문서
│   ├── UI/                # UI/UX 설계
│   ├── guides/            # 가이드
│   └── specs/             # 기능 스펙
├── supabase/              # Supabase 설정
│   └── migrations/        # DB 마이그레이션
└── public/                # 정적 파일
```

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 테스트
npm test
```

http://localhost:3000 에서 확인

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x (strict mode)
- **Database**: Supabase (PostgreSQL)
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: Supabase Auth
- **i18n**: next-intl

## UI 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| avatar | 사용자 아바타 |
| badge | 상태 배지 |
| button | 버튼 |
| calendar | 날짜 선택 |
| card | 카드 레이아웃 |
| checkbox | 체크박스 |
| dialog | 모달 다이얼로그 |
| dropdown-menu | 드롭다운 메뉴 |
| form | 폼 컴포넌트 |
| input | 입력 필드 |
| label | 레이블 |
| popover | 팝오버 |
| select | 셀렉트 박스 |
| sonner | 토스트 알림 |
| table | 테이블 |
| tabs | 탭 네비게이션 |
