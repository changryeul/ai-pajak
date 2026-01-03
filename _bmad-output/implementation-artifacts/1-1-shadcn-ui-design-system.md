# Story 1.1: shadcn/ui 초기화 및 Design System 설정

Status: done

## Story

As a **Developer**,
I want shadcn/ui가 프로젝트에 초기화되고 Design System이 설정되도록,
So that 일관된 UI 컴포넌트를 사용하여 개발할 수 있습니다.

## Acceptance Criteria

1. **Given** apps/web 프로젝트가 존재할 때
   **When** shadcn/ui 초기화 명령을 실행하면
   **Then** components.json 설정 파일이 생성됩니다

2. **Given** shadcn/ui가 초기화되었을 때
   **When** globals.css를 확인하면
   **Then** DJP 테마 CSS 변수가 설정됩니다 (Primary: #1E3A5F, Secondary 등)

3. **Given** shadcn/ui가 초기화되었을 때
   **When** tailwind.config.cjs를 확인하면
   **Then** shadcn 확장 설정이 추가됩니다 (colors, borderRadius, etc.)

4. **Given** shadcn/ui가 초기화되었을 때
   **When** P0 컴포넌트를 설치하면
   **Then** Button, Card, Input, Badge, Dialog 등 P0 컴포넌트가 설치됩니다

5. **Given** 모든 설치가 완료되었을 때
   **When** `npm run dev:web`을 실행하면
   **Then** 빌드 에러 없이 정상 동작합니다

## Tasks / Subtasks

- [x] Task 1: shadcn/ui 의존성 설치 (AC: #1)
  - [x] 1.1: tailwindcss-animate 설치
  - [x] 1.2: class-variance-authority 설치
  - [x] 1.3: clsx, tailwind-merge 설치
  - [x] 1.4: lucide-react 아이콘 라이브러리 설치

- [x] Task 2: shadcn/ui 초기화 (AC: #1)
  - [x] 2.1: `npx shadcn@latest init` 실행
  - [x] 2.2: components.json 설정 확인 및 조정 (alias: @/components)
  - [x] 2.3: lib/utils.ts에 cn() 유틸리티 함수 생성 확인

- [x] Task 3: DJP 테마 CSS 변수 설정 (AC: #2)
  - [x] 3.1: globals.css에 CSS 변수 추가 (--primary: DJP Navy 등)
  - [x] 3.2: Stage Colors 변수 추가 (uploaded, ai-analyzed 등)
  - [x] 3.3: Tax Type Colors 변수 추가 (pph21, pph23, ppn, annual)
  - [x] 3.4: OCR Confidence Colors 변수 추가 (high, medium, low)
  - [x] 3.5: Dark mode 변수 추가

- [x] Task 4: tailwind.config.cjs 확장 설정 (AC: #3)
  - [x] 4.1: colors 확장 (stage, tax, confidence)
  - [x] 4.2: borderRadius 설정
  - [x] 4.3: container 설정 (max-width: 1400px)
  - [x] 4.4: tailwindcss-animate 플러그인 추가

- [x] Task 5: P0 컴포넌트 설치 (AC: #4)
  - [x] 5.1: Basic 컴포넌트 설치 (button, card, input, label, badge, separator)
  - [x] 5.2: Form 컴포넌트 설치 (form, select, checkbox, radio-group, textarea)
  - [x] 5.3: Feedback 컴포넌트 설치 (dialog, alert-dialog, toast/sonner, progress, skeleton)
  - [x] 5.4: Data 컴포넌트 설치 (table, tabs)
  - [x] 5.5: Navigation 컴포넌트 설치 (breadcrumb, dropdown-menu)

- [x] Task 6: 빌드 검증 (AC: #5)
  - [x] 6.1: `npm run dev:web` 실행하여 에러 없음 확인
  - [x] 6.2: TypeScript 에러 없음 확인
  - [x] 6.3: 샘플 Button 컴포넌트 렌더링 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 (apps/web/src/):**
```
components/
├── ui/                    # shadcn/ui (auto-generated)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── common/                # 공통 래퍼 (나중에 추가)
├── layout/                # 레이아웃 (Story 1.5에서 구현)
└── ...domain components
lib/
└── utils.ts               # cn() utility
styles/
└── globals.css            # CSS variables + Tailwind
```

### Library & Framework Requirements

**필수 의존성:**
```json
{
  "devDependencies": {
    "tailwindcss-animate": "^1.0.7"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.309.0"
  }
}
```

**shadcn/ui 초기화 옵션:**
```
Style: Default
Base Color: Slate
CSS Variables: Yes
React Server Components: No (Vite 사용)
Components Alias: @/components
Utils Alias: @/lib/utils
```

### Technical Requirements

**DJP 테마 색상 (UX 설계 문서 기반):**

| CSS Variable | Value | Purpose |
|-------------|-------|---------|
| `--primary` | 217 91% 35% (HSL) | DJP Navy Blue #1E3A5F |
| `--primary-light` | Ocean Blue #2563EB | Hover/Light variant |
| `--primary-dark` | Deep Navy #0F172A | Dark variant |
| `--secondary` | Warm Gold #CA8A04 | Secondary actions |
| `--accent` | Teal #0D9488 | Accent color |

**Stage Colors (Workflow 단계별):**

| Stage | Background | Text |
|-------|-----------|------|
| UPLOADED | slate-100 | slate-700 |
| AI_ANALYZED | blue-100 | blue-700 |
| HUMAN_REVIEW | amber-100 | amber-700 |
| APPROVED | emerald-100 | emerald-700 |
| FILED | violet-100 | violet-700 |

### File Structure Notes

**기존 파일 수정 필요:**
- `apps/web/src/index.css` - CSS 변수 추가 (실제 경로)
- `apps/web/tailwind.config.cjs` - 확장 설정 추가 (또는 .js/.ts 파일)

**신규 파일 생성:**
- `apps/web/components.json` - shadcn/ui 설정
- `apps/web/src/lib/utils.ts` - cn() 유틸리티
- `apps/web/src/components/ui/*.tsx` - shadcn 컴포넌트들

### Critical Implementation Rules

1. **기존 TailwindCSS와 충돌 방지**: 기존 tailwind.config를 확장하되 덮어쓰지 않음
2. **Alias 설정 확인**: `@/components`, `@/lib` alias가 vite.config.ts에 설정되어 있어야 함
3. **CSS Variable 네이밍**: shadcn/ui 기본 네이밍 규칙 준수 (--background, --foreground 등)
4. **컴포넌트 자동 생성**: `npx shadcn@latest add` 명령어로 설치, 수동 수정 금지

### globals.css 예시 (UX 설계 문서 기준)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Background */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    /* Primary - DJP Navy */
    --primary: 217 91% 35%;
    --primary-foreground: 210 40% 98%;

    /* Secondary */
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    /* Muted */
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    /* Card */
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    /* Border/Input/Ring */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 217 91% 35%;

    --radius: 0.75rem;

    /* Destructive */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    /* Stage Colors */
    --stage-uploaded: 220 14.3% 95.9%;
    --stage-ai-analyzed: 213 93.9% 67.8%;
    --stage-human-review: 47.9 95.8% 53.1%;
    --stage-approved: 142.1 76.2% 36.3%;
    --stage-filed: 215 13.8% 34.1%;

    /* Tax Type Colors */
    --tax-pph21: 142 76% 36%;
    --tax-pph23: 25 95% 53%;
    --tax-ppn: 217 91% 60%;
    --tax-annual: 280 84% 55%;

    /* OCR Confidence */
    --confidence-high: 142 76% 36%;
    --confidence-medium: 47 95% 53%;
    --confidence-low: 0 84% 60%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217 91% 60%;
    --card: 222.2 84% 4.9%;
    --muted: 217.2 32.6% 17.5%;
    --border: 217.2 32.6% 17.5%;
  }
}
```

### tailwind.config.cjs 예시

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        stage: {
          uploaded: "hsl(var(--stage-uploaded))",
          "ai-analyzed": "hsl(var(--stage-ai-analyzed))",
          "human-review": "hsl(var(--stage-human-review))",
          approved: "hsl(var(--stage-approved))",
          filed: "hsl(var(--stage-filed))",
        },
        tax: {
          pph21: "hsl(var(--tax-pph21))",
          pph23: "hsl(var(--tax-pph23))",
          ppn: "hsl(var(--tax-ppn))",
          annual: "hsl(var(--tax-annual))",
        },
        confidence: {
          high: "hsl(var(--confidence-high))",
          medium: "hsl(var(--confidence-medium))",
          low: "hsl(var(--confidence-low))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### P0 컴포넌트 설치 명령어

```bash
# 한 번에 설치
npx shadcn@latest add button card input label badge separator \
  form select checkbox radio-group textarea \
  dialog alert-dialog sonner progress skeleton \
  table tabs breadcrumb dropdown-menu
```

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Part 2: Component Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/prd.md#Technical Considerations]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- shadcn CLI가 `@/` alias를 잘못 해석하여 `/apps/web/@/components/ui/` 경로에 컴포넌트를 설치함
- 컴포넌트를 수동으로 `/apps/web/src/components/ui/`로 이동하여 해결
- index.ts 파일을 생성하여 기존 import 패턴과의 호환성 유지

### Completion Notes List

- shadcn/ui 의존성 설치 완료 (tailwindcss-animate, class-variance-authority, clsx, tailwind-merge, lucide-react)
- components.json 설정 파일 생성 (Default style, Slate base color, CSS variables 활성화)
- lib/utils.ts에 cn() 유틸리티 함수 생성
- Path alias 설정 (@/) - tsconfig.app.json 및 vite.config.ts에 추가
- DJP 테마 CSS 변수 설정 완료 (Primary, Secondary, Stage, Tax, Confidence colors + Dark mode)
- tailwind.config.cjs 확장 설정 완료 (colors, borderRadius, container, animations)
- 20개 P0 컴포넌트 설치 완료 (button, card, input, label, badge, separator, form, select, checkbox, radio-group, textarea, dialog, alert-dialog, sonner, progress, skeleton, table, tabs, breadcrumb, dropdown-menu)
- 빌드 검증 완료 (`npm run build` 성공, dev 서버 정상 시작)
- **[Code Review 추가]** Vitest 테스트 프레임워크 설정 및 30개 테스트 작성 완료
- **[Code Review 추가]** Badge 컴포넌트에 Stage/Tax/Confidence variants 추가

### File List

**New Files:**
- apps/web/components.json
- apps/web/vitest.config.ts (테스트 설정)
- apps/web/src/lib/utils.ts
- apps/web/src/test/setup.ts (테스트 설정)
- apps/web/src/components/ui/alert-dialog.tsx
- apps/web/src/components/ui/breadcrumb.tsx
- apps/web/src/components/ui/checkbox.tsx
- apps/web/src/components/ui/dialog.tsx
- apps/web/src/components/ui/dropdown-menu.tsx
- apps/web/src/components/ui/form.tsx
- apps/web/src/components/ui/input.tsx
- apps/web/src/components/ui/label.tsx
- apps/web/src/components/ui/progress.tsx
- apps/web/src/components/ui/radio-group.tsx
- apps/web/src/components/ui/select.tsx
- apps/web/src/components/ui/separator.tsx
- apps/web/src/components/ui/skeleton.tsx
- apps/web/src/components/ui/sonner.tsx
- apps/web/src/components/ui/table.tsx
- apps/web/src/components/ui/tabs.tsx
- apps/web/src/components/ui/textarea.tsx
- apps/web/src/components/ui/button.test.tsx (Button 테스트)
- apps/web/src/components/ui/badge.test.tsx (Badge 테스트)

**Modified Files:**
- apps/web/package.json (dependencies + test scripts added)
- apps/web/tsconfig.app.json (path aliases added)
- apps/web/vite.config.ts (path aliases added)
- apps/web/src/index.css (DJP theme CSS variables added)
- apps/web/tailwind.config.cjs (shadcn extensions added)
- apps/web/src/components/ui/button.tsx (기존 파일 교체)
- apps/web/src/components/ui/card.tsx (기존 파일 교체)
- apps/web/src/components/ui/index.ts (기존 파일 수정)
- apps/web/src/components/ui/badge.tsx (Stage/Tax/Confidence variants 추가)

**Deleted Files:**
- apps/web/src/components/ui/ui.tsx (기존 UI 통합 파일 제거, index.ts로 대체)

## Change Log

- 2026-01-03: Story 1-1 구현 완료 - shadcn/ui 초기화 및 Design System 설정
- 2026-01-03: Code Review 수정 완료 (Amelia - Dev Agent)
  - [CRITICAL] Button 컴포넌트 테스트 추가 (13 tests)
  - [CRITICAL] Badge 컴포넌트 테스트 추가 (17 tests)
  - [HIGH] Badge에 Stage/Tax/Confidence variants 추가
  - [HIGH] 삭제된 파일(ui.tsx) 문서화
  - [HIGH] 파일 상태(New/Modified) 정확히 분류
  - [MEDIUM] @tailwindcss/postcss v4 충돌 제거
  - [MEDIUM] Dev Notes 경로 수정 (styles/globals.css → src/index.css)
  - Vitest 테스트 프레임워크 설정 추가
  - 총 30개 테스트 통과
