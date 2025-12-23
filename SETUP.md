# AI PAJAK - 개발 환경 설정 가이드

## 빠른 시작 (Quick Start)

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저에서 열기
# http://localhost:3000
```

## 환경 설정 완료 ✅

프로젝트가 즉시 실행 가능하도록 다음 설정이 완료되었습니다:

### 1. 개발 환경 변수 (.env.local)
- ✅ 기본 설정 완료 (인증 비활성화 모드)
- ✅ 로컬 개발에 최적화
- ⚠️ 선택적 서비스는 필요시 API 키 입력

### 2. 개발 모드 특징
- **인증 우회**: `middleware.ts`에서 개발 모드에서는 인증 체크 비활성화
- **플레이스홀더 Supabase**: 실제 Supabase 없이도 UI 개발 가능
- **즉시 실행**: 추가 설정 없이 바로 테스트 가능

## 프로젝트 구조

```
ai-pajak/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [locale]/          # 다국어 라우팅 (id, en, ko, ja, zh)
│   │   │   ├── (auth)/        # 인증: /login, /register
│   │   │   └── (dashboard)/   # 대시보드
│   │   └── api/               # API Routes
│   │       ├── auth/          # 인증 API
│   │       ├── tax/           # 세금 계산 API
│   │       ├── ocr/           # OCR API
│   │       ├── payment/       # 결제 API
│   │       └── djp/           # DJP 통합 API
│   │
│   ├── components/            # React 컴포넌트
│   ├── lib/                   # 핵심 라이브러리
│   │   ├── tax/              # 세금 계산기 (PPh21, PPh23, PPN)
│   │   ├── ai/               # AI 서비스 (OCR, Assistant)
│   │   ├── supabase/         # Supabase 클라이언트
│   │   ├── payment/          # Midtrans 결제
│   │   └── djp/              # DJP API
│   │
│   ├── i18n/                 # 국제화 (5개 언어)
│   ├── types/                # TypeScript 타입
│   └── config/               # 설정 및 상수
│
├── .env.local                # 환경 변수 (설정 완료 ✅)
└── package.json
```

## 사용 가능한 페이지

개발 서버 실행 후 다음 URL에 접속할 수 있습니다:

### 인도네시아어 (기본)
- http://localhost:3000/id
- http://localhost:3000/id/login
- http://localhost:3000/id/register
- http://localhost:3000/id/dashboard

### 한국어
- http://localhost:3000/ko
- http://localhost:3000/ko/login
- http://localhost:3000/ko/register
- http://localhost:3000/ko/dashboard

### 영어
- http://localhost:3000/en

### 일본어
- http://localhost:3000/ja

### 중국어
- http://localhost:3000/zh

## NPM 스크립트

```bash
# 개발 서버 실행 (Hot Reload)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# Lint 검사
npm run lint
```

## 선택적 설정 (Optional)

프로젝트는 현재 상태로 실행 가능하지만, 다음 기능을 사용하려면 API 키가 필요합니다:

### 1. Supabase (인증 & 데이터베이스)
실제 사용자 인증을 활성화하려면:

1. https://supabase.com 에서 프로젝트 생성
2. `.env.local`에 다음 값 입력:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. `src/middleware.ts`에서 `isDev` 조건 제거

### 2. AI 서비스 (OCR & Chat)

**OpenAI (GPT-4 Vision OCR)**
```
OPENAI_API_KEY=sk-your-key
```

**Anthropic Claude (Chat Assistant)**
```
ANTHROPIC_API_KEY=sk-ant-your-key
```

**Google Cloud Vision (OCR)**
```
GOOGLE_CLOUD_API_KEY=your-key
```

### 3. Midtrans (결제)
인도네시아 결제 연동:
```
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your-client-key
MIDTRANS_SERVER_KEY=your-server-key
MIDTRANS_MERCHANT_ID=your-merchant-id
```

### 4. DJP API (인도네시아 세무청)
세금 신고 연동:
```
DJP_API_KEY=your-key
DJP_API_SECRET=your-secret
```

## 주요 기능

### 1. 세금 계산
- **PPh 21**: 근로소득세 (누진세율 5-35%)
- **PPh 23**: 원천징수세 (배당, 이자, 로열티 등)
- **PPN**: 부가가치세 (11%)
- **SPT Tahunan**: 연간 소득세 신고

### 2. 다국어 지원
- 인도네시아어 (id) - 기본
- 영어 (en)
- 한국어 (ko)
- 일본어 (ja)
- 중국어 (zh)

### 3. AI 기능
- OCR: 세금 문서 자동 인식
- Tax Assistant: AI 세금 상담

## 기술 스택

- **프레임워크**: Next.js 16.1.0 (App Router + Turbopack)
- **언어**: TypeScript 5
- **UI**: React 19.2.3 + Tailwind CSS 4
- **상태 관리**: Zustand + TanStack Query
- **폼**: React Hook Form + Zod
- **국제화**: next-intl
- **백엔드**: Supabase
- **AI**: OpenAI, Anthropic, Google Cloud

## 문제 해결

### macOS 보안 경고 (Operation not permitted)
macOS에서 파일 격리 문제가 발생하면:
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 빌드 실패
```bash
# 캐시 정리 후 재빌드
rm -rf .next
npm run build
```

### 포트 충돌
기본 포트(3000)가 사용 중이면:
```bash
PORT=3001 npm run dev
```

## 다음 단계

1. ✅ **개발 서버 실행**: `npm run dev`
2. 🌐 **브라우저에서 확인**: http://localhost:3000/id
3. 📝 **코드 수정**: 파일 저장 시 자동 리로드
4. 🔐 **인증 활성화**: Supabase 설정 (선택사항)
5. 🤖 **AI 기능 테스트**: API 키 입력 (선택사항)

## 지원

- 문서: [Next.js Docs](https://nextjs.org/docs)
- Supabase: [Supabase Docs](https://supabase.com/docs)
- next-intl: [next-intl Docs](https://next-intl-docs.vercel.app/)

---

**개발 준비 완료! 🚀**

이제 `npm run dev`로 개발 서버를 시작하세요.
