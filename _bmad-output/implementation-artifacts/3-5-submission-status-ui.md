# Story 3.5: 제출 준비 상태 조회 UI

Status: ready-for-dev

## Story

- **As a** Tax Advisor
- **I want** 제출 준비 상태를 확인하도록
- **So that** 준비 진행 상황을 파악할 수 있습니다

## Acceptance Criteria (ACs)

### AC 3.5.1: 현재 상태 표시
**Given** 세금 케이스가 있을 때
**When** Tax Case 상세 페이지를 열면
**Then** 현재 상태(APPROVED/READY_TO_FILE/FILED)가 표시됩니다

### AC 3.5.2: 제출 준비 완료 시간 표시
**Given** 제출 준비가 완료된 케이스가 있을 때
**When** Tax Case 상세 페이지를 열면
**Then** 제출 준비 완료 시간이 표시됩니다

### AC 3.5.3: Operator Helper 데이터 복사 기능
**Given** READY_TO_FILE 상태의 케이스가 있을 때
**When** Tax Case 상세 페이지를 열면
**Then** Operator Helper 데이터 복사 버튼이 표시됩니다

### AC 3.5.4: 수동 제출 완료 버튼 표시
**Given** READY_TO_FILE 상태의 케이스가 있을 때
**When** Tax Case 상세 페이지를 열면
**Then** 수동 제출 완료 버튼이 표시됩니다

## Technical Notes

### Architecture Context

이 스토리는 Epic 3의 최종 UI 스토리로, 이전 스토리들(3-1 ~ 3-4)의 기능을 통합합니다:
- Story 3-1: SPT 데이터 생성 서비스
- Story 3-2: Operator Helper 포맷팅
- Story 3-3: 제출 준비 완료 기능
- Story 3-4: 수동 제출 완료 확인

**참고**: 현재 `submission-prep` 모듈이 API에 존재하지 않으므로, Story 3-1 ~ 3-4의 구현이 선행되어야 합니다. 이 스토리는 UI 레이어에 집중합니다.

### Key Components

1. **Frontend (React)**
   - `SubmissionStatusCard` - 제출 준비 상태 표시 카드
   - `OperatorHelperPanel` - Operator Helper 데이터 복사 패널 (Story 3-2)
   - `PrepareSubmissionButton` - 제출 준비 버튼 (Story 3-3)
   - `MarkSubmittedDialog` - 수동 제출 완료 다이얼로그 (Story 3-4)
   - `TaxCaseDetail.tsx` 수정 - 모든 컴포넌트 통합

2. **API Integration**
   - `GET /api/submission-prep/:taxCaseId` - 제출 준비 상태 조회
   - `GET /api/submission-prep/:taxCaseId/operator-helper` - Operator Helper 데이터 조회

### Database Context

기존 `SubmissionPrep` 테이블 활용 (Story 3-1에서 정의):
```typescript
interface SubmissionPrep {
  id: bigint;
  taxCaseId: bigint;
  sptData: JSON;
  operatorHelperData: JSON | null;
  status: 'GENERATED' | 'VALIDATED' | 'READY_TO_FILE' | 'MANUALLY_SUBMITTED' | 'VALIDATION_FAILED';
  validatedAt: DateTime | null;
  validationErrors: JSON | null;
  preparedByConsultantId: bigint | null;
  manuallySubmittedAt: DateTime | null;
  djpReferenceId: string | null;
  createdAt: DateTime;
}
```

### Workflow Stage Reference

```
APPROVED → READY_TO_FILE → FILED
    ↓           ↓            ↓
 "제출 준비   "수동 제출    (완료 상태)
  완료 버튼"   완료 버튼"
```

### API Endpoints (Story 3-1 ~ 3-4에서 구현)

| Method | Endpoint | Description | Story |
|--------|----------|-------------|-------|
| GET | `/api/submission-prep/:taxCaseId` | 제출 준비 상태 조회 | 3-1 |
| GET | `/api/submission-prep/:taxCaseId/operator-helper` | Operator Helper 데이터 조회 | 3-2 |
| POST | `/api/submission-prep/:taxCaseId/prepare` | 제출 준비 완료 | 3-3 |
| POST | `/api/submission-prep/:taxCaseId/mark-submitted` | 수동 제출 완료 | 3-4 |

## Tasks

### Task 1: API 클라이언트 확장 (AC: #1, #2, #3)
- [ ] Subtask 1.1: `apps/web/src/api/submission-prep.api.ts` 생성
- [ ] Subtask 1.2: `getSubmissionPrep(taxCaseId)` - 제출 준비 상태 조회
- [ ] Subtask 1.3: `getOperatorHelperData(taxCaseId)` - Operator Helper 데이터 조회
- [ ] Subtask 1.4: `SubmissionPrepDto` 타입 정의

### Task 2: React Query Hooks (AC: #1, #2, #3)
- [ ] Subtask 2.1: `apps/web/src/hooks/useSubmissionPrep.ts` 생성
- [ ] Subtask 2.2: `useSubmissionPrep(taxCaseId)` - 제출 준비 상태 쿼리
- [ ] Subtask 2.3: `useOperatorHelperData(taxCaseId)` - Operator Helper 데이터 쿼리
- [ ] Subtask 2.4: enabled 조건 설정 (APPROVED 이상일 때만)

### Task 3: SubmissionStatusCard 컴포넌트 (AC: #1, #2)
- [ ] Subtask 3.1: `apps/web/src/components/filing/SubmissionStatusCard.tsx` 생성
- [ ] Subtask 3.2: 상태별 배지 표시 (APPROVED/READY_TO_FILE/FILED)
- [ ] Subtask 3.3: 제출 준비 완료 시간 표시 (상대 시간 + 절대 시간)
- [ ] Subtask 3.4: 수동 제출 완료 시간 표시 (FILED 상태일 때)
- [ ] Subtask 3.5: DJP 참조 번호 표시 (입력된 경우)
- [ ] Subtask 3.6: 로딩/에러 상태 처리

### Task 4: OperatorHelperPanel 컴포넌트 (AC: #3)
- [ ] Subtask 4.1: `apps/web/src/components/filing/OperatorHelperPanel.tsx` 생성
- [ ] Subtask 4.2: 세금 유형별 필드 표시 (PPh21, PPh23, VAT, Annual)
- [ ] Subtask 4.3: 필드별 복사 버튼 (클립보드 복사)
- [ ] Subtask 4.4: "전체 복사" 버튼
- [ ] Subtask 4.5: 복사 성공 Toast 알림
- [ ] Subtask 4.6: 접기/펼치기 (Collapsible) UI

### Task 5: SubmissionActionsPanel 컴포넌트 (AC: #3, #4)
- [ ] Subtask 5.1: `apps/web/src/components/filing/SubmissionActionsPanel.tsx` 생성
- [ ] Subtask 5.2: APPROVED 상태: "제출 준비 완료" 버튼 (PrepareSubmissionButton)
- [ ] Subtask 5.3: READY_TO_FILE 상태: "수동 제출 완료" 버튼
- [ ] Subtask 5.4: FILED 상태: 완료 메시지 및 BPE 업로드 안내
- [ ] Subtask 5.5: 상태별 조건부 렌더링

### Task 6: TaxCaseDetail 페이지 통합 (AC: #1, #2, #3, #4)
- [ ] Subtask 6.1: `apps/web/src/views/TaxCaseDetail.tsx` 수정
- [ ] Subtask 6.2: SubmissionStatusCard 추가 (Summary 카드 아래)
- [ ] Subtask 6.3: OperatorHelperPanel 조건부 렌더링 (READY_TO_FILE/FILED)
- [ ] Subtask 6.4: SubmissionActionsPanel 추가 (기존 StageActions 대체 또는 병합)
- [ ] Subtask 6.5: React Query 캐시 무효화 처리

### Task 7: 타입 정의 (AC: 전체)
- [ ] Subtask 7.1: `apps/web/src/types/submission-prep.types.ts` 생성
- [ ] Subtask 7.2: `SubmissionPrepStatus` enum 정의
- [ ] Subtask 7.3: `SubmissionPrep` 인터페이스 정의
- [ ] Subtask 7.4: `OperatorHelperData` 인터페이스 정의

### Task 8: 단위 테스트 (AC: 전체)
- [ ] Subtask 8.1: `SubmissionStatusCard.test.tsx` - 상태별 렌더링 테스트
- [ ] Subtask 8.2: `OperatorHelperPanel.test.tsx` - 복사 기능 테스트
- [ ] Subtask 8.3: `SubmissionActionsPanel.test.tsx` - 버튼 표시 조건 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/web/src/
├── api/
│   └── submission-prep.api.ts              # 신규
├── hooks/
│   └── useSubmissionPrep.ts                # 신규
├── types/
│   └── submission-prep.types.ts            # 신규
├── components/
│   └── filing/                             # 신규 디렉토리
│       ├── SubmissionStatusCard.tsx        # 신규 (AC: #1, #2)
│       ├── OperatorHelperPanel.tsx         # 신규 (AC: #3)
│       ├── SubmissionActionsPanel.tsx      # 신규 (AC: #3, #4)
│       ├── PrepareSubmissionButton.tsx     # Story 3-3에서 생성
│       └── MarkSubmittedDialog.tsx         # Story 3-4에서 생성
└── views/
    └── TaxCaseDetail.tsx                   # 수정
```

**아키텍처 문서 참조:**
- [Source: architecture.md#Frontend Architecture - Component Architecture]
- [Source: architecture.md#API & Communication Patterns]
- [Source: architecture.md#Implementation Patterns - Naming Patterns]

### Code Patterns

**shadcn/ui 컴포넌트 활용:**
```tsx
// 사용할 shadcn/ui 컴포넌트
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
```

**React Query 패턴 (기존 패턴 참조):**
```typescript
// apps/web/src/hooks/useSubmissionPrep.ts
import { useQuery } from '@tanstack/react-query';
import { getSubmissionPrep, getOperatorHelperData } from '@/api/submission-prep.api';

export function useSubmissionPrep(taxCaseId: string, enabled = true) {
  return useQuery({
    queryKey: ['submissionPrep', taxCaseId],
    queryFn: () => getSubmissionPrep(taxCaseId),
    enabled: !!taxCaseId && enabled,
    staleTime: 30 * 1000, // 30초
  });
}

export function useOperatorHelperData(taxCaseId: string, enabled = true) {
  return useQuery({
    queryKey: ['operatorHelper', taxCaseId],
    queryFn: () => getOperatorHelperData(taxCaseId),
    enabled: !!taxCaseId && enabled,
    staleTime: 5 * 60 * 1000, // 5분 (자주 변경되지 않음)
  });
}
```

**상태별 UI 렌더링 패턴:**
```tsx
// apps/web/src/components/filing/SubmissionActionsPanel.tsx
interface SubmissionActionsPanelProps {
  taxCaseId: string;
  workflowStage: WorkflowStage;
  submissionPrep?: SubmissionPrep | null;
  onActionComplete?: () => void;
}

export function SubmissionActionsPanel({
  taxCaseId,
  workflowStage,
  submissionPrep,
  onActionComplete
}: SubmissionActionsPanelProps) {
  switch (workflowStage) {
    case 'APPROVED':
      return (
        <PrepareSubmissionButton
          taxCaseId={taxCaseId}
          onSuccess={onActionComplete}
        />
      );

    case 'READY_TO_FILE':
      return (
        <div className="flex gap-4">
          <MarkSubmittedButton
            taxCaseId={taxCaseId}
            onSuccess={onActionComplete}
          />
          <Button variant="outline" onClick={() => {/* Operator Helper 펼치기 */}}>
            Operator Helper 보기
          </Button>
        </div>
      );

    case 'FILED':
      return (
        <div className="text-green-600 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <span>제출 완료됨</span>
          {submissionPrep?.manuallySubmittedAt && (
            <span className="text-sm text-muted-foreground">
              ({formatRelativeTime(submissionPrep.manuallySubmittedAt)})
            </span>
          )}
        </div>
      );

    default:
      return null; // UPLOADED, AI_ANALYZED, HUMAN_REVIEW에서는 표시 안함
  }
}
```

**SubmissionStatusCard 구현:**
```tsx
// apps/web/src/components/filing/SubmissionStatusCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Clock, Send, CheckCircle2 } from 'lucide-react';
import { useSubmissionPrep } from '@/hooks/useSubmissionPrep';
import { formatRelativeTime, formatDateTime } from '@/lib/date-utils';

interface SubmissionStatusCardProps {
  taxCaseId: string;
  workflowStage: string;
}

const STATUS_CONFIG = {
  APPROVED: {
    label: '승인됨',
    variant: 'secondary',
    icon: FileCheck,
    description: '제출 준비를 진행할 수 있습니다',
  },
  READY_TO_FILE: {
    label: '제출 준비 완료',
    variant: 'warning',
    icon: Clock,
    description: 'DJP에 수동 제출 후 완료를 기록하세요',
  },
  FILED: {
    label: '제출 완료',
    variant: 'success',
    icon: CheckCircle2,
    description: '세금 신고가 완료되었습니다',
  },
} as const;

export function SubmissionStatusCard({ taxCaseId, workflowStage }: SubmissionStatusCardProps) {
  const { data: submissionPrep, isLoading, error } = useSubmissionPrep(
    taxCaseId,
    ['APPROVED', 'READY_TO_FILE', 'FILED'].includes(workflowStage)
  );

  // APPROVED 이전 단계에서는 표시 안함
  if (!['APPROVED', 'READY_TO_FILE', 'FILED'].includes(workflowStage)) {
    return null;
  }

  const config = STATUS_CONFIG[workflowStage as keyof typeof STATUS_CONFIG];
  const Icon = config?.icon || FileCheck;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-10 w-10 bg-muted rounded-lg" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon className="h-5 w-5" />
            제출 준비 상태
          </CardTitle>
          <Badge variant={config?.variant as any}>{config?.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{config?.description}</p>

        {/* 제출 준비 완료 시간 */}
        {submissionPrep?.validatedAt && (
          <div className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>준비 완료: {formatRelativeTime(submissionPrep.validatedAt)}</span>
            <span className="text-muted-foreground">
              ({formatDateTime(submissionPrep.validatedAt)})
            </span>
          </div>
        )}

        {/* 수동 제출 완료 시간 (FILED 상태) */}
        {submissionPrep?.manuallySubmittedAt && (
          <div className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4 text-green-600" />
            <span>제출 완료: {formatRelativeTime(submissionPrep.manuallySubmittedAt)}</span>
          </div>
        )}

        {/* DJP 참조 번호 */}
        {submissionPrep?.djpReferenceId && (
          <div className="text-sm flex items-center gap-2">
            <span className="font-medium">DJP 참조:</span>
            <code className="bg-muted px-2 py-0.5 rounded">
              {submissionPrep.djpReferenceId}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**OperatorHelperPanel 구현:**
```tsx
// apps/web/src/components/filing/OperatorHelperPanel.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useOperatorHelperData } from '@/hooks/useSubmissionPrep';

interface OperatorHelperPanelProps {
  taxCaseId: string;
  defaultOpen?: boolean;
}

export function OperatorHelperPanel({ taxCaseId, defaultOpen = false }: OperatorHelperPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { data: operatorData, isLoading } = useOperatorHelperData(taxCaseId);

  const copyToClipboard = async (value: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldName);
      toast.success(`${fieldName} 복사됨`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast.error('복사 실패');
    }
  };

  const copyAll = async () => {
    if (!operatorData?.formattedText) return;
    try {
      await navigator.clipboard.writeText(operatorData.formattedText);
      toast.success('전체 데이터가 복사되었습니다');
    } catch (err) {
      toast.error('복사 실패');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!operatorData) return null;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Operator Helper 데이터</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="h-4 w-4 mr-2" />
                전체 복사
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {operatorData.fields?.map((field: any) => (
              <div key={field.name} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="text-sm font-medium">{field.label}</span>
                  <p className="text-sm text-muted-foreground font-mono">{field.value}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(field.value, field.label)}
                >
                  {copiedField === field.label ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

### TaxCaseDetail 통합 예시

```tsx
// apps/web/src/views/TaxCaseDetail.tsx (수정)
import { SubmissionStatusCard } from '@/components/filing/SubmissionStatusCard';
import { OperatorHelperPanel } from '@/components/filing/OperatorHelperPanel';
import { SubmissionActionsPanel } from '@/components/filing/SubmissionActionsPanel';
import { useQueryClient } from '@tanstack/react-query';

export default function TaxCaseDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  // ... 기존 상태 및 로직 ...

  const handleActionComplete = () => {
    // 모든 관련 쿼리 무효화
    queryClient.invalidateQueries({ queryKey: ['taxCase', id] });
    queryClient.invalidateQueries({ queryKey: ['submissionPrep', id] });
    queryClient.invalidateQueries({ queryKey: ['operatorHelper', id] });

    // taxCase 데이터 새로고침
    fetchTaxCase(id!).then(setTaxCase);
  };

  return (
    <div className="max-w-5xl mx-auto p-10 space-y-8 text-slate-50">
      {/* ... Header, Progress, Summary ... */}

      {/* ===== Submission Status ===== */}
      <SubmissionStatusCard
        taxCaseId={id!}
        workflowStage={taxCase.workflowStage}
      />

      {/* ===== Operator Helper (READY_TO_FILE or FILED) ===== */}
      {['READY_TO_FILE', 'FILED'].includes(taxCase.workflowStage) && (
        <OperatorHelperPanel taxCaseId={id!} />
      )}

      {/* ===== Actions ===== */}
      <Card>
        <CardContent className="py-4">
          <SubmissionActionsPanel
            taxCaseId={id!}
            workflowStage={taxCase.workflowStage}
            onActionComplete={handleActionComplete}
          />
        </CardContent>
      </Card>

      {/* ... Audit Timeline ... */}
    </div>
  );
}
```

### Dependencies

**Story 3-3 의존성:**
- `PrepareSubmissionButton` 컴포넌트
- `usePrepareSubmission` hook

**Story 3-4 의존성:**
- `MarkSubmittedDialog` 컴포넌트
- `useMarkAsSubmitted` hook

**기존 컴포넌트:**
- `StageBadge`, `StageProgress` - 기존 워크플로우 UI
- shadcn/ui 컴포넌트 (Card, Badge, Button, Collapsible, Tooltip)

**외부 라이브러리:**
- `@tanstack/react-query` - 서버 상태 관리
- `sonner` - Toast 알림
- `lucide-react` - 아이콘

### Utility Functions Needed

```typescript
// apps/web/src/lib/date-utils.ts
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatDateTime(date);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
```

### Out of Scope

- 일괄 제출 준비 UI (Epic 4)
- e-Billing 데이터 표시 (Epic 5)
- BPE 업로드 UI (Epic 9)
- 백엔드 API 구현 (Story 3-1 ~ 3-4)

### Testing Considerations

**단위 테스트 케이스:**
1. APPROVED 상태에서 SubmissionStatusCard 렌더링
2. READY_TO_FILE 상태에서 OperatorHelperPanel 렌더링
3. FILED 상태에서 완료 메시지 표시
4. Operator Helper 필드 복사 기능
5. 전체 복사 기능
6. 상태별 액션 버튼 조건부 렌더링

**통합 테스트:**
1. 제출 준비 완료 후 UI 업데이트
2. 수동 제출 완료 후 UI 업데이트
3. React Query 캐시 무효화 동작

### Previous Story Intelligence

**Story 3-3에서 학습:**
- `PrepareSubmissionButton` 컴포넌트 구조
- 확인 다이얼로그 패턴 (AlertDialog)
- useMutation hook 패턴

**Story 3-4에서 학습:**
- `MarkSubmittedDialog` 컴포넌트 구조
- 폼 입력 필드 패턴
- 상태 업데이트 및 쿼리 무효화

### Git Intelligence

**관련 파일 패턴 (최근 커밋 참조):**
- `apps/web/src/views/` - 뷰 컴포넌트 패턴
- `apps/web/src/components/` - 재사용 컴포넌트 패턴
- `apps/web/src/api/` - API 클라이언트 패턴

**Epic 2 완료 커밋에서 패턴 참조:**
- OCR Review UI 구조
- 상태별 조건부 렌더링
- Toast 알림 통합

## Story Progress Notes

### Agent Model Used: `Claude`

### Change Log

| Change | Date | Version | Description | Author |
| ------ | ---- | ------- | ----------- | ------ |
| Created | 2026-01-06 | 0.1.0 | Ultimate context engine analysis - 종합 UI 스토리 생성 | SM Agent |

### References

- Epic 3: 단일 케이스 제출 준비 [Source: epics.md#Epic 3]
- PRD FR-1.1: SPT 제출 데이터 준비 [Source: prd.md#FR-1]
- Architecture: Frontend Architecture [Source: architecture.md#Frontend Architecture]
- Story 3-1: SPT 제출 데이터 생성 [Source: 3-1-spt-submission-data-generation.md]
- Story 3-2: Operator Helper 포맷팅 [Source: 3-2-operator-helper-formatting.md]
- Story 3-3: 제출 준비 완료 기능 [Source: 3-3-submission-prep-complete.md]
- Story 3-4: 수동 제출 완료 확인 [Source: 3-4-manual-submission-confirm.md]
- UX Design: Component Architecture [Source: architecture.md#Component Architecture]
