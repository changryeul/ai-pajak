import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { CustomFileTypeValidator } from './validators/file-type.validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Request } from 'express';
import { extname } from 'path';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { MAX_FILE_SIZE } from './types/document.types';

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
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new CustomFileTypeValidator({
            fileTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.create(file, dto);
  }

  @Get(':id/status')
  async getDocumentStatus(@Param('id') id: string) {
    return this.documentService.getStatus(id);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    return this.documentService.findById(id);
  }
}
