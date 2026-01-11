# Story 4.3: 일괄 준비 진행률 표시

Status: ready-for-dev

## Story

- **As a** Tax Advisor
- **I want** 일괄 준비 진행률을 실시간으로 확인하도록
- **So that** 전체 진행 상황을 파악할 수 있습니다

## Acceptance Criteria (ACs)

### AC 4.3.1: 진행률 모달 표시
**Given** 일괄 제출 준비가 시작되었을 때
**When** "일괄 제출 준비" 버튼을 클릭하면
**Then** 진행률 모달이 표시됩니다

### AC 4.3.2: 전체 진행률 바 표시
**Given** 진행률 모달이 표시되었을 때
**When** 일괄 준비가 진행 중이면
**Then** 전체 진행률 바가 퍼센트와 함께 표시됩니다 (예: 60%)

### AC 4.3.3: 성공/실패 건수 실시간 업데이트
**Given** 일괄 준비가 진행 중일 때
**When** 각 케이스 처리가 완료되면
**Then** 성공/검증실패 건수가 실시간으로 업데이트됩니다

### AC 4.3.4: 케이스별 상태 아이콘 표시
**Given** 진행률 모달이 표시되었을 때
**When** 케이스 목록을 확인하면
**Then** 각 케이스의 상태 아이콘이 표시됩니다 (✅ 성공 / ❌ 실패 / 🔄 처리 중 / ⏳ 대기)

### AC 4.3.5: 완료 시 요약 통계 표시
**Given** 일괄 준비가 완료되었을 때
**When** 진행률이 100%에 도달하면
**Then** 요약 통계가 표시됩니다 (총 건수, 성공, 실패, 소요 시간)
**And** "완료" 또는 "닫기" 버튼이 활성화됩니다

## Technical Notes

### Architecture Context

이 스토리는 Epic 4 (일괄 제출 준비 및 체크리스트)의 세 번째 스토리입니다.
**FRs covered:** FR-1.4 (일괄 제출 준비 - 35+ 고객 제출 데이터 일괄 준비)

**Epic 4 스토리 시퀀스:**
1. Story 4-1: 일괄 선택 UI - BulkPreparePanel ✅ (ready-for-dev)
2. Story 4-2: 일괄 제출 준비 처리 (Bull Queue) ✅ (ready-for-dev)
3. **Story 4-3** (현재): 일괄 준비 진행률 표시
4. Story 4-4: 마감일별 제출 체크리스트
5. Story 4-5: 제출 준비 데이터 일괄 내보내기

### Key Components

1. **Frontend (React)**
   - `BulkProgressModal` - 진행률 표시 모달
   - `ProgressBar` - 애니메이션 진행률 바 (shadcn/ui Progress)
   - `BulkProgressList` - 케이스별 상태 목록
   - `BulkProgressSummary` - 완료 요약 통계

2. **State Management**
   - `useBulkProgressStore` (Zustand) - 진행률 상태 관리
   - Polling 기반 실시간 업데이트 (React Query)

3. **API Integration**
   - `GET /api/submission-prep/bulk-status/:batchId` - 일괄 준비 상태 조회 (Story 4-2에서 구현)

### Workflow Context

```
Story 4-1: BulkPrepareButton 클릭
        ↓
Story 4-2: POST /api/submission-prep/bulk-prepare
        ↓
batchId 반환
        ↓
BulkProgressModal 표시 (현재 스토리)
        ↓
Polling: GET /api/submission-prep/bulk-status/:batchId
        ↓
실시간 진행률 업데이트
        ↓
완료 시 요약 통계 표시
```

### API Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/submission-prep/bulk-status/:batchId` | 일괄 준비 상태 조회 | Story 4-2에서 구현 |

**BulkStatusResponse (Story 4-2에서 정의):**
```typescript
interface BulkStatusResponse {
  batchId: string;
  totalCount: number;
  completed: number;
  failed: number;
  processing: number;
  waiting: number;
  progress: number;  // 0-100
  status: 'PROCESSING' | 'COMPLETED';
}
```

## Tasks

### Task 1: Zustand Store 생성 (AC: #1, #2, #3)
- [ ] Subtask 1.1: `apps/web/src/stores/bulkProgressStore.ts` 생성
- [ ] Subtask 1.2: `BulkProgressState` 인터페이스 정의
- [ ] Subtask 1.3: `setBatchId(batchId)` 액션 구현
- [ ] Subtask 1.4: `setProgress(progress)` 액션 구현
- [ ] Subtask 1.5: `setStatus(status)` 액션 구현
- [ ] Subtask 1.6: `reset()` 액션 구현
- [ ] Subtask 1.7: `isModalOpen` 상태 및 `openModal/closeModal` 액션

### Task 2: React Query Polling Hook (AC: #2, #3)
- [ ] Subtask 2.1: `apps/web/src/hooks/useBulkProgress.ts` 생성
- [ ] Subtask 2.2: `useBulkProgressPolling(batchId)` hook 구현
- [ ] Subtask 2.3: 2초 간격 polling 설정 (`refetchInterval: 2000`)
- [ ] Subtask 2.4: 완료 시 polling 중지 (`enabled: status !== 'COMPLETED'`)
- [ ] Subtask 2.5: Zustand store 자동 업데이트

### Task 3: BulkProgressModal 컴포넌트 (AC: #1, #5)
- [ ] Subtask 3.1: `apps/web/src/components/filing/BulkProgressModal.tsx` 생성
- [ ] Subtask 3.2: shadcn/ui Dialog 컴포넌트 활용
- [ ] Subtask 3.3: 모달 헤더 (제목: "일괄 제출 준비 진행 중")
- [ ] Subtask 3.4: 진행률 바 섹션
- [ ] Subtask 3.5: 케이스 목록 섹션
- [ ] Subtask 3.6: 요약 통계 섹션 (완료 시)
- [ ] Subtask 3.7: 닫기/완료 버튼 (완료 후에만 활성화)
- [ ] Subtask 3.8: 모달 외부 클릭 방지 (진행 중)

### Task 4: ProgressBar 컴포넌트 (AC: #2)
- [ ] Subtask 4.1: shadcn/ui Progress 컴포넌트 확장
- [ ] Subtask 4.2: 애니메이션 transition 추가
- [ ] Subtask 4.3: 퍼센트 텍스트 표시 (예: "60%")
- [ ] Subtask 4.4: 색상 변화 (진행 중: 파란색, 완료: 녹색, 오류 있음: 주황색)

### Task 5: BulkProgressList 컴포넌트 (AC: #4)
- [ ] Subtask 5.1: `apps/web/src/components/filing/BulkProgressList.tsx` 생성
- [ ] Subtask 5.2: 케이스별 행 렌더링
- [ ] Subtask 5.3: 상태 아이콘 매핑 (✅/❌/🔄/⏳)
- [ ] Subtask 5.4: 스크롤 가능 영역 (max-height)
- [ ] Subtask 5.5: 실시간 상태 업데이트 애니메이션

### Task 6: BulkProgressSummary 컴포넌트 (AC: #5)
- [ ] Subtask 6.1: `apps/web/src/components/filing/BulkProgressSummary.tsx` 생성
- [ ] Subtask 6.2: 총 건수 표시
- [ ] Subtask 6.3: 성공 건수 (녹색)
- [ ] Subtask 6.4: 실패 건수 (빨간색)
- [ ] Subtask 6.5: 소요 시간 계산 및 표시
- [ ] Subtask 6.6: 성공률 퍼센트

### Task 7: BulkPrepareButton 연결 (AC: #1)
- [ ] Subtask 7.1: Story 4-1의 `BulkPrepareButton.tsx` 수정
- [ ] Subtask 7.2: `onPrepare` 콜백에서 bulkPrepare API 호출
- [ ] Subtask 7.3: batchId 수신 후 모달 열기
- [ ] Subtask 7.4: 에러 처리 및 Toast 알림

### Task 8: 타입 정의 (AC: 전체)
- [ ] Subtask 8.1: `apps/web/src/types/bulk-progress.types.ts` 생성
- [ ] Subtask 8.2: `BulkProgressState` 인터페이스 정의
- [ ] Subtask 8.3: `CaseProgressStatus` enum 정의
- [ ] Subtask 8.4: `BulkProgressSummary` 인터페이스 정의

### Task 9: 단위 테스트 (AC: 전체)
- [ ] Subtask 9.1: `BulkProgressModal.test.tsx` - 모달 렌더링 테스트
- [ ] Subtask 9.2: `BulkProgressList.test.tsx` - 상태 아이콘 테스트
- [ ] Subtask 9.3: `BulkProgressSummary.test.tsx` - 통계 계산 테스트
- [ ] Subtask 9.4: `useBulkProgress.test.ts` - Polling 테스트
- [ ] Subtask 9.5: `bulkProgressStore.test.ts` - Store 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/web/src/
├── stores/
│   ├── bulkSelectStore.ts              # 기존 (Story 4-1)
│   └── bulkProgressStore.ts            # 신규 (Task 1)
├── hooks/
│   ├── useBulkPrepare.ts               # 기존 (Story 4-1)
│   └── useBulkProgress.ts              # 신규 (Task 2)
├── types/
│   ├── bulk-prepare.types.ts           # 기존 (Story 4-1)
│   └── bulk-progress.types.ts          # 신규 (Task 8)
├── components/
│   └── filing/
│       ├── BulkPreparePanel.tsx        # 기존 (Story 4-1)
│       ├── BulkPrepareButton.tsx       # 수정 (Task 7)
│       ├── BulkProgressModal.tsx       # 신규 (Task 3)
│       ├── BulkProgressList.tsx        # 신규 (Task 5)
│       └── BulkProgressSummary.tsx     # 신규 (Task 6)
└── api/
    └── submission-prep.api.ts          # 기존 (Story 4-2)
```

**아키텍처 문서 참조:**
- [Source: architecture.md#Frontend Architecture - State Management: React Query + Zustand]
- [Source: architecture.md#Frontend Architecture - Component Architecture: shadcn/ui + Domain Components]
- [Source: architecture.md#Implementation Patterns - Naming Patterns]

### Code Patterns

**Zustand Store 패턴:**
```typescript
// apps/web/src/stores/bulkProgressStore.ts
import { create } from 'zustand';

interface BulkProgressState {
  batchId: string | null;
  isModalOpen: boolean;
  progress: number;
  totalCount: number;
  completed: number;
  failed: number;
  processing: number;
  waiting: number;
  status: 'IDLE' | 'PROCESSING' | 'COMPLETED';
  startTime: number | null;

  // Actions
  startProgress: (batchId: string, totalCount: number) => void;
  updateProgress: (data: Partial<BulkProgressState>) => void;
  openModal: () => void;
  closeModal: () => void;
  reset: () => void;
}

export const useBulkProgressStore = create<BulkProgressState>((set) => ({
  batchId: null,
  isModalOpen: false,
  progress: 0,
  totalCount: 0,
  completed: 0,
  failed: 0,
  processing: 0,
  waiting: 0,
  status: 'IDLE',
  startTime: null,

  startProgress: (batchId, totalCount) =>
    set({
      batchId,
      totalCount,
      isModalOpen: true,
      progress: 0,
      completed: 0,
      failed: 0,
      processing: 0,
      waiting: totalCount,
      status: 'PROCESSING',
      startTime: Date.now(),
    }),

  updateProgress: (data) =>
    set((state) => ({
      ...state,
      ...data,
    })),

  openModal: () => set({ isModalOpen: true }),

  closeModal: () => set({ isModalOpen: false }),

  reset: () =>
    set({
      batchId: null,
      isModalOpen: false,
      progress: 0,
      totalCount: 0,
      completed: 0,
      failed: 0,
      processing: 0,
      waiting: 0,
      status: 'IDLE',
      startTime: null,
    }),
}));
```

**React Query Polling Hook:**
```typescript
// apps/web/src/hooks/useBulkProgress.ts
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getBulkStatus } from '@/api/submission-prep.api';
import { useBulkProgressStore } from '@/stores/bulkProgressStore';

export function useBulkProgressPolling(batchId: string | null) {
  const { status, updateProgress } = useBulkProgressStore();

  const query = useQuery({
    queryKey: ['bulk-progress', batchId],
    queryFn: () => getBulkStatus(batchId!),
    enabled: !!batchId && status === 'PROCESSING',
    refetchInterval: 2000, // 2초마다 polling
    refetchIntervalInBackground: false,
  });

  // Store 자동 업데이트
  useEffect(() => {
    if (query.data) {
      updateProgress({
        progress: query.data.progress,
        completed: query.data.completed,
        failed: query.data.failed,
        processing: query.data.processing,
        waiting: query.data.waiting,
        status: query.data.status === 'COMPLETED' ? 'COMPLETED' : 'PROCESSING',
      });
    }
  }, [query.data, updateProgress]);

  return query;
}
```

**BulkProgressModal 구현:**
```tsx
// apps/web/src/components/filing/BulkProgressModal.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BulkProgressList } from './BulkProgressList';
import { BulkProgressSummary } from './BulkProgressSummary';
import { useBulkProgressStore } from '@/stores/bulkProgressStore';
import { useBulkProgressPolling } from '@/hooks/useBulkProgress';
import { Loader2, CheckCircle2 } from 'lucide-react';

export function BulkProgressModal() {
  const {
    batchId,
    isModalOpen,
    closeModal,
    reset,
    progress,
    status,
    totalCount,
    completed,
    failed,
    startTime,
  } = useBulkProgressStore();

  // Polling 활성화
  useBulkProgressPolling(batchId);

  const isCompleted = status === 'COMPLETED';
  const hasErrors = failed > 0;

  const handleClose = () => {
    if (isCompleted) {
      reset();
    }
  };

  // 진행 중일 때는 모달 닫기 방지
  const handleOpenChange = (open: boolean) => {
    if (!open && isCompleted) {
      handleClose();
    }
  };

  // 소요 시간 계산
  const elapsedTime = startTime
    ? Math.round((Date.now() - startTime) / 1000)
    : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => {
          if (!isCompleted) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!isCompleted) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                일괄 제출 준비 완료
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                일괄 제출 준비 진행 중
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCompleted
              ? '모든 케이스의 제출 준비가 완료되었습니다.'
              : `${totalCount}건의 케이스를 처리하고 있습니다...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 진행률 바 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>진행률</span>
              <span className="font-mono font-semibold">{progress}%</span>
            </div>
            <Progress
              value={progress}
              className={`h-3 transition-all ${
                isCompleted
                  ? hasErrors
                    ? 'bg-orange-100 [&>div]:bg-orange-500'
                    : 'bg-green-100 [&>div]:bg-green-500'
                  : ''
              }`}
            />
          </div>

          {/* 진행 상태 카드 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">{completed}</div>
              <div className="text-xs text-muted-foreground">성공</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-red-600">{failed}</div>
              <div className="text-xs text-muted-foreground">실패</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {useBulkProgressStore.getState().processing}
              </div>
              <div className="text-xs text-muted-foreground">처리 중</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-gray-500">
                {useBulkProgressStore.getState().waiting}
              </div>
              <div className="text-xs text-muted-foreground">대기</div>
            </div>
          </div>

          {/* 소요 시간 */}
          <div className="text-center text-sm text-muted-foreground">
            소요 시간: <span className="font-mono">{formatTime(elapsedTime)}</span>
          </div>

          {/* 완료 시 요약 */}
          {isCompleted && (
            <BulkProgressSummary
              totalCount={totalCount}
              completed={completed}
              failed={failed}
              elapsedTime={elapsedTime}
            />
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleClose}
            disabled={!isCompleted}
            variant={isCompleted ? 'default' : 'outline'}
          >
            {isCompleted ? '완료' : '처리 중...'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**BulkProgressSummary 구현:**
```tsx
// apps/web/src/components/filing/BulkProgressSummary.tsx
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Clock, BarChart2 } from 'lucide-react';

interface BulkProgressSummaryProps {
  totalCount: number;
  completed: number;
  failed: number;
  elapsedTime: number;
}

export function BulkProgressSummary({
  totalCount,
  completed,
  failed,
  elapsedTime,
}: BulkProgressSummaryProps) {
  const successRate = totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  };

  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-4">
        <h4 className="font-semibold mb-3">처리 요약</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            <span>총 처리: {totalCount}건</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>성공: {completed}건</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>실패: {failed}건</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span>소요 시간: {formatTime(elapsedTime)}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">성공률</span>
            <span
              className={`font-semibold ${
                successRate >= 90
                  ? 'text-green-600'
                  : successRate >= 70
                  ? 'text-orange-600'
                  : 'text-red-600'
              }`}
            >
              {successRate}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**BulkPrepareButton 수정 (Story 4-1 연결):**
```tsx
// apps/web/src/components/filing/BulkPrepareButton.tsx (수정)
import { useState } from 'react';
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
import { FileStack, AlertTriangle, Loader2 } from 'lucide-react';
import { useBulkSelectStore } from '@/stores/bulkSelectStore';
import { useBulkProgressStore } from '@/stores/bulkProgressStore';
import { bulkPrepare } from '@/api/submission-prep.api';
import { useToast } from '@/hooks/use-toast';
import { BulkProgressModal } from './BulkProgressModal';

interface BulkPrepareButtonProps {
  expiredPOACount?: number;
  consultantId: string;
}

export function BulkPrepareButton({
  expiredPOACount = 0,
  consultantId
}: BulkPrepareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { selectedIds, clearSelection } = useBulkSelectStore();
  const { startProgress } = useBulkProgressStore();
  const { toast } = useToast();

  const selectedCount = selectedIds.length;
  const isDisabled = selectedCount === 0 || isLoading;

  const handlePrepare = async () => {
    setIsLoading(true);
    try {
      const response = await bulkPrepare({
        taxCaseIds: selectedIds.map(String),
        consultantId,
      });

      // 진행률 모달 시작
      startProgress(response.batchId, response.totalCount);

      // 선택 초기화
      clearSelection();

      toast({
        title: '일괄 준비 시작',
        description: `${response.totalCount}건의 케이스 준비가 시작되었습니다.`,
      });
    } catch (error) {
      toast({
        title: '오류 발생',
        description: '일괄 준비를 시작하지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="lg"
            disabled={isDisabled}
            className="min-w-48"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <FileStack className="h-5 w-5 mr-2" />
            )}
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
            <AlertDialogAction onClick={handlePrepare}>
              제출 준비 시작
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 진행률 모달 */}
      <BulkProgressModal />
    </>
  );
}
```

### Dependencies

**Story 4-1 의존성:**
- `useBulkSelectStore` - 선택된 케이스 ID 관리
- `BulkPrepareButton` - 버튼 컴포넌트 (수정 필요)

**Story 4-2 의존성:**
- `POST /api/submission-prep/bulk-prepare` API
- `GET /api/submission-prep/bulk-status/:batchId` API
- `bulkPrepare()`, `getBulkStatus()` API 클라이언트 함수

**기존 컴포넌트:**
- shadcn/ui (Dialog, Progress, Button, Card)
- lucide-react 아이콘

**외부 라이브러리:**
- `zustand` - 상태 관리
- `@tanstack/react-query` - 서버 상태 관리 (Polling)

### Out of Scope

- 마감일별 체크리스트 (Story 4-4)
- 엑셀 내보내기 (Story 4-5)
- 실패 건 상세 오류 메시지 표시
- 개별 케이스 재시도 기능
- 케이스별 상세 목록 표시 (현재는 숫자 요약만)

### Testing Considerations

**단위 테스트 케이스:**
1. 모달 열기/닫기 동작
2. 진행 중일 때 모달 닫기 방지
3. 진행률 바 값 업데이트
4. 상태별 아이콘 렌더링
5. 요약 통계 계산 (성공률)
6. 소요 시간 포맷팅
7. Polling 시작/중지 조건

**Zustand Store 테스트:**
```typescript
// apps/web/src/stores/bulkProgressStore.test.ts
import { useBulkProgressStore } from './bulkProgressStore';

describe('bulkProgressStore', () => {
  beforeEach(() => {
    useBulkProgressStore.setState({
      batchId: null,
      isModalOpen: false,
      progress: 0,
      status: 'IDLE',
    });
  });

  it('should start progress', () => {
    const { startProgress } = useBulkProgressStore.getState();
    startProgress('batch-123', 35);

    const state = useBulkProgressStore.getState();
    expect(state.batchId).toBe('batch-123');
    expect(state.totalCount).toBe(35);
    expect(state.isModalOpen).toBe(true);
    expect(state.status).toBe('PROCESSING');
  });

  it('should update progress', () => {
    useBulkProgressStore.setState({ status: 'PROCESSING' });
    const { updateProgress } = useBulkProgressStore.getState();

    updateProgress({ progress: 60, completed: 21, failed: 2 });

    const state = useBulkProgressStore.getState();
    expect(state.progress).toBe(60);
    expect(state.completed).toBe(21);
    expect(state.failed).toBe(2);
  });

  it('should reset on close after completion', () => {
    useBulkProgressStore.setState({ status: 'COMPLETED' });
    const { reset } = useBulkProgressStore.getState();

    reset();

    const state = useBulkProgressStore.getState();
    expect(state.batchId).toBeNull();
    expect(state.isModalOpen).toBe(false);
  });
});
```

### Previous Story Intelligence

**Story 4-1에서 학습:**
- Zustand store 패턴 (`useBulkSelectStore`)
- shadcn/ui Dialog/AlertDialog 활용
- 조건부 버튼 활성화 패턴

**Story 4-2에서 학습:**
- `BulkStatusResponse` 인터페이스 구조
- API 클라이언트 패턴 (`getBulkStatus`)
- Bull Queue 상태 조회 방식

**Epic 2 (OCR 처리)에서 학습:**
- 비동기 작업 상태 추적 패턴
- 진행률 표시 UI 패턴

### Git Intelligence

**최근 커밋 패턴:**
- `d4a842e` - Epic 2 버그 수정
- `481c1d3` - Epic 2-4 완료
- `0409c74` - Epic 1 완료

**파일 패턴:**
- `apps/web/src/components/filing/` - Filing 도메인 컴포넌트
- `apps/web/src/stores/` - Zustand 스토어
- `apps/web/src/hooks/` - 커스텀 훅

### References

- Epic 4: 일괄 제출 준비 및 체크리스트 [Source: epics.md#Epic 4]
- PRD FR-1.4: 일괄 제출 준비 [Source: prd.md#FR-1]
- Architecture: Frontend Architecture [Source: architecture.md#Frontend Architecture]
- Architecture: State Management [Source: architecture.md#Frontend Architecture - State Management]
- Story 4-1: 일괄 선택 UI [Source: 4-1-bulk-select-ui.md]
- Story 4-2: 일괄 제출 준비 처리 [Source: 4-2-bulk-prepare-queue.md]

## Story Progress Notes

### Agent Model Used: `Claude Opus 4.5`

### Change Log

| Change | Date | Version | Description | Author |
| ------ | ---- | ------- | ----------- | ------ |
| Created | 2026-01-06 | 0.1.0 | Ultimate context engine analysis - 일괄 준비 진행률 표시 스토리 생성 | SM Agent |

### Completion Notes List

### File List
