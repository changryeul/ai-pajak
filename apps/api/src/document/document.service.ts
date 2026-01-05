import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../repository/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentResponseDto, DocumentStatusResponseDto } from './dto/document-response.dto';
import { OcrQueueJobData } from './types/document.types';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
  ) {}

  /**
   * Create a new document record and queue OCR processing
   * @param file - Uploaded file from Multer
   * @param dto - Upload document DTO with optional taxCaseId
   * @returns Document response with OCR job ID
   */
  async create(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
  ): Promise<DocumentResponseDto> {
    // TODO: Epic 10 (Production Deployment)에서 S3로 마이그레이션 예정
    // - 현재: 로컬 uploads/ 디렉토리에 저장 (file.path)
    // - 변경: AWS S3 버킷으로 업로드
    // - 참조: architecture.md#Infrastructure & Deployment - S3 Storage

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
    const jobData: OcrQueueJobData = {
      documentId: document.id.toString(),
      filePath: file.path,
      mimeType: file.mimetype,
    };

    let job;
    try {
      job = await this.ocrQueue.add('process', jobData);
    } catch (queueError) {
      // Queue 추가 실패 시 문서 상태를 FAILED로 업데이트
      this.logger.error(`Failed to add OCR job for document ${document.id}:`, queueError);

      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: 'FAILED' },
      });

      throw new InternalServerErrorException(
        'Failed to queue document for OCR processing. Please try again.',
      );
    }

    // 3. Document에 jobId 업데이트 및 상태 변경
    await this.prisma.document.update({
      where: { id: document.id },
      data: {
        ocrJobId: job.id.toString(),
        status: 'PROCESSING',
      },
    });

    this.logger.log(`Document uploaded: ${document.id}, OCR job: ${job.id}`);

    return {
      id: document.id.toString(),
      filename: document.filename,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: 'PROCESSING',
      taxCaseId: dto.taxCaseId || undefined,
      ocrJobId: job.id.toString(),
      createdAt: document.createdAt.toISOString(),
    };
  }

  /**
   * Get document status by ID
   * @param id - Document ID as string
   * @returns Document status response
   */
  async getStatus(id: string): Promise<DocumentStatusResponseDto> {
    const document = await this.prisma.document.findUnique({
      where: { id: BigInt(id) },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      id: document.id.toString(),
      status: document.status as DocumentStatusResponseDto['status'],
      ocrJobId: document.ocrJobId || undefined,
    };
  }

  /**
   * Get document by ID with full details
   * @param id - Document ID as string
   * @returns Full document response
   */
  async findById(id: string): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findUnique({
      where: { id: BigInt(id) },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return {
      id: document.id.toString(),
      filename: document.filename,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: document.status as DocumentResponseDto['status'],
      taxCaseId: document.taxCaseId?.toString() || undefined,
      ocrJobId: document.ocrJobId || undefined,
      createdAt: document.createdAt.toISOString(),
    };
  }
}
