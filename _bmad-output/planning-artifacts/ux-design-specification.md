---
stepsCompleted: [1]
workflowType: 'ux-design'
lastStep: 1
status: complete
designDirection: 'modern-djp'
platform: 'desktop-first-responsive'
uiLibrary: 'shadcn-ui-full'
createdAt: 2026-01-03
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - docs/PRD/core/01-executive-summary.md
  - docs/PRD/features/mvp-scope.md
  - docs/PRD/workflows/consultant-manual.md
  - docs/PRD/personas/tax-consultant.md
  - docs/project-documentation/architecture-web.md
---

# AI Pajak UX Design Specification

**Author:** Chrishan (with AI Agent Collaboration)
**Date:** 2026-01-03
**Version:** 1.0
**Design Direction:** Modern DJP (정부 신뢰감 + 현대적 SaaS)
**Platform:** Desktop First, Mobile Responsive

---

## Executive Summary

이 문서는 AI Pajak Phase 2의 UX 디자인 명세서입니다. **세 명의 AI 에이전트**(UX Designer, Frontend Developer, Product Manager)가 협업하여 작성하였습니다.

### 핵심 디자인 결정

| 항목 | 결정 |
|------|------|
| **UI 라이브러리** | shadcn/ui 전면 도입 |
| **디자인 테마** | Modern DJP (정부 스타일 + 현대적 SaaS) |
| **플랫폼 전략** | Desktop First, Mobile Responsive |
| **네비게이션** | Sidebar Navigation |
| **색상 체계** | DJP Navy Blue 기반 + Semantic Colors |

---

## Part 1: Design System

### 1.1 Color Palette

#### Primary Colors (DJP 스타일)

| 용도 | 색상명 | HEX | CSS Variable |
|------|--------|-----|--------------|
| **Primary** | Navy Blue | `#1E3A5F` | `--primary` |
| **Primary Light** | Ocean Blue | `#2563EB` | `--primary-light` |
| **Primary Dark** | Deep Navy | `#0F172A` | `--primary-dark` |
| **Secondary** | Warm Gold | `#CA8A04` | `--secondary` |
| **Accent** | Teal | `#0D9488` | `--accent` |

#### Semantic Colors

| 상태 | HEX | TailwindCSS | 용도 |
|------|-----|-------------|------|
| **Success** | `#10B981` | `emerald-500` | 승인 완료, 제출 성공 |
| **Warning** | `#F59E0B` | `amber-500` | 마감일 임박, 검토 필요 |
| **Error** | `#F43F5E` | `rose-500` | 오류, 거부됨 |
| **Info** | `#0EA5E9` | `sky-500` | 알림, 도움말 |

#### Workflow Stage Colors

| Stage | 배경색 | 텍스트색 | 용도 |
|-------|--------|---------|------|
| `UPLOADED` | `slate-100` | `slate-700` | 문서 업로드 완료 |
| `AI_ANALYZED` | `blue-100` | `blue-700` | AI 분석 완료 |
| `HUMAN_REVIEW` | `amber-100` | `amber-700` | 전문가 검토 중 |
| `APPROVED` | `emerald-100` | `emerald-700` | 승인됨 |
| `FILED` | `violet-100` | `violet-700` | DJP 제출 완료 |

#### Tax Type Colors

| Tax Type | HEX | 용도 |
|----------|-----|------|
| PPh 21 | `#10B981` | 근로소득세 |
| PPh 23 | `#F59E0B` | 원천징수세 |
| PPN | `#2563EB` | 부가가치세 |
| Annual | `#8B5CF6` | 연간 신고 |

### 1.2 Typography System

#### Font Families

```css
:root {
  --font-primary: 'Inter', 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  --font-display: 'Plus Jakarta Sans', 'Inter', sans-serif;
}
```

| 폰트 | 용도 | 선택 이유 |
|------|------|----------|
| **Inter** | 본문, UI | 뛰어난 가독성, 다국어 지원 |
| **Plus Jakarta Sans** | 제목 | 인도네시아 기반, 현대적 |
| **JetBrains Mono** | 숫자/금액 | 금액 표시 시 명확한 구분 |

#### Type Scale (1.25 ratio)

| 클래스 | 크기 | 용도 |
|--------|------|------|
| `text-6xl` | 48.83px | Display 1 |
| `text-5xl` | 39.06px | Display 2 |
| `text-4xl` | 31.25px | H1 |
| `text-3xl` | 25px | H2 |
| `text-2xl` | 20px | H3 |
| `text-xl` | 18px | Body Large |
| `text-lg` | 16px | Body |
| `text-base` | 14px | Body Small |
| `text-sm` | 12px | Caption |
| `text-xs` | 10px | Overline |

### 1.3 Spacing & Layout

#### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Desktop XL | 1536px+ | 3-column |
| Desktop | 1280px+ | 3-column |
| Laptop | 1024px+ | 2-column |
| Tablet | 768px+ | 1-column + Bottom Nav |
| Mobile | < 768px | 1-column + Bottom Nav |

#### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Top Bar (48px) - Logo, Search, Notifications, User Menu        │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  Sidebar   │  Main Content Area (max-width: 1400px)            │
│  (240px)   │                                                    │
│            │  ┌──────────────────────────────────────────────┐  │
│  [Logo]    │  │ Breadcrumb                                   │  │
│            │  ├──────────────────────────────────────────────┤  │
│  [Dash]    │  │ Summary Cards (4 columns)                    │  │
│  [Cases]   │  ├──────────────────────────────────────────────┤  │
│  [Submit]  │  │                                              │  │
│  [History] │  │ Main Table / Grid                            │  │
│  [Settings]│  │                                              │  │
│            │  ├──────────────────────────────────────────────┤  │
│  [User]    │  │ Action Panel (sticky bottom)                 │  │
│            │  └──────────────────────────────────────────────┘  │
└────────────┴────────────────────────────────────────────────────┘
```

---

## Part 2: Component Architecture

### 2.1 shadcn/ui Components (Full List)

#### Critical (P0) - 즉시 설치

| Category | Components |
|----------|------------|
| **Basic** | Button, Card, Input, Label, Badge, Separator |
| **Form** | Form, Select, Checkbox, Radio-Group, Textarea, DatePicker |
| **Feedback** | Dialog, Alert-Dialog, Toast (Sonner), Progress, Skeleton |
| **Data** | Table, DataTable, Tabs |
| **Navigation** | Breadcrumb, DropdownMenu |

#### High Priority (P1)

| Category | Components |
|----------|------------|
| **Layout** | Sheet, ScrollArea, Collapsible |
| **Form** | Switch, Calendar, Slider |
| **Feedback** | Alert, Tooltip, Popover |
| **Navigation** | Command, Pagination |

#### Nice to Have (P2)

| Category | Components |
|----------|------------|
| **Utility** | AspectRatio, Toggle, ToggleGroup |
| **Navigation** | NavigationMenu, ContextMenu |
| **Layout** | ResizablePanel |

### 2.2 Folder Structure

```
apps/web/src/
├── components/
│   ├── ui/                    # shadcn/ui (auto-generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   │
│   ├── common/                # 공통 래퍼 컴포넌트
│   │   ├── PageHeader.tsx
│   │   ├── DataCard.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── LoadingOverlay.tsx
│   │   └── EmptyState.tsx
│   │
│   ├── layout/                # 레이아웃
│   │   ├── MainLayout.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   │
│   ├── taxcase/               # TaxCase 도메인
│   │   ├── StageBadge.tsx
│   │   ├── StageProgress.tsx
│   │   ├── StageActions.tsx
│   │   ├── WorkflowTimeline.tsx
│   │   ├── TaxCaseCard.tsx
│   │   └── TaxTypeSelector.tsx
│   │
│   ├── filing/                # Filing 도메인
│   │   ├── BulkSubmitPanel.tsx
│   │   ├── SubmissionProgress.tsx
│   │   ├── FilingStatusBadge.tsx
│   │   └── BPEDownloadCard.tsx
│   │
│   ├── ocr/                   # OCR 도메인
│   │   ├── DocumentPreview.tsx
│   │   ├── OCRConfidenceIndicator.tsx
│   │   ├── ExtractedDataTable.tsx
│   │   └── OCRReviewPanel.tsx
│   │
│   └── audit/                 # Audit 도메인
│       ├── AuditTimeline.tsx
│       └── AuditLogEntry.tsx
│
├── lib/
│   └── utils.ts               # cn() utility
│
└── styles/
    └── globals.css            # CSS variables + Tailwind
```

### 2.3 Theme Configuration

#### globals.css

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

    /* Destructive */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    /* Muted */
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    /* Card */
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    /* Border/Input */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 217 91% 35%;

    --radius: 0.75rem;

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

#### tailwind.config.cjs

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
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
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

---

## Part 3: Screen Inventory & Navigation

### 3.1 Role-based Screen Matrix

#### Customer (UMKM 사업자)

| Priority | Screen | Key User Story |
|----------|--------|----------------|
| **P0** | Dashboard | 이번 달 세금 현황 한눈에 확인 |
| **P0** | Tax Case Detail | 신고 진행 상황 및 납부 금액 확인 |
| **P0** | Document Upload | 급여명세서 업로드 → 세금 계산 요청 |
| **P0** | BPE Download | 신고 완료 증빙(BPE) 다운로드 |
| **P1** | Payment Status | e-Billing 납부 및 증빙 업로드 |
| **P1** | POA Management | 위임장 제출 및 관리 |
| **P2** | Annual Summary | 연간 납부 현황 및 비교 |

#### Consultant (Jakarta Tax Consulting)

| Priority | Screen | Key User Story |
|----------|--------|----------------|
| **P0** | Consultant Dashboard | 35개 고객 진행 상황 한눈에 확인 |
| **P0** | Client List | 상태별 고객 필터링 |
| **P0** | Tax Case Review | AI 분석 결과 검토 및 수정 |
| **P0** | Bulk e-Billing | 35개 고객 e-Billing 일괄 생성 |
| **P0** | DJP Submit Helper | DJP 입력을 위한 복사 도우미 |
| **P0** | BPE Upload | DJP에서 받은 BPE 업로드 |
| **P1** | Client Messaging | 자료 보완 요청 메시지 발송 |
| **P1** | My Performance | 처리 건수 및 평균 처리 시간 |

#### Tax Advisor (Jakarta Tax Consulting)

| Priority | Screen | Key User Story |
|----------|--------|----------------|
| **P0** | Approval Queue | 승인/반려 대기 케이스 목록 |
| **P0** | Case Deep Review | 복잡한 케이스 세무 검토 |
| **P0** | Final Approval | 최종 승인 또는 수정 반려 |
| **P0** | Bulk Submit | 승인된 케이스 DJP 일괄 제출 |
| **P1** | POA Review | 위임장 유효성 확인 및 서명 |
| **P1** | Team Performance | 컨설턴트 실적 모니터링 |

#### Platform Admin (세금 데이터 접근 불가)

| Priority | Screen | Key User Story |
|----------|--------|----------------|
| **P0** | Platform Dashboard | 익명화된 전체 통계 |
| **P0** | System Status | API 응답 시간, 에러율 확인 |
| **P1** | Audit Logs (Anonymized) | 보안 이벤트 모니터링 |
| **P1** | User Management | 역할별 사용자 관리 |

### 3.2 Navigation Structure

#### Sidebar Menu (역할별)

**Customer:**
```
Dashboard
세금 신고
├── 문서 업로드
├── 진행 중인 케이스
├── 완료된 케이스
└── BPE 다운로드
납부
├── e-Billing 목록
└── 납부 확인
설정
├── 회사 정보
├── 위임장(POA) 관리
└── 알림 설정
```

**Consultant:**
```
대시보드
고객 관리
├── 전체 고객 목록
├── 데이터 미완성
├── 검토 대기
└── 승인 대기
세금 처리
├── 세금 케이스 검토
├── e-Billing 일괄 생성
├── DJP 제출 도우미
└── BPE 업로드
커뮤니케이션
내 실적
```

**Tax Advisor:**
```
대시보드
승인 큐
├── 승인 대기
├── 반려 목록
└── 최종 검토
제출 관리
├── 일괄 DJP 제출
├── 제출 완료 확인
└── BPE 검증
팀 관리
├── 컨설턴트 실적
├── 고객 배정
└── POA 서명 대기
감사 로그
```

### 3.3 Permission-based Menu Visibility

```typescript
// navigation.ts
interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
}

const menuConfig: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'PLATFORM_ADMIN'],
  },
  {
    id: 'tax-cases',
    label: '세금 신고',
    path: '/tax-cases',
    icon: 'FileText',
    roles: ['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC'],
    // PLATFORM_ADMIN 제외
  },
  {
    id: 'bulk-submit',
    label: '일괄 제출',
    path: '/bulk-submit',
    icon: 'Send',
    roles: ['TAX_ADVISOR_JTC'],
  },
  {
    id: 'approval-queue',
    label: '승인 큐',
    path: '/approval-queue',
    icon: 'CheckCircle',
    roles: ['TAX_ADVISOR_JTC'],
  },
];
```

---

## Part 4: Key UX Patterns

### 4.1 Workflow Visualization (5-Stage)

```
UPLOADED → AI_ANALYZED → HUMAN_REVIEW → APPROVED → FILED
   [1]         [2]            [3]          [4]       [5]
```

**Visual Elements:**

| Stage | Icon | Color | Animation |
|-------|------|-------|-----------|
| UPLOADED | `Upload` | slate | - |
| AI_ANALYZED | `Brain` | blue | - |
| HUMAN_REVIEW | `UserCheck` | amber | Pulse |
| APPROVED | `CheckCircle2` | emerald | - |
| FILED | `FileCheck` | violet | - |

**StageProgress Component:**
- 완료 단계: 채워진 원 + 체크마크 + 실선 연결
- 현재 단계: 펄스 애니메이션 + 강조 테두리
- 대기 단계: 빈 원 + 점선 연결

### 4.2 Bulk Submit UI

**Toolbar:**
```
[ ] 전체 선택  |  선택: 5개  |  [일괄 승인] [일괄 제출]
```

**Case List (with Checkbox):**
```
[x] PT ABC Corp     | PPh 21  | AI_ANALYZED | 5일 후 마감
[x] CV Maju Jaya    | PPN     | AI_ANALYZED | 7일 후 마감
[x] Warung Padang   | PPh 21  | APPROVED    | 즉시 제출 가능
```

**Confirmation Dialog:**
```
"5개 항목을 DJP에 제출합니다.
 Jakarta Tax Consulting 명의로 진행됩니다.
 계속하시겠습니까?"
[취소] [확인]
```

**Progress Display:**
```
제출 진행 중... 3/5 완료
████████░░░░░░░░ 60%

✅ PT ABC Corp - 성공
✅ CV Maju Jaya - 성공
✅ Warung Padang - 성공
🔄 Toko Trendy - 진행 중...
⏳ Guest House - 대기
```

### 4.3 OCR Result Display

**Document Preview (Side-by-side):**
```
┌────────────────────┬────────────────────┐
│   원본 문서 이미지   │    추출된 데이터     │
│                    │                    │
│   [Zoom] [Rotate]  │  공급자: PT ABC    │
│                    │  NPWP: 01.222...   │
│   📄 invoice.pdf   │  금액: Rp 10M      │
│                    │  세금: Rp 1.1M     │
│                    │                    │
│   클릭 시 해당 영역  │  [✓] [⚠] [✗]      │
│   하이라이트       │  신뢰도 표시        │
└────────────────────┴────────────────────┘
```

**Confidence Indicator:**
| 신뢰도 | 아이콘 | 색상 | 행동 |
|--------|--------|------|------|
| 90%+ | ✓ | 녹색 | 자동 확인 |
| 70-89% | ⚠ | 주황색 | 사용자 검토 필요 |
| <70% | ✗ | 빨간색 | 수동 입력 권장 |

### 4.4 Notification System

**Notification Types:**

| Type | Priority | Display | Example |
|------|----------|---------|---------|
| Urgent | Critical | Full-screen Banner + Sound | 마감일 D-1, 제출 실패 |
| Action Required | High | Toast + Badge | 검토 대기, 승인 필요 |
| Info | Medium | Toast only | 처리 완료, 업로드 성공 |
| Background | Low | Notification Center | 시스템 업데이트 |

**Toast Design:**
```
┌──────────────────────────────────────────────┐
│ ✓ 세금 신고가 DJP에 성공적으로 제출되었습니다  │
│   BPE 번호: 123456789                [확인]  │
└──────────────────────────────────────────────┘
```

---

## Part 5: KPI Dashboards

### 5.1 Customer Dashboard

| Metric | Visualization | Description |
|--------|---------------|-------------|
| 이번 달 세금 총액 | Big Number + Trend | `Rp 18.7M (▲2%)` |
| 세금 유형별 상태 | Status Cards (3) | PPh21: ✅ / PPh23: 🔄 / PPN: ⏳ |
| 다음 마감일 | Countdown | `PPh21 납부까지 5일` |
| 연간 납부 현황 | Bar Chart | 월별 추이 |
| BPE 다운로드 | Badge | `3건 가능` |

### 5.2 Consultant Dashboard

| Metric | Visualization | Description |
|--------|---------------|-------------|
| 담당 고객 수 | Big Number | `35개 고객` |
| 진행 상태 분포 | Donut Chart | 완료 25 / 진행 7 / 대기 3 |
| 긴급 처리 | Alert Card (Red) | `3건 긴급` |
| 오늘 처리 | Progress Bar | `12/35 (34%)` |
| 이번 달 실적 | Number vs Target | `89건 / 105건` |
| 평균 처리 시간 | Number + Trend | `12분 (▼3분)` |

### 5.3 Tax Advisor Dashboard

| Metric | Visualization | Description |
|--------|---------------|-------------|
| 승인 대기 건수 | Big Number (Orange) | `15건` |
| 오늘 승인/반려 | Number Pair | `12 / 2` |
| 이번 달 제출 | Progress Bar | `287/350 (82%)` |
| 마감일별 분포 | Stacked Bar | D-5, D-3, D-1, 당일 |
| 컨설턴트 실적 | Table | 이름, 건수, 성공률, 시간 |
| POA 만료 임박 | Alert | `5개 7일 내 만료` |

### 5.4 Platform Admin Dashboard (Anonymized)

| Metric | Visualization | Description |
|--------|---------------|-------------|
| 전체 고객사 | Number | `152개` (개별 정보 없음) |
| MAU | Number + Trend | `1,234 (▲12%)` |
| 월간 제출 건수 | Number | `3,456건` |
| API p95 | Line Chart | 24시간 응답 시간 |
| 에러율 | Gauge | `0.3%` (목표 <1%) |
| 빌링 분포 | Histogram | 범위별 % |

---

## Part 6: Key Workflows (Visual)

### 6.1 Consultant 일괄 제출 Flow

```
[Day 12-14: 시작]
     │
     ▼
┌─────────────────────────────────────┐
│ 1. 대시보드에서 35개 고객 확인       │
│    - 데이터 완료: 30, 미완료: 5     │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ 2. [e-Billing 일괄 생성] 클릭       │
│    ✅ 28건 성공 / ❌ 2건 실패       │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ 3. 고객에게 자동 알림 발송           │
│    "e-Billing 코드: 301234567..."   │
└─────────────────────────────────────┘
     │
     │ [고객 납부 완료 - Day 16-20]
     ▼
┌─────────────────────────────────────┐
│ 4. DJP 제출 도우미                  │
│    - 필드별 복사 버튼               │
│    - [DJP 웹사이트 열기]            │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ 5. BPE 업로드                       │
│    - PDF 드래그 앤 드롭             │
│    - 고객에게 알림 자동 발송         │
└─────────────────────────────────────┘
```

### 6.2 OCR 문서 처리 Flow

```
[문서 업로드]
     │
     ▼
┌─────────────────────────────────────┐
│ 1. 드래그 앤 드롭 / 파일 선택        │
│    지원: PDF, JPG, PNG, XLSX        │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ 2. PaddleOCR 처리 중                │
│    ████████░░░░ 45%                 │
│    "문서 분석 중..."                │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ 3. AI 분석 결과 검토                │
│    - 원본 ↔ 추출 데이터 비교        │
│    - 신뢰도별 필드 표시             │
│    [❌ 반려] [✅ 승인]              │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ 4. Tax Advisor 최종 승인            │
│    - POA 유효성 확인                │
│    [📤 DJP 제출]                    │
└─────────────────────────────────────┘
```

---

## Part 7: Implementation Plan

### 7.1 Migration Strategy

#### Phase 1: Foundation (Day 1-2)

```bash
# 1. 필수 의존성 설치
npm install -D tailwindcss-animate class-variance-authority clsx tailwind-merge
npm install lucide-react

# 2. shadcn/ui 초기화
npx shadcn@latest init

# 3. Critical 컴포넌트 설치
npx shadcn@latest add button card input label badge
npx shadcn@latest add dialog alert-dialog toast
npx shadcn@latest add table tabs select form progress skeleton
```

#### Phase 2: Component Replacement (Day 3-5)

| 기존 컴포넌트 | shadcn 교체 | 변경 사항 |
|-------------|-------------|----------|
| `Button` | `button.tsx` | `size="md"` → `size="default"` |
| `Card` | `card.tsx` | CardHeader, CardContent 분리 |
| `Input` | `input.tsx` | 1:1 교체 |
| `Badge` | `badge.tsx` | `variant` prop 추가 |

#### Phase 3: Domain Components (Day 6-10)

- StageBadge 리팩토링
- StageProgress 개선
- BulkSubmitPanel 신규
- OCRConfidenceIndicator 신규

#### Phase 4: Layout & Navigation (Day 11-14)

- MainLayout 구현
- Sidebar 구현
- 역할별 메뉴 구성

### 7.2 Epic Mapping (for Sprint Planning)

| Epic | Screens | Components | Priority |
|------|---------|------------|----------|
| **E1: shadcn/ui 기반 설정** | - | Button, Card, Input, Badge, Form | P0 |
| **E2: Layout & Navigation** | - | Sidebar, Header, MainLayout | P0 |
| **E3: Consultant Dashboard** | 대시보드, 고객 목록 | DataCard, StatusBadge, Table | P0 |
| **E4: Tax Case Review** | 케이스 상세 | StageProgress, WorkflowTimeline | P0 |
| **E5: Bulk Submit** | 일괄 제출 | BulkSubmitPanel, SubmissionProgress | P0 |
| **E6: DJP Helper** | 제출 도우미 | CopyButton, FieldDisplay | P0 |
| **E7: OCR Review** | OCR 검토 | DocumentPreview, ConfidenceIndicator | P0 |
| **E8: BPE Management** | BPE 업로드/다운로드 | FileUpload, BPECard | P0 |
| **E9: Customer Dashboard** | 고객 대시보드 | SummaryCards, TaxCaseList | P1 |
| **E10: Messaging** | 커뮤니케이션 | MessageThread, NotificationBell | P1 |

---

## Appendix

### A. Icon Library (Lucide React)

| Usage | Icon Name |
|-------|-----------|
| Dashboard | `LayoutDashboard` |
| Tax Case | `FileText` |
| Upload | `Upload` |
| Download | `Download` |
| Submit | `Send` |
| Approve | `CheckCircle2` |
| Reject | `XCircle` |
| Review | `UserCheck` |
| AI | `Brain` |
| Settings | `Settings` |
| Alert | `AlertTriangle` |
| Info | `Info` |

### B. Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Keyboard Navigation | All actions keyboard accessible |
| Screen Reader | ARIA labels applied |
| Color Contrast | WCAG 2.1 AA compliance |
| Form Errors | Clear error messages |
| Focus Indicators | Visible focus rings |

### C. Reference Documents

| Document | Location |
|----------|----------|
| PRD Phase 2 | `_bmad-output/planning-artifacts/prd.md` |
| Executive Summary | `docs/PRD/core/01-executive-summary.md` |
| MVP Scope | `docs/PRD/features/mvp-scope.md` |
| Consultant Workflow | `docs/PRD/workflows/consultant-manual.md` |
| Web Architecture | `docs/project-documentation/architecture-web.md` |

---

**Document Status:** Complete
**Next Steps:** Epic/Story 생성 → Sprint Planning → 구현

---

*Generated with AI Agent Collaboration:*
- 🎨 UX Designer Agent
- 💻 Frontend Developer Agent
- 📊 Product Manager Agent
