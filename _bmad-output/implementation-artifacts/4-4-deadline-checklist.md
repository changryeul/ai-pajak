# Story 4.4: 마감일별 제출 체크리스트 생성

Status: ready-for-dev

## Story

- **As a** Tax Advisor
- **I want** 마감일별 제출 체크리스트가 자동 생성되도록
- **So that** 마감일별로 수동 제출할 건을 관리할 수 있습니다

## Acceptance Criteria (ACs)

### AC 4.4.1: 마감일별 그룹화된 체크리스트 표시
**Given** READY_TO_FILE 상태의 케이스들이 있을 때
**When** 체크리스트 페이지를 열면
**Then** 마감일별로 그룹화된 체크리스트가 표시됩니다
**And** 각 그룹은 마감일 헤더와 함께 표시됩니다
**And** 오늘/긴급(D-1)/다가오는 마감일 순으로 정렬됩니다

### AC 4.4.2: 케이스별 체크박스 표시
**Given** 체크리스트에 케이스가 표시되었을 때
**When** 각 케이스를 확인하면
**Then** 수동 제출 완료 표시용 체크박스가 있습니다
**And** 고객명, 세금 유형, 금액이 표시됩니다
**And** Operator Helper 데이터 복사 버튼이 있습니다

### AC 4.4.3: 엑셀/CSV 내보내기
**Given** 체크리스트에 케이스들이 있을 때
**When** "엑셀 내보내기" 또는 "CSV 내보내기" 버튼을 클릭하면
**Then** 선택된 케이스들의 제출 데이터가 파일로 다운로드됩니다
**And** 마감일, 고객명, 세금 유형, 금액이 포함됩니다

### AC 4.4.4: 체크 시 FILED 상태 변경
**Given** READY_TO_FILE 상태의 케이스가 있을 때
**When** 체크박스를 체크하면
**Then** 확인 다이얼로그가 표시됩니다 (DJP 참조 번호 입력 옵션 포함)
**And** 확인 시 케이스 상태가 FILED로 변경됩니다
**And** 성공 Toast 알림이 표시됩니다

### AC 4.4.5: 긴급 마감일 강조
**Given** 마감일이 오늘 또는 D-1인 케이스가 있을 때
**When** 체크리스트 페이지를 열면
**Then** 해당 케이스는 빨간색/주황색 배경으로 강조됩니다
**And** "긴급" 또는 "오늘 마감" 배지가 표시됩니다

## Technical Notes

### Architecture Context

이 스토리는 Epic 4 (일괄 제출 준비 및 체크리스트)의 네 번째 스토리입니다.
**FRs covered:** FR-1.4 (일괄 제출 준비 - 마감일별 체크리스트 생성)

**Epic 4 스토리 시퀀스:**
1. Story 4-1: 일괄 선택 UI - BulkPreparePanel ✅ (ready-for-dev)
2. Story 4-2: 일괄 제출 준비 처리 (Bull Queue) ✅ (ready-for-dev)
3. Story 4-3: 일괄 준비 진행률 표시 ✅ (ready-for-dev)
4. **Story 4-4** (현재): 마감일별 제출 체크리스트
5. Story 4-5: 제출 준비 데이터 일괄 내보내기

### Key Components

1. **Frontend (React)**
   - `DeadlineChecklistPage` - 체크리스트 페이지 컴포넌트
   - `DeadlineGroup` - 마감일별 그룹 컴포넌트
   - `ChecklistItem` - 개별 케이스 체크박스 항목
   - `MarkAsFiledDialog` - 제출 완료 확인 다이얼로그
   - `ExportDropdown` - 엑셀/CSV 내보내기 드롭다운

2. **API Integration**
   - `GET /api/submission-prep/checklist` - 체크리스트 조회 (마감일별 그룹화)
   - `POST /api/submission-prep/mark-submitted` - 수동 제출 완료 기록
   - `GET /api/submission-prep/export` - 내보내기 데이터 조회

3. **Backend (NestJS)**
   - `SubmissionPrepController.getChecklist()` - 체크리스트 엔드포인트
   - `SubmissionPrepService.markAsSubmitted()` - 상태 변경 로직

### API Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/submission-prep/checklist` | 마감일별 체크리스트 조회 | 신규 |
| POST | `/api/submission-prep/mark-submitted` | 수동 제출 완료 기록 | Story 3-4에서 구현 (확장) |
| GET | `/api/submission-prep/export` | 내보내기 데이터 조회 | Story 4-5에서 구현 (선제적 포함) |

**ChecklistResponse:**
```typescript
interface DeadlineGroup {
  deadline: string;  // ISO date
  deadlineLabel: string;  // "오늘", "내일", "2026-01-15" 등
  urgencyLevel: 'TODAY' | 'URGENT' | 'UPCOMING' | 'FUTURE';
  cases: ChecklistCase[];
}

interface ChecklistCase {
  id: string;
  taxCaseId: string;
  customerName: string;
  companyName: string;
  taxType: 'PPh21' | 'PPh23' | 'PPh_Final' | 'PPN';
  taxPeriod: string;  // "2026-01"
  amount: number;
  status: 'READY_TO_FILE';
  operatorHelperData: string;  // 복사용 데이터
  deadline: string;
  poaValid: boolean;
  preparedAt: string;
}

interface ChecklistResponse {
  groups: DeadlineGroup[];
  totalCount: number;
  todayCount: number;
  urgentCount: number;
}
```

**MarkAsSubmittedRequest:**
```typescript
interface MarkAsSubmittedRequest {
  taxCaseId: string;
  djpReferenceId?: string;  // 선택적 DJP 참조 번호
  submittedAt?: string;  // 기본값: 현재 시간
}
```

## Tasks

### Task 1: API 엔드포인트 구현 (AC: #1)
- [ ] Subtask 1.1: `apps/api/src/submission-prep/dto/checklist.dto.ts` 생성
- [ ] Subtask 1.2: `ChecklistQueryDto` 정의 (필터: 마감일 범위, 세금 유형)
- [ ] Subtask 1.3: `ChecklistResponseDto` 정의
- [ ] Subtask 1.4: `SubmissionPrepService.getChecklist()` 구현
- [ ] Subtask 1.5: Prisma 쿼리 - READY_TO_FILE 케이스 조회
- [ ] Subtask 1.6: 마감일별 그룹화 로직 구현
- [ ] Subtask 1.7: 긴급도 계산 로직 (TODAY/URGENT/UPCOMING/FUTURE)
- [ ] Subtask 1.8: `SubmissionPrepController.getChecklist()` 라우트 추가
- [ ] Subtask 1.9: Swagger 문서화

### Task 2: DeadlineChecklistPage 구현 (AC: #1, #5)
- [ ] Subtask 2.1: `apps/web/src/pages/DeadlineChecklist.tsx` 생성
- [ ] Subtask 2.2: React Query로 체크리스트 데이터 fetch
- [ ] Subtask 2.3: 페이지 헤더 (제목, 통계 배지)
- [ ] Subtask 2.4: 필터 섹션 (마감일 범위, 세금 유형)
- [ ] Subtask 2.5: DeadlineGroup 컴포넌트 렌더링
- [ ] Subtask 2.6: 라우팅 설정 (`/deadline-checklist`)

### Task 3: DeadlineGroup 컴포넌트 (AC: #1, #5)
- [ ] Subtask 3.1: `apps/web/src/components/filing/DeadlineGroup.tsx` 생성
- [ ] Subtask 3.2: 그룹 헤더 (마감일, 건수 배지)
- [ ] Subtask 3.3: 긴급도별 배경색 적용
- [ ] Subtask 3.4: 접기/펼치기 기능 (Collapsible)
- [ ] Subtask 3.5: ChecklistItem 렌더링

### Task 4: ChecklistItem 컴포넌트 (AC: #2)
- [ ] Subtask 4.1: `apps/web/src/components/filing/ChecklistItem.tsx` 생성
- [ ] Subtask 4.2: 체크박스 + 케이스 정보 레이아웃
- [ ] Subtask 4.3: 고객명, 세금 유형, 금액 표시
- [ ] Subtask 4.4: Operator Helper 복사 버튼 (클립보드 복사)
- [ ] Subtask 4.5: POA 유효성 표시 (만료 시 경고)
- [ ] Subtask 4.6: 케이스 상세 링크

### Task 5: MarkAsFiledDialog 컴포넌트 (AC: #4)
- [ ] Subtask 5.1: `apps/web/src/components/filing/MarkAsFiledDialog.tsx` 생성
- [ ] Subtask 5.2: shadcn/ui Dialog 활용
- [ ] Subtask 5.3: DJP 참조 번호 입력 필드 (선택적)
- [ ] Subtask 5.4: 제출 일시 선택 (기본: 현재)
- [ ] Subtask 5.5: 확인/취소 버튼
- [ ] Subtask 5.6: API 호출 및 성공/실패 Toast

### Task 6: markAsSubmitted API 확장 (AC: #4)
- [ ] Subtask 6.1: 기존 Story 3-4의 `markAsSubmitted` 확인/확장
- [ ] Subtask 6.2: TaxCase 상태 FILED로 업데이트
- [ ] Subtask 6.3: WorkflowState 전이 기록
- [ ] Subtask 6.4: AuditLog 기록 (Jakarta Tax Consulting 귀속)
- [ ] Subtask 6.5: React Query 캐시 무효화

### Task 7: ExportDropdown 컴포넌트 (AC: #3)
- [ ] Subtask 7.1: `apps/web/src/components/filing/ExportDropdown.tsx` 생성
- [ ] Subtask 7.2: 드롭다운 메뉴 (엑셀, CSV)
- [ ] Subtask 7.3: 전체 내보내기 / 선택 내보내기 옵션
- [ ] Subtask 7.4: 파일 다운로드 로직

### Task 8: 엑셀/CSV 생성 유틸리티 (AC: #3)
- [ ] Subtask 8.1: `apps/web/src/lib/export-utils.ts` 생성
- [ ] Subtask 8.2: `exportToExcel(data)` 함수 (xlsx 라이브러리)
- [ ] Subtask 8.3: `exportToCsv(data)` 함수
- [ ] Subtask 8.4: 컬럼 매핑 및 한국어 헤더

### Task 9: 타입 정의 (AC: 전체)
- [ ] Subtask 9.1: `apps/web/src/types/checklist.types.ts` 생성
- [ ] Subtask 9.2: `DeadlineGroup` 인터페이스
- [ ] Subtask 9.3: `ChecklistCase` 인터페이스
- [ ] Subtask 9.4: `UrgencyLevel` enum

### Task 10: 단위 테스트 (AC: 전체)
- [ ] Subtask 10.1: `DeadlineGroup.test.tsx` - 그룹 렌더링 테스트
- [ ] Subtask 10.2: `ChecklistItem.test.tsx` - 체크박스 동작 테스트
- [ ] Subtask 10.3: `MarkAsFiledDialog.test.tsx` - 다이얼로그 테스트
- [ ] Subtask 10.4: `export-utils.test.ts` - 내보내기 함수 테스트
- [ ] Subtask 10.5: API 서비스 테스트 (`getChecklist`, `markAsSubmitted`)

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/api/src/
├── submission-prep/
│   ├── dto/
│   │   ├── checklist.dto.ts          # 신규 (Task 1)
│   │   └── mark-submitted.dto.ts     # 기존 (Story 3-4, 확장)
│   ├── submission-prep.controller.ts  # 수정 (Task 1)
│   └── submission-prep.service.ts     # 수정 (Task 1, 6)

apps/web/src/
├── pages/
│   └── DeadlineChecklist.tsx         # 신규 (Task 2)
├── components/
│   └── filing/
│       ├── DeadlineGroup.tsx         # 신규 (Task 3)
│       ├── ChecklistItem.tsx         # 신규 (Task 4)
│       ├── MarkAsFiledDialog.tsx     # 신규 (Task 5)
│       └── ExportDropdown.tsx        # 신규 (Task 7)
├── api/
│   └── submission-prep.api.ts        # 수정 (API 클라이언트)
├── types/
│   └── checklist.types.ts            # 신규 (Task 9)
└── lib/
    └── export-utils.ts               # 신규 (Task 8)
```

**아키텍처 문서 참조:**
- [Source: architecture.md#API Endpoints - submission-prep]
- [Source: architecture.md#Frontend Architecture - Component Architecture]
- [Source: architecture.md#Database Schema - submission_prep 테이블]

### Code Patterns

**Backend Service 패턴:**
```typescript
// apps/api/src/submission-prep/submission-prep.service.ts
@Injectable()
export class SubmissionPrepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxCaseRepository: TaxCaseRepository,
  ) {}

  async getChecklist(query: ChecklistQueryDto): Promise<ChecklistResponse> {
    // 1. READY_TO_FILE 상태 케이스 조회
    const cases = await this.prisma.taxCase.findMany({
      where: {
        status: 'READY_TO_FILE',
        deadline: query.deadlineRange
          ? { gte: query.startDate, lte: query.endDate }
          : undefined,
        taxType: query.taxType || undefined,
      },
      include: {
        company: true,
        submissionPrep: true,
      },
      orderBy: { deadline: 'asc' },
    });

    // 2. 마감일별 그룹화
    const groupedByDeadline = this.groupByDeadline(cases);

    // 3. 긴급도 계산
    const groups = groupedByDeadline.map((group) => ({
      ...group,
      urgencyLevel: this.calculateUrgency(group.deadline),
    }));

    return {
      groups,
      totalCount: cases.length,
      todayCount: groups.filter(g => g.urgencyLevel === 'TODAY').reduce((sum, g) => sum + g.cases.length, 0),
      urgentCount: groups.filter(g => g.urgencyLevel === 'URGENT').reduce((sum, g) => sum + g.cases.length, 0),
    };
  }

  private calculateUrgency(deadline: Date): UrgencyLevel {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'TODAY';
    if (diffDays === 1) return 'URGENT';
    if (diffDays <= 7) return 'UPCOMING';
    return 'FUTURE';
  }

  async markAsSubmitted(dto: MarkAsSubmittedDto): Promise<void> {
    const taxCase = await this.taxCaseRepository.findById(BigInt(dto.taxCaseId));
    if (!taxCase) throw new NotFoundException('Tax case not found');
    if (taxCase.status !== 'READY_TO_FILE') {
      throw new BadRequestException('Tax case is not ready for filing');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. TaxCase 상태 업데이트
      await tx.taxCase.update({
        where: { id: BigInt(dto.taxCaseId) },
        data: { status: 'FILED' },
      });

      // 2. SubmissionPrep 업데이트
      await tx.submissionPrep.update({
        where: { taxCaseId: BigInt(dto.taxCaseId) },
        data: {
          status: 'MANUALLY_SUBMITTED',
          manuallySubmittedAt: dto.submittedAt || new Date(),
          djpReferenceId: dto.djpReferenceId,
        },
      });

      // 3. WorkflowState 기록
      await tx.workflowState.create({
        data: {
          taxCaseId: BigInt(dto.taxCaseId),
          previousStatus: 'READY_TO_FILE',
          newStatus: 'FILED',
          changedBy: 'TAX_ADVISOR_JTC',
          changedAt: new Date(),
        },
      });

      // 4. AuditLog 기록 (Jakarta Tax Consulting 귀속)
      await tx.auditLog.create({
        data: {
          taxCaseId: BigInt(dto.taxCaseId),
          action: 'MANUAL_SUBMISSION',
          submittedByEntity: 'JAKARTA_TAX_CONSULTING',
          details: JSON.stringify({
            djpReferenceId: dto.djpReferenceId,
            submittedAt: dto.submittedAt || new Date(),
          }),
        },
      });
    });
  }
}
```

**Frontend DeadlineGroup 컴포넌트:**
```tsx
// apps/web/src/components/filing/DeadlineGroup.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import { ChecklistItem } from './ChecklistItem';
import type { DeadlineGroup as DeadlineGroupType } from '@/types/checklist.types';

interface DeadlineGroupProps {
  group: DeadlineGroupType;
  onMarkAsFiled: (taxCaseId: string) => void;
}

const urgencyStyles = {
  TODAY: 'bg-red-50 border-red-200',
  URGENT: 'bg-orange-50 border-orange-200',
  UPCOMING: 'bg-yellow-50 border-yellow-200',
  FUTURE: 'bg-gray-50 border-gray-200',
};

const urgencyBadges = {
  TODAY: { label: '오늘 마감', variant: 'destructive' as const },
  URGENT: { label: 'D-1 긴급', variant: 'secondary' as const },
  UPCOMING: { label: '다가오는 마감', variant: 'outline' as const },
  FUTURE: { label: '예정', variant: 'outline' as const },
};

export function DeadlineGroup({ group, onMarkAsFiled }: DeadlineGroupProps) {
  const { deadline, deadlineLabel, urgencyLevel, cases } = group;
  const badgeConfig = urgencyBadges[urgencyLevel];

  return (
    <Collapsible defaultOpen={urgencyLevel === 'TODAY' || urgencyLevel === 'URGENT'}>
      <Card className={`${urgencyStyles[urgencyLevel]} mb-4`}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {(urgencyLevel === 'TODAY' || urgencyLevel === 'URGENT') && (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <CardTitle className="text-lg">
                {deadlineLabel}
              </CardTitle>
              <Badge variant={badgeConfig.variant}>
                {badgeConfig.label}
              </Badge>
              <Badge variant="outline">
                {cases.length}건
              </Badge>
            </div>
            <ChevronDown className="h-5 w-5 transition-transform ui-expanded:rotate-180" />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {cases.map((caseItem) => (
                <ChecklistItem
                  key={caseItem.id}
                  caseItem={caseItem}
                  onMarkAsFiled={() => onMarkAsFiled(caseItem.taxCaseId)}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
```

**ChecklistItem 컴포넌트:**
```tsx
// apps/web/src/components/filing/ChecklistItem.tsx
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ChecklistCase } from '@/types/checklist.types';
import { MarkAsFiledDialog } from './MarkAsFiledDialog';

interface ChecklistItemProps {
  caseItem: ChecklistCase;
  onMarkAsFiled: () => void;
}

const taxTypeLabels = {
  PPh21: 'PPh 21',
  PPh23: 'PPh 23',
  PPh_Final: 'PPh Final',
  PPN: 'PPN',
};

export function ChecklistItem({ caseItem, onMarkAsFiled }: ChecklistItemProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleCopyOperatorHelper = async () => {
    try {
      await navigator.clipboard.writeText(caseItem.operatorHelperData);
      toast({
        title: '복사 완료',
        description: 'Operator Helper 데이터가 클립보드에 복사되었습니다.',
      });
    } catch {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (checked) {
      setIsDialogOpen(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 p-3 bg-white rounded-lg border">
        <Checkbox
          onCheckedChange={handleCheckboxChange}
          disabled={!caseItem.poaValid}
        />

        <div className="flex-1 grid grid-cols-4 gap-4 items-center">
          <div>
            <div className="font-medium">{caseItem.customerName}</div>
            <div className="text-sm text-muted-foreground">{caseItem.companyName}</div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">{taxTypeLabels[caseItem.taxType]}</Badge>
            <span className="text-sm text-muted-foreground">{caseItem.taxPeriod}</span>
          </div>

          <div className="text-right font-mono">
            Rp {caseItem.amount.toLocaleString('id-ID')}
          </div>

          <div className="flex items-center gap-2 justify-end">
            {!caseItem.poaValid && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                POA 만료
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyOperatorHelper}
            >
              <Copy className="h-4 w-4 mr-1" />
              복사
            </Button>

            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <a href={`/tax-cases/${caseItem.taxCaseId}`}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      <MarkAsFiledDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        taxCaseId={caseItem.taxCaseId}
        customerName={caseItem.customerName}
        onSuccess={onMarkAsFiled}
      />
    </>
  );
}
```

**MarkAsFiledDialog 구현:**
```tsx
// apps/web/src/components/filing/MarkAsFiledDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAsSubmitted } from '@/api/submission-prep.api';
import { Loader2 } from 'lucide-react';

interface MarkAsFiledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxCaseId: string;
  customerName: string;
  onSuccess: () => void;
}

export function MarkAsFiledDialog({
  open,
  onOpenChange,
  taxCaseId,
  customerName,
  onSuccess,
}: MarkAsFiledDialogProps) {
  const [djpReferenceId, setDjpReferenceId] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => markAsSubmitted({
      taxCaseId,
      djpReferenceId: djpReferenceId || undefined,
    }),
    onSuccess: () => {
      toast({
        title: '제출 완료 기록됨',
        description: `${customerName}의 세금 케이스가 FILED로 변경되었습니다.`,
      });
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      onSuccess();
      onOpenChange(false);
      setDjpReferenceId('');
    },
    onError: () => {
      toast({
        title: '오류 발생',
        description: '상태 변경에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  const handleConfirm = () => {
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>수동 제출 완료 확인</DialogTitle>
          <DialogDescription>
            <strong>{customerName}</strong>의 세금 신고를 DJP에 수동으로 제출했습니까?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="djpRef">DJP 참조 번호 (선택)</Label>
            <Input
              id="djpRef"
              placeholder="DJP에서 받은 참조 번호 입력"
              value={djpReferenceId}
              onChange={(e) => setDjpReferenceId(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              DJP에서 제공받은 참조 번호가 있으면 입력하세요.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            제출 완료 확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Dependencies

**Story 4-1, 4-2, 4-3 의존성:**
- READY_TO_FILE 상태의 케이스가 존재해야 함
- `submission_prep` 테이블에 준비된 데이터 필요

**Story 3-4 의존성:**
- `markAsSubmitted` API (확장)

**기존 컴포넌트:**
- shadcn/ui (Dialog, Card, Badge, Checkbox, Input, Button, Collapsible)
- lucide-react 아이콘

**신규 라이브러리:**
- `xlsx` (엑셀 내보내기용) - Task 8
- `date-fns` (날짜 포맷팅) - 권장

### Out of Scope

- 자동 새로고침 (수동 새로고침 버튼으로 대체)
- 일괄 체크 (개별 체크만)
- 실패 건 재시도 상세
- 실시간 알림 (WebSocket)

### Testing Considerations

**단위 테스트 케이스:**
1. 마감일별 그룹화 정확성
2. 긴급도 계산 (TODAY/URGENT/UPCOMING/FUTURE)
3. 체크박스 체크 시 다이얼로그 열림
4. markAsSubmitted API 호출 성공/실패
5. 엑셀/CSV 내보내기 데이터 정확성
6. POA 만료 시 체크박스 비활성화

**통합 테스트:**
```typescript
describe('DeadlineChecklist Integration', () => {
  it('should display cases grouped by deadline', async () => {
    render(<DeadlineChecklistPage />);
    await waitFor(() => {
      expect(screen.getByText('오늘 마감')).toBeInTheDocument();
    });
  });

  it('should mark case as filed when checkbox checked', async () => {
    render(<DeadlineChecklistPage />);
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText('수동 제출 완료 확인')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('제출 완료 확인'));

    await waitFor(() => {
      expect(mockMarkAsSubmitted).toHaveBeenCalled();
    });
  });
});
```

### Previous Story Intelligence

**Story 4-3에서 학습:**
- shadcn/ui Dialog/Collapsible 패턴
- React Query와 Zustand 조합
- 상태 아이콘 및 색상 코딩 패턴

**Story 3-4에서 학습:**
- `markAsSubmitted` API 구조
- TaxCase 상태 전이 패턴
- AuditLog 기록 패턴

**Epic 3 전체에서 학습:**
- Operator Helper 데이터 구조
- POA 검증 패턴
- 제출 준비 워크플로우

### Git Intelligence

**최근 커밋 패턴:**
- `d4a842e` - Epic 2 버그 수정
- `481c1d3` - Epic 2-4 완료
- `0409c74` - Epic 1 완료

**파일 패턴:**
- `apps/web/src/pages/` - 페이지 컴포넌트
- `apps/web/src/components/filing/` - Filing 도메인 컴포넌트
- `apps/api/src/submission-prep/` - 제출 준비 모듈

### References

- Epic 4: 일괄 제출 준비 및 체크리스트 [Source: epics.md#Epic 4]
- Story 4.4 AC: [Source: epics.md#Story 4.4: 마감일별 제출 체크리스트 생성]
- PRD FR-1.4: 일괄 제출 준비 [Source: prd.md#FR-1.4]
- Architecture: API Endpoints [Source: architecture.md#API Endpoints]
- Architecture: Database Schema [Source: architecture.md#Database Schema - submission_prep]
- Story 4-3: 일괄 준비 진행률 표시 [Source: 4-3-bulk-progress-display.md]
- Story 3-4: 수동 제출 완료 확인 [Source: epics.md#Story 3.4]

## Story Progress Notes

### Agent Model Used: `Claude Opus 4.5`

### Change Log

| Change | Date | Version | Description | Author |
| ------ | ---- | ------- | ----------- | ------ |
| Created | 2026-01-07 | 0.1.0 | Ultimate context engine analysis - 마감일별 제출 체크리스트 스토리 생성 | SM Agent |

### Completion Notes List

### File List
