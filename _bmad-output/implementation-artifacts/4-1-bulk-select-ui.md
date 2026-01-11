# Story 4.1: 일괄 선택 UI (BulkPreparePanel)

Status: ready-for-dev

## Story

- **As a** Tax Advisor
- **I want** 여러 케이스를 체크박스로 선택하도록
- **So that** 일괄 제출 준비할 케이스를 쉽게 선택할 수 있습니다

## Acceptance Criteria (ACs)

### AC 4.1.1: 케이스별 체크박스 표시
**Given** APPROVED 상태의 케이스 목록이 있을 때
**When** 일괄 제출 준비 페이지를 열면
**Then** 각 케이스 옆에 체크박스가 표시됩니다

### AC 4.1.2: 전체 선택 기능
**Given** 일괄 제출 준비 페이지가 열려 있을 때
**When** "전체 선택" 체크박스를 클릭하면
**Then** 모든 APPROVED 케이스가 선택됩니다

### AC 4.1.3: 선택된 케이스 수 표시
**Given** 케이스가 선택되었을 때
**When** 페이지를 확인하면
**Then** 선택된 케이스 수가 표시됩니다

### AC 4.1.4: 일괄 제출 준비 버튼 활성화
**Given** 1개 이상의 케이스가 선택되었을 때
**When** 페이지를 확인하면
**Then** "일괄 제출 준비" 버튼이 활성화됩니다

### AC 4.1.5: POA 유효성 미리보기
**Given** 케이스를 선택하기 전에
**When** 케이스 목록을 확인하면
**Then** 각 케이스의 POA 유효성 상태가 미리보기로 표시됩니다

## Technical Notes

### Architecture Context

이 스토리는 Epic 4 (일괄 제출 준비 및 체크리스트)의 첫 번째 스토리입니다.
**FRs covered:** FR-1.4 (일괄 제출 준비 - 35+ 고객 제출 데이터 일괄 준비)

**Epic 4 스토리 시퀀스:**
1. **Story 4-1** (현재): 일괄 선택 UI - BulkPreparePanel
2. Story 4-2: 일괄 제출 준비 처리 (Bull Queue)
3. Story 4-3: 일괄 준비 진행률 표시
4. Story 4-4: 마감일별 제출 체크리스트
5. Story 4-5: 제출 준비 데이터 일괄 내보내기

### Key Components

1. **Frontend (React)**
   - `BulkPreparePanel` - 일괄 선택 및 제출 준비 메인 컴포넌트
   - `BulkSelectTable` - 체크박스 포함 케이스 테이블
   - `BulkSelectToolbar` - 전체 선택, 필터, 선택 수 표시
   - `POAStatusBadge` - POA 유효성 상태 배지
   - `BulkPrepareButton` - 일괄 제출 준비 버튼

2. **State Management (Zustand)**
   - `useBulkSelectStore` - 선택된 케이스 ID 관리

3. **API Integration**
   - `GET /api/tax-cases?status=APPROVED` - APPROVED 케이스 목록 조회
   - `GET /api/poa/bulk-status?customerIds=[]` - POA 상태 일괄 조회

### Database Context

**사용할 기존 테이블:**
```typescript
// TaxCase (기존)
interface TaxCase {
  id: bigint;
  companyId: bigint;
  taxType: 'PPh21' | 'PPh23' | 'VAT' | 'ANNUAL';
  taxPeriod: string;
  dueDate: Date;
  workflowStage: WorkflowStage;
  // ...
}

// POA (기존 - power_of_attorney)
interface POA {
  id: bigint;
  customerId: bigint;
  validUntil: Date;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}
```

### Workflow Context

```
일괄 제출 준비 페이지 진입
        ↓
APPROVED 케이스 목록 로드
        ↓
케이스 선택 (체크박스)
        ↓
선택된 케이스 확인
        ↓
"일괄 제출 준비" 버튼 클릭
        ↓
Story 4-2: 일괄 준비 처리 (Bull Queue)
```

### API Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/tax-cases?status=APPROVED` | APPROVED 케이스 목록 조회 | 기존 |
| GET | `/api/poa/bulk-status` | POA 상태 일괄 조회 | 신규 (선택) |

## Tasks

### Task 1: Zustand Store 생성 (AC: #1, #2, #3)
- [ ] Subtask 1.1: `apps/web/src/stores/bulkSelectStore.ts` 생성
- [ ] Subtask 1.2: `selectedIds: bigint[]` 상태 정의
- [ ] Subtask 1.3: `toggleSelect(id)` 액션 구현
- [ ] Subtask 1.4: `selectAll(ids)` 액션 구현
- [ ] Subtask 1.5: `clearSelection()` 액션 구현
- [ ] Subtask 1.6: `isSelected(id)` 셀렉터 구현

### Task 2: API 클라이언트 확장 (AC: #1, #5)
- [ ] Subtask 2.1: `apps/web/src/api/tax-cases.api.ts` 수정 - APPROVED 필터 추가
- [ ] Subtask 2.2: `getApprovedTaxCases()` 함수 추가
- [ ] Subtask 2.3: 페이지네이션 지원 (35+ 케이스 대응)
- [ ] Subtask 2.4: `apps/web/src/api/poa.api.ts` 생성 (선택)
- [ ] Subtask 2.5: `getBulkPOAStatus(customerIds)` 함수 추가 (선택)

### Task 3: React Query Hooks (AC: #1, #5)
- [ ] Subtask 3.1: `apps/web/src/hooks/useBulkPrepare.ts` 생성
- [ ] Subtask 3.2: `useApprovedTaxCases()` hook 구현
- [ ] Subtask 3.3: 페이지네이션 쿼리 옵션 설정
- [ ] Subtask 3.4: `useBulkPOAStatus(customerIds)` hook 구현 (선택)

### Task 4: BulkSelectTable 컴포넌트 (AC: #1, #5)
- [ ] Subtask 4.1: `apps/web/src/components/filing/BulkSelectTable.tsx` 생성
- [ ] Subtask 4.2: DataTable 컴포넌트 활용 (shadcn/ui)
- [ ] Subtask 4.3: 체크박스 컬럼 추가
- [ ] Subtask 4.4: 고객명, 세금 유형, 과세 기간, 마감일 컬럼
- [ ] Subtask 4.5: POA 상태 배지 컬럼
- [ ] Subtask 4.6: 행 클릭 시 체크박스 토글
- [ ] Subtask 4.7: 로딩/빈 상태 처리

### Task 5: BulkSelectToolbar 컴포넌트 (AC: #2, #3, #4)
- [ ] Subtask 5.1: `apps/web/src/components/filing/BulkSelectToolbar.tsx` 생성
- [ ] Subtask 5.2: "전체 선택" 체크박스 (indeterminate 상태 포함)
- [ ] Subtask 5.3: 선택된 케이스 수 배지 (예: "12건 선택됨")
- [ ] Subtask 5.4: 필터 드롭다운 (세금 유형, 마감일)
- [ ] Subtask 5.5: 검색 입력 (고객명)
- [ ] Subtask 5.6: "선택 해제" 버튼

### Task 6: POAStatusBadge 컴포넌트 (AC: #5)
- [ ] Subtask 6.1: `apps/web/src/components/filing/POAStatusBadge.tsx` 생성
- [ ] Subtask 6.2: 상태별 색상 정의 (유효: 녹색, 만료 임박: 주황색, 만료: 빨간색)
- [ ] Subtask 6.3: 만료일 툴팁 표시
- [ ] Subtask 6.4: POA 없음 상태 처리

### Task 7: BulkPrepareButton 컴포넌트 (AC: #4)
- [ ] Subtask 7.1: `apps/web/src/components/filing/BulkPrepareButton.tsx` 생성
- [ ] Subtask 7.2: 선택된 케이스가 0개일 때 비활성화
- [ ] Subtask 7.3: 선택 수 표시 (예: "12건 일괄 준비")
- [ ] Subtask 7.4: 클릭 시 확인 다이얼로그 표시
- [ ] Subtask 7.5: POA 만료 케이스 경고 표시

### Task 8: BulkPreparePanel 메인 컴포넌트 (AC: 전체)
- [ ] Subtask 8.1: `apps/web/src/components/filing/BulkPreparePanel.tsx` 생성
- [ ] Subtask 8.2: BulkSelectToolbar + BulkSelectTable + BulkPrepareButton 통합
- [ ] Subtask 8.3: 레이아웃 및 간격 조정
- [ ] Subtask 8.4: 반응형 디자인 (테이블 스크롤)

### Task 9: 일괄 제출 준비 페이지 (AC: 전체)
- [ ] Subtask 9.1: `apps/web/src/pages/BulkPrepare.tsx` 생성
- [ ] Subtask 9.2: 라우트 추가 `/bulk-prepare`
- [ ] Subtask 9.3: 페이지 헤더 및 설명
- [ ] Subtask 9.4: BulkPreparePanel 임포트
- [ ] Subtask 9.5: 사이드바 메뉴에 링크 추가

### Task 10: 타입 정의 (AC: 전체)
- [ ] Subtask 10.1: `apps/web/src/types/bulk-prepare.types.ts` 생성
- [ ] Subtask 10.2: `BulkSelectState` 인터페이스 정의
- [ ] Subtask 10.3: `POAStatus` 인터페이스 정의
- [ ] Subtask 10.4: `BulkPrepareRequest` 인터페이스 정의

### Task 11: 단위 테스트 (AC: 전체)
- [ ] Subtask 11.1: `BulkSelectTable.test.tsx` - 체크박스 동작 테스트
- [ ] Subtask 11.2: `BulkSelectToolbar.test.tsx` - 전체 선택 테스트
- [ ] Subtask 11.3: `POAStatusBadge.test.tsx` - 상태별 렌더링 테스트
- [ ] Subtask 11.4: `BulkPrepareButton.test.tsx` - 활성화 조건 테스트
- [ ] Subtask 11.5: `bulkSelectStore.test.ts` - Zustand 스토어 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/web/src/
├── stores/
│   └── bulkSelectStore.ts              # 신규 (Task 1)
├── api/
│   ├── tax-cases.api.ts                # 수정 (Task 2)
│   └── poa.api.ts                      # 신규 (Task 2, 선택)
├── hooks/
│   └── useBulkPrepare.ts               # 신규 (Task 3)
├── types/
│   └── bulk-prepare.types.ts           # 신규 (Task 10)
├── components/
│   └── filing/
│       ├── BulkSelectTable.tsx         # 신규 (Task 4)
│       ├── BulkSelectToolbar.tsx       # 신규 (Task 5)
│       ├── POAStatusBadge.tsx          # 신규 (Task 6)
│       ├── BulkPrepareButton.tsx       # 신규 (Task 7)
│       └── BulkPreparePanel.tsx        # 신규 (Task 8)
├── pages/
│   └── BulkPrepare.tsx                 # 신규 (Task 9)
└── App.tsx                             # 수정 - 라우트 추가
```

**아키텍처 문서 참조:**
- [Source: architecture.md#Frontend Architecture - State Management: React Query + Zustand]
- [Source: architecture.md#Frontend Architecture - Component Architecture: shadcn/ui + Domain Components]
- [Source: architecture.md#Implementation Patterns - Naming Patterns]

### Code Patterns

**Zustand Store 패턴 (Architecture 문서 기반):**
```typescript
// apps/web/src/stores/bulkSelectStore.ts
import { create } from 'zustand';

interface BulkSelectState {
  selectedIds: bigint[];
  toggleSelect: (id: bigint) => void;
  selectAll: (ids: bigint[]) => void;
  clearSelection: () => void;
  isSelected: (id: bigint) => boolean;
}

export const useBulkSelectStore = create<BulkSelectState>((set, get) => ({
  selectedIds: [],

  toggleSelect: (id) => set((state) => ({
    selectedIds: state.selectedIds.some(x => x === id)
      ? state.selectedIds.filter(x => x !== id)
      : [...state.selectedIds, id]
  })),

  selectAll: (ids) => set({ selectedIds: ids }),

  clearSelection: () => set({ selectedIds: [] }),

  isSelected: (id) => get().selectedIds.some(x => x === id),
}));
```

**React Query 패턴:**
```typescript
// apps/web/src/hooks/useBulkPrepare.ts
import { useQuery } from '@tanstack/react-query';
import { getApprovedTaxCases } from '@/api/tax-cases.api';

export function useApprovedTaxCases(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['taxCases', 'approved', { page, pageSize }],
    queryFn: () => getApprovedTaxCases({ page, pageSize }),
    staleTime: 30 * 1000,
  });
}
```

**BulkSelectTable 구현:**
```tsx
// apps/web/src/components/filing/BulkSelectTable.tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useBulkSelectStore } from '@/stores/bulkSelectStore';
import { POAStatusBadge } from './POAStatusBadge';
import { formatDate } from '@/lib/date-utils';

interface BulkSelectTableProps {
  taxCases: TaxCase[];
  isLoading?: boolean;
}

export function BulkSelectTable({ taxCases, isLoading }: BulkSelectTableProps) {
  const { selectedIds, toggleSelect, isSelected } = useBulkSelectStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (taxCases.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        승인된 케이스가 없습니다.
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              {/* 전체 선택은 Toolbar에서 처리 */}
            </TableHead>
            <TableHead>고객명</TableHead>
            <TableHead>세금 유형</TableHead>
            <TableHead>과세 기간</TableHead>
            <TableHead>마감일</TableHead>
            <TableHead>POA 상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {taxCases.map((taxCase) => (
            <TableRow
              key={String(taxCase.id)}
              className="cursor-pointer"
              onClick={() => toggleSelect(taxCase.id)}
            >
              <TableCell>
                <Checkbox
                  checked={isSelected(taxCase.id)}
                  onCheckedChange={() => toggleSelect(taxCase.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="font-medium">
                {taxCase.company?.name}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{taxCase.taxType}</Badge>
              </TableCell>
              <TableCell>{taxCase.taxPeriod}</TableCell>
              <TableCell>
                <span className={getDueDateColor(taxCase.dueDate)}>
                  {formatDate(taxCase.dueDate)}
                </span>
              </TableCell>
              <TableCell>
                <POAStatusBadge customerId={taxCase.companyId} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getDueDateColor(dueDate: Date): string {
  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 1) return 'text-red-600 font-semibold';
  if (daysLeft <= 3) return 'text-orange-600';
  return 'text-muted-foreground';
}
```

**BulkSelectToolbar 구현:**
```tsx
// apps/web/src/components/filing/BulkSelectToolbar.tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Search } from 'lucide-react';
import { useBulkSelectStore } from '@/stores/bulkSelectStore';

interface BulkSelectToolbarProps {
  totalCount: number;
  allIds: bigint[];
  onSearch?: (query: string) => void;
  onFilterChange?: (filter: string) => void;
}

export function BulkSelectToolbar({
  totalCount,
  allIds,
  onSearch,
  onFilterChange
}: BulkSelectToolbarProps) {
  const { selectedIds, selectAll, clearSelection } = useBulkSelectStore();
  const selectedCount = selectedIds.length;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount;

  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll(allIds);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-muted/30">
      <div className="flex items-center gap-4">
        {/* 전체 선택 체크박스 */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            ref={(ref) => {
              if (ref) {
                (ref as HTMLButtonElement).dataset.state = isIndeterminate ? 'indeterminate' : undefined;
              }
            }}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm">전체 선택</span>
        </div>

        {/* 선택 수 배지 */}
        {selectedCount > 0 && (
          <Badge variant="secondary" className="font-mono">
            {selectedCount}건 선택됨
          </Badge>
        )}

        {/* 선택 해제 버튼 */}
        {selectedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            <X className="h-4 w-4 mr-1" />
            선택 해제
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="고객명 검색..."
            className="pl-8 w-48"
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>

        {/* 필터 */}
        <Select onValueChange={onFilterChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="세금 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="PPh21">PPh 21</SelectItem>
            <SelectItem value="PPh23">PPh 23</SelectItem>
            <SelectItem value="VAT">PPN</SelectItem>
            <SelectItem value="ANNUAL">연간</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

**POAStatusBadge 구현:**
```tsx
// apps/web/src/components/filing/POAStatusBadge.tsx
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';
import { formatDate } from '@/lib/date-utils';

interface POAStatusBadgeProps {
  customerId: bigint;
  poa?: {
    validUntil: Date;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  } | null;
}

export function POAStatusBadge({ customerId, poa }: POAStatusBadgeProps) {
  if (!poa) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="text-gray-500">
            <ShieldQuestion className="h-3 w-3 mr-1" />
            POA 없음
          </Badge>
        </TooltipTrigger>
        <TooltipContent>위임장이 등록되지 않았습니다</TooltipContent>
      </Tooltip>
    );
  }

  const daysUntilExpiry = Math.ceil(
    (new Date(poa.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  // 만료됨
  if (poa.status === 'EXPIRED' || daysUntilExpiry < 0) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="destructive">
            <ShieldX className="h-3 w-3 mr-1" />
            만료됨
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          만료일: {formatDate(poa.validUntil)}
        </TooltipContent>
      </Tooltip>
    );
  }

  // 만료 임박 (30일 이내)
  if (daysUntilExpiry <= 30) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="warning" className="bg-orange-100 text-orange-800">
            <ShieldAlert className="h-3 w-3 mr-1" />
            {daysUntilExpiry}일 남음
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          만료일: {formatDate(poa.validUntil)}
        </TooltipContent>
      </Tooltip>
    );
  }

  // 유효
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="success" className="bg-green-100 text-green-800">
          <ShieldCheck className="h-3 w-3 mr-1" />
          유효
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        만료일: {formatDate(poa.validUntil)}
      </TooltipContent>
    </Tooltip>
  );
}
```

**BulkPrepareButton 구현:**
```tsx
// apps/web/src/components/filing/BulkPrepareButton.tsx
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { FileStack, AlertTriangle } from 'lucide-react';
import { useBulkSelectStore } from '@/stores/bulkSelectStore';

interface BulkPrepareButtonProps {
  expiredPOACount?: number;
  onPrepare: () => void;
}

export function BulkPrepareButton({ expiredPOACount = 0, onPrepare }: BulkPrepareButtonProps) {
  const { selectedIds } = useBulkSelectStore();
  const selectedCount = selectedIds.length;
  const isDisabled = selectedCount === 0;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="lg"
          disabled={isDisabled}
          className="min-w-48"
        >
          <FileStack className="h-5 w-5 mr-2" />
          {selectedCount > 0 ? `${selectedCount}건 일괄 준비` : '일괄 제출 준비'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>일괄 제출 준비</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              선택한 <strong>{selectedCount}건</strong>의 케이스에 대해 제출 데이터를 준비합니다.
            </p>
            {expiredPOACount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md text-orange-800">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">
                  <strong>{expiredPOACount}건</strong>의 케이스에 만료된 POA가 있습니다.
                  해당 케이스는 제출이 차단될 수 있습니다.
                </span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              준비된 데이터는 Operator Helper 형식으로 제공됩니다.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onPrepare}>
            제출 준비 시작
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**BulkPreparePanel 메인 컴포넌트:**
```tsx
// apps/web/src/components/filing/BulkPreparePanel.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BulkSelectToolbar } from './BulkSelectToolbar';
import { BulkSelectTable } from './BulkSelectTable';
import { BulkPrepareButton } from './BulkPrepareButton';
import { useApprovedTaxCases } from '@/hooks/useBulkPrepare';
import { useBulkSelectStore } from '@/stores/bulkSelectStore';

export function BulkPreparePanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [taxTypeFilter, setTaxTypeFilter] = useState<string>('all');

  const { data, isLoading } = useApprovedTaxCases();
  const { selectedIds } = useBulkSelectStore();

  // 필터링
  const filteredCases = data?.data.filter((tc) => {
    const matchesSearch = tc.company?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTaxType = taxTypeFilter === 'all' || tc.taxType === taxTypeFilter;
    return matchesSearch && matchesTaxType;
  }) || [];

  // POA 만료 케이스 수 계산
  const expiredPOACount = filteredCases.filter((tc) => {
    // TODO: POA 상태 확인 로직
    return false;
  }).length;

  const handlePrepare = () => {
    // Story 4-2에서 구현할 일괄 준비 API 호출
    console.log('일괄 준비 시작:', selectedIds);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>일괄 제출 준비</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <BulkSelectToolbar
          totalCount={filteredCases.length}
          allIds={filteredCases.map(tc => tc.id)}
          onSearch={setSearchQuery}
          onFilterChange={setTaxTypeFilter}
        />

        <BulkSelectTable
          taxCases={filteredCases}
          isLoading={isLoading}
        />

        <div className="p-4 border-t flex justify-end">
          <BulkPrepareButton
            expiredPOACount={expiredPOACount}
            onPrepare={handlePrepare}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

### TaxCase API 확장

```typescript
// apps/web/src/api/tax-cases.api.ts
import { apiClient } from './client';

interface TaxCasesQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  taxType?: string;
}

export async function getApprovedTaxCases(query: TaxCasesQuery = {}) {
  const params = new URLSearchParams({
    status: 'APPROVED',
    page: String(query.page || 1),
    pageSize: String(query.pageSize || 50),
    ...(query.taxType && query.taxType !== 'all' ? { taxType: query.taxType } : {}),
  });

  const response = await apiClient.get(`/api/tax-cases?${params}`);
  return response.data;
}
```

### 라우트 추가

```tsx
// apps/web/src/App.tsx (수정)
import BulkPrepare from '@/pages/BulkPrepare';

// 라우트 추가
<Route path="/bulk-prepare" element={<BulkPrepare />} />
```

### 사이드바 메뉴 추가

```tsx
// apps/web/src/components/layout/Sidebar.tsx (수정)
// TAX_ADVISOR_JTC 역할 메뉴에 추가
{
  label: '일괄 제출 준비',
  path: '/bulk-prepare',
  icon: FileStack,
}
```

### Dependencies

**Story 3 의존성:**
- Epic 3 완료 후 API가 존재해야 함
- `submission-prep` 모듈이 구현되어 있어야 일괄 준비 API 호출 가능

**기존 컴포넌트:**
- shadcn/ui 컴포넌트 (Table, Checkbox, Badge, Button, AlertDialog, Select, Input, Tooltip)
- DashboardLayout

**외부 라이브러리:**
- `zustand` - 상태 관리
- `@tanstack/react-query` - 서버 상태 관리
- `lucide-react` - 아이콘

### Out of Scope

- 일괄 준비 API 구현 (Story 4-2)
- 진행률 표시 UI (Story 4-3)
- 마감일별 체크리스트 (Story 4-4)
- 엑셀 내보내기 (Story 4-5)
- 백엔드 일괄 처리 로직

### Testing Considerations

**단위 테스트 케이스:**
1. 체크박스 클릭 시 선택 상태 토글
2. 전체 선택 클릭 시 모든 케이스 선택
3. 선택된 케이스가 0개일 때 버튼 비활성화
4. 선택된 케이스가 1개 이상일 때 버튼 활성화
5. POA 상태별 배지 렌더링
6. 필터 적용 시 테이블 업데이트
7. 검색 적용 시 테이블 필터링

**Zustand 스토어 테스트:**
```typescript
// apps/web/src/stores/bulkSelectStore.test.ts
import { useBulkSelectStore } from './bulkSelectStore';

describe('bulkSelectStore', () => {
  beforeEach(() => {
    useBulkSelectStore.setState({ selectedIds: [] });
  });

  it('should toggle selection', () => {
    const { toggleSelect } = useBulkSelectStore.getState();
    toggleSelect(1n);
    expect(useBulkSelectStore.getState().selectedIds).toContain(1n);

    toggleSelect(1n);
    expect(useBulkSelectStore.getState().selectedIds).not.toContain(1n);
  });

  it('should select all', () => {
    const { selectAll } = useBulkSelectStore.getState();
    selectAll([1n, 2n, 3n]);
    expect(useBulkSelectStore.getState().selectedIds).toHaveLength(3);
  });

  it('should clear selection', () => {
    useBulkSelectStore.setState({ selectedIds: [1n, 2n] });
    const { clearSelection } = useBulkSelectStore.getState();
    clearSelection();
    expect(useBulkSelectStore.getState().selectedIds).toHaveLength(0);
  });
});
```

### Previous Story Intelligence

**Story 3-5에서 학습:**
- React Query 패턴 (useQuery, queryKey 구조)
- shadcn/ui 컴포넌트 활용 (Card, Badge, Button)
- 조건부 렌더링 패턴
- Toast 알림 패턴

**Epic 2에서 학습:**
- 테이블 컴포넌트 구조
- 로딩/에러 상태 처리
- 필터링 패턴

### Git Intelligence

**최근 커밋 패턴:**
- `d4a842e` - Epic 2 버그 수정
- `481c1d3` - Epic 2-4 완료
- `0409c74` - Epic 1 완료

**파일 패턴:**
- `apps/web/src/components/` - 컴포넌트 디렉토리
- `apps/web/src/hooks/` - 커스텀 훅 디렉토리
- `apps/web/src/stores/` - Zustand 스토어 디렉토리

### References

- Epic 4: 일괄 제출 준비 및 체크리스트 [Source: epics.md#Epic 4]
- PRD FR-1.4: 일괄 제출 준비 [Source: prd.md#FR-1]
- Architecture: Frontend Architecture [Source: architecture.md#Frontend Architecture]
- Architecture: State Management [Source: architecture.md#Frontend Architecture - State Management]
- UX: Bulk Submit UI 패턴 [Source: architecture.md#UX 요구사항]

## Story Progress Notes

### Agent Model Used: `Claude`

### Change Log

| Change | Date | Version | Description | Author |
| ------ | ---- | ------- | ----------- | ------ |
| Created | 2026-01-06 | 0.1.0 | Ultimate context engine analysis - 일괄 선택 UI 스토리 생성 | SM Agent |

### Completion Notes List

### File List
