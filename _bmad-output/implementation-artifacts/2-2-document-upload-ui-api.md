# Story 2.2: 문서 업로드 UI 및 API

Status: done

## Story

As a **Tax Consultant**,
I want 드래그 앤 드롭으로 세금 문서를 업로드하도록,
So that 편리하게 문서를 제출할 수 있습니다.

## Acceptance Criteria

1. **Given** 로그인한 Tax Consultant가 문서 업로드 페이지에 있을 때
   **When** 파일을 드래그 앤 드롭하거나 파일 선택하면
   **Then** 업로드 진행률이 표시됩니다

2. **Given** 파일 선택 시
   **When** 지원 형식(PDF, JPG, PNG) 검증이 수행되면
   **Then** 유효한 파일만 업로드가 허용됩니다
   **And** 유효하지 않은 파일은 에러 메시지가 표시됩니다

3. **Given** 업로드가 완료될 때
   **When** 서버에 파일이 저장되면
   **Then** OCR 처리가 자동 시작됩니다
   **And** "OCR 처리 중..." 스피너가 표시됩니다

4. **Given** 파일 업로드 API가 호출될 때
   **When** 파일 크기가 10MB를 초과하면
   **Then** 적절한 에러(PayloadTooLargeException)가 반환됩니다

5. **Given** 문서 업로드 시
   **When** TaxCase와 연결될 때
   **Then** taxCaseId가 연결되어 저장됩니다
   **And** 고객 정보가 자동으로 연결됩니다

## Tasks / Subtasks

- [x] Task 1: API 문서 업로드 엔드포인트 구현 (AC: #1, #3, #4, #5)
  - [x] 1.1: DocumentModule 생성 (apps/api/src/document/)
  - [x] 1.2: document.controller.ts 생성 - POST /api/documents/upload
  - [x] 1.3: document.service.ts 생성 - 파일 저장 및 OCR 큐 연동
  - [x] 1.4: Multer 설정으로 파일 크기 제한 (10MB)
  - [x] 1.5: UploadDocumentDto 생성 (taxCaseId, file metadata)
  - [x] 1.6: 지원 MIME type 검증 로직 구현

- [x] Task 2: 파일 저장 및 OCR 큐 연동 (AC: #3)
  - [x] 2.1: 로컬 파일 저장 (uploads/ 디렉토리) - **TODO 주석 필수** (추후 S3 마이그레이션)
  - [x] 2.2: OCR 처리 큐에 작업 추가 (Bull Queue)
  - [x] 2.3: 문서 상태 관리 (PENDING → PROCESSING → COMPLETED)
  - [x] 2.4: Document 엔티티/테이블 생성 (Prisma migration)

- [x] Task 3: Frontend DocumentUpload 컴포넌트 구현 (AC: #1, #2)
  - [x] 3.1: components/ocr/DocumentUpload.tsx 생성
  - [x] 3.2: 드래그 앤 드롭 영역 구현 (react-dropzone 또는 native)
  - [x] 3.3: 파일 선택 버튼 구현
  - [x] 3.4: 파일 타입/크기 클라이언트 검증
  - [x] 3.5: 업로드 진행률 표시 (Progress 컴포넌트)

- [x] Task 4: OCR 상태 표시 UI (AC: #3)
  - [x] 4.1: components/ocr/UploadStatusCard.tsx 생성
  - [x] 4.2: "OCR 처리 중..." 스피너 표시
  - [x] 4.3: 처리 완료 시 결과 카드 표시
  - [x] 4.4: 에러 발생 시 에러 메시지 표시

- [x] Task 5: 문서 업로드 페이지 통합 (AC: #1-5)
  - [x] 5.1: pages/DocumentUpload.tsx 생성 또는 기존 페이지에 통합
  - [x] 5.2: TaxCase 선택 연동
  - [x] 5.3: 업로드 후 OCR 검토 페이지로 리다이렉트

- [x] Task 6: API 클라이언트 및 테스트 (AC: #1-5)
  - [x] 6.1: api/document.api.ts 생성
  - [x] 6.2: useDocumentUpload 커스텀 훅 생성
  - [x] 6.3: API 단위 테스트 (document.controller.spec.ts)
  - [x] 6.4: 프론트엔드 컴포넌트 테스트

## Dev Notes

### Architecture Compliance

**프로젝트 구조 - API:**
```
apps/api/src/document/
├── document.module.ts           # 모듈 정의
├── document.controller.ts       # HTTP 라우트 (업로드 엔드포인트)
├── document.service.ts          # 비즈니스 로직
├── dto/
│   ├── upload-document.dto.ts   # 요청 DTO
│   └── document-response.dto.ts # 응답 DTO
├── types/
│   └── document.types.ts        # TypeScript 인터페이스
└── exceptions/
    └── invalid-file.exception.ts
```

**프로젝트 구조 - Frontend:**
```
apps/web/src/
├── components/
│   └── ocr/
│       ├── DocumentUpload.tsx      # 드래그앤드롭 업로드
│       ├── UploadStatusCard.tsx    # 상태 표시 카드
│       └── UploadProgress.tsx      # 진행률 표시
├── api/
│   └── document.api.ts             # API 클라이언트
├── hooks/
│   └── useDocumentUpload.ts        # 커스텀 훅
└── pages/
    └── DocumentUploadPage.tsx      # 업로드 페이지
```

**아키텍처 문서 참조:**
- [Source: architecture.md#API & Communication Patterns]
- [Source: architecture.md#Project Structure & Boundaries]
- [Source: ux-design-specification.md#Component Architecture]

### Technical Requirements

**API 엔드포인트 스펙:**

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/documents/upload` | POST | 문서 업로드 | `multipart/form-data` | `DocumentResponse` |
| `/api/documents/:id/status` | GET | OCR 상태 조회 | - | `DocumentStatusResponse` |

**Request DTO:**
```typescript
// upload-document.dto.ts
import { IsOptional, IsNumberString } from 'class-validator';

export class UploadDocumentDto {
  @IsOptional()
  @IsNumberString()
  taxCaseId?: string;  // BigInt as string
}
```

**Response DTO:**
```typescript
// document-response.dto.ts
export class DocumentResponseDto {
  id: string;           // BigInt as string
  filename: string;
  mimeType: string;
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  taxCaseId?: string;
  ocrJobId?: string;    // OCR 큐 작업 ID
  createdAt: string;    // ISO 8601
}
```

**Prisma 스키마 확장:**
```prisma
model Document {
  id          BigInt   @id @default(autoincrement())
  filename    String
  originalName String
  mimeType    String
  size        Int
  // TODO: Epic 10에서 S3 마이그레이션 시 S3 URL로 변경
  path        String   // 현재: 로컬 파일 경로, 추후: S3 URL
  status      String   @default("PENDING")  // PENDING, PROCESSING, COMPLETED, FAILED
  ocrJobId    String?
  taxCaseId   BigInt?
  taxCase     TaxCase? @relation(fields: [taxCaseId], references: [id])
  uploadedBy  BigInt?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([taxCaseId])
  @@index([status])
}
```

### Library & Framework Requirements

**Backend 패키지 (기존 설치됨):**
- `@nestjs/common`, `@nestjs/config` - NestJS 기본
- `@nestjs/platform-express` - Multer 지원
- `multer` - 파일 업로드 처리
- `@nestjs/bull` - Bull Queue 연동

**Frontend 패키지:**
- `react-dropzone` - 드래그앤드롭 (권장) 또는 native HTML5 DnD
- `axios` - 파일 업로드 (progress tracking)

**환경 변수:**
```env
# 파일 업로드
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_MIME_TYPES=image/jpeg,image/png,application/pdf
```

### File Structure Notes

**신규 생성 파일 - API:**
- apps/api/src/document/document.module.ts
- apps/api/src/document/document.controller.ts
- apps/api/src/document/document.service.ts
- apps/api/src/document/dto/upload-document.dto.ts
- apps/api/src/document/dto/document-response.dto.ts
- apps/api/src/document/types/document.types.ts
- apps/api/src/document/exceptions/invalid-file.exception.ts

**신규 생성 파일 - Frontend:**
- apps/web/src/components/ocr/DocumentUpload.tsx
- apps/web/src/components/ocr/UploadStatusCard.tsx
- apps/web/src/components/ocr/UploadProgress.tsx
- apps/web/src/api/document.api.ts
- apps/web/src/hooks/useDocumentUpload.ts
- apps/web/src/pages/DocumentUploadPage.tsx

**수정 파일:**
- apps/api/src/app.module.ts (DocumentModule 추가)
- prisma/schema.prisma (Document 모델 추가)
- apps/api/.env.example (UPLOAD_DIR, MAX_FILE_SIZE 추가)

### S3 마이그레이션 TODO 주석 요구사항

**중요**: 로컬 파일 저장 관련 코드에는 반드시 TODO 주석을 남겨야 합니다.

```typescript
// TODO: Epic 10 (Production Deployment)에서 S3로 마이그레이션 예정
// - 현재: 로컬 uploads/ 디렉토리에 저장
// - 변경: AWS S3 버킷으로 업로드
// - 참조: architecture.md#Infrastructure & Deployment - S3 Storage
```

**TODO 주석이 필요한 위치:**
1. `document.controller.ts` - Multer diskStorage 설정 부분
2. `document.service.ts` - 파일 경로 저장 로직
3. Prisma schema - `path` 필드 주석

### Critical Implementation Patterns

**1. 파일 업로드 Controller 패턴:**
```typescript
// apps/api/src/document/document.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // TODO: Epic 10 (Production Deployment)에서 S3로 마이그레이션 예정
      // - 현재: 로컬 uploads/ 디렉토리에 저장
      // - 변경: AWS S3 버킷으로 업로드 (multer-s3 사용)
      // - 참조: architecture.md#Infrastructure & Deployment - S3 Storage
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|pdf)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.create(file, dto);
  }
}
```

**2. OCR 큐 연동 Service 패턴:**
```typescript
// apps/api/src/document/document.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../repository/prisma.service';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
  ) {}

  async create(file: Express.Multer.File, dto: UploadDocumentDto) {
    // 1. Document 레코드 생성
    const document = await this.prisma.document.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        status: 'PENDING',
        taxCaseId: dto.taxCaseId ? BigInt(dto.taxCaseId) : null,
      },
    });

    // 2. OCR 큐에 작업 추가
    const job = await this.ocrQueue.add('process', {
      documentId: document.id.toString(),
      filePath: file.path,
      mimeType: file.mimetype,
    });

    // 3. Document에 jobId 업데이트
    await this.prisma.document.update({
      where: { id: document.id },
      data: { ocrJobId: job.id.toString(), status: 'PROCESSING' },
    });

    this.logger.log(`Document uploaded: ${document.id}, OCR job: ${job.id}`);

    return {
      id: document.id.toString(),
      filename: document.filename,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: 'PROCESSING',
      ocrJobId: job.id.toString(),
      createdAt: document.createdAt.toISOString(),
    };
  }

  async getStatus(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: BigInt(id) },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      id: document.id.toString(),
      status: document.status,
      ocrJobId: document.ocrJobId,
    };
  }
}
```

**3. Frontend DocumentUpload 컴포넌트 패턴:**
```typescript
// apps/web/src/components/ocr/DocumentUpload.tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

interface DocumentUploadProps {
  taxCaseId?: string;
  onUploadComplete?: (documentId: string) => void;
}

export function DocumentUpload({ taxCaseId, onUploadComplete }: DocumentUploadProps) {
  const { upload, progress, isUploading, error } = useDocumentUpload();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      const result = await upload(file, taxCaseId);
      onUploadComplete?.(result.id);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  }, [upload, taxCaseId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            isUploading && 'pointer-events-none opacity-50',
          )}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="space-y-4">
              <FileText className="mx-auto h-12 w-12 text-primary animate-pulse" />
              <div className="space-y-2">
                <p className="text-sm font-medium">업로드 중...</p>
                <Progress value={progress} className="w-full max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground">{progress}%</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? '여기에 파일을 놓으세요' : '파일을 드래그하거나 클릭하여 선택'}
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF, JPG, PNG (최대 10MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {(error || fileRejections.length > 0) && (
          <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>
              {error || '지원하지 않는 파일 형식이거나 크기가 초과되었습니다.'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**4. API 클라이언트 패턴:**
```typescript
// apps/web/src/api/document.api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface UploadResponse {
  id: string;
  filename: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  ocrJobId?: string;
}

export async function uploadDocument(
  file: File,
  taxCaseId?: string,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (taxCaseId) {
    formData.append('taxCaseId', taxCaseId);
  }

  const response = await axios.post<UploadResponse>(
    `${API_BASE_URL}/documents/upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress?.(percent);
        }
      },
    },
  );

  return response.data;
}

export async function getDocumentStatus(id: string) {
  const response = await axios.get(`${API_BASE_URL}/documents/${id}/status`);
  return response.data;
}
```

**5. useDocumentUpload 훅 패턴:**
```typescript
// apps/web/src/hooks/useDocumentUpload.ts
import { useState, useCallback } from 'react';
import { uploadDocument, UploadResponse } from '@/api/document.api';

export function useDocumentUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, taxCaseId?: string): Promise<UploadResponse> => {
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await uploadDocument(file, taxCaseId, setProgress);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, progress, isUploading, error };
}
```

### Testing Requirements

**단위 테스트 (document.controller.spec.ts):**
```typescript
describe('DocumentController', () => {
  it('should successfully upload a valid PDF file', async () => {
    // Mock file upload with valid PDF
  });

  it('should reject files larger than 10MB', async () => {
    // Mock oversized file upload
  });

  it('should reject invalid file types', async () => {
    // Mock invalid file type (.exe, .txt, etc.)
  });

  it('should trigger OCR queue job after upload', async () => {
    // Verify OCR queue receives job
  });

  it('should associate document with taxCaseId if provided', async () => {
    // Verify taxCaseId linkage
  });
});
```

**프론트엔드 컴포넌트 테스트:**
```typescript
describe('DocumentUpload', () => {
  it('renders drag and drop area', () => {
    // Verify DnD area renders
  });

  it('shows progress during upload', () => {
    // Mock upload progress
  });

  it('displays error for invalid files', () => {
    // Mock file rejection
  });

  it('calls onUploadComplete after successful upload', () => {
    // Verify callback
  });
});
```

### Previous Story Learnings (Story 2-1)

**PaddleOCR 클라이언트 상세 (Story 2-1에서 구현됨):**
- Port: 8080
- Endpoints: `/ocr/process`, `/health`, `/info`
- 지원 파일 형식: image/jpeg, image/png, application/pdf
- 최대 파일 크기: 10MB
- 응답 포함: text, confidence, bbox, tables

**적용할 패턴:**
- PaddleOcrClient 사용하여 OCR 요청
- FormData로 multipart/form-data 전송
- 신뢰도 85% 미만 시 Gemini fallback 트리거 (Story 2-4에서 구현)
- 재시도 로직: 지수 백오프 (1s → 2s → 4s), 최대 3회

**OCR 큐 설정 (apps/api/src/queue/):**
- Bull Queue 'ocr-processing' 큐 사용
- Redis 연결 설정 완료
- 작업 실패 시 재시도 로직 구현됨

### Git Intelligence

**최근 커밋 패턴:**
- 0409c74: epic 1 finished
- 모듈 구조: module.ts, service.ts, controller.ts, dto/, types/
- 테스트 파일: *.spec.ts

**코드 컨벤션:**
- camelCase 함수/변수
- PascalCase 클래스/인터페이스
- kebab-case 파일명

### Architecture Document References

- [Source: architecture.md#API & Communication Patterns - /api/ocr/process]
- [Source: architecture.md#Project Structure & Boundaries - apps/api/src/]
- [Source: architecture.md#Queue System: Bull (Redis)]
- [Source: ux-design-specification.md#2.2 Folder Structure - components/ocr/]
- [Source: prd.md#FR-2: PaddleOCR 통합]
- [Source: epics.md#Story 2.2: 문서 업로드 UI 및 API]

### UX Design Reference

**드래그앤드롭 영역 스타일 (UX Spec 준수):**
- 기본 상태: `border-dashed border-muted-foreground/25`
- 드래그 중: `border-primary bg-primary/5`
- 업로드 중: 진행률 바 + 아이콘 애니메이션

**색상 체계:**
- Progress 바: `--primary` (Navy Blue)
- 에러 메시지: `--destructive` (Rose 500)
- 성공 표시: `--confidence-high` (Emerald 500)

### Security Considerations

1. **파일 타입 검증**: 서버측에서 MIME type 및 확장자 이중 검증
2. **파일 크기 제한**: 10MB 제한으로 DoS 공격 방지
3. **경로 조작 방지**: 저장 경로에 사용자 입력 포함 금지
4. **CSRF 보호**: 기존 NestJS CSRF 설정 활용

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **API Document Module 구현 완료**
   - DocumentController with POST /api/documents/upload, GET /api/documents/:id, GET /api/documents/:id/status
   - DocumentService with OCR queue integration (Bull Queue 'ocr-processing')
   - Multer file upload with 10MB limit and MIME type validation (PDF, JPG, PNG)
   - TODO comments added for S3 migration (Epic 10)

2. **Prisma Schema 확장**
   - Document 모델 추가 with status tracking (PENDING, PROCESSING, COMPLETED, FAILED)
   - TaxCase와의 관계 설정 완료
   - Migration 실행: 20260104085433_add_document_model

3. **Frontend Components 구현**
   - DocumentUpload.tsx: react-dropzone 기반 드래그 앤 드롭 업로드
   - UploadStatusCard.tsx: OCR 처리 상태 표시 with auto-polling
   - UploadProgress.tsx: 파일 업로드 진행률 표시
   - DocumentUploadPage.tsx: 통합 페이지 with taxCaseId query param 지원

4. **API Client 및 Hooks**
   - document.api.ts: axios 기반 API 클라이언트 with progress tracking
   - useDocumentUpload.ts: 상태 관리 커스텀 훅

5. **테스트 구현**
   - document.controller.spec.ts: 8개 테스트 (기본 CRUD + 에러 처리)
   - document.service.spec.ts: 6개 테스트 (서비스 레이어)
   - DocumentUpload.test.tsx: 9개 테스트 (컴포넌트 렌더링 + 콜백)
   - 전체 테스트 스위트 통과

6. **라우팅 통합**
   - /tax-cases/upload 및 /documents/upload 라우트 추가

### Senior Developer Review (AI)

**Review Date:** 2026-01-04
**Reviewer:** Claude Opus 4.5 (Code Review Agent)
**Outcome:** Changes Requested → Fixed

**Issues Found & Fixed:**

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| CR-1 | HIGH | 테스트 개수 허위 기재 (14개 → 8개) | ✅ Fixed |
| CR-2 | HIGH | AC #4 테스트 누락 (PayloadTooLarge) | ✅ Fixed |
| CR-3 | MEDIUM | 하드코딩된 User ID TODO 불명확 | ✅ Fixed |
| CR-4 | MEDIUM | 커스텀 Exception 미사용 | ✅ Fixed |
| CR-5 | MEDIUM | Frontend 테스트 품질 부족 | ✅ Fixed |
| CR-6 | MEDIUM | 존재하지 않는 라우트로 네비게이션 | ✅ Fixed |
| CR-7 | LOW | 중복 라우트 | ✅ Fixed |
| CR-8 | LOW | uploads 디렉토리 확인 없음 | ✅ Fixed |
| CR-9 | LOW | Queue 에러 핸들링 없음 | ✅ Fixed |

**Fixes Applied:**
1. Story completion notes 테스트 개수 정정
2. document.controller.spec.ts에 파일 검증 테스트 3개 추가
3. document.api.ts TODO 주석에 Epic 3 참조 추가
4. invalid-file.exception.ts에 validateFile 유틸리티 함수 추가
5. DocumentUpload.test.tsx 전면 개선 (AC별 테스트 그룹화)
6. App.tsx에 /documents/:id/review 라우트 추가
7. 중복 라우트 /tax-cases/upload 제거
8. DocumentModule에 uploads 디렉토리 자동 생성 로직 추가
9. DocumentService.create()에 queue 실패 에러 핸들링 추가

### Change Log

- 2026-01-04: Code Review 완료 - 9개 이슈 수정
- 2026-01-04: Story 2-2 구현 완료 - 문서 업로드 UI 및 API

### File List

**신규 생성 - API:**
- apps/api/src/document/document.module.ts
- apps/api/src/document/document.controller.ts
- apps/api/src/document/document.controller.spec.ts
- apps/api/src/document/document.service.ts
- apps/api/src/document/document.service.spec.ts
- apps/api/src/document/dto/upload-document.dto.ts
- apps/api/src/document/dto/document-response.dto.ts
- apps/api/src/document/dto/index.ts
- apps/api/src/document/types/document.types.ts
- apps/api/src/document/exceptions/invalid-file.exception.ts
- apps/api/src/document/exceptions/index.ts
- apps/api/src/document/index.ts
- apps/api/uploads/ (디렉토리)
- prisma/migrations/20260104085433_add_document_model/migration.sql

**신규 생성 - Frontend:**
- apps/web/src/api/document.api.ts
- apps/web/src/hooks/useDocumentUpload.ts
- apps/web/src/components/ocr/DocumentUpload.tsx
- apps/web/src/components/ocr/DocumentUpload.test.tsx
- apps/web/src/components/ocr/UploadStatusCard.tsx
- apps/web/src/components/ocr/UploadProgress.tsx
- apps/web/src/components/ocr/index.ts
- apps/web/src/pages/DocumentUploadPage.tsx

**수정:**
- apps/api/src/app.module.ts (DocumentModule import 추가)
- apps/api/.env.example (UPLOAD_DIR, MAX_FILE_SIZE, ALLOWED_MIME_TYPES 추가)
- prisma/schema.prisma (Document 모델 및 TaxCase 관계 추가)
- apps/web/src/App.tsx (DocumentUploadPage 라우트 추가)
- apps/web/package.json (react-dropzone 의존성 추가)
