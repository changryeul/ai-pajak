import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PaddleOcrClient } from './paddleocr.client';
import { GeminiClient } from './gemini.client';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { OcrProcessingProcessor } from './ocr-processing.processor';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [
    ConfigModule,
    RepositoryModule,
    BullModule.registerQueue({ name: 'ocr-processing' }),
  ],
  controllers: [OcrController],
  providers: [PaddleOcrClient, GeminiClient, OcrService, OcrProcessingProcessor],
  exports: [PaddleOcrClient, GeminiClient, OcrService],
})
export class OcrModule {}
