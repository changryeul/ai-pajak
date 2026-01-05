import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { existsSync, mkdirSync } from 'fs';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { PrismaService } from '../repository/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ocr-processing',
    }),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, PrismaService],
  exports: [DocumentService],
})
export class DocumentModule implements OnModuleInit {
  private readonly logger = new Logger(DocumentModule.name);

  /**
   * Ensure uploads directory exists on module initialization
   * TODO: Epic 10 - Remove this when migrating to S3
   */
  onModuleInit() {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';

    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${uploadDir}`);
    } else {
      this.logger.log(`Uploads directory exists: ${uploadDir}`);
    }
  }
}
