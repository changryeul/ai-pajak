# Story 2.5: OCR 결과 검토 UI

Status: ready-for-dev

## Story

As a **Tax Consultant**,
I want OCR 결과를 원본 문서와 나란히 검토하도록,
So that 추출된 데이터의 정확성을 확인할 수 있습니다.

## Acceptance Criteria

1. **Given** OCR 처리가 완료된 문서가 있을 때
   **When** OCR 검토 페이지를 열면
   **Then** 왼쪽에 원본 문서 이미지가 표시됩니다 (PDF 뷰어 또는 이미지 뷰어)

2. **Given** OCR 검토 페이지가 열렸을 때
   **When** 추출된 데이터가 로드되면
   **Then** 오른쪽에 추출된 데이터 필드가 표시됩니다
   **And** 각 필드는 텍스트와 신뢰도 정보를 포함합니다

3. **Given** 추출된 데이터 필드가 표시될 때
   **When** 필드가 렌더링되면
   **Then** 각 필드 옆에 신뢰도 표시기가 있습니다
   **And** 90% 이상은 녹색으로 표시됩니다
   **And** 70-89%는 주황색으로 표시됩니다
   **And** 70% 미만은 빨간색으로 표시됩니다

4. **Given** 저신뢰도 필드(70% 미만)가 있을 때
   **When** 해당 필드가 표시되면
   **Then** 필드가 수정 가능하도록 강조 표시됩니다
   **And** 사용자가 텍스트를 수정할 수 있습니다

5. **Given** 사용자가 검토를 완료했을 때
   **When** "확인" 버튼을 클릭하면
   **Then** 수정된 데이터가 저장됩니다
   **And** 검토 완료 상태로 업데이트됩니다
   **And** 성공 Toast 알림이 표시됩니다

6. **Given** 테이블 데이터가 추출되었을 때
   **When** OCR 검토 페이지가 로드되면
   **Then** 테이블 형식의 데이터가 별도 테이블로 표시됩니다
   **And** 각 셀에 신뢰도 표시가 있습니다

## Tasks / Subtasks

- [ ] Task 1: Backend API - OCR 결과 조회 엔드포인트 (AC: #2, #6)
  - [ ] 1.1: `GET /api/documents/:id/ocr-result` 엔드포인트 추가 (OcrController)
  - [ ] 1.2: `getOcrResult(documentId)` 메서드 추가 (OcrService)
  - [ ] 1.3: OCR 결과 + 문서 정보 + 원본 파일 URL 반환
  - [ ] 1.4: `OcrResultResponseDto` DTO 정의

- [ ] Task 2: Backend API - OCR 결과 수정/확인 엔드포인트 (AC: #4, #5)
  - [ ] 2.1: `PATCH /api/documents/:id/ocr-result` 엔드포인트 추가
  - [ ] 2.2: `updateOcrResult(documentId, updates)` 메서드 추가
  - [ ] 2.3: `POST /api/documents/:id/ocr-confirm` 확인 완료 엔드포인트 추가
  - [ ] 2.4: Document 상태를 'REVIEWED'로 업데이트
  - [ ] 2.5: 수정 이력 기록 (누가, 언제, 어떤 필드를 수정했는지)

- [ ] Task 3: Frontend API 클라이언트 확장 (AC: #2, #4, #5)
  - [ ] 3.1: `getOcrResult(documentId)` 함수 추가 (`document.api.ts`)
  - [ ] 3.2: `updateOcrField(documentId, fieldIndex, newValue)` 함수 추가
  - [ ] 3.3: `confirmOcrReview(documentId)` 함수 추가
  - [ ] 3.4: `OcrResultResponse` 타입 정의

- [ ] Task 4: OCRConfidenceIndicator 컴포넌트 (AC: #3)
  - [ ] 4.1: `apps/web/src/components/ocr/OCRConfidenceIndicator.tsx` 생성
  - [ ] 4.2: 신뢰도 레벨별 색상 표시 (녹색/주황색/빨간색)
  - [ ] 4.3: 퍼센트 값 또는 아이콘 표시 옵션
  - [ ] 4.4: Tooltip으로 상세 신뢰도 표시

- [ ] Task 5: ExtractedDataField 컴포넌트 (AC: #2, #3, #4)
  - [ ] 5.1: `apps/web/src/components/ocr/ExtractedDataField.tsx` 생성
  - [ ] 5.2: 텍스트 + 신뢰도 표시기 결합
  - [ ] 5.3: 저신뢰도 필드 강조 스타일 (빨간색 테두리, 수정 아이콘)
  - [ ] 5.4: 인라인 편집 기능 (클릭 시 input으로 변환)
  - [ ] 5.5: 수정 확인/취소 버튼

- [ ] Task 6: ExtractedDataTable 컴포넌트 (AC: #6)
  - [ ] 6.1: `apps/web/src/components/ocr/ExtractedDataTable.tsx` 생성
  - [ ] 6.2: 테이블 형식 OCR 결과 렌더링
  - [ ] 6.3: 각 셀에 신뢰도 표시
  - [ ] 6.4: 셀 편집 기능

- [ ] Task 7: DocumentPreview 컴포넌트 (AC: #1)
  - [ ] 7.1: `apps/web/src/components/ocr/DocumentPreview.tsx` 생성
  - [ ] 7.2: PDF 뷰어 통합 (`@react-pdf-viewer/core`)
  - [ ] 7.3: 이미지 뷰어 (zoom, pan 기능)
  - [ ] 7.4: 페이지 네비게이션 (다중 페이지 문서)

- [ ] Task 8: OCRReviewPanel 컴포넌트 (AC: #1, #2, #5)
  - [ ] 8.1: `apps/web/src/components/ocr/OCRReviewPanel.tsx` 생성
  - [ ] 8.2: 2-column 레이아웃 (왼쪽: DocumentPreview, 오른쪽: ExtractedData)
  - [ ] 8.3: "확인" 버튼 및 검토 완료 처리
  - [ ] 8.4: 로딩 상태 및 에러 처리

- [ ] Task 9: useOcrResult 훅 (AC: #2, #4, #5)
  - [ ] 9.1: `apps/web/src/hooks/useOcrResult.ts` 생성
  - [ ] 9.2: React Query를 사용한 OCR 결과 페칭
  - [ ] 9.3: 필드 수정 mutation
  - [ ] 9.4: 검토 확인 mutation

- [ ] Task 10: OCRReview 페이지 (AC: #1-6)
  - [ ] 10.1: `apps/web/src/pages/OCRReview.tsx` 생성
  - [ ] 10.2: 라우트 등록 (`/documents/:id/ocr-review`)
  - [ ] 10.3: OCRReviewPanel 통합
  - [ ] 10.4: 완료 후 리다이렉트 처리

- [ ] Task 11: 컴포넌트 export 및 인덱스 업데이트 (AC: 전체)
  - [ ] 11.1: `apps/web/src/components/ocr/index.ts` 업데이트
  - [ ] 11.2: App.tsx 라우트 추가

- [ ] Task 12: 테스트 작성 (AC: 전체)
  - [ ] 12.1: OCRConfidenceIndicator 단위 테스트
  - [ ] 12.2: ExtractedDataField 단위 테스트
  - [ ] 12.3: OCRReviewPanel 통합 테스트
  - [ ] 12.4: Backend API 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - 신규/수정 파일:**
```
apps/api/src/
├── ocr/
│   ├── ocr.controller.ts           # 수정: getOcrResult, updateOcrResult, confirmOcrReview 추가
│   ├── ocr.service.ts              # 수정: getOcrResult, updateOcrResult, confirmOcrReview 추가
│   └── dto/
│       ├── ocr-result-response.dto.ts  # 신규
│       ├── update-ocr-result.dto.ts    # 신규
│       └── index.ts                    # 수정

apps/web/src/
├── api/
│   └── document.api.ts             # 수정: getOcrResult, updateOcrField, confirmOcrReview 추가
├── components/
│   └── ocr/
│       ├── OCRConfidenceIndicator.tsx   # 신규
│       ├── ExtractedDataField.tsx       # 신규
│       ├── ExtractedDataTable.tsx       # 신규
│       ├── DocumentPreview.tsx          # 신규
│       ├── OCRReviewPanel.tsx           # 신규
│       └── index.ts                     # 수정
├── hooks/
│   └── useOcrResult.ts             # 신규
├── pages/
│   └── OCRReview.tsx               # 신규
└── App.tsx                         # 수정: 라우트 추가
```

**아키텍처 문서 참조:**
- [Source: architecture.md#Frontend Architecture]
- [Source: architecture.md#Component Architecture: shadcn/ui + Domain Components]
- [Source: architecture.md#State Management: React Query + Zustand]
- [Source: ux-design-specification.md#OCR Confidence Indicator]

### Technical Requirements

**신뢰도 임계값 (UX 설계 기반):**
```typescript
const CONFIDENCE_THRESHOLDS = {
  HIGH: 90,    // 녹색 (정확함)
  MEDIUM: 70,  // 주황색 (검토 필요)
  LOW: 0,      // 빨간색 (수정 필요)
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return 'text-green-600';
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'text-orange-500';
  return 'text-red-600';
};
```

**Document 상태 확장:**
```typescript
// 기존: PENDING, PROCESSING, COMPLETED, FAILED
// 신규: REVIEWED (OCR 검토 완료)
type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVIEWED';
```

### Library & Framework Requirements

**신규 패키지 (Frontend):**
```bash
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout pdfjs-dist
```

**PDF 뷰어 설정:**
```typescript
// vite.config.ts에 pdfjs worker 설정 필요
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
```

**대안: react-pdf (더 가벼움):**
```bash
npm install react-pdf
```

### Critical Implementation Patterns

**1. OCRConfidenceIndicator 컴포넌트:**
```typescript
// apps/web/src/components/ocr/OCRConfidenceIndicator.tsx
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface OCRConfidenceIndicatorProps {
  confidence: number | null;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const THRESHOLDS = { HIGH: 90, MEDIUM: 70 };

export function OCRConfidenceIndicator({
  confidence,
  showPercentage = true,
  size = 'md',
  className,
}: OCRConfidenceIndicatorProps) {
  // Gemini fallback은 confidence가 null일 수 있음
  if (confidence === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className={cn('gap-1', className)}>
              AI 처리됨
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Gemini AI로 처리됨 (신뢰도 점수 없음)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getConfig = () => {
    if (confidence >= THRESHOLDS.HIGH) {
      return {
        color: 'text-green-600 bg-green-50 border-green-200',
        icon: CheckCircle2,
        label: '높음',
      };
    }
    if (confidence >= THRESHOLDS.MEDIUM) {
      return {
        color: 'text-orange-600 bg-orange-50 border-orange-200',
        icon: AlertCircle,
        label: '보통',
      };
    }
    return {
      color: 'text-red-600 bg-red-50 border-red-200',
      icon: XCircle,
      label: '낮음',
    };
  };

  const config = getConfig();
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded border', config.color, className)}>
            <Icon className={iconSize} />
            {showPercentage && <span className="text-xs font-medium">{confidence}%</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>신뢰도: {confidence}% ({config.label})</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**2. ExtractedDataField 컴포넌트:**
```typescript
// apps/web/src/components/ocr/ExtractedDataField.tsx
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OCRConfidenceIndicator } from './OCRConfidenceIndicator';
import { Pencil, Check, X } from 'lucide-react';

interface ExtractedDataFieldProps {
  text: string;
  confidence: number | null;
  index: number;
  isEditable?: boolean;
  onUpdate?: (index: number, newValue: string) => void;
  className?: string;
}

const LOW_CONFIDENCE_THRESHOLD = 70;

export function ExtractedDataField({
  text,
  confidence,
  index,
  isEditable = true,
  onUpdate,
  className,
}: ExtractedDataFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLowConfidence = confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue !== text) {
      onUpdate?.(index, editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md border',
        isLowConfidence && 'border-red-300 bg-red-50',
        !isLowConfidence && 'border-gray-200',
        className,
      )}
    >
      {isEditing ? (
        <>
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button size="sm" variant="ghost" onClick={handleSave}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 text-red-600" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{text}</span>
          <OCRConfidenceIndicator confidence={confidence} size="sm" />
          {isEditable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className={cn(isLowConfidence && 'text-red-600')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
```

**3. DocumentPreview 컴포넌트:**
```typescript
// apps/web/src/components/ocr/DocumentPreview.tsx
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface DocumentPreviewProps {
  fileUrl: string;
  mimeType: string;
  className?: string;
}

export function DocumentPreview({ fileUrl, mimeType, className }: DocumentPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);

  const isPdf = mimeType === 'application/pdf';

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 2));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          원본 문서
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">{Math.round(scale * 100)}%</span>
            <Button size="sm" variant="outline" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isPdf ? (
          <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess}>
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
        ) : (
          <img
            src={fileUrl}
            alt="Uploaded document"
            className="max-w-full"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
          />
        )}
      </CardContent>
      {isPdf && numPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-2 border-t">
          <Button size="sm" variant="outline" onClick={goToPrevPage} disabled={pageNumber <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {pageNumber} / {numPages}
          </span>
          <Button size="sm" variant="outline" onClick={goToNextPage} disabled={pageNumber >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
```

**4. OCRReviewPanel 컴포넌트:**
```typescript
// apps/web/src/components/ocr/OCRReviewPanel.tsx
import { useState } from 'react';
import { DocumentPreview } from './DocumentPreview';
import { ExtractedDataField } from './ExtractedDataField';
import { ExtractedDataTable } from './ExtractedDataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface OcrResult {
  text: string;
  confidence: number | null;
  bbox: number[][];
  page: number;
}

interface TableResult {
  page: number;
  cells: { row: number; col: number; text: string; confidence: number }[];
}

interface OCRReviewPanelProps {
  documentId: string;
  fileUrl: string;
  mimeType: string;
  results: OcrResult[];
  tables?: TableResult[];
  onConfirm: (updates: { index: number; newValue: string }[]) => Promise<void>;
  className?: string;
}

export function OCRReviewPanel({
  documentId,
  fileUrl,
  mimeType,
  results,
  tables,
  onConfirm,
  className,
}: OCRReviewPanelProps) {
  const [updates, setUpdates] = useState<Map<number, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFieldUpdate = (index: number, newValue: string) => {
    setUpdates((prev) => new Map(prev).set(index, newValue));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const updateArray = Array.from(updates.entries()).map(([index, newValue]) => ({
        index,
        newValue,
      }));
      await onConfirm(updateArray);
      toast({
        title: '검토 완료',
        description: 'OCR 결과 검토가 완료되었습니다.',
      });
    } catch (error) {
      toast({
        title: '오류 발생',
        description: '검토 완료 처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const modifiedCount = updates.size;

  return (
    <div className={cn('grid grid-cols-2 gap-4 h-[calc(100vh-200px)]', className)}>
      {/* 왼쪽: 원본 문서 */}
      <DocumentPreview fileUrl={fileUrl} mimeType={mimeType} />

      {/* 오른쪽: 추출된 데이터 */}
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">추출된 데이터</CardTitle>
          <p className="text-sm text-muted-foreground">
            총 {results.length}개 필드 {modifiedCount > 0 && `(${modifiedCount}개 수정됨)`}
          </p>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-2">
          {/* 텍스트 필드 */}
          {results.map((result, index) => (
            <ExtractedDataField
              key={index}
              text={updates.get(index) ?? result.text}
              confidence={result.confidence}
              index={index}
              onUpdate={handleFieldUpdate}
            />
          ))}

          {/* 테이블 데이터 */}
          {tables && tables.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">테이블 데이터</h4>
              {tables.map((table, tableIndex) => (
                <ExtractedDataTable key={tableIndex} table={table} />
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                검토 완료
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
```

**5. useOcrResult 훅:**
```typescript
// apps/web/src/hooks/useOcrResult.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOcrResult, updateOcrField, confirmOcrReview, OcrResultResponse } from '@/api/document.api';

export function useOcrResult(documentId: string) {
  const queryClient = useQueryClient();

  const {
    data: ocrResult,
    isLoading,
    error,
  } = useQuery<OcrResultResponse>({
    queryKey: ['ocr-result', documentId],
    queryFn: () => getOcrResult(documentId),
    enabled: !!documentId,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      fieldIndex,
      newValue,
    }: {
      fieldIndex: number;
      newValue: string;
    }) => updateOcrField(documentId, fieldIndex, newValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-result', documentId] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (updates: { index: number; newValue: string }[]) =>
      confirmOcrReview(documentId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-result', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
    },
  });

  return {
    ocrResult,
    isLoading,
    error,
    updateField: updateMutation.mutate,
    confirmReview: confirmMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isConfirming: confirmMutation.isPending,
  };
}
```

**6. Backend API - OcrController 확장:**
```typescript
// apps/api/src/ocr/ocr.controller.ts (추가)

@Get('documents/:id/result')
@ApiOperation({ summary: 'Get OCR result for a document' })
@ApiParam({ name: 'id', description: 'Document ID' })
@ApiResponse({ status: 200, type: OcrResultResponseDto })
async getOcrResult(@Param('id') documentId: string): Promise<OcrResultResponseDto> {
  return this.ocrService.getOcrResult(documentId);
}

@Patch('documents/:id/result')
@ApiOperation({ summary: 'Update OCR result field' })
async updateOcrResult(
  @Param('id') documentId: string,
  @Body() updateDto: UpdateOcrResultDto,
): Promise<void> {
  await this.ocrService.updateOcrResult(documentId, updateDto);
}

@Post('documents/:id/confirm')
@ApiOperation({ summary: 'Confirm OCR review completion' })
async confirmOcrReview(
  @Param('id') documentId: string,
  @Body() confirmDto: ConfirmOcrReviewDto,
): Promise<void> {
  await this.ocrService.confirmOcrReview(documentId, confirmDto);
}
```

**7. Backend DTO 정의:**
```typescript
// apps/api/src/ocr/dto/ocr-result-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class OcrResultDto {
  @ApiProperty()
  text: string;

  @ApiProperty({ nullable: true })
  confidence: number | null;

  @ApiProperty()
  bbox: number[][];

  @ApiProperty()
  page: number;
}

export class TableCellDto {
  @ApiProperty()
  row: number;

  @ApiProperty()
  col: number;

  @ApiProperty()
  text: string;

  @ApiProperty()
  confidence: number;
}

export class TableResultDto {
  @ApiProperty()
  page: number;

  @ApiProperty({ type: [TableCellDto] })
  cells: TableCellDto[];
}

export class OcrResultResponseDto {
  @ApiProperty()
  documentId: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: [OcrResultDto] })
  results: OcrResultDto[];

  @ApiProperty({ type: [TableResultDto], nullable: true })
  tables?: TableResultDto[];

  @ApiProperty()
  engine: string;

  @ApiProperty()
  fallbackUsed: boolean;

  @ApiProperty({ nullable: true })
  originalConfidence?: number;

  @ApiProperty()
  processingTimeMs: number;
}

// apps/api/src/ocr/dto/update-ocr-result.dto.ts
export class UpdateOcrResultDto {
  @ApiProperty()
  fieldIndex: number;

  @ApiProperty()
  newValue: string;
}

// apps/api/src/ocr/dto/confirm-ocr-review.dto.ts
export class ConfirmOcrReviewDto {
  @ApiProperty({ type: [UpdateOcrResultDto] })
  updates: UpdateOcrResultDto[];
}
```

### File Structure Notes

**신규 생성 파일:**
- `apps/web/src/components/ocr/OCRConfidenceIndicator.tsx`
- `apps/web/src/components/ocr/ExtractedDataField.tsx`
- `apps/web/src/components/ocr/ExtractedDataTable.tsx`
- `apps/web/src/components/ocr/DocumentPreview.tsx`
- `apps/web/src/components/ocr/OCRReviewPanel.tsx`
- `apps/web/src/hooks/useOcrResult.ts`
- `apps/web/src/pages/OCRReview.tsx`
- `apps/api/src/ocr/dto/ocr-result-response.dto.ts`
- `apps/api/src/ocr/dto/update-ocr-result.dto.ts`
- `apps/api/src/ocr/dto/confirm-ocr-review.dto.ts`

**수정 파일:**
- `apps/web/src/api/document.api.ts` (API 함수 추가)
- `apps/web/src/components/ocr/index.ts` (export 추가)
- `apps/web/src/App.tsx` (라우트 추가)
- `apps/api/src/ocr/ocr.controller.ts` (엔드포인트 추가)
- `apps/api/src/ocr/ocr.service.ts` (메서드 추가)
- `apps/api/src/ocr/dto/index.ts` (DTO export)

### Testing Requirements

**단위 테스트:**
```typescript
// OCRConfidenceIndicator.test.tsx
describe('OCRConfidenceIndicator', () => {
  it('should show green for confidence >= 90%', () => {});
  it('should show orange for confidence 70-89%', () => {});
  it('should show red for confidence < 70%', () => {});
  it('should show "AI 처리됨" when confidence is null (Gemini)', () => {});
});

// ExtractedDataField.test.tsx
describe('ExtractedDataField', () => {
  it('should highlight low confidence fields with red border', () => {});
  it('should allow editing when edit button clicked', () => {});
  it('should save changes on Enter key', () => {});
  it('should cancel changes on Escape key', () => {});
});
```

### Previous Story Learnings (Stories 2-1 to 2-4)

**Story 2-1/2-2 - 컴포넌트 패턴:**
- 기존 OCR 컴포넌트: DocumentUpload, UploadStatusCard, UploadProgress
- Polling 패턴: UploadStatusCard의 상태 폴링 참조
- API 클라이언트 패턴: document.api.ts 스타일 유지

**Story 2-3 - 서비스 패턴:**
- OcrService의 saveOcrResult 패턴
- AIResult 테이블에 OCR 결과 저장
- calculateAverageConfidence 재사용 가능

**Story 2-4 - Fallback 패턴:**
- confidence가 null일 수 있음 (Gemini)
- fallbackUsed 플래그 확인
- originalPaddleConfidence 로깅

### Git Intelligence

**최근 커밋 패턴:**
- 0409c74: epic 1 finished
- 모듈 구조 유지: component 폴더 내 관련 파일 그룹화
- 테스트 파일: *.test.tsx (Vitest)

**코드 컨벤션:**
- camelCase 함수/변수
- PascalCase 컴포넌트
- kebab-case 파일명 (API, hooks)

### Architecture Document References

- [Source: architecture.md#Frontend Architecture]
- [Source: architecture.md#Component Architecture: shadcn/ui + Domain Components]
- [Source: architecture.md#State Management: React Query + Zustand]
- [Source: ux-design-specification.md#OCR Confidence Indicator (90%+ 녹색, 70-89% 주황색, <70% 빨간색)]
- [Source: epics.md#Story 2.5: OCR 결과 검토 UI]

### Performance Considerations

**PDF 렌더링 최적화:**
- 페이지별 렌더링 (lazy loading)
- 워커 스레드 사용 (pdfjs-dist worker)
- 이미지 캐싱

**대용량 OCR 결과:**
- 가상화 고려 (react-virtualized) - 필드가 100개 이상일 경우
- 페이지네이션 - 다중 페이지 문서

### Security Considerations

1. **파일 접근**: fileUrl은 서명된 S3 URL 또는 인증된 API 엔드포인트
2. **XSS 방지**: 추출된 텍스트 렌더링 시 React의 기본 이스케이프 사용
3. **입력 검증**: 수정된 텍스트 길이 제한, 악성 스크립트 필터링

### Known Limitations

| 한계점 | 영향 | 대응 방안 |
|--------|------|----------|
| PDF 렌더링 성능 | 대용량 PDF 느림 | 페이지별 렌더링, 로딩 표시 |
| Bounding Box | Gemini는 bbox 미제공 | 필드 하이라이트 비활성화 |
| 테이블 복잡 구조 | 병합 셀 표현 어려움 | 기본 그리드로 표현 |

### Edge Cases

1. **OCR 결과 없음**: COMPLETED 상태이나 results가 빈 배열
2. **문서 로드 실패**: 네트워크 오류, 만료된 URL
3. **동시 편집**: 다른 사용자가 동시에 수정 (낙관적 업데이트 + 충돌 감지)
4. **대용량 문서**: 100페이지 이상 PDF, 1000개 이상 필드

### Dependencies on Previous Stories

| 스토리 | 의존성 |
|--------|--------|
| 2-1 | PaddleOcrClient, OCR 결과 구조 |
| 2-2 | DocumentUpload, document.api.ts |
| 2-3 | OcrService.saveOcrResult, AIResult 모델 |
| 2-4 | GeminiClient, fallback 결과 구조, confidence null 처리 |

### Implementation Priority

**P0 (MVP):**
1. OCRConfidenceIndicator
2. ExtractedDataField
3. DocumentPreview (이미지만)
4. OCRReviewPanel (기본)
5. Backend API

**P1 (필수 개선):**
1. PDF 뷰어 통합
2. 테이블 데이터 표시
3. 수정 이력 저장

**P2 (향후):**
1. Bounding Box 하이라이트
2. 가상화 스크롤
3. 협업 편집

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

