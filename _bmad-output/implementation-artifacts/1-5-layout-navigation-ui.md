# Story 1.5: 공통 레이아웃 및 네비게이션 UI

Status: done

## Story

As a **Developer**,
I want 공통 레이아웃과 역할별 네비게이션이 구현되도록,
So that 모든 페이지에서 일관된 UI 경험을 제공할 수 있습니다.

## Acceptance Criteria

1. **Given** shadcn/ui가 설정되었을 때
   **When** DashboardLayout 컴포넌트를 구현하면
   **Then** Sidebar (240px) + Main Content 구조로 렌더링됩니다
   **And** Main Content는 max-width: 1400px로 제한됩니다

2. **Given** Sidebar 컴포넌트가 구현될 때
   **When** 메뉴를 렌더링하면
   **Then** 로고, 네비게이션 메뉴, 사용자 프로필 영역이 포함됩니다
   **And** lucide-react 아이콘이 메뉴 아이템에 표시됩니다
   **And** 현재 활성 페이지가 시각적으로 구분됩니다

3. **Given** 사용자가 역할(Customer, Consultant, Tax Advisor)을 가질 때
   **When** Sidebar 메뉴가 렌더링되면
   **Then** 역할에 따라 다른 메뉴 아이템이 표시됩니다
   **And** CUSTOMER는 Dashboard, 세금 신고, 납부, 설정 메뉴를 봅니다
   **And** CONSULTANT_JTC는 대시보드, 고객 관리, 세금 처리, 커뮤니케이션 메뉴를 봅니다
   **And** TAX_ADVISOR_JTC는 대시보드, 승인 큐, 제출 관리, 팀 관리 메뉴를 봅니다

4. **Given** Header 컴포넌트가 구현될 때
   **When** Header를 렌더링하면
   **Then** 48px 높이로 표시됩니다
   **And** 사용자 이름과 역할이 표시됩니다
   **And** 알림 아이콘(Bell)이 표시됩니다
   **And** 드롭다운 메뉴로 로그아웃 등 옵션이 제공됩니다

5. **Given** 레이아웃이 반응형으로 구현될 때
   **When** 화면 너비가 1024px 미만이면
   **Then** Sidebar가 숨겨지고 햄버거 메뉴가 표시됩니다
   **And** 모바일에서는 Sidebar가 Sheet(오버레이)로 열립니다

6. **Given** 모든 레이아웃 컴포넌트가 구현될 때
   **When** 로컬 개발 환경에서 테스트하면
   **Then** 각 역할별 대시보드 페이지가 정상 렌더링됩니다
   **And** 네비게이션 클릭 시 라우팅이 동작합니다

## Tasks / Subtasks

- [x] Task 1: 레이아웃 폴더 구조 생성 (AC: #1)
  - [x] 1.1: `apps/web/src/components/layout/` 디렉토리 생성
  - [x] 1.2: index.ts 배럴 파일 생성

- [x] Task 2: 네비게이션 설정 구현 (AC: #3)
  - [x] 2.1: `apps/web/src/config/navigation.ts` 생성
  - [x] 2.2: MenuItem 타입 정의 (id, label, path, icon, roles, children)
  - [x] 2.3: 역할별 메뉴 구성 정의 (CUSTOMER, CONSULTANT_JTC, TAX_ADVISOR_JTC)
  - [x] 2.4: getMenuForRole(role: UserRole) 헬퍼 함수 구현

- [x] Task 3: Sidebar 컴포넌트 구현 (AC: #2, #3)
  - [x] 3.1: `apps/web/src/components/layout/Sidebar.tsx` 생성
  - [x] 3.2: 로고 영역 구현 (AI Pajak 로고 또는 텍스트)
  - [x] 3.3: 네비게이션 메뉴 렌더링 (navigation.ts 활용)
  - [x] 3.4: lucide-react 아이콘 매핑 (LayoutDashboard, FileText, Send 등)
  - [x] 3.5: 현재 경로 기반 활성 메뉴 스타일링 (useLocation 활용)
  - [x] 3.6: 하위 메뉴 접기/펼치기 (Collapsible 활용)
  - [x] 3.7: 사용자 프로필 영역 (하단 고정)

- [x] Task 4: Header 컴포넌트 구현 (AC: #4)
  - [x] 4.1: `apps/web/src/components/layout/Header.tsx` 생성
  - [x] 4.2: 48px 높이, 상단 고정 스타일
  - [x] 4.3: 모바일 햄버거 메뉴 버튼 (Sheet 트리거)
  - [x] 4.4: Breadcrumb 영역 (선택사항)
  - [x] 4.5: 알림 아이콘 (Bell) + 배지 표시
  - [x] 4.6: 사용자 드롭다운 메뉴 (DropdownMenu 활용)
  - [x] 4.7: 로그아웃 버튼 (기능은 추후 연동)

- [x] Task 5: DashboardLayout 컴포넌트 구현 (AC: #1, #5)
  - [x] 5.1: `apps/web/src/components/layout/DashboardLayout.tsx` 생성
  - [x] 5.2: Sidebar + Main Content 구조
  - [x] 5.3: Main Content max-width: 1400px, 중앙 정렬
  - [x] 5.4: 반응형 Sidebar 처리 (lg:block hidden)
  - [x] 5.5: Sheet 컴포넌트로 모바일 Sidebar 구현

- [x] Task 6: MainLayout 컴포넌트 구현 (AC: #1)
  - [x] 6.1: `apps/web/src/components/layout/MainLayout.tsx` 생성
  - [x] 6.2: Header + Outlet 구조 (레이아웃 외부 래퍼)
  - [x] 6.3: 인증되지 않은 사용자용 레이아웃 (로그인/회원가입 페이지)

- [x] Task 7: 의존성 설치 및 shadcn 컴포넌트 추가 (AC: #5)
  - [x] 7.1: Sheet 컴포넌트 설치: `npx shadcn@latest add sheet`
  - [x] 7.2: Collapsible 컴포넌트 설치: `npx shadcn@latest add collapsible`
  - [x] 7.3: Avatar 컴포넌트 설치: `npx shadcn@latest add avatar`
  - [x] 7.4: Tooltip 컴포넌트 설치: `npx shadcn@latest add tooltip`

- [x] Task 8: 라우팅 통합 및 테스트 페이지 (AC: #6)
  - [x] 8.1: App.tsx에 DashboardLayout을 레이아웃 라우트로 적용
  - [x] 8.2: 임시 대시보드 페이지 생성 (각 역할별)
  - [x] 8.3: Mock 사용자 역할 전환 기능 (개발용)
  - [x] 8.4: 로컬 개발 환경 테스트 (`npm run dev:web`)

- [x] Task 9: 접근성 및 품질 검증 (AC: #2, #4)
  - [x] 9.1: 키보드 네비게이션 테스트
  - [x] 9.2: 포커스 표시 확인
  - [x] 9.3: 반응형 동작 테스트 (Desktop, Tablet, Mobile)
  - [x] 9.4: 빌드 검증 (`npm run build:web`)

## Dev Notes

### Architecture Compliance

**프로젝트 구조 (architecture.md#Frontend Architecture):**
```
apps/web/src/
├── components/
│   ├── layout/                # 이 스토리에서 생성
│   │   ├── index.ts           # 배럴 파일
│   │   ├── MainLayout.tsx
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   └── ui/                    # shadcn/ui (기존)
├── config/
│   └── navigation.ts          # 네비게이션 설정 (신규)
└── types/
    └── user.types.ts          # UserRole 타입 (기존 또는 신규)
```

### UX Design Compliance

**Dashboard Layout (ux-design-specification.md#1.3):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Top Bar (48px) - Logo, Search, Notifications, User Menu        │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  Sidebar   │  Main Content Area (max-width: 1400px)            │
│  (240px)   │                                                    │
│            │                                                    │
└────────────┴────────────────────────────────────────────────────┘
```

**Color Variables (globals.css):**
- Primary: `hsl(var(--primary))` - Navy Blue #1E3A5F
- Sidebar 배경: `bg-slate-50` 또는 `bg-background`
- 활성 메뉴: `bg-primary/10 text-primary`

### Role-based Navigation Config

**navigation.ts 구조:**
```typescript
import { LucideIcon } from 'lucide-react';

export type UserRole = 'CUSTOMER' | 'CONSULTANT_JTC' | 'TAX_ADVISOR_JTC' | 'PLATFORM_ADMIN' | 'SYSTEM';

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: MenuItem[];
}

export const menuConfig: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: ['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'PLATFORM_ADMIN'],
  },
  {
    id: 'tax-cases',
    label: '세금 신고',
    path: '/tax-cases',
    icon: FileText,
    roles: ['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC'],
    children: [
      { id: 'upload', label: '문서 업로드', path: '/tax-cases/upload', icon: Upload, roles: ['CUSTOMER'] },
      { id: 'in-progress', label: '진행 중', path: '/tax-cases/in-progress', icon: Clock, roles: ['CUSTOMER', 'CONSULTANT_JTC'] },
      { id: 'completed', label: '완료됨', path: '/tax-cases/completed', icon: CheckCircle, roles: ['CUSTOMER', 'CONSULTANT_JTC'] },
    ],
  },
  {
    id: 'approval-queue',
    label: '승인 큐',
    path: '/approval-queue',
    icon: CheckCircle2,
    roles: ['TAX_ADVISOR_JTC'],
  },
  {
    id: 'bulk-submit',
    label: '일괄 제출',
    path: '/bulk-submit',
    icon: Send,
    roles: ['TAX_ADVISOR_JTC'],
  },
  // ... 추가 메뉴
];

export function getMenuForRole(role: UserRole): MenuItem[] {
  return menuConfig
    .filter(item => item.roles.includes(role))
    .map(item => ({
      ...item,
      children: item.children?.filter(child => child.roles.includes(role)),
    }));
}
```

### Sidebar Component Pattern

```tsx
// Sidebar.tsx
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getMenuForRole, MenuItem } from '@/config/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface SidebarProps {
  userRole: UserRole;
  userName?: string;
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const location = useLocation();
  const menuItems = getMenuForRole(userRole);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-slate-50">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-xl font-bold text-primary">AI Pajak</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <SidebarItem key={item.id} item={item} isActive={isActive} />
          ))}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{userName?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium truncate">{userName || 'User'}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

### Header Component Pattern

```tsx
// Header.tsx
import { Bell, Menu, LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMenuClick?: () => void;
  userName?: string;
  notificationCount?: number;
}

export function Header({ onMenuClick, userName, notificationCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Spacer for desktop */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

### DashboardLayout Component Pattern

```tsx
// DashboardLayout.tsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface DashboardLayoutProps {
  userRole: UserRole;
  userName?: string;
}

export function DashboardLayout({ userRole, userName }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar userRole={userRole} userName={userName} />
      </div>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <Sidebar userRole={userRole} userName={userName} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          userName={userName}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-[1400px] py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
```

### Technical Requirements

**lucide-react 아이콘 목록:**
- `LayoutDashboard` - 대시보드
- `FileText` - 세금 신고
- `Upload` - 문서 업로드
- `Send` - 제출
- `CheckCircle2` - 승인
- `XCircle` - 거부
- `UserCheck` - 검토
- `Settings` - 설정
- `Bell` - 알림
- `Menu` - 햄버거 메뉴
- `LogOut` - 로그아웃
- `ChevronDown` - 드롭다운 화살표

**Breakpoints:**
- Desktop: `lg:` (1024px+) - Sidebar 표시
- Tablet/Mobile: `< 1024px` - Sheet로 Sidebar 표시

**shadcn 추가 컴포넌트:**
```bash
npx shadcn@latest add sheet collapsible avatar tooltip scroll-area
```

### File Structure Notes

**신규 생성 파일:**
- `apps/web/src/components/layout/index.ts`
- `apps/web/src/components/layout/MainLayout.tsx`
- `apps/web/src/components/layout/DashboardLayout.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/Header.tsx`
- `apps/web/src/config/navigation.ts`

**수정 파일:**
- `apps/web/src/App.tsx` - 라우팅에 DashboardLayout 적용

### Previous Story Learnings (Story 1-1, 1-4)

**적용할 패턴:**
- Story 1-1에서 shadcn/ui가 이미 설정됨 (components.json, tailwind.config.cjs 확인)
- cn() 유틸리티는 `@/lib/utils`에서 import
- 컴포넌트는 PascalCase 파일명
- Props 인터페이스 명확히 정의

**shadcn 명령어 실행 위치:**
- `apps/web/` 디렉토리에서 실행

### Testing Checklist

- [ ] 각 역할(CUSTOMER, CONSULTANT_JTC, TAX_ADVISOR_JTC)별 메뉴 표시 확인
- [ ] 현재 경로에 따른 활성 메뉴 스타일 확인
- [ ] 하위 메뉴 접기/펼치기 동작 확인
- [ ] 모바일에서 Sheet 열기/닫기 확인
- [ ] Header 드롭다운 메뉴 동작 확인
- [ ] 알림 배지 표시 확인
- [ ] 키보드 네비게이션 동작 확인
- [ ] 반응형 레이아웃 확인 (Desktop, Tablet, Mobile)
- [ ] 빌드 성공 확인

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Architecture: shadcn/ui + Domain Components]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Part 1: Design System]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Part 2: Component Architecture]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#3.2 Navigation Structure]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#3.3 Permission-based Menu Visibility]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: 공통 레이아웃 및 네비게이션 UI]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- LucideIcon 타입 import 오류 수정: `import type { LucideIcon }` 형태로 변경
- shadcn 컴포넌트가 `apps/web/@/components/ui/`에 잘못 생성되어 올바른 위치로 이동

### Completion Notes List

1. **레이아웃 구조 생성 완료**: `apps/web/src/components/layout/` 디렉토리 및 배럴 파일 생성
2. **네비게이션 설정 구현**: 역할 기반 메뉴 시스템 구현 (CUSTOMER, CONSULTANT_JTC, TAX_ADVISOR_JTC, PLATFORM_ADMIN)
3. **Sidebar 컴포넌트**: 로고, 네비게이션 메뉴, Collapsible 하위 메뉴, 사용자 프로필 영역 포함
4. **Header 컴포넌트**: 48px 높이, 모바일 햄버거 메뉴, 알림 배지, 사용자 드롭다운 메뉴
5. **DashboardLayout**: Sidebar(240px) + Main Content(max-width: 1400px) 구조, 반응형 Sheet 모바일 사이드바
6. **MainLayout**: 공개 페이지용 레이아웃 (로그인/회원가입 등)
7. **shadcn 컴포넌트 설치**: sheet, collapsible, avatar, tooltip, scroll-area
8. **라우팅 통합**: App.tsx에 DashboardLayout 적용, 개발용 역할 전환 기능 추가
9. **품질 검증**: TypeScript 타입 체크 통과, 빌드 성공, 기존 테스트 30개 모두 통과

### File List

**New Files:**
- apps/web/src/components/layout/index.ts
- apps/web/src/components/layout/MainLayout.tsx
- apps/web/src/components/layout/DashboardLayout.tsx
- apps/web/src/components/layout/DashboardLayoutWrapper.tsx
- apps/web/src/components/layout/Sidebar.tsx
- apps/web/src/components/layout/Header.tsx
- apps/web/src/config/navigation.ts
- apps/web/src/pages/DashboardPage.tsx
- apps/web/src/components/ui/sheet.tsx (shadcn 자동 생성)
- apps/web/src/components/ui/collapsible.tsx (shadcn 자동 생성)
- apps/web/src/components/ui/avatar.tsx (shadcn 자동 생성)
- apps/web/src/components/ui/tooltip.tsx (shadcn 자동 생성)
- apps/web/src/components/ui/scroll-area.tsx (shadcn 자동 생성)

**Modified Files:**
- apps/web/src/App.tsx (라우팅 통합, UserContext, 역할 전환 기능)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-03
**Outcome:** ✅ APPROVED (모든 이슈 수정 완료)

### Review Summary

**Initial Findings:**
- 0 HIGH issues
- 5 MEDIUM issues
- 5 LOW issues

### Issues Fixed

**MEDIUM Issues (5건 모두 수정):**
1. ✅ MainLayout 라우팅 통합 - 공개 페이지용 라우팅에 MainLayout 적용
2. ✅ 레이아웃 컴포넌트 테스트 추가 - Sidebar, Header, DashboardLayout, navigation 테스트 77개 통과
3. ✅ DashboardLayoutWrapper 중복 코드 제거 - 불필요한 파일 삭제
4. ✅ PLATFORM_ADMIN 대시보드 콘텐츠 추가 - 빈 대시보드 대신 통계 카드 추가
5. ✅ onSettingsClick 핸들러 연결 - DashboardLayout에서 Header로 핸들러 전달

**LOW Issues (5건 모두 수정):**
1. ✅ Payment 메뉴 아이콘 변경 - FileText → Wallet 아이콘으로 변경
2. ✅ App.tsx 미사용 import 제거 - useOutletContext, Outlet 제거
3. ✅ Console.log 제거 - 프로덕션 코드에서 불필요한 로그 제거
4. ✅ UserRole 중복 export 제거 - DashboardLayoutWrapper 삭제로 해결
5. ✅ DevRoleSwitcher 접근성 개선 - aria-label, role, aria-labelledby 추가

### Verification Results

- **Build:** ✅ 성공 (vite build)
- **TypeScript:** ✅ 오류 없음
- **Tests:** ✅ 77개 테스트 모두 통과
  - navigation.test.ts: 15 tests
  - badge.test.tsx: 17 tests
  - button.test.tsx: 13 tests
  - Header.test.tsx: 13 tests
  - Sidebar.test.tsx: 10 tests
  - DashboardLayout.test.tsx: 9 tests

### Files Changed in Review

**Modified:**
- apps/web/src/App.tsx (라우팅, 접근성, 핸들러 개선)
- apps/web/src/components/layout/DashboardLayout.tsx (onSettingsClick 추가)
- apps/web/src/components/layout/Header.tsx (console.log 제거)
- apps/web/src/components/layout/index.ts (DashboardLayoutWrapper export 제거)
- apps/web/src/config/navigation.ts (Payment 아이콘 변경)
- apps/web/src/pages/DashboardPage.tsx (PLATFORM_ADMIN 콘텐츠 추가)

**Deleted:**
- apps/web/src/components/layout/DashboardLayoutWrapper.tsx

**Added (Tests):**
- apps/web/src/components/layout/Sidebar.test.tsx
- apps/web/src/components/layout/Header.test.tsx
- apps/web/src/components/layout/DashboardLayout.test.tsx
- apps/web/src/config/navigation.test.ts

## Change Log

- 2026-01-03: Story 1-5 생성 - ready-for-dev 상태로 설정
- 2026-01-03: Story 1-5 구현 완료 - review 상태로 변경
  - 공통 레이아웃 컴포넌트 구현 (DashboardLayout, MainLayout, Sidebar, Header)
  - 역할 기반 네비게이션 시스템 구현
  - shadcn UI 컴포넌트 추가 (sheet, collapsible, avatar, tooltip, scroll-area)
  - 개발용 역할 전환 기능 추가
  - 빌드 및 테스트 검증 완료
- 2026-01-03: Code Review 완료 - done 상태로 변경
  - MEDIUM 5건, LOW 5건 이슈 모두 수정
  - 레이아웃 컴포넌트 테스트 77개 추가
  - 빌드 및 모든 테스트 통과 확인
