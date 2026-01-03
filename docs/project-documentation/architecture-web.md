# Web 아키텍처 문서

## 개요

AI Pajak Web은 React + Vite 기반의 SPA(Single Page Application)입니다. Feature-based 구조로 구성되어 있으며, TailwindCSS를 사용한 유틸리티 기반 스타일링을 적용합니다.

## 기술 스택

| 카테고리 | 기술 | 버전 |
|---------|------|------|
| Framework | React | ^18.2.0 |
| Build Tool | Vite | ^5.2.0 |
| Language | TypeScript | ^5.4.5 |
| Routing | React Router | ^7.11.0 |
| Styling | TailwindCSS | ^3.4.19 |
| HTTP Client | Axios | ^1.6.7 |
| OCR Engine | PaddleOCR | - | 문서 OCR (Python 서비스) |

## 아키텍처 패턴

### Feature-based 구조

```
apps/web/src/
├── main.tsx                   # 애플리케이션 엔트리포인트
├── App.tsx                    # 루트 컴포넌트 & 라우팅
├── constants.ts               # 상수 정의
│
├── components/                # 재사용 가능한 UI 컴포넌트
│   ├── ui/                    # 기본 UI 컴포넌트
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── ui.tsx
│   │   └── index.ts
│   ├── AuditTimeline.tsx
│   ├── StageActions.tsx
│   ├── StageBadge.tsx
│   ├── StageProgress.tsx
│   ├── TaxCaseActions.tsx
│   └── WorkflowTimeline.tsx
│
├── views/                     # 피처 뷰 (페이지 레벨)
│   ├── Landing.tsx            # 랜딩 페이지
│   ├── Landing.full.tsx       # 전체 랜딩 (백업)
│   ├── TaxCaseDetail.tsx      # 세금 케이스 상세
│   ├── CustomerDashboard.tsx
│   ├── ConsultantDashboard.tsx
│   ├── TaxAdvisorQueue.tsx
│   ├── DataUpload.tsx
│   ├── EmployeeFiling.tsx
│   ├── AnnualFiling.tsx
│   ├── FilingHistory.tsx
│   ├── CompanyProfile.tsx
│   ├── Onboarding.tsx
│   ├── OperatorHelper.tsx
│   └── Partners.tsx
│
├── pages/                     # 라우트 레벨 컴포넌트
│   ├── Home.tsx
│   ├── HomePage.tsx
│   ├── CompanyList.tsx
│   ├── CompanyPage.tsx
│   ├── CompanyTaxCaseList.tsx
│   └── TaxCasePage.tsx
│
├── api/                       # API 클라이언트 함수
│   ├── client.ts              # Axios 인스턴스
│   ├── company.ts
│   ├── taxcase.ts
│   └── taxCaseApi.ts
│
├── services/                  # 외부 서비스 통합
│   ├── api.ts
│   ├── ocr.ts                 # PaddleOCR 서비스 (마이그레이션 예정)
│   ├── taxcase.ts
│   └── taxCaseApi.ts
│
├── domain/                    # 비즈니스 로직
│   └── taxCaseWorkflow.ts     # 워크플로우 액션 로직
│
├── contexts/                  # React Context
│   └── LanguageContext.tsx    # 다국어 지원
│
├── types/                     # TypeScript 인터페이스
│   └── taxcase.ts
│
└── assets/                    # 정적 자산
```

## 라우팅

### 현재 라우트

| 경로 | 컴포넌트 | 설명 |
|------|---------|------|
| `/` | `Landing` | 랜딩 페이지 |
| `/tax-cases/:id` | `TaxCaseDetail` | 세금 케이스 상세 |

### Vite 프록시 설정

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

## UI 컴포넌트

### 현재 상태

| 컴포넌트 | 설명 |
|---------|------|
| `Button` | 기본 버튼 |
| `Card` | 카드 레이아웃 |
| `ui.tsx` | 공통 UI 유틸리티 |

### 개선 필요사항

> **기술 부채**: 현재 TailwindCSS만 사용 중. shadcn/ui 도입 권장.

## 워크플로우 컴포넌트

세금 케이스 워크플로우를 시각화하는 컴포넌트:

- `StageProgress` - 스테이지 진행 표시
- `StageBadge` - 스테이지 뱃지
- `StageActions` - 스테이지별 액션 버튼
- `TaxCaseActions` - 세금 케이스 액션
- `WorkflowTimeline` - 워크플로우 타임라인
- `AuditTimeline` - 감사 타임라인

## API 통합

### 클라이언트 구조

```typescript
// api/client.ts
const client = axios.create({
  baseURL: '/api',
});
```

### 중복 문제

> **기술 부채**: `api/` 폴더와 `services/` 폴더에 유사한 기능이 중복됨. 통합 필요.

## 다국어 지원

`LanguageContext`를 통해 다국어 지원:

```typescript
// contexts/LanguageContext.tsx
const LanguageContext = createContext<LanguageContextType>(...);
```

## 스타일링

### TailwindCSS 설정

```javascript
// tailwind.config.cjs
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### shadcn/ui 마이그레이션 계획

1. shadcn/ui 초기화
2. 기존 button.tsx, card.tsx를 shadcn 컴포넌트로 교체
3. 추가 컴포넌트 도입 (Dialog, Form, Table 등)

## 참고 문서

- [통합 아키텍처](./integration-architecture.md)
- [개발 가이드](./development-guide.md)
